import { describe, expect, it } from 'vitest'
import { esriWorldBasemap, plainBasemap, tileBasemap, worldBasemap } from '../src/basemaps'
import {
  defaultInitialView,
  defineMapConfig,
  hasDefaultZoom,
  normalizeMapConfig,
} from '../src/config/normalize'
import { validateMapConfig } from '../src/config/validate'
import { fingerprint as configFingerprint } from '../src/utils'
import type { MapConfigInput, MapLayerConfig } from '../src/types'

const layer: MapLayerConfig = {
  id: 'regions',
  title: 'Regions',
  kind: 'geojson',
  data: { url: '/regions.geojson' },
  featureIdField: 'id',
  style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#60a5fa' } },
}

const short: MapConfigInput = {
  accessibility: { ariaLabel: 'Regions' },
  data: { layers: [layer] },
}

describe('short configuration form', () => {
  it('validates with only accessibility and layers', () => {
    const result = validateMapConfig(short)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.config.version).toBe(1)
    // The Esri World Basemap in Equal Earth, with the bundled outlines as its fallback.
    expect(result.config.data.basemaps).toEqual([esriWorldBasemap, worldBasemap])
    expect(result.config.initialState.view).toEqual(defaultInitialView)
    expect(result.config.initialState.activeBasemapId).toBe('esri-world')
    expect(result.config.initialState.layers['regions']).toEqual({
      visible: true,
      opacity: 1,
      order: 0,
    })
  })

  it('defaults to the Esri World Basemap, reprojected, with the World outlines as fallback', () => {
    expect(esriWorldBasemap).toMatchObject({
      id: 'esri-world',
      title: 'Esri World Basemap',
      supportedProjections: ['EPSG:8857', 'EPSG:3857'],
      fallbackBasemapId: 'world',
      exportable: true,
    })
    expect(esriWorldBasemap.layers).toMatchObject([
      {
        id: 'esri-world-base',
        kind: 'arcgis-vector-tiles',
        url: 'https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer',
        mapboxStyle: { layers: 'base' },
      },
      { id: 'esri-world-labels', mapboxStyle: { layers: 'reference' }, aboveOverlays: true },
    ])
    // A configuration's own basemaps are kept as they are.
    const own = defineMapConfig({ ...short, data: { layers: [layer], basemaps: [worldBasemap] } })
    expect(own.data.basemaps).toEqual([worldBasemap])
    expect(own.initialState.activeBasemapId).toBe('world')
  })

  it('keeps an explicit plain basemap', () => {
    const config = defineMapConfig({
      ...short,
      data: { layers: [layer], basemaps: [plainBasemap] },
    })
    expect(config.initialState.activeBasemapId).toBe('plain')
  })

  it('starts a tile-only map in Web Mercator', () => {
    const tiles = tileBasemap({
      url: 'https://tiles.example.com/{z}/{x}/{y}.png',
      attribution: '© Example',
    })
    expect(tiles.supportedProjections).toEqual(['EPSG:3857'])
    expect(tiles.exportable).toBe(false)
    expect(tiles.layers[0]).toMatchObject({ kind: 'xyz', sourceProjection: 'EPSG:3857' })
    const result = validateMapConfig({ ...short, data: { layers: [layer], basemaps: [tiles] } })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.config.initialState.view.projection).toBe('EPSG:3857')
    expect(result.config.initialState.activeBasemapId).toBe('tiles')
  })

  it('merges a partial starting view and layer state over the defaults', () => {
    const config = defineMapConfig({
      ...short,
      initialState: {
        view: { center: [25, 42], zoom: 5 },
        layers: { regions: { visible: false, opacity: 0.5, order: 0 } },
      },
    })
    expect(config.initialState.view).toEqual({ center: [25, 42], zoom: 5, projection: 'EPSG:8857' })
    expect(config.initialState.layers['regions']?.visible).toBe(false)
  })

  it('makes layers with a feature id selectable unless they opt out', () => {
    const config = normalizeMapConfig({
      ...short,
      data: { layers: [layer, { ...layer, id: 'outline', selectable: false }] },
    })
    expect(config.data.layers.map((item) => 'selectable' in item && item.selectable)).toEqual([
      true,
      false,
    ])
  })

  it('leaves the world fit to the map, so a spread config with a zoom keeps its zoom', () => {
    const config = defineMapConfig(short)
    expect(config.view.fitWorld).toBeUndefined()
    expect(hasDefaultZoom(config.initialState.view)).toBe(true)
    const zoomed = defineMapConfig({
      ...config,
      initialState: { ...config.initialState, view: { ...config.initialState.view, zoom: 4 } },
    })
    expect(hasDefaultZoom(zoomed.initialState.view)).toBe(false)
  })

  it('starts at the first time frame when layers have frames and no time is set', () => {
    const timed = { ...layer, time: { values: ['2021', '2022'] } }
    expect(defineMapConfig({ ...short, data: { layers: [timed] } }).initialState.time).toBe('2021')
    expect(
      defineMapConfig({ ...short, initialState: { time: null }, data: { layers: [timed] } })
        .initialState.time,
    ).toBeNull()
    expect(defineMapConfig(short).initialState.time).toBeNull()
  })

  it('leaves a complete configuration unchanged in content', () => {
    const full = normalizeMapConfig(short)
    expect(normalizeMapConfig(full)).toEqual(full)
  })

  it('still reports malformed external JSON instead of throwing', () => {
    expect(validateMapConfig({ data: { layers: 'nope' } }).success).toBe(false)
    expect(validateMapConfig(null).success).toBe(false)
  })
})

describe('config fingerprint', () => {
  it('treats a config rebuilt with the same content as unchanged', () => {
    expect(configFingerprint({ ...short })).toBe(configFingerprint(structuredClone(short)))
    expect(configFingerprint(short)).not.toBe(
      configFingerprint({ ...short, accessibility: { ariaLabel: 'Other' } }),
    )
  })

  it('keys inline features by identity instead of serializing them', () => {
    const features = [{ type: 'Feature', properties: {}, geometry: null }]
    const config = { data: { type: 'FeatureCollection', features } }
    expect(configFingerprint(config)).toBe(configFingerprint({ ...config }))
    expect(configFingerprint(config)).not.toContain('"geometry"')
    expect(configFingerprint(config)).not.toBe(
      configFingerprint({ data: { type: 'FeatureCollection', features: [...features] } }),
    )
  })
})
