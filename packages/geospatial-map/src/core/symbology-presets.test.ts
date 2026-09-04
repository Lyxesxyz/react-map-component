import { describe, expect, it } from 'vitest'
import { createClassifiedPolygonStyle } from './symbology-presets.js'
import { legendEntriesForStyle } from './legend-model.js'
import { symbolForValue } from './style-compiler.js'

describe('approved symbology presets', () => {
  it('builds bounded equal-interval and quantile classes', () => {
    for (const method of ['equal-interval', 'quantile'] as const) {
      const style = createClassifiedPolygonStyle({
        field: 'value',
        values: [1, 2, 3, 30, 90],
        palette: 'viridis',
        method,
        classCount: 4,
        range: [0, 100],
      })
      expect(style.type).toBe('graduated')
      expect(legendEntriesForStyle(style)).toHaveLength(6)
      expect(symbolForValue(style, 101)).toMatchObject({ dash: [3, 3] })
    }
  })
})
