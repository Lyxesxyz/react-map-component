import { describe, expect, it } from 'vitest'
import {
  createView,
  projectionForZoom,
  safeToLonLat,
  viewToState,
} from '../../src/core/projections'

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

  it('switches a custom Equal Earth view to Mercator at local zoom', () => {
    expect(projectionForZoom(4, 'ESRI:EQUAL-EARTH-CM11', { mode: 'automatic' })).toBe('EPSG:3857')
  })

  it('keeps the view state finite when an Equal Earth map is panned into an extent corner', () => {
    const view = createView({ center: [0, 0], zoom: 1, projection: 'EPSG:8857' })
    const [, , east, north] = view.getProjection().getExtent()
    // The corner of the rectangular extent lies outside the rounded world outline.
    view.setCenter([east! * 0.98, north! * 0.98])
    const state = viewToState(view, { center: [0, 0], zoom: 1, projection: 'EPSG:8857' })
    expect(state.center.every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(state.zoom)).toBe(true)
    expect(state.center[0]).toBeGreaterThan(150)
    expect(() => createView(state)).not.toThrow()
    expect(safeToLonLat([0, 0], view.getProjection())).toEqual([0, 0])
  })
})
