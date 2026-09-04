import { describe, expect, it } from 'vitest'
import { validateLayerConfigs } from './layer-factory.js'
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
})
