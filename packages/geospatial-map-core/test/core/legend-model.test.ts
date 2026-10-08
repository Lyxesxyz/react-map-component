import { describe, expect, it } from 'vitest'
import { legendEntriesForStyle, normalizeLegend } from '../../src/core/legend-model'
import { interpolateStops, symbolPicker } from '../../src/core/symbols'
import type { GeoJsonLayerConfig, ThematicStyleSpec } from '../../src/types'

const style: ThematicStyleSpec = {
  type: 'graduated',
  field: 'value',
  classes: [
    { label: 'Low', min: 0, max: 10, symbol: { kind: 'polygon', fillColor: '#eeeeee' } },
    { label: 'High', min: 10, symbol: { kind: 'polygon', fillColor: '#0057b8' } },
  ],
  missing: { label: 'No data', symbol: { kind: 'polygon', fillColor: '#999999' } },
}

describe('style and legend compilation', () => {
  it('uses the same classes for feature symbols and legend entries', () => {
    expect(symbolPicker(style)(12)).toMatchObject({ fillColor: '#0057b8' })
    expect(legendEntriesForStyle(style).map((entry) => entry.label)).toEqual([
      'Low',
      'High',
      'No data',
    ])
  })

  it('lets explicit legend copy override generated entries', () => {
    const layer: GeoJsonLayerConfig = {
      id: 'indicator',
      title: 'Indicator',
      kind: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      style,
      legend: {
        title: 'Population',
        entries: [
          { id: 'custom', label: 'Custom', symbol: { kind: 'polygon', fillColor: '#fff' } },
        ],
        byTime: { '2020': { title: 'Population in 2020' } },
      },
    }
    const legend = normalizeLegend(layer, true, null)
    expect(legend?.title).toBe('Population')
    expect(legend?.entries).toHaveLength(1)
    expect(normalizeLegend(layer, true, '2020')?.title).toBe('Population in 2020')
  })

  it('interpolates zoom stops', () => {
    expect(
      interpolateStops(
        [
          { zoom: 0, value: 2 },
          { zoom: 10, value: 12 },
        ],
        5,
        1,
      ),
    ).toBe(7)
  })

  it('derives a normalized gradient legend for heatmaps', () => {
    const legend = normalizeLegend(
      {
        id: 'density',
        title: 'Density',
        kind: 'heatmap',
        data: { type: 'FeatureCollection', features: [] },
        gradient: ['#000000', '#ffffff'],
      },
      true,
      null,
    )
    expect(legend?.entries[0]).toMatchObject({
      label: '0 – 1',
      symbol: {
        kind: 'gradient',
        stops: [
          { value: 0, color: '#000000' },
          { value: 1, color: '#ffffff' },
        ],
      },
    })
  })
})
