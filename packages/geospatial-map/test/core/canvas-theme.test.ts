import { describe, expect, it } from 'vitest'
import { canvasFont, defaultCanvasTheme, readCanvasTheme } from '../../src/core/canvas-theme'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import type { Style } from 'ol/style.js'
import { compileThematicStyle, selectionStyleForGeometry } from '../../src/core/style-compiler'

describe('canvas theme', () => {
  it('falls back to defaults outside the browser', () => {
    expect(readCanvasTheme(undefined)).toEqual(defaultCanvasTheme)
  })

  it('formats canvas fonts from the resolved font family', () => {
    expect(canvasFont({ ...defaultCanvasTheme, fontFamily: '"Brand Sans", serif' }, 12, 500)).toBe(
      '500 12px "Brand Sans", serif',
    )
  })

  it('draws the selection highlight with themed colors', () => {
    const theme = { ...defaultCanvasTheme, selectionFill: 'red', selectionStroke: 'blue' }
    const style = selectionStyleForGeometry('Polygon', theme)
    expect(style.getFill()?.getColor()).toBe('red')
    expect(style.getStroke()?.getColor()).toBe('blue')
  })

  it('draws map labels in the theme label size and weight', () => {
    const theme = { ...defaultCanvasTheme, fontFamily: 'Serif', labelSize: 13, labelWeight: '600' }
    const style = compileThematicStyle(
      { type: 'constant', symbol: { kind: 'point', fillColor: '#000', labelField: 'name' } },
      () => 3,
      () => null,
      undefined,
      () => theme,
    )
    const feature = new Feature({ geometry: new Point([0, 0]), name: 'Sofia' })
    const result = (style as (feature: Feature, resolution: number) => Style | Style[])(feature, 1)
    const text = (Array.isArray(result) ? result[0] : result)?.getText()
    expect(text?.getFont()).toBe('600 13px Serif')
  })
})
