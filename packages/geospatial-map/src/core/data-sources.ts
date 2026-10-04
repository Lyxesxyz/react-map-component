// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { Feature, FeatureCollection } from 'geojson'
import type { DataFormat, GeoJsonLoaderOptions, JsonValue } from '../types'
import { warnOnce } from '../utils'
import { arcgisItem } from './arcgis'
import { arcgisErrorOf, fetchText, parseJson } from './http'

// Turns the data teams actually have into GeoJSON: GeoJSON files, ArcGIS feature layers (with
// paging past the service's record limit), CSV files, and JSON lists of rows with coordinates.

const ARCGIS_LAYER = /\/(FeatureServer|MapServer)\/\d+\/?(\/query\/?)?$/i
const LONGITUDE_COLUMNS = ['longitude', 'lon', 'lng', 'long', 'x']
const LATITUDE_COLUMNS = ['latitude', 'lat', 'y']
/** ArcGIS layers are read in pages; this caps one layer at a size the browser can still draw. */
const MAX_ARCGIS_FEATURES = 200_000

type Row = Record<string, unknown>

/** The format a URL is likely in, from its shape alone. */
export function detectFormat(url: string): DataFormat | undefined {
  const path = url.replace(/[?#].*$/, '')
  if (ARCGIS_LAYER.test(path)) return 'arcgis'
  if (/\.csv$/i.test(path)) return 'csv'
  if (/\.(geo)?json$/i.test(path)) return 'geojson'
  return undefined
}

function request(url: string, { signal, prefetch, init }: GeoJsonLoaderOptions) {
  return fetchText(url, {
    ...init,
    ...(signal ? { signal } : {}),
    ...(prefetch ? { cache: 'force-cache' as const } : {}),
  })
}

/** Parses CSV (quoted fields, escaped quotes, CRLF; comma, semicolon or tab delimited). */
export function parseCsv(text: string): Row[] {
  const source = text.replace(/^\uFEFF/, '')
  const firstLine = source.slice(0, source.search(/\r?\n/) >>> 0)
  const delimiter = [',', ';', '\t'].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  )
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index++
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else field += char
  }
  if (field || record.length) {
    record.push(field)
    records.push(record)
  }
  const [header, ...body] = records.filter((item) => item.some((value) => value.trim() !== ''))
  if (!header) return []
  const columns = header.map((name) => name.trim())
  return body.map((values) =>
    Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ''])),
  )
}

/** Numbers stay numbers; numeric-looking codes with leading zeros ("004") stay text. */
function coerce(value: unknown): JsonValue {
  if (typeof value !== 'string') return (value ?? null) as JsonValue
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return Number(trimmed)
  return value
}

function findColumn(
  columns: string[],
  explicit: string | undefined,
  candidates: string[],
): string | undefined {
  const lower = (name: string) => name.trim().toLowerCase()
  if (explicit) return columns.find((column) => lower(column) === lower(explicit))
  return columns.find((column) => candidates.includes(lower(column)))
}

/** Points from rows with longitude and latitude columns. */
export function rowsToFeatureCollection(
  rows: Row[],
  options: Pick<GeoJsonLoaderOptions, 'longitude' | 'latitude'>,
  source: string,
): FeatureCollection {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const longitude = findColumn(columns, options.longitude, LONGITUDE_COLUMNS)
  const latitude = findColumn(columns, options.latitude, LATITUDE_COLUMNS)
  if (!longitude || !latitude)
    throw new Error(
      `${source} has no ${!longitude ? 'longitude' : 'latitude'} column. Columns: ` +
        `${columns.slice(0, 30).join(', ') || '(none)'}. Set data.longitude and data.latitude ` +
        'to the column names.',
    )
  let skipped = 0
  const features: Feature[] = []
  const number = (value: unknown) =>
    value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value)
  for (const row of rows) {
    const x = number(row[longitude])
    const y = number(row[latitude])
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(y) > 90 || Math.abs(x) > 360) {
      skipped++
      continue
    }
    features.push({
      type: 'Feature',
      properties: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, coerce(value)]),
      ),
      geometry: { type: 'Point', coordinates: [x, y] },
    })
  }
  if (skipped)
    warnOnce(
      `rows-skipped:${source}`,
      `${skipped} of ${rows.length} rows in ${source} have no valid ${longitude}/${latitude} and were left out.`,
    )
  return { type: 'FeatureCollection', features }
}

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])

/** GeoJSON from parsed JSON: a FeatureCollection, a Feature or geometry, or a list of rows. */
export function toFeatureCollection(
  json: unknown,
  options: Pick<GeoJsonLoaderOptions, 'longitude' | 'latitude'>,
  source: string,
): FeatureCollection {
  const value = json as { type?: string; features?: unknown } | null
  if (value?.type === 'FeatureCollection' && Array.isArray(value.features))
    return value as FeatureCollection
  if (value?.type === 'Feature') return { type: 'FeatureCollection', features: [value as Feature] }
  if (value?.type && GEOMETRY_TYPES.has(value.type))
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: value as Feature['geometry'] }],
    }
  if (Array.isArray(json)) return rowsToFeatureCollection(json as Row[], options, source)
  for (const key of ['data', 'items', 'results', 'rows', 'records']) {
    const rows = (json as Record<string, unknown> | null)?.[key]
    if (Array.isArray(rows)) return rowsToFeatureCollection(rows as Row[], options, source)
  }
  throw new Error(`${source} is JSON, but neither GeoJSON nor a list of rows with coordinates.`)
}

async function arcgisJson(url: string, options: GeoJsonLoaderOptions): Promise<unknown> {
  const json = parseJson((await request(url, options)).text, url)
  const failure = arcgisErrorOf(json, url)
  if (failure) throw failure
  return json
}

/**
 * Every feature of an ArcGIS feature layer, as GeoJSON in longitude/latitude. Services return at
 * most `maxRecordCount` features per request, so the layer is read page by page. A `/query?…`
 * URL keeps its parameters (for example `where`).
 */
export async function loadArcgisFeatures(
  url: string,
  options: GeoJsonLoaderOptions = {},
): Promise<FeatureCollection> {
  const queryAt = url.search(/\/query\/?(\?|$)/i)
  const layerUrl = (queryAt >= 0 ? url.slice(0, queryAt) : url.replace(/[?#].*$/, '')).replace(
    /\/+$/,
    '',
  )
  const given = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')
  const layer = (await arcgisJson(`${layerUrl}?f=json`, options)) as {
    name?: string
    maxRecordCount?: number
    advancedQueryCapabilities?: { supportsPagination?: boolean }
  }
  const pageSize = Math.max(1, layer.maxRecordCount ?? 1000)
  const paging = layer.advancedQueryCapabilities?.supportsPagination !== false
  const features: Feature[] = []
  for (let offset = 0; offset < MAX_ARCGIS_FEATURES; offset += pageSize) {
    const params = new URLSearchParams({ where: '1=1', outFields: '*', returnGeometry: 'true' })
    for (const [key, value] of given) params.set(key, value)
    params.set('f', 'geojson')
    params.set('outSR', '4326')
    if (paging) {
      params.set('resultOffset', String(offset))
      params.set('resultRecordCount', String(pageSize))
    }
    const page = (await arcgisJson(`${layerUrl}/query?${params}`, options)) as {
      features?: Feature[]
      exceededTransferLimit?: boolean
      properties?: { exceededTransferLimit?: boolean }
    }
    const batch = page.features ?? []
    features.push(...batch)
    const more = page.exceededTransferLimit ?? page.properties?.exceededTransferLimit ?? false
    if (!paging) {
      if (more)
        warnOnce(
          `arcgis-limit:${layerUrl}`,
          `${layer.name ?? layerUrl} returned only its first ${batch.length} features: the ` +
            'service does not support paging. Filter it with a /query?where=… URL.',
        )
      break
    }
    if (!batch.length || (!more && batch.length < pageSize)) break
  }
  if (features.length >= MAX_ARCGIS_FEATURES)
    warnOnce(
      `arcgis-cap:${layerUrl}`,
      `${layer.name ?? layerUrl} has more than ${MAX_ARCGIS_FEATURES} features; only the first ` +
        `${MAX_ARCGIS_FEATURES} are shown. Publish it as vector tiles for layers this large.`,
    )
  return { type: 'FeatureCollection', features }
}

/** Where an ArcGIS Online item's data lives, and in which format. */
async function arcgisItemData(
  item: { portal: string; id: string },
  options: GeoJsonLoaderOptions,
): Promise<{ url: string; format: DataFormat }> {
  const itemUrl = `${item.portal}/sharing/rest/content/items/${item.id}`
  const meta = (await arcgisJson(`${itemUrl}?f=json`, options)) as { type?: string; url?: string }
  if ((meta.type === 'Feature Service' || meta.type === 'Map Service') && meta.url)
    return {
      url: /\/\d+\/?$/.test(meta.url) ? meta.url : `${meta.url.replace(/\/+$/, '')}/0`,
      format: 'arcgis',
    }
  if (meta.type === 'GeoJson') return { url: `${itemUrl}/data`, format: 'geojson' }
  if (meta.type === 'CSV') return { url: `${itemUrl}/data`, format: 'csv' }
  throw new Error(
    `ArcGIS item ${item.id} is a "${meta.type ?? 'unknown'}" item. Use a feature layer, ` +
      'GeoJSON or CSV item, or the layer URL (…/FeatureServer/0).',
  )
}

/**
 * The default data loader. Reads GeoJSON, ArcGIS feature layers (`…/FeatureServer/0`, item
 * pages), CSV, and JSON rows with coordinates. Wrap it in your own `loadGeoJson` to add headers
 * or tokens and keep the format handling.
 */
export async function fetchGeoJson(
  url: string,
  options: GeoJsonLoaderOptions = {},
): Promise<FeatureCollection> {
  const item = options.format ? undefined : arcgisItem(url)
  if (item) {
    const located = await arcgisItemData(item, options)
    return fetchGeoJson(located.url, { ...options, format: located.format })
  }
  const format = options.format ?? detectFormat(url)
  if (format === 'arcgis') return loadArcgisFeatures(url, options)
  const { text, contentType } = await request(url, options)
  if (format === 'csv' || (!format && /\bcsv\b/i.test(contentType)))
    return rowsToFeatureCollection(parseCsv(text), options, url)
  return toFeatureCollection(parseJson(text, url), options, url)
}
