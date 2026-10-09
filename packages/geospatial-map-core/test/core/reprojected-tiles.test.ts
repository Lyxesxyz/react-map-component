import { describe, expect, it } from 'vitest'
import { get as getProjection, getTransform } from 'ol/proj.js'
import RenderFeature from 'ol/render/Feature.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import type { Extent } from 'ol/extent.js'
import {
  areaOutline,
  clipLine,
  clipRing,
  densify,
  reprojectableFeatures,
  withoutCutOutlines,
} from '../../src/core/layers/vector-tile-layer'
import { ensureConfiguredProjection, equalEarth } from '../../src/core/projections'

// Web Mercator vector tiles drawn in Equal Earth (the default Esri basemap): what a tile carries
// is clipped to the tile, long edges follow their curve, and only the data's own edges of areas
// are outlined.

const mercator = getProjection('EPSG:3857')!
const view = ensureConfiguredProjection(equalEarth('EPSG:8857'))
const toView = getTransform(mercator, view)

/** The largest distance (in metres of the view) between `flat`'s segments and the true curve. */
function chordError(flat: number[]) {
  let error = 0
  for (let index = 0; index + 3 < flat.length; index += 2) {
    const [x0, y0, x1, y1] = flat.slice(index, index + 4) as [number, number, number, number]
    const [ax, ay] = toView([x0, y0])
    const [bx, by] = toView([x1, y1])
    const [mx, my] = toView([(x0 + x1) / 2, (y0 + y1) / 2])
    error = Math.max(error, Math.hypot(mx! - (ax! + bx!) / 2, my! - (ay! + by!) / 2))
  }
  return error
}

/** A z2 Web Mercator tile (x 1, y 0: 90° W to 0°, 0° to 66.5° N) and its box one pixel wider. */
const tile: Extent = [-10_018_754.17, 0, 0, 10_018_754.17]
const margin = (tile[2]! - tile[0]!) / 512
const box: Extent = [tile[0]! - margin, -margin, margin, tile[3]! + margin]

describe('reprojected vector tiles', () => {
  it('adds vertices along long edges, so they follow their curve in the map', () => {
    // The western edge of the tile, along the meridian at 90° W: one straight segment.
    const edge = [tile[0]!, tile[3]!, tile[0]!, 0]
    expect(chordError(edge)).toBeGreaterThan(100_000)
    const step = (tile[2]! - tile[0]!) / 64
    const densified = densify(edge, [4], step, [tile[0]!, tile[3]!])
    expect(densified.flat.length / 2).toBe(65)
    expect(densified.ends).toEqual([densified.flat.length])
    expect(chordError(densified.flat)).toBeLessThan(500)
  })

  it('gives edges along the same line the same vertices, so they still coincide', () => {
    const x = tile[0]!
    const step = 1000
    // Down the whole line, then back up part of it from another point (a zero-width bridge).
    const down = densify([x, 9_500, x, 120], [4], step, [x, 10_000]).flat
    const up = densify([x, 2_345, x, 7_890], [4], step, [x, 10_000]).flat
    const pointsOf = (flat: number[]) =>
      new Set(flat.flatMap((value, index) => (index % 2 ? [`${flat[index - 1]},${value}`] : [])))
    const shared = [...pointsOf(up)].filter((point) => pointsOf(down).has(point))
    // The grid vertices between 2,345 and 7,890: 3,000 to 7,000.
    expect(shared).toEqual([3000, 4000, 5000, 6000, 7000].map((y) => `${x},${y}`))
  })

  it('clips areas and lines to the tile', () => {
    // A square reaching past the tile's western edge.
    const ring = [-11e6, 5e6, -5e6, 5e6, -5e6, 1e6, -11e6, 1e6, -11e6, 5e6]
    const clipped = clipRing(ring, box)!
    expect(Math.min(...clipped.filter((_, index) => index % 2 === 0))).toBe(box[0])
    expect(clipped.slice(0, 2)).toEqual(clipped.slice(-2))
    expect(clipRing([-20e6, 5e6, -19e6, 5e6, -19e6, 1e6, -20e6, 5e6], box)).toBeUndefined()
    // A ring around the whole tile becomes the box.
    const around = clipRing([-30e6, 30e6, 30e6, 30e6, 30e6, -30e6, -30e6, -30e6, -30e6, 30e6], box)!
    expect(new Set(around.map((value) => Math.abs(value)))).toEqual(
      new Set([Math.abs(box[0]!), Math.abs(box[3]!), margin]),
    )
    // A line that leaves the tile and comes back: two parts.
    const parts = clipLine([-9e6, 1e6, -12e6, 2e6, -9e6, 3e6, -8e6, 3e6], box)
    expect(parts).toHaveLength(2)
    expect(parts[0]!.slice(0, 2)).toEqual([-9e6, 1e6])
    expect(parts[1]!.slice(-2)).toEqual([-8e6, 3e6])
  })

  it('leaves out what a tile carries past its edges, such as place names across the antimeridian', () => {
    const name = (x: number, y: number) =>
      new RenderFeature('Point', [x, y], [2], 2, { _name: 'Anadyr' }, 1)
    const features = reprojectableFeatures(
      [
        name(-5e6, 5e6),
        // A copy of a place across the antimeridian, in the tile's buffer past 180° W.
        name(-20_200_000, 5e6),
        new RenderFeature('LineString', [-9e6, 1e6, -12e6, 2e6, -9e6, 3e6], [6], 2, {}, 2),
        new RenderFeature(
          'Polygon',
          [-12e6, 2e6, -11e6, 2e6, -11e6, 1e6, -12e6, 2e6],
          [8],
          2,
          {},
          3,
        ),
      ],
      tile,
      box,
    )
    expect(features.map((feature) => [feature.getType(), feature.getId()])).toEqual([
      ['Point', 1],
      ['MultiLineString', 2],
    ])
    const points = reprojectableFeatures(
      [name(-20_200_000, 5e6)],
      [-20_037_508.34, 0, -10_018_754.17, 10_018_754.17],
      [-20_057_078, -19_570, -9_999_184, 10_038_324],
    )
    expect(points).toEqual([])
  })

  it('outlines only the data edges of an area, also once OpenLayers has copied it', () => {
    // Land reaching past the tile's western edge and across its southern edge.
    const land = new RenderFeature(
      'Polygon',
      [-11e6, 5e6, -5e6, 5e6, -5e6, -1e6, -11e6, -1e6, -11e6, 5e6],
      [10],
      2,
      { layer: 'Land' },
      7,
    )
    const [clipped] = reprojectableFeatures([land], tile, box)
    const outline = areaOutline(clipped!.clone())!
    expect(outline.getType()).toBe('MultiLineString')
    const flat = outline.getFlatCoordinates()
    // No segment of the outline runs along the western or southern edge of the box: those are cuts.
    let start = 0
    for (const end of outline.getEnds()!) {
      for (let index = start; index + 3 < end; index += 2) {
        const [x0, y0, x1, y1] = flat.slice(index, index + 4)
        expect(x0 === box[0] && x1 === box[0]).toBe(false)
        expect(y0 === box[1] && y1 === box[1]).toBe(false)
      }
      start = end
    }
    // The data edges (east and north) are there.
    expect(flat).toContain(-5e6)
    expect(flat).toContain(5e6)
    expect(clipped!.get('layer')).toBe('Land')
  })

  it('does not outline the edge of a tile that its tiler cut areas along (no buffer)', () => {
    // Land cut by the tiler exactly along the tile's western edge.
    const land = new RenderFeature(
      'Polygon',
      [tile[0]!, 5e6, -5e6, 5e6, -5e6, 1e6, tile[0]!, 1e6, tile[0]!, 5e6],
      [10],
      2,
      {},
      8,
    )
    const [clipped] = reprojectableFeatures([land], tile, box)
    const flat = areaOutline(clipped!)!.getFlatCoordinates()
    // Three data edges remain, as one line: the cut along the western edge is left out.
    expect(flat.slice(0, 2)).toEqual([tile[0], 5e6])
    expect(flat.slice(-2)).toEqual([tile[0], 1e6])
    expect(areaOutline(clipped!)!.getEnds()).toHaveLength(1)
  })

  it('draws the fill of an area whole and its outline along the data edges', () => {
    const fill = new Fill({ color: '#e6d8ad' })
    const stroke = new Stroke({ color: '#e6d8ad', width: 0.5 })
    const line = new Stroke({ color: '#8f7f6a', width: 1 })
    const style = withoutCutOutlines((feature) =>
      (feature as RenderFeature).getType() === 'Polygon'
        ? new Style({ fill, stroke, zIndex: 3 })
        : new Style({ stroke: line }),
    )
    const area = new RenderFeature('Polygon', [0, 0, 1, 0, 1, 1, 0, 0], [8], 2, {}, 1)
    const styles = style(area, 1) as Style[]
    expect(styles).toHaveLength(2)
    expect(styles[0]!.getFill()).toBe(fill)
    expect(styles[0]!.getStroke()).toBeFalsy()
    expect(styles[1]!.getStroke()).toBe(stroke)
    expect(styles[1]!.getFill()).toBeFalsy()
    expect(styles[1]!.getGeometryFunction()).toBe(areaOutline)
    expect(styles.map((item) => item.getZIndex())).toEqual([3, 3])
    const border = new RenderFeature('LineString', [0, 0, 1, 1], [4], 2, {}, 2)
    expect((style(border, 1) as Style).getStroke()).toBe(line)
  })
})
