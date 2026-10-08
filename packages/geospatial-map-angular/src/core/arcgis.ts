// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import proj4 from 'proj4'
import { arcgisItem, fetchJson, memoizeAsync } from './http'
import { EQUAL_EARTH_EXTENT, equalEarth, MERCATOR_EXTENT } from './projections'
import type {
  ArcGISVectorTileLayerConfig,
  AttributionSpec,
  BasemapConfig,
  BasemapLayerConfig,
  MapConfig,
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
  const meta = (await fetchJson(`${itemUrl}?f=json`)) as { type?: string; url?: string }
  if (meta.type === 'Vector Tile Service' && meta.url) return { serviceUrl: trimUrl(meta.url) }
  if (meta.type === 'Vector Tile Style') {
    const styleUrl = `${itemUrl}/resources/styles/root.json`
    const style = (await fetchJson(styleUrl)) as {
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
  const info = (await fetchJson(`${serviceUrl}?f=json`)) as VectorTileServiceInfo
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

/** The `mvt` layer an `arcgis-vector-tiles` layer stands for, given its service. */
export function arcgisToMvt(
  layer: ArcGISVectorTileLayerConfig & Pick<BasemapLayerConfig, 'aboveOverlays'>,
  service: ArcGISService,
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
    wrapX: code === 'EPSG:3857',
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
 * projection the map starts in the first basemap's projection.
 */
export function resolveArcgisConfig(
  config: MapConfig,
  serviceFor: (url: string) => ArcGISService,
): MapConfig {
  const resolve = (layer: BasemapLayerConfig): BasemapLayerConfig =>
    isArcgis(layer) ? arcgisToMvt(layer, serviceFor(layer.url)) : layer
  const basemaps: BasemapConfig[] = config.data.basemaps.map((basemap) => {
    if (!basemap.layers.some(isArcgis)) return basemap
    const layers = basemap.layers.map(resolve)
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
  const layers = config.data.layers.map(resolve)
  for (const [index, layer] of config.data.layers.entries()) {
    const resolved = layers[index]!
    if (isArcgis(layer) && resolved.kind === 'mvt' && resolved.sourceProjection !== projection)
      throw new Error(
        `Layer ${layer.id} is in ${resolved.sourceProjection} but the map uses ${projection}. ` +
          'Vector tiles cannot be re-projected: use a service in the map projection.',
      )
  }
  return {
    ...config,
    data: { ...config.data, basemaps, layers },
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
