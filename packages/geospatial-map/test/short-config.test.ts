import { describe, expect, it } from 'vitest'
import {
  defaultInitialView,
  defineMapConfig,
  normalizeMapConfig,
  plainBasemap,
  validateMapConfig,
} from '../src/config'
import { configFingerprint } from '../src/map-state'
import type { MapConfigInput, MapLayerConfig } from '../src/types'

const layer: MapLayerConfig = {
  id: 'regions',
  title: 'Regions',
  role: 'indicator',
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
    expect(result.config.data.basemaps).toEqual([plainBasemap])
    expect(result.config.initialState.view).toEqual(defaultInitialView)
    expect(result.config.initialState.activeBasemapId).toBe('plain')
    expect(result.config.initialState.layers['regions']).toEqual({
      visible: true,
      opacity: 1,
      order: 0,
    })
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
    expect(config.data.layers.map((item) => item.selectable)).toEqual([true, false])
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
