import { describe, expect, it } from 'vitest'
import { canvasFont, defaultCanvasTheme, readCanvasTheme } from '../../src/core/canvas-theme'
import { selectionStyleForGeometry } from '../../src/core/style-compiler'

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
})
