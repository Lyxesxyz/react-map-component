// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import proj4 from 'proj4'
import { warnOnce } from '../utils'
import { mapError } from './errors'
import { arcgisItem, fetchJson, memoizeAsync, SERVICE_TIMEOUT_MS, withTimeout } from './http'
import { EQUAL_EARTH_EXTENT, equalEarth, MERCATOR_EXTENT } from './projections'
import type {
  ArcGISVectorTileLayerConfig,
  AttributionSpec,
  BasemapConfig,
  BasemapLayerConfig,
  MapConfig,
  MapError,
  MapLayerConfig,
  ProjectionDefinition,
  VectorTileLayerConfig,
} from '../types'

// Turns `arcgis-vector-tiles` layers (configured with only a URL) into ordinary `mvt` layers by
// reading the ArcGIS service: projection, tile grid, default style, and attribution.

type SpatialReference = { wkid?: number; latestWkid?: number; wkt?: string }

/** The parts of a `VectorTileServer?f=json` response the map uses. */
export type VectorTileServiceInfo = {
  name?: string
  copyrightText?: string
  spatialReference?: SpatialReference
  tileInfo?: {
    rows?: number
    origin?: { x: number; y: number }
    spatialReference?: SpatialReference
    lods?: Array<{ level: number; resolution: number }>
  }
  tiles?: string[]
  defaultStyles?: string
  error?: { code?: number; message?: string; details?: string[] }
}

export type ArcGISService = {
  serviceUrl: string
  styleUrl: string
  info: VectorTileServiceInfo
}

// Equal Earth variants. 54035 is Esri's code for the Greenwich-centred one (same as EPSG:8857).
const MERCATOR_WKIDS = new Set([3857, 102100, 102113, 900913])
const EQUAL_EARTH_CENTRAL_MERIDIANS: Record<number, number> = { 8858: -90, 8859: 150 }

const trimUrl = (url: string) => url.replace(/[?#].*$/, '').replace(/\/+$/, '')

/** A service description, given up on after `SERVICE_TIMEOUT_MS`. */
const fetchDescription = (url: string) => fetchJson(url, withTimeout(SERVICE_TIMEOUT_MS))

async function locateService(input: string): Promise<{ serviceUrl: string; styleUrl?: string }> {
  const item = arcgisItem(input)
  if (!item) {
    const serviceUrl = trimUrl(input)
    if (!/\/VectorTileServer$/i.test(serviceUrl))
      throw new Error(
        `${input} is not an ArcGIS vector tile service. Use a URL ending in /VectorTileServer, ` +
          'an ArcGIS Online item page (…/home/item.html?id=…), or the item id.',
      )
    return { serviceUrl }
  }
  const itemUrl = `${item.portal}/sharing/rest/content/items/${item.id}`
  const meta = (await fetchDescription(`${itemUrl}?f=json`)) as { type?: string; url?: string }
  if (meta.type === 'Vector Tile Service' && meta.url) return { serviceUrl: trimUrl(meta.url) }
  if (meta.type === 'Vector Tile Style') {
    const styleUrl = `${itemUrl}/resources/styles/root.json`
    const style = (await fetchDescription(styleUrl)) as {
      sources?: Record<string, { type?: string; url?: string }>
    }
    const source = Object.values(style.sources ?? {}).find(
      (item) => item.type === 'vector' && item.url,
    )
    if (!source?.url)
      throw new Error(`The style of ArcGIS item ${item.id} has no vector tile source`)
    return { serviceUrl: trimUrl(new URL(source.url, styleUrl).href), styleUrl }
  }
  throw new Error(
    `ArcGIS item ${item.id} is a "${meta.type ?? 'unknown'}" item. ` +
      'Use a Vector Tile Service or Vector Tile Style item.',
  )
}

const loaded = new Map<string, ArcGISService>()

/** A service already read in this page, or `undefined`. */
export function cachedArcgisService(url: string): ArcGISService | undefined {
  return loaded.get(url)
}

/** Reads an ArcGIS vector tile service once per page (shared by every map; a failure is retried). */
export const loadArcgisService = memoizeAsync(async (url: string): Promise<ArcGISService> => {
  const { serviceUrl, styleUrl } = await locateService(url)
  const info = (await fetchDescription(`${serviceUrl}?f=json`)) as VectorTileServiceInfo
  if (!info.tileInfo?.lods?.length || !info.tileInfo.origin)
    throw new Error(`${serviceUrl} did not describe a tile grid; is it a VectorTileServer?`)
  const service: ArcGISService = {
    serviceUrl,
    styleUrl: styleUrl ?? `${serviceUrl}/${info.defaultStyles ?? 'resources/styles'}/root.json`,
    info,
  }
  loaded.set(url, service)
  return service
})

function hash(text: string): string {
  let value = 5381
  for (let index = 0; index < text.length; index++)
    value = ((value << 5) + value + text.charCodeAt(index)) | 0
  return (value >>> 0).toString(36)
}

/** Projected bounds of the whole world, found by sampling the projection. */
function estimateExtents(definition: string): Pick<ProjectionDefinition, 'extent' | 'worldExtent'> {
  const forward = proj4(definition)
  const meridian = ((proj4.Proj(definition) as { long0?: number }).long0 ?? 0) * (180 / Math.PI)
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
  // Sample from seam to seam around the central meridian, including the edges themselves.
  const offsets = [
    -179.999999,
    ...Array.from({ length: 179 }, (_, index) => -178 + index * 2),
    179.999999,
  ]
  for (const offset of offsets)
    for (let lat = -90; lat <= 90; lat += 2) {
      const [x, y] = forward.forward([meridian + offset, lat])
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      minX = Math.min(minX, x!)
      maxX = Math.max(maxX, x!)
      minY = Math.min(minY, y!)
      maxY = Math.max(maxY, y!)
    }
  return {
    extent: [minX, minY, maxX, maxY],
    worldExtent: [meridian - 180, -90, meridian + 180, 90],
  }
}

/** The map projection for a service's spatial reference, with a definition when it is not built in. */
export function projectionForService(
  info: VectorTileServiceInfo,
  override?: ProjectionDefinition,
): { code: string; definition?: ProjectionDefinition; extent: readonly number[] } {
  if (override) {
    const estimated = override.extent ? {} : estimateExtents(override.definition)
    const definition = { ...estimated, ...override }
    return { code: override.code, definition, extent: definition.extent! }
  }
  const reference = info.tileInfo?.spatialReference ?? info.spatialReference ?? {}
  const wkid = reference.latestWkid ?? reference.wkid
  if (wkid !== undefined && MERCATOR_WKIDS.has(wkid))
    return { code: 'EPSG:3857', extent: MERCATOR_EXTENT }
  if (wkid === 8857 || wkid === 54035) return { code: 'EPSG:8857', extent: EQUAL_EARTH_EXTENT }
  if (wkid !== undefined && wkid in EQUAL_EARTH_CENTRAL_MERIDIANS) {
    const definition = equalEarth(`EPSG:${wkid}`, EQUAL_EARTH_CENTRAL_MERIDIANS[wkid])
    return { code: definition.code, definition, extent: EQUAL_EARTH_EXTENT }
  }
  if (reference.wkt) {
    const code = `ARCGIS:${hash(reference.wkt)}`
    let estimated: ReturnType<typeof estimateExtents>
    try {
      estimated = estimateExtents(reference.wkt)
    } catch (cause) {
      throw new Error(
        `The service's spatial reference could not be read (${String(cause)}). ` +
          'Pass `sourceProjectionDefinition: { code, definition }` with its proj4 definition.',
        { cause },
      )
    }
    const definition = { code, definition: reference.wkt, ...estimated }
    return { code, definition, extent: definition.extent! }
  }
  throw new Error(
    `The service uses spatial reference ${wkid ?? '(none)'}, which the map does not know. ` +
      'Pass `sourceProjectionDefinition: { code, definition }` with its proj4 definition (see epsg.io).',
  )
}

function joinTemplate(serviceUrl: string, template: string | undefined): string {
  const tiles = template ?? 'tile/{z}/{y}/{x}.pbf'
  return /^https?:\/\//i.test(tiles) ? tiles : `${serviceUrl}/${tiles.replace(/^\/+/, '')}`
}

function serviceAttribution(service: ArcGISService): AttributionSpec {
  return {
    label: service.info.copyrightText?.trim() || service.info.name || 'Esri',
    url: service.serviceUrl,
  }
}

/**
 * The `mvt` layer an `arcgis-vector-tiles` layer stands for, given its service. The layer keeps
 * the service's projection and tile grid whatever the map's: in a map of another projection
 * (`mapProjection`), OpenLayers reprojects each tile's features while drawing.
 */
export function arcgisToMvt(
  layer: ArcGISVectorTileLayerConfig & Pick<BasemapLayerConfig, 'aboveOverlays'>,
  service: ArcGISService,
  mapProjection?: string,
): VectorTileLayerConfig & Pick<BasemapLayerConfig, 'aboveOverlays'> {
  // `url` is replaced by the tile URL below.
  const { mapboxStyle, sourceProjectionDefinition, ...common } = layer
  const { code, definition, extent } = projectionForService(
    service.info,
    sourceProjectionDefinition,
  )
  const tileInfo = service.info.tileInfo!
  const resolutions = [...tileInfo.lods!]
    .sort((a, b) => a.level - b.level)
    .map((lod) => lod.resolution)
  return {
    ...common,
    kind: 'mvt',
    url: joinTemplate(service.serviceUrl, service.info.tiles?.[0]),
    sourceProjection: code,
    ...(definition ? { sourceProjectionDefinition: definition } : {}),
    maxSourceZoom: resolutions.length - 1,
    tileGrid: {
      extent: [extent[0]!, extent[1]!, extent[2]!, extent[3]!],
      origin: [tileInfo.origin!.x, tileInfo.origin!.y],
      resolutions,
      tileSize: tileInfo.rows ?? 512,
    },
    // Wrapped copies of the world only where the tiles are drawn as they are: in a reprojected
    // map, tiles past the edge of the world would repeat it beside the map's outline.
    wrapX: code === 'EPSG:3857' && (mapProjection === undefined || mapProjection === code),
    mapboxStyle: { ...mapboxStyle, url: mapboxStyle?.url ?? service.styleUrl },
    attribution: layer.attribution ?? [serviceAttribution(service)],
  }
}

const isArcgis = (layer: MapLayerConfig): layer is ArcGISVectorTileLayerConfig =>
  layer.kind === 'arcgis-vector-tiles'

/** Every ArcGIS service URL in a configuration, once each. */
export function arcgisServiceUrls(config: MapConfig): string[] {
  const layers = [
    ...config.data.basemaps.flatMap((basemap) => basemap.layers),
    ...config.data.layers,
  ]
  return [...new Set(layers.filter(isArcgis).map((layer) => layer.url))]
}

/**
 * The configuration with every ArcGIS layer replaced by its `mvt` equivalent. Basemaps without
 * declared projections take the service's, and when no basemap supports the configured view
 * projection the map starts in the first basemap's projection. A basemap that declares
 * projections other than its service's is drawn in them by reprojecting its tiles; your own
 * vector tile layers must be in the map's projection.
 */
export function resolveArcgisConfig(
  config: MapConfig,
  serviceFor: (url: string) => ArcGISService,
): MapConfig {
  const resolve = (layer: BasemapLayerConfig, mapProjection?: string): BasemapLayerConfig =>
    isArcgis(layer) ? arcgisToMvt(layer, serviceFor(layer.url), mapProjection) : layer
  const basemaps: BasemapConfig[] = config.data.basemaps.map((basemap) => {
    if (!basemap.layers.some(isArcgis)) return basemap
    const layers = basemap.layers.map((layer) => resolve(layer))
    const codes = [
      ...new Set(layers.flatMap((layer) => (layer.kind === 'mvt' ? [layer.sourceProjection] : []))),
    ]
    return {
      ...basemap,
      layers,
      supportedProjections: basemap.supportedProjections.length
        ? basemap.supportedProjections
        : codes,
      attribution: basemap.attribution?.length
        ? basemap.attribution
        : [
            ...new Map(
              layers.flatMap((layer) => layer.attribution ?? []).map((item) => [item.label, item]),
            ).values(),
          ],
    }
  })
  const view = config.initialState.view
  const supported = (basemap: BasemapConfig) =>
    basemap.supportedProjections.includes(view.projection)
  const active = basemaps.find((basemap) => basemap.id === config.initialState.activeBasemapId)
  const fallback = basemaps.find(supported)
  const first = basemaps.find((basemap) => basemap.supportedProjections.length)
  const projection = fallback || !first ? view.projection : first.supportedProjections[0]!
  const activeBasemapId =
    active && active.supportedProjections.includes(projection)
      ? active.id
      : (basemaps.find((basemap) => basemap.supportedProjections.includes(projection))?.id ??
        config.initialState.activeBasemapId)
  const layers = config.data.layers.map((layer) => resolve(layer, projection))
  for (const [index, layer] of config.data.layers.entries()) {
    const resolved = layers[index]!
    if (isArcgis(layer) && resolved.kind === 'mvt' && resolved.sourceProjection !== projection)
      throw new Error(
        `Layer ${layer.id} is in ${resolved.sourceProjection} but the map uses ${projection}. ` +
          'Vector tiles cannot be re-projected: use a service in the map projection.',
      )
  }
  // Tiles drawn in another projection than their own are not wrapped (see `arcgisToMvt`).
  const drawn = basemaps.map((basemap, index) => {
    const original = config.data.basemaps[index]!
    if (basemap === original) return basemap
    return {
      ...basemap,
      layers: basemap.layers.map((layer, at) =>
        isArcgis(original.layers[at]!) &&
        layer.kind === 'mvt' &&
        layer.wrapX &&
        layer.sourceProjection !== projection
          ? { ...layer, wrapX: false }
          : layer,
      ),
    }
  })
  return {
    ...config,
    data: { ...config.data, basemaps: drawn, layers },
    initialState: {
      ...config.initialState,
      view: { ...view, projection },
      ...(activeBasemapId ? { activeBasemapId } : {}),
    },
  }
}

/** The configuration without ArcGIS layers, used when a service cannot be read. */
export function withoutArcgisLayers(config: MapConfig): MapConfig {
  const projection = config.initialState.view.projection
  return {
    ...config,
    data: {
      ...config.data,
      basemaps: config.data.basemaps.map((basemap) => ({
        ...basemap,
        layers: basemap.layers.filter((layer) => !isArcgis(layer)),
        supportedProjections: basemap.supportedProjections.length
          ? basemap.supportedProjections
          : [projection],
      })),
      layers: config.data.layers.filter((layer) => !isArcgis(layer)),
    },
  }
}

/** The error shown when an ArcGIS service can't be used (read, or turned into layers). */
export function arcgisServiceError(cause: unknown): MapError {
  return mapError(
    'SOURCE_LOAD_FAILED',
    `Could not load the ArcGIS basemap: ${cause instanceof Error ? cause.message : String(cause)}`,
    true,
    undefined,
    cause,
  )
}

/** What the map shows when its ArcGIS services can't be used, and whether to report it. */
export type ArcgisFallback = {
  /** The configuration without ArcGIS layers, with failed basemaps replaced by their fallbacks. */
  config: MapConfig
  /** The error to report, or `null` when every failed layer belonged to a replaced basemap. */
  error: MapError | null
  /**
   * The basemaps left out, by id, with the id of the basemap shown instead: a state that names
   * one (a host that controls the state) shows that basemap.
   */
  replaced: Readonly<Record<string, string>>
}

/**
 * The configuration to show when the ArcGIS services can't be used (`cause` says why): the
 * ArcGIS layers are dropped, and a basemap made only of them that names a `fallbackBasemapId`
 * (followed past other replaced basemaps, to one that supports the map's projection) is removed
 * in favour of that basemap, which becomes the active one if it was. The error is `null` when
 * nothing else was dropped: the switch is then only told in one console hint per basemap.
 */
export function arcgisFallback(config: MapConfig, cause: unknown): ArcgisFallback {
  const stripped = withoutArcgisLayers(config)
  const projection = config.initialState.view.projection
  const originals = new Map(config.data.basemaps.map((basemap) => [basemap.id, basemap]))
  const kept = new Map(stripped.data.basemaps.map((basemap) => [basemap.id, basemap]))
  const replaceable = (basemap: BasemapConfig) =>
    basemap.fallbackBasemapId !== undefined &&
    basemap.layers.length > 0 &&
    basemap.layers.every(isArcgis)
  /** The basemap shown instead of `basemap`, following fallbacks that are replaced too. */
  const replacement = (basemap: BasemapConfig): BasemapConfig | undefined => {
    const seen = new Set<string>()
    let current = basemap
    while (replaceable(current)) {
      if (seen.has(current.id)) return undefined
      seen.add(current.id)
      const next = originals.get(current.fallbackBasemapId!)
      if (!next) return undefined
      current = next
    }
    const target = kept.get(current.id)
    return target?.supportedProjections.includes(projection) ? target : undefined
  }
  const replaced = new Map<string, BasemapConfig>()
  for (const basemap of config.data.basemaps) {
    const target = replaceable(basemap) ? replacement(basemap) : undefined
    if (target) replaced.set(basemap.id, target)
  }
  const reason = cause instanceof Error ? cause.message : String(cause)
  for (const [id, target] of replaced) {
    const basemap = originals.get(id)!
    warnOnce(
      `basemap-fallback:${id}`,
      `The basemap "${basemap.title}" (${id}) could not be loaded, so the map shows its ` +
        `fallback "${target.title}" (${target.id}) instead. Reason: ${reason}`,
    )
  }
  const quiet =
    !config.data.layers.some(isArcgis) &&
    config.data.basemaps.every(
      (basemap) => replaced.has(basemap.id) || !basemap.layers.some(isArcgis),
    )
  const activeId = config.initialState.activeBasemapId
  const basemaps = stripped.data.basemaps
    .filter((basemap) => !replaced.has(basemap.id))
    .map((basemap) => {
      // A fallback that was replaced points at what replaced it.
      const fallback = basemap.fallbackBasemapId
      const target = fallback === undefined ? undefined : replaced.get(fallback)
      if (!target) return basemap
      const result: BasemapConfig = { ...basemap }
      if (target.id === basemap.id) delete result.fallbackBasemapId
      else result.fallbackBasemapId = target.id
      return result
    })
  return {
    config: {
      ...stripped,
      data: { ...stripped.data, basemaps },
      initialState: {
        ...stripped.initialState,
        ...(activeId && replaced.has(activeId)
          ? { activeBasemapId: replaced.get(activeId)!.id }
          : {}),
      },
    },
    error: quiet ? null : arcgisServiceError(cause),
    replaced: Object.fromEntries([...replaced].map(([id, target]) => [id, target.id])),
  }
}
