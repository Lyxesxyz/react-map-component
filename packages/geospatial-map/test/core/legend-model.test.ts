import { describe, expect, it } from 'vitest'
import {
  legendEntriesForStyle,
  normalizeHeatmapLegend,
  normalizeLegend,
} from '../../src/core/legend-model'
import { interpolateStops, symbolForValue } from '../../src/core/style-compiler'
import type { ThematicStyleSpec } from '../../src/types'

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
    expect(symbolForValue(style, 12)).toMatchObject({ fillColor: '#0057b8' })
    expect(legendEntriesForStyle(style).map((entry) => entry.label)).toEqual([
      'Low',
      'High',
      'No data',
    ])
  })

  it('lets explicit legend copy override generated entries', () => {
    const legend = normalizeLegend('indicator', 'Indicator', true, style, {
      title: 'Population',
      entries: [{ id: 'custom', label: 'Custom', symbol: { kind: 'polygon', fillColor: '#fff' } }],
    })
    expect(legend?.title).toBe('Population')
    expect(legend?.entries).toHaveLength(1)
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
    const legend = normalizeHeatmapLegend(
      {
        id: 'density',
        title: 'Density',
        role: 'indicator',
        kind: 'heatmap',
        data: { type: 'FeatureCollection', features: [] },
        gradient: ['#000000', '#ffffff'],
      },
      true,
    )
    expect(legend.entries[0]).toMatchObject({
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
