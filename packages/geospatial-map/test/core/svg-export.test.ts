import { describe, expect, it } from 'vitest'
import { defaultCanvasTheme } from '../../src/core/canvas-theme'
import { composeVectorSvg } from '../../src/core/svg-export'

describe('vector SVG export', () => {
  it('writes the disclaimer lines under the map and the scale label in the header', () => {
    const svg = composeVectorSvg({
      width: 800,
      height: 600,
      headerHeight: 80,
      legendWidth: 0,
      attributionHeight: 72,
      disclaimerLines: ['Disclaimer: Borders are', 'illustrative & not official.'],
      pixelRatio: 1,
      report: { format: 'image/svg+xml', title: 'Report' },
      time: null,
      selection: null,
      layers: [],
      backgroundColor: '#ddeeff',
      coordinateToPixel: () => null,
      attribution: 'Natural Earth',
      scaleLabel: 'Scale: zoom 2 · Equal Earth',
      theme: defaultCanvasTheme,
    })
    expect(svg).toContain('y="546" ')
    expect(svg).toContain('>Disclaimer: Borders are</text>')
    expect(svg).toContain('y="561" ')
    expect(svg).toContain('>illustrative &amp; not official.</text>')
    expect(svg).toContain('Scale: zoom 2 · Equal Earth')
  })
})
