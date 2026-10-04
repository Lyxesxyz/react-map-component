import { describe, expect, it } from 'vitest'
import { defaultCanvasTheme } from '../../src/core/canvas-theme'
import { renderReportSvg, reportLayout } from '../../src/core/report'
import type { NormalizedLegend } from '../../src/types'

const legends: NormalizedLegend[] = [
  {
    layerId: 'rate',
    title: 'Rate',
    visible: true,
    entries: [
      { id: 'low', label: 'Low', symbol: { kind: 'polygon', fillColor: '#eeeeee' } },
      { id: 'custom', label: 'Written by hand', symbol: { kind: 'line', color: '#000000' } },
      {
        id: 'ramp',
        label: '0 – 10',
        symbol: {
          kind: 'gradient',
          stops: [
            { value: 0, color: '#000000' },
            { value: 10, color: '#ffffff' },
          ],
        },
      },
    ],
  },
  { layerId: 'hidden', title: 'Hidden', visible: false, entries: [] },
]

const layout = reportLayout({
  options: {
    format: 'image/svg+xml',
    width: 800,
    height: 600,
    title: 'Report',
    disclaimer: 'Disclaimer: Borders are illustrative & not official.',
  },
  details: { scale: 'Scale: zoom 2 · Equal Earth' },
  legends,
  attribution: 'Natural Earth',
  mapBackground: '#ddeeff',
  measure: (text) => text.length * 10,
})

describe('export report', () => {
  it('lays out the header, the screen legend, the disclaimer and the attribution once', () => {
    const texts = layout.items.flatMap((item) => (item.kind === 'text' ? [item.text] : []))
    expect(texts).toEqual([
      'Report',
      'Scale: zoom 2 · Equal Earth',
      'Rate',
      'Low',
      'Written by hand',
      '0 – 10',
      'Disclaimer: Borders are illustrative & not official.',
      'Natural Earth',
    ])
    expect(layout.items.filter((item) => item.kind === 'swatch')).toHaveLength(2)
    expect(layout.items.filter((item) => item.kind === 'gradient')).toHaveLength(1)
    expect(layout.map).toEqual({ x: 0, y: 92, width: 520, height: 600 - 92 - 38 - 15 - 8 })
  })

  it('wraps a long disclaimer to the report width', () => {
    const narrow = reportLayout({
      options: { format: 'image/png', width: 400, height: 600, disclaimer: 'word '.repeat(40) },
      details: { scale: '' },
      legends: [],
      attribution: '',
      mapBackground: '#fff',
      measure: (text) => text.length * 10,
    })
    const lines = narrow.items.filter((item) => item.kind === 'text')
    expect(lines.length).toBeGreaterThan(3)
  })

  it('draws the same items in SVG, escaped', () => {
    const svg = renderReportSvg(layout, '<circle r="1"/>', defaultCanvasTheme, 'note')
    expect(svg).toContain('>Written by hand</text>')
    expect(svg).toContain('illustrative &amp; not official.</text>')
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('<circle r="1"/>')
    expect(svg).toContain(`y="${600 - 14}"`)
  })
})
