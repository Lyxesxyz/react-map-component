import { describe, expect, it } from 'vitest'
import { normalizeHeatmapWeight, validateLayerConfigs } from './layer-factory.js'
import type { MapLayerConfig } from '../types.js'

const layer = (id: string): MapLayerConfig => ({
  id,
  title: id,
  role: 'indicator',
  kind: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
  style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#fff' } },
})

describe('layer validation', () => {
  it('rejects duplicate IDs', () => {
    expect(() => validateLayerConfigs([layer('same'), layer('same')])).toThrow('Duplicate layer ID')
  })

  it('requires stable identifiers for selectable layers', () => {
    expect(() => validateLayerConfigs([{ ...layer('selectable'), selectable: true }])).toThrow(
      'needs featureIdField',
    )
  })

  it('validates service-styled MVT projection and tile-grid configuration', () => {
    const mvt: MapLayerConfig = {
      id: 'service-basemap',
      title: 'Service basemap',
      role: 'basemap',
      kind: 'mvt',
      urlTemplate: '/tiles/{z}/{y}/{x}.pbf',
      sourceProjection: 'CUSTOM:1',
      sourceProjectionDefinition: {
        code: 'CUSTOM:2',
        definition: '+proj=longlat +datum=WGS84 +no_defs',
      },
      tileGrid: { extent: [-1, -1, 1, 1], origin: [-1, 1], resolutions: [], tileSize: 512 },
      mapboxStyle: { url: '/style.json', source: 'basemap' },
    }

    expect(() => validateLayerConfigs([mvt])).toThrow('at least one tile-grid resolution')
    mvt.tileGrid!.resolutions = [1]
    expect(() => validateLayerConfigs([mvt])).toThrow('must match its source projection')
  })

  it('rejects interactive or invalid heatmap policies', () => {
    const heatmap: MapLayerConfig = {
      id: 'density',
      title: 'Density',
      role: 'indicator',
      kind: 'heatmap',
      data: { type: 'FeatureCollection', features: [] },
      selectable: true,
    }
    expect(() => validateLayerConfigs([heatmap])).toThrow('cannot be selectable')
    delete heatmap.selectable
    heatmap.radiusStops = [
      { zoom: 2, value: 10 },
      { zoom: 1, value: 8 },
    ]
    expect(() => validateLayerConfigs([heatmap])).toThrow('strictly ascending')
  })

  it('clamps numeric heatmap weights and defaults invalid values', () => {
    expect([-1, 0.4, 2, undefined].map(normalizeHeatmapWeight)).toEqual([0, 0.4, 1, 1])
  })
})
