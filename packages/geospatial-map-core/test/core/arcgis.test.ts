import { afterEach, describe, expect, it, vi } from 'vitest'
import { get as getProjection } from 'ol/proj.js'
import { arcgisBasemap, esriWorldBasemap, worldBasemap } from '../../src/basemaps'
import Value from 'typebox/value'
import { defineMapConfig } from '../../src/config/normalize'
import { mapConfigSchema, mapInputSchema } from '../../src/config/schema'
import { validateMapConfig } from '../../src/config/validate'
import {
  arcgisFallback,
  arcgisServiceUrls,
  arcgisToMvt,
  loadArcgisService,
  projectionForService,
  resolveArcgisConfig,
  withoutArcgisLayers,
} from '../../src/core/arcgis'
import { fetchJson, withTimeout } from '../../src/core/http'
import { styleResolutions } from '../../src/core/layers/vector-tile-layer'
import { ensureConfiguredProjection, equalEarth } from '../../src/core/projections'
import type { ArcGISService, VectorTileServiceInfo } from '../../src/core/arcgis'
import { matchesPattern, prepareStyle } from '../../src/core/vector-style'
import type { StyleDocument } from '../../src/core/vector-style'
import type { MapConfigInput, MapLayerConfig, VectorTileLayerConfig } from '../../src/types'

const SERVICE = 'https://tiles.example.com/arcgis/rest/services/EqualEarth/VectorTileServer'
const CM11_WKT =
  'PROJCS["Equal_Earth_CM11",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",' +
  '6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],' +
  'PROJECTION["Equal_Earth"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],' +
  'PARAMETER["Central_Meridian",11.0],UNIT["Meter",1.0]]'

const info = (
  spatialReference: NonNullable<VectorTileServiceInfo['spatialReference']>,
): VectorTileServiceInfo => ({
  name: 'Equal Earth basemap',
  copyrightText: 'Esri, Natural Earth',
  spatialReference,
  tileInfo: {
    rows: 512,
    origin: { x: -17243958.56, y: 17243958.56 },
    lods: [
      { level: 1, resolution: 33679.6 },
      { level: 0, resolution: 67359.2 },
    ],
  },
  tiles: ['tile/{z}/{y}/{x}.pbf'],
  defaultStyles: 'resources/styles',
})

const service = (
  spatialReference: NonNullable<VectorTileServiceInfo['spatialReference']>,
): ArcGISService => ({
  serviceUrl: SERVICE,
  styleUrl: `${SERVICE}/resources/styles/root.json`,
  info: info(spatialReference),
})

const indicator: MapLayerConfig = {
  id: 'regions',
  title: 'Regions',
  kind: 'geojson',
  data: { url: '/regions.geojson' },
  style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#60a5fa' } },
}

describe('ArcGIS service projections', () => {
  it('maps well-known spatial references to built-in projections', () => {
    expect(projectionForService(info({ wkid: 102100, latestWkid: 3857 })).code).toBe('EPSG:3857')
    expect(projectionForService(info({ wkid: 8857 })).code).toBe('EPSG:8857')
    expect(projectionForService(info({ wkid: 54035 })).code).toBe('EPSG:8857')
    const americas = projectionForService(info({ wkid: 8858 }))
    expect(americas.code).toBe('EPSG:8858')
    expect(americas.definition?.definition).toContain('+lon_0=-90')
  })

  it('reads a custom Equal Earth from its WKT, with the world extent and seam', () => {
    const { code, definition, extent } = projectionForService(info({ wkt: CM11_WKT }))
    expect(code).toMatch(/^ARCGIS:/)
    expect(extent[0]).toBeCloseTo(-17243959, -3)
    expect(extent[3]).toBeCloseTo(8392927, -3)
    expect(definition?.worldExtent).toEqual([-169, -90, 191, 90])
  })

  it('explains what to do for an unknown spatial reference', () => {
    expect(() => projectionForService(info({ wkid: 2154 }))).toThrow(
      /sourceProjectionDefinition: \{ code, definition \}/,
    )
  })
})

describe('ArcGIS layers', () => {
  it('becomes a vector tile layer with the service tile grid, style and copyright', () => {
    const layer = arcgisToMvt(
      {
        id: 'base',
        title: 'Base',
        kind: 'arcgis-vector-tiles',
        url: SERVICE,
        mapboxStyle: { layers: 'base', overrides: [{ layers: 'Boundary*', color: '#333' }] },
      },
      service({ wkid: 8857 }),
    )
    expect(layer).toMatchObject({
      kind: 'mvt',
      url: `${SERVICE}/tile/{z}/{y}/{x}.pbf`,
      sourceProjection: 'EPSG:8857',
      maxSourceZoom: 1,
      tileGrid: {
        origin: [-17243958.56, 17243958.56],
        resolutions: [67359.2, 33679.6],
        tileSize: 512,
      },
      mapboxStyle: {
        url: `${SERVICE}/resources/styles/root.json`,
        layers: 'base',
        overrides: [{ layers: 'Boundary*', color: '#333' }],
      },
      attribution: [{ label: 'Esri, Natural Earth', url: SERVICE }],
    })
  })

  it('starts the map in the basemap projection and keeps overlays as they are', () => {
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Indicators' },
      data: { basemaps: [arcgisBasemap({ url: SERVICE })], layers: [indicator] },
    })
    expect(arcgisServiceUrls(config)).toEqual([SERVICE])
    const resolved = resolveArcgisConfig(config, () => service({ wkt: CM11_WKT }))
    const code = resolved.data.basemaps[0]!.supportedProjections[0]!
    expect(code).toMatch(/^ARCGIS:/)
    expect(resolved.initialState.view.projection).toBe(code)
    expect(resolved.initialState.activeBasemapId).toBe('arcgis')
    expect(resolved.data.basemaps[0]!.layers.map((layer) => layer.kind)).toEqual(['mvt', 'mvt'])
    expect(resolved.data.basemaps[0]!.layers[1]!.aboveOverlays).toBe(true)
    expect(resolved.data.basemaps[0]!.attribution?.[0]?.label).toBe('Esri, Natural Earth')
    expect(resolved.data.layers).toEqual(config.data.layers)
    expect(validateMapConfig(resolved).success).toBe(true)
  })

  it('validates a short config with only a basemap URL', () => {
    const result = validateMapConfig({
      accessibility: { ariaLabel: 'Indicators' },
      data: { basemaps: [arcgisBasemap({ url: SERVICE })], layers: [indicator] },
    })
    expect(result.success).toBe(true)
  })

  it('refuses vector tile overlays in another projection than the map', () => {
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Indicators' },
      data: {
        layers: [
          {
            id: 'tiles',
            title: 'Tiles',
            kind: 'arcgis-vector-tiles',
            url: SERVICE,
          },
        ],
      },
    })
    expect(() => resolveArcgisConfig(config, () => service({ wkid: 3857 }))).toThrow(
      /cannot be re-projected/,
    )
    expect(withoutArcgisLayers(config).data.layers).toEqual([])
  })
})

describe('reading ArcGIS services', () => {
  /** Answers `fetch` with the JSON of `map`, by URL. */
  const respond = (map: Record<string, unknown>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url in map
          ? new Response(JSON.stringify(map[url]))
          : new Response('missing', { status: 404 }),
      ),
    )
  afterEach(() => vi.unstubAllGlobals())

  it('follows an ArcGIS Online style item to its service', async () => {
    const id = '0123456789abcdef0123456789abcdef'
    const item = `https://www.arcgis.com/sharing/rest/content/items/${id}`
    respond({
      [`${item}?f=json`]: { type: 'Vector Tile Style' },
      [`${item}/resources/styles/root.json`]: {
        sources: { esri: { type: 'vector', url: `${SERVICE}/` } },
      },
      [`${SERVICE}?f=json`]: info({ wkid: 8857 }),
    })
    const loaded = await loadArcgisService(`https://www.arcgis.com/home/item.html?id=${id}`)
    expect(loaded.serviceUrl).toBe(SERVICE)
    expect(loaded.styleUrl).toBe(`${item}/resources/styles/root.json`)
  })

  it('reports ArcGIS errors and wrong URLs in plain words', async () => {
    respond({
      [`${SERVICE}/../Broken/VectorTileServer?f=json`]: {
        error: { code: 499, message: 'Token Required' },
      },
    })
    await expect(loadArcgisService(`${SERVICE}/../Broken/VectorTileServer`)).rejects.toThrow(
      /Token Required/,
    )
    await expect(loadArcgisService('https://example.com/map.json')).rejects.toThrow(
      /ending in \/VectorTileServer/,
    )
  })
})

describe('basemap style layers and overrides', () => {
  const style: StyleDocument = {
    layers: [
      { id: 'background', type: 'background' },
      { id: 'Land/fill', type: 'fill', paint: { 'fill-color': '#eee' } },
      { id: 'Boundary line/Admin0/0', type: 'line', paint: { 'line-color': '#999' } },
      { id: 'Boundary line/Admin1/0', type: 'line' },
      { id: 'Admin0 point/label', type: 'symbol' },
    ],
  }

  it('matches ids and patterns without regard to case', () => {
    expect(matchesPattern('Boundary line/Admin1/0', 'boundary line/admin1*')).toBe(true)
    expect(matchesPattern('Boundary line/Admin1/0', 'Boundary line/Admin0*')).toBe(false)
  })

  it('splits labels and borders from the rest', () => {
    const ids = (selection: 'base' | 'reference') =>
      prepareStyle(style, selection).style.layers.map((layer) => layer.id)
    expect(ids('base')).toEqual(['background', 'Land/fill'])
    expect(ids('reference')).toEqual([
      'Boundary line/Admin0/0',
      'Boundary line/Admin1/0',
      'Admin0 point/label',
    ])
  })

  it('applies colour, width and visibility overrides and reports unmatched patterns', () => {
    const { style: prepared, unmatched } = prepareStyle(
      style,
      undefined,
      [
        { layers: 'Boundary line/Admin1*', color: 'var(--border)', width: 2 },
        { layers: 'Land/*', visible: false },
        { layers: 'Admin9*', color: '#000' },
      ],
      (color) => (color === 'var(--border)' ? 'rgb(1, 2, 3)' : color),
    )
    const byId = Object.fromEntries(prepared.layers.map((layer) => [layer.id, layer]))
    expect(byId['Boundary line/Admin1/0']?.paint).toEqual({
      'line-color': 'rgb(1, 2, 3)',
      'line-width': 2,
    })
    expect(byId['Land/fill']?.layout).toEqual({ visibility: 'none' })
    expect(byId['Boundary line/Admin0/0']?.paint).toEqual({ 'line-color': '#999' })
    expect(unmatched).toEqual(['Admin9*'])
  })
})

const WORLD_BASEMAP_V2 =
  'https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer'

/**
 * A Web Mercator service shaped like World_Basemap_v2's description (October 2026): levels
 * listed to 22 with tiles to 16 (`maxLOD`), and the spatial reference in the tile grid only.
 */
const mercatorService = (): ArcGISService => ({
  serviceUrl: WORLD_BASEMAP_V2,
  styleUrl: `${WORLD_BASEMAP_V2}/resources/styles/root.json`,
  info: {
    name: 'World_Basemap_v2',
    copyrightText: 'Esri, TomTom, Garmin',
    tileInfo: {
      rows: 512,
      origin: { x: -20037508.342787, y: 20037508.342787 },
      spatialReference: { wkid: 102100, latestWkid: 3857 },
      lods: Array.from({ length: 23 }, (_, level) => ({
        level,
        resolution: 78271.51696402048 / 2 ** level,
      })),
    },
    maxLOD: 16,
    tiles: ['tile/{z}/{y}/{x}.pbf'],
    defaultStyles: 'resources/styles',
  },
})

describe('reprojected ArcGIS basemaps', () => {
  it('declares the projections it is drawn in, and its fallback', () => {
    const basemap = arcgisBasemap({
      url: SERVICE,
      id: 'remote',
      projections: ['EPSG:8857', 'EPSG:3857'],
      fallbackBasemapId: 'world',
    })
    expect(basemap.supportedProjections).toEqual(['EPSG:8857', 'EPSG:3857'])
    expect(basemap.fallbackBasemapId).toBe('world')
    expect(arcgisBasemap({ url: SERVICE }).supportedProjections).toEqual([])
    expect('fallbackBasemapId' in arcgisBasemap({ url: SERVICE })).toBe(false)
  })

  it('draws a Web Mercator service in an Equal Earth map without wrapping its tiles', () => {
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Default' },
      data: { layers: [] },
    })
    expect(config.initialState.view.projection).toBe('EPSG:8857')
    expect(arcgisServiceUrls(config)).toEqual([WORLD_BASEMAP_V2])
    const resolved = resolveArcgisConfig(config, () => mercatorService())
    expect(resolved.initialState.view.projection).toBe('EPSG:8857')
    expect(resolved.initialState.activeBasemapId).toBe('esri-world')
    const [esri, world] = resolved.data.basemaps
    expect(world).toBe(worldBasemap)
    expect(esri!.supportedProjections).toEqual(['EPSG:8857', 'EPSG:3857'])
    expect(esri!.fallbackBasemapId).toBe('world')
    expect(esri!.attribution).toEqual([{ label: 'Esri, TomTom, Garmin', url: WORLD_BASEMAP_V2 }])
    for (const layer of esri!.layers)
      expect(layer).toMatchObject({
        kind: 'mvt',
        url: `${WORLD_BASEMAP_V2}/tile/{z}/{y}/{x}.pbf`,
        sourceProjection: 'EPSG:3857',
        // Tiles to level 16; the 23 levels listed still number the style's zoom levels.
        maxSourceZoom: 16,
        tileGrid: {
          origin: [-20037508.342787, 20037508.342787],
          tileSize: 512,
        },
        wrapX: false,
      })
    expect(esri!.layers[1]!.aboveOverlays).toBe(true)
    const { tileGrid } = esri!.layers[0] as { tileGrid: { resolutions: number[] } }
    expect(tileGrid.resolutions).toHaveLength(23)
    expect(validateMapConfig(resolved).success).toBe(true)
  })

  it('wraps the tiles in a Web Mercator map, where they are drawn as they are', () => {
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Mercator' },
      initialState: { view: { center: [0, 0], zoom: 2, projection: 'EPSG:3857' } },
      data: { layers: [] },
    })
    const resolved = resolveArcgisConfig(config, () => mercatorService())
    expect(resolved.initialState.view.projection).toBe('EPSG:3857')
    expect(
      resolved.data.basemaps[0]!.layers.map((layer) => 'wrapX' in layer && layer.wrapX),
    ).toEqual([true, true])
  })

  it('numbers style zoom levels at the same scale in Equal Earth as in Web Mercator', () => {
    const layer = arcgisToMvt(
      { id: 'tiles', title: 'Tiles', kind: 'arcgis-vector-tiles', url: WORLD_BASEMAP_V2 },
      {
        ...mercatorService(),
        info: {
          ...mercatorService().info,
          tileInfo: {
            ...mercatorService().info.tileInfo,
            lods: [0, 1, 2].map((level) => ({ level, resolution: 78271.51696402048 / 2 ** level })),
          },
        },
      },
    ) as VectorTileLayerConfig
    const mercator = styleResolutions(layer, getProjection('EPSG:3857')!)!
    const equalEarthResolutions = styleResolutions(
      layer,
      ensureConfiguredProjection(equalEarth('EPSG:8857')),
    )!
    // In the tiles' own projection, the service's levels, as before 0.11.
    expect(mercator).toEqual([0, 1, 2].map((level) => 78271.51696402048 / 2 ** level))
    // Reprojected: both are in metres, so the same resolutions, continued past the service's
    // last level.
    expect(equalEarthResolutions.slice(0, 3)).toEqual(mercator)
    expect(equalEarthResolutions).toHaveLength(25)
    expect(equalEarthResolutions[3]).toBeCloseTo(78271.51696402048 / 8)
    expect(equalEarthResolutions[24]).toBeCloseTo(78271.51696402048 / 2 ** 24)
  })
})

describe('the fallback of an ArcGIS basemap that cannot be loaded', () => {
  afterEach(() => vi.restoreAllMocks())
  const offline = new Error('Failed to fetch')

  it('replaces the default Esri basemap by the World outlines, quietly but for one hint', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Default' },
      data: { layers: [] },
    })
    const { config: fallen, error, replaced } = arcgisFallback(config, offline)
    expect(error).toBeNull()
    expect(fallen.data.basemaps).toEqual([worldBasemap])
    expect(fallen.initialState.activeBasemapId).toBe('world')
    // A host's state that names the Esri basemap shows the World outlines.
    expect(replaced).toEqual({ 'esri-world': 'world' })
    expect(fallen.initialState.view.projection).toBe('EPSG:8857')
    expect(validateMapConfig(fallen).success).toBe(true)
    arcgisFallback(config, offline)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toBe(
      '[geospatial-map] The basemap "Esri World Basemap" (esri-world) could not be loaded, so ' +
        'the map shows its fallback "World" (world) instead. Reason: Failed to fetch',
    )
  })

  it('still reports the error when other ArcGIS layers were dropped too', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Mixed' },
      data: {
        layers: [{ id: 'roads', title: 'Roads', kind: 'arcgis-vector-tiles', url: SERVICE }],
      },
    })
    const { config: fallen, error } = arcgisFallback(config, offline)
    expect(error).toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      message: 'Could not load the ArcGIS basemap: Failed to fetch',
    })
    expect(fallen.data.layers).toEqual([])
    expect(fallen.data.basemaps.map((basemap) => basemap.id)).toEqual(['world'])
  })

  it('reports the error as before for a basemap without a usable fallback', () => {
    const plain = defineMapConfig({
      accessibility: { ariaLabel: 'Plain' },
      data: { layers: [], basemaps: [arcgisBasemap({ url: SERVICE }), worldBasemap] },
    })
    const result = arcgisFallback(plain, offline)
    expect(result.error?.code).toBe('SOURCE_LOAD_FAILED')
    expect(result.config).toEqual(withoutArcgisLayers(plain))
    expect(result.replaced).toEqual({})
    // A fallback that doesn't support the map's projection is no fallback.
    const mercatorOnly = { ...worldBasemap, id: 'mercator', supportedProjections: ['EPSG:3857'] }
    const elsewhere = defineMapConfig({
      accessibility: { ariaLabel: 'Elsewhere' },
      data: {
        layers: [],
        basemaps: [
          arcgisBasemap({
            url: SERVICE,
            projections: ['EPSG:8857'],
            fallbackBasemapId: 'mercator',
          }),
          mercatorOnly,
        ],
      },
    })
    expect(arcgisFallback(elsewhere, offline).error?.code).toBe('SOURCE_LOAD_FAILED')
  })

  it('follows fallbacks past other failed basemaps and repoints the fallbacks of the rest', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Chain' },
      initialState: { activeBasemapId: 'first' },
      data: {
        layers: [],
        basemaps: [
          arcgisBasemap({
            id: 'first',
            url: SERVICE,
            projections: ['EPSG:8857'],
            fallbackBasemapId: 'second',
          }),
          arcgisBasemap({
            id: 'second',
            url: SERVICE,
            projections: ['EPSG:8857'],
            fallbackBasemapId: 'world',
          }),
          { ...worldBasemap, id: 'tiles', fallbackBasemapId: 'second' },
          worldBasemap,
        ],
      },
    })
    const { config: fallen, error, replaced } = arcgisFallback(config, offline)
    expect(error).toBeNull()
    expect(fallen.initialState.activeBasemapId).toBe('world')
    expect(replaced).toEqual({ first: 'world', second: 'world' })
    expect(fallen.data.basemaps.map((basemap) => [basemap.id, basemap.fallbackBasemapId])).toEqual([
      ['tiles', 'world'],
      ['world', undefined],
    ])
  })
})

describe('fallbackBasemapId validation', () => {
  const withFallback = (fallbackBasemapId: string) =>
    validateMapConfig({
      accessibility: { ariaLabel: 'Fallback' },
      data: { layers: [], basemaps: [{ ...esriWorldBasemap, fallbackBasemapId }, worldBasemap] },
    })

  it('accepts another basemap of the configuration', () => {
    expect(withFallback('world').success).toBe(true)
  })

  it('refuses an unknown basemap or the basemap itself', () => {
    const unknown = withFallback('satellite')
    expect(unknown.success).toBe(false)
    if (!unknown.success)
      expect(unknown.issues).toEqual([
        {
          path: '/data/basemaps/0/fallbackBasemapId',
          code: 'unknown',
          message:
            'The fallback of basemap esri-world is "satellite", which is not one of the basemaps: ' +
            'add that basemap or remove fallbackBasemapId',
        },
      ])
    const itself = withFallback('esri-world')
    expect(itself.success).toBe(false)
    if (!itself.success) expect(itself.issues[0]?.code).toBe('reference')
  })

  it('is a string in the JSON Schemas of both forms', () => {
    const short = (fallbackBasemapId: unknown) => ({
      accessibility: { ariaLabel: 'Fallback' },
      data: { layers: [], basemaps: [{ ...esriWorldBasemap, fallbackBasemapId }, worldBasemap] },
    })
    expect(Value.Check(mapInputSchema, short('world'))).toBe(true)
    expect(Value.Check(mapInputSchema, short(3))).toBe(false)
    expect(Value.Check(mapConfigSchema, defineMapConfig(short('world') as MapConfigInput))).toBe(
      true,
    )
    const invalid = validateMapConfig(short(3))
    expect(invalid.success).toBe(false)
    if (!invalid.success)
      expect(invalid.issues.map((item) => item.path)).toContain(
        '/data/basemaps/0/fallbackBasemapId',
      )
  })

  it('needs the World outlines next to the Esri World Basemap', () => {
    const alone = validateMapConfig({
      accessibility: { ariaLabel: 'Alone' },
      data: { layers: [], basemaps: [esriWorldBasemap] },
    })
    expect(alone.success).toBe(false)
  })
})

describe('service requests', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('give up on a service that does not answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)),
          ),
      ),
    )
    await expect(fetchJson('https://example.com/slow', withTimeout(20))).rejects.toThrow(
      'https://example.com/slow did not answer in time',
    )
  })

  it('read an ArcGIS service with a time limit', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(mercatorService().info)))
    vi.stubGlobal('fetch', fetch)
    await loadArcgisService(`${SERVICE}/../Timed/VectorTileServer`)
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({ signal: expect.any(AbortSignal) })
  })
})
