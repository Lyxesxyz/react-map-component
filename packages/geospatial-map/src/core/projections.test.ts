import { describe, expect, it } from 'vitest'
import { createView, projectionForZoom, viewToState } from './projections.js'

describe('projection state', () => {
  it('uses hysteresis for automatic switching', () => {
    expect(projectionForZoom(4, 'EPSG:8857', { mode: 'automatic' })).toBe('EPSG:3857')
    expect(projectionForZoom(3.8, 'EPSG:3857', { mode: 'automatic' })).toBe('EPSG:3857')
    expect(projectionForZoom(3.4, 'EPSG:3857', { mode: 'automatic' })).toBe('EPSG:8857')
  })

  it('round-trips a canonical view in both supported projections', () => {
    for (const projection of ['EPSG:8857', 'EPSG:3857'] as const) {
      const expected = { center: [23.32, 42.7] as const, zoom: 3, projection }
      const actual = viewToState(createView(expected), expected)
      expect(actual.center[0]).toBeCloseTo(expected.center[0], 5)
      expect(actual.center[1]).toBeCloseTo(expected.center[1], 5)
      expect(actual.zoom).toBeCloseTo(expected.zoom, 5)
    }
  })
})
