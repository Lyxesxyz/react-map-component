import { describe, expect, it } from 'vitest'
import {
  fromLonLat,
  get as getProjection,
  getTransform,
  toLonLat,
  transformExtent,
} from 'ol/proj.js'
import {
  createView,
  ensureConfiguredProjection,
  equalEarth,
  registerReprojection,
  safeToLonLat,
  viewToState,
} from '../../src/core/projections'

describe('projection state', () => {
  it('round-trips a canonical view in both supported projections', () => {
    for (const projection of ['EPSG:8857', 'EPSG:3857'] as const) {
      const expected = { center: [23.32, 42.7] as const, zoom: 3, projection }
      const actual = viewToState(createView(expected))
      expect(actual.center[0]).toBeCloseTo(expected.center[0], 5)
      expect(actual.center[1]).toBeCloseTo(expected.center[1], 5)
      expect(actual.zoom).toBeCloseTo(expected.zoom, 5)
    }
  })

  it('keeps the view state finite when an Equal Earth map is panned into an extent corner', () => {
    const view = createView({ center: [0, 0], zoom: 1, projection: 'EPSG:8857' })
    const [, , east, north] = view.getProjection().getExtent()
    // The corner of the rectangular extent lies outside the rounded world outline.
    view.setCenter([east! * 0.98, north! * 0.98])
    const state = viewToState(view)
    expect(state.center.every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(state.zoom)).toBe(true)
    expect(state.center[0]).toBeGreaterThan(150)
    expect(() => createView(state)).not.toThrow()
    expect(safeToLonLat([0, 0], view.getProjection())).toEqual([0, 0])
  })
})

describe('Web Mercator tiles drawn in Equal Earth', () => {
  const equalEarthMap = () => {
    const view = ensureConfiguredProjection(equalEarth('EPSG:8857'))
    const mercator = getProjection('EPSG:3857')!
    registerReprojection(mercator, view)
    return { view, mercator }
  }

  it('puts points past the antimeridian (tile buffers) on the edge of the world', () => {
    const { view, mercator } = equalEarthMap()
    const toView = getTransform(mercator, view)
    const [west, , east] = mercator.getExtent()!
    for (const latitude of [0, 45, 71]) {
      const y = fromLonLat([0, latitude], mercator)[1]!
      const edge = fromLonLat([-180, latitude], view)
      // 64 units of a 4096-unit z0 tile past each edge: the same point as the edge itself.
      expect(toView([west! - 626_000, y])[0]).toBeCloseTo(edge[0]!, 0)
      expect(toView([east! + 626_000, y])[0]).toBeCloseTo(-edge[0]!, 0)
    }
  })

  it('finds the tiles of every part of the view, also its corners and poles', () => {
    const { view, mercator } = equalEarthMap()
    const [left, bottom, right, top] = view.getExtent()!
    const corners = transformExtent([left!, bottom!, right!, top!], view, mercator)
    expect(corners.every(Number.isFinite)).toBe(true)
    expect(corners[0]).toBeCloseTo(mercator.getExtent()![0]!, 0)
    expect(corners[3]).toBeLessThanOrEqual(mercator.getExtent()![3]!)
    // The western quarter of the world above the equator maps to longitudes −180° to −90°.
    const quarter = transformExtent([left!, 0, left! / 2, top!], view, mercator)
    expect(toLonLat([quarter[0]!, quarter[1]!], mercator)[0]).toBeCloseTo(-180, 6)
    expect(toLonLat([quarter[2]!, quarter[3]!], mercator)[0]).toBeCloseTo(-90, 0)
    expect(toLonLat([quarter[2]!, quarter[3]!], mercator)[1]).toBeCloseTo(85, 1)
  })
})
