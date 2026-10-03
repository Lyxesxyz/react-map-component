import { describe, expect, it } from 'vitest'
import { arcgisBasemap } from '../../src/basemaps'
import { defineMapConfig, validateMapConfig } from '../../src/config'
import {
  arcgisServiceUrls,
  arcgisToMvt,
  loadArcgisService,
  projectionForService,
  resolveArcgisConfig,
  withoutArcgisLayers,
} from '../../src/core/arcgis'
import type { ArcGISService, FetchJson, VectorTileServiceInfo } from '../../src/core/arcgis'
import { matchesPattern, prepareStyle } from '../../src/core/vector-style'
import type { StyleDocument } from '../../src/core/vector-style'
import type { MapLayerConfig } from '../../src/types'

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
  role: 'indicator',
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
      /projection: \{ code, definition \}/,
    )
  })
})

describe('ArcGIS layers', () => {
  it('becomes a vector tile layer with the service tile grid, style and copyright', () => {
    const layer = arcgisToMvt(
      {
        id: 'base',
        title: 'Base',
        role: 'basemap',
        kind: 'arcgis-vector-tiles',
        url: SERVICE,
        styleLayers: 'base',
        styleOverrides: [{ layers: 'Boundary*', color: '#333' }],
      },
      service({ wkid: 8857 }),
    )
    expect(layer).toMatchObject({
      kind: 'mvt',
      urlTemplate: `${SERVICE}/tile/{z}/{y}/{x}.pbf`,
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
    expect(resolved.data.basemaps[0]!.attribution[0]?.label).toBe('Esri, Natural Earth')
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
            role: 'indicator',
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
  const responses =
    (map: Record<string, unknown>): FetchJson =>
    async (url) => {
      if (!(url in map)) throw new Error(`unexpected ${url}`)
      return map[url]
    }

  it('follows an ArcGIS Online style item to its service', async () => {
    const id = '0123456789abcdef0123456789abcdef'
    const item = `https://www.arcgis.com/sharing/rest/content/items/${id}`
    const loaded = await loadArcgisService(
      `https://www.arcgis.com/home/item.html?id=${id}`,
      responses({
        [`${item}?f=json`]: { type: 'Vector Tile Style' },
        [`${item}/resources/styles/root.json`]: {
          sources: { esri: { type: 'vector', url: `${SERVICE}/` } },
        },
        [`${SERVICE}?f=json`]: info({ wkid: 8857 }),
      }),
    )
    expect(loaded.serviceUrl).toBe(SERVICE)
    expect(loaded.styleUrl).toBe(`${item}/resources/styles/root.json`)
  })

  it('reports ArcGIS errors and wrong URLs in plain words', async () => {
    await expect(
      loadArcgisService(
        `${SERVICE}/../Broken/VectorTileServer`,
        responses({
          [`${SERVICE}/../Broken/VectorTileServer?f=json`]: {
            error: { code: 499, message: 'Token Required' },
          },
        }),
      ),
    ).rejects.toThrow(/Token Required/)
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
