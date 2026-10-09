// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import {
  buffer,
  containsXY,
  getHeight,
  getIntersection,
  getWidth,
  intersects,
  isEmpty,
} from 'ol/extent.js'
import type { Extent } from 'ol/extent.js'
import type { ReadOptions } from 'ol/format/Feature.js'
import MVT from 'ol/format/MVT.js'
import RenderFeature from 'ol/render/Feature.js'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import VectorTileSource from 'ol/source/VectorTile.js'
import type { TileCoord } from 'ol/tilecoord.js'
import { createXYZ, extentFromProjection } from 'ol/tilegrid.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'
import Style from 'ol/style/Style.js'
import type { StyleFunction } from 'ol/style/Style.js'
import type { FeatureLike } from 'ol/Feature.js'
import { unByKey } from 'ol/Observable.js'
import { equivalent, get as getProjection, getTransform, transformExtent } from 'ol/proj.js'
import { renderXYZTemplate } from 'ol/uri.js'
import type { TransformFunction } from 'ol/proj.js'
import type Projection from 'ol/proj/Projection.js'
import type VectorTile from 'ol/VectorTile.js'
import type { TileGridSpec, VectorTileLayerConfig } from '../../types'
import { warnOnce } from '../../utils'
import { fetchBytes } from '../http'
import { isCssColor, paint } from '../canvas-theme'
import { registerReprojection } from '../projections'
import { timeMode, withTime } from '../time'
import { loadStyleDocument, prepareStyle } from '../vector-style'
import {
  attributionText,
  layerOptions,
  redrawOn,
  thematicLayerStyle,
  watchTiles,
  withSelection,
} from './common'
import type { BuiltLayer, LayerChange, LayerEnvironment, LayerReporter } from './common'

// Vector tile (`mvt`) layers, styled by a thematic style or a Mapbox GL style document (the
// format of ArcGIS vector tile styles).

/**
 * `grid` without the levels past `maxSourceZoom`, so the map draws them overzoomed instead of
 * asking the service for tiles it may not have (OpenLayers ignores a source's `maxZoom` when it
 * is given a tile grid).
 */
export function lastSourceLevel(
  grid: TileGridSpec,
  maxSourceZoom: number | undefined,
): TileGridSpec {
  if (maxSourceZoom === undefined || maxSourceZoom >= grid.resolutions.length - 1) return grid
  return { ...grid, resolutions: grid.resolutions.slice(0, Math.max(1, maxSourceZoom + 1)) }
}

/** The options of an OpenLayers tile grid from the config's (`TileGrid`, `WMTSTileGrid`). */
export function tileGridOptions(grid: TileGridSpec) {
  const size = grid.tileSize
  return {
    extent: [...grid.extent],
    origin: [...grid.origin],
    resolutions: grid.resolutions,
    tileSize: size === undefined || typeof size === 'number' ? size : [size[0], size[1]],
  }
}

/** How far a reprojected tile reaches past its edges: one pixel of a 512-pixel tile. */
const TILE_OVERLAP = 1 / 512

/**
 * A service tile's extent reaching `TILE_OVERLAP` past each edge, into the buffer vector tiles
 * carry around them, so that where two tiles meet along a line of the map they overlap instead
 * of leaving a faint seam. `OverlapFormat` still places the features by the tile's own extent.
 */
function overlapping(extent: Extent): Extent {
  const margin = (extent[2]! - extent[0]!) * TILE_OVERLAP
  return [extent[0]! - margin, extent[1]! - margin, extent[2]! + margin, extent[3]! + margin]
}

/** The grid `densify` adds vertices on in a reprojected tile: this many steps to its width. */
const DENSIFY_STEPS = 64

/**
 * The parts of a line or polygon (`flat` x, y pairs, each part ending at an index in `ends`)
 * with a vertex added wherever a segment crosses a line of the grid of `step` through `origin`.
 * Reprojection moves only the vertices, so a long edge stays straight: the edges along which a
 * tile's polygons are clipped run along meridians, curved in Equal Earth, and drawn straight they
 * cut slivers of land and water across the map where tiles meet. Edges along the same line get
 * the same vertices, so they still coincide once moved.
 */
export function densify(
  flat: readonly number[],
  ends: readonly number[],
  step: number,
  origin: readonly [number, number],
): { flat: number[]; ends: number[] } {
  const [originX, originY] = origin
  const result: number[] = []
  const resultEnds: number[] = []
  // The crossings of one segment: t, x, y.
  const crossings: number[] = []
  let start = 0
  for (const end of ends) {
    for (let index = start; index < end; index += 2) {
      const x0 = flat[index]!
      const y0 = flat[index + 1]!
      result.push(x0, y0)
      if (index + 2 >= end) break
      const x1 = flat[index + 2]!
      const y1 = flat[index + 3]!
      const column0 = Math.floor((x0 - originX) / step)
      const column1 = Math.floor((x1 - originX) / step)
      const row0 = Math.floor((y0 - originY) / step)
      const row1 = Math.floor((y1 - originY) / step)
      // Most segments of real data are short and cross no line of the grid.
      if (column0 === column1 && row0 === row1) continue
      crossings.length = 0
      if (x0 !== x1)
        for (let k = Math.min(column0, column1); k <= Math.max(column0, column1) + 1; k++) {
          const x = originX + k * step
          if (x <= Math.min(x0, x1) || x >= Math.max(x0, x1)) continue
          const t = (x - x0) / (x1 - x0)
          crossings.push(t, x, y0 + t * (y1 - y0))
        }
      if (y0 !== y1)
        for (let k = Math.min(row0, row1); k <= Math.max(row0, row1) + 1; k++) {
          const y = originY + k * step
          if (y <= Math.min(y0, y1) || y >= Math.max(y0, y1)) continue
          const t = (y - y0) / (y1 - y0)
          crossings.push(t, x0 + t * (x1 - x0), y)
        }
      const order = Array.from({ length: crossings.length / 3 }, (_, at) => at * 3)
      if (order.length > 1) order.sort((a, b) => crossings[a]! - crossings[b]!)
      for (const at of order) result.push(crossings[at + 1]!, crossings[at + 2]!)
    }
    resultEnds.push(result.length)
    start = end
  }
  return { flat: result, ends: resultEnds }
}

/** The bounds of `flat` (x, y pairs). */
function boundsOf(flat: readonly number[]): [number, number, number, number] {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let index = 0; index < flat.length; index += 2) {
    const x = flat[index]!
    const y = flat[index + 1]!
    if (x < west) west = x
    if (x > east) east = x
    if (y < south) south = y
    if (y > north) north = y
  }
  return [west, south, east, north]
}

/**
 * The closed ring `ring` (x, y pairs, the first repeated last) clipped to `box`
 * (Sutherland–Hodgman), closed, or `undefined` when nothing of it is left. Where the ring leaves
 * the box and comes back, the result runs along the box's edge (a zero-width bridge); filled, it
 * covers exactly the part of the ring's area inside the box.
 */
export function clipRing(ring: readonly number[], box: Extent): number[] | undefined {
  const [west, south, east, north] = boundsOf(ring)
  if (west >= box[0]! && south >= box[1]! && east <= box[2]! && north <= box[3]!) return [...ring]
  if (west > box[2]! || south > box[3]! || east < box[0]! || north < box[1]!) return undefined
  const closed = ring.length > 2 && ring[0] === ring.at(-2) && ring[1] === ring.at(-1)
  let points: readonly number[] = closed ? ring.slice(0, -2) : ring
  for (let edge = 0; edge < 4 && points.length; edge++) {
    // West, south, east, north: the coordinate kept at or above (west, south) or at or below.
    const axis = edge % 2
    const bound = box[edge]!
    const inside = (value: number) => (edge < 2 ? value >= bound : value <= bound)
    const clipped: number[] = []
    const count = points.length / 2
    for (let index = 0; index < count; index++) {
      const next = ((index + 1) % count) * 2
      const ax = points[index * 2]!
      const ay = points[index * 2 + 1]!
      const bx = points[next]!
      const by = points[next + 1]!
      const a = axis === 0 ? ax : ay
      const b = axis === 0 ? bx : by
      if (inside(a)) clipped.push(ax, ay)
      if (inside(a) !== inside(b)) {
        const t = (bound - a) / (b - a)
        clipped.push(
          axis === 0 ? bound : ax + t * (bx - ax),
          axis === 0 ? ay + t * (by - ay) : bound,
        )
      }
    }
    points = clipped
  }
  if (points.length < 6) return undefined
  let area = 0
  for (let index = 0; index < points.length; index += 2) {
    const next = (index + 2) % points.length
    area += points[index]! * points[next + 1]! - points[next]! * points[index + 1]!
  }
  return area === 0 ? undefined : [...points, points[0]!, points[1]!]
}

/** The parts of the line `line` (x, y pairs) inside `box` (Liang–Barsky, segment by segment). */
export function clipLine(line: readonly number[], box: Extent): number[][] {
  const parts: number[][] = []
  let part: number[] = []
  const finish = () => {
    if (part.length >= 4) parts.push(part)
    part = []
  }
  const [west, south, east, north] = boundsOf(line)
  if (west >= box[0]! && south >= box[1]! && east <= box[2]! && north <= box[3]!) return [[...line]]
  if (west > box[2]! || south > box[3]! || east < box[0]! || north < box[1]!) return []
  for (let index = 0; index + 3 < line.length; index += 2) {
    const x0 = line[index]!
    const y0 = line[index + 1]!
    const dx = line[index + 2]! - x0
    const dy = line[index + 3]! - y0
    let from = 0
    let to = 1
    // Liang–Barsky: the part of the segment on the inner side of each edge of the box.
    for (let edge = 0; edge < 4; edge++) {
      const p = edge === 0 ? -dx : edge === 1 ? dx : edge === 2 ? -dy : dy
      const q =
        edge === 0
          ? x0 - box[0]!
          : edge === 1
            ? box[2]! - x0
            : edge === 2
              ? y0 - box[1]!
              : box[3]! - y0
      if (p === 0) {
        if (q < 0) from = 2
      } else if (p < 0) from = Math.max(from, q / p)
      else to = Math.min(to, q / p)
    }
    if (from > to) {
      finish()
      continue
    }
    if (!part.length || from > 0) {
      finish()
      part.push(x0 + from * dx, y0 + from * dy)
    }
    part.push(x0 + to * dx, y0 + to * dy)
    if (to < 1) finish()
  }
  finish()
  return parts
}

/** `feature` with the lines or areas `flat` (clipped to `box`), its cut edges marked. */
function reprojectable(
  feature: RenderFeature,
  type: string,
  flat: number[],
  ends: number[],
  extent: Extent,
  box: Extent,
): RenderFeature {
  const kind = type === 'Polygon' ? type : ends.length > 1 ? 'MultiLineString' : 'LineString'
  const properties: Record<PropertyKey, unknown> = { ...feature.getProperties() }
  const cuts = type === 'Polygon' ? cutEdges(flat, ends, extent, box) : undefined
  if (cuts?.size) properties[CUT_EDGES] = cuts
  return new RenderFeature(kind, flat, ends, 2, properties, feature.getId())
}

/**
 * The features of a tile ready to be drawn in another projection than the tiles'. A tile of the
 * map is a rectangle, made of service tiles whose sides are curved there (Web Mercator tiles in
 * Equal Earth), so what vector tiles carry past their edges (a buffer, cut along straight lines,
 * and at the antimeridian the other side of the world) would be drawn over the neighbouring
 * tiles: twice where the neighbours draw it too (dashes and transparent fills look darker), the
 * cut edges of areas outlined, and copies of place names pressed onto the far edge of the world.
 * So lines and areas are clipped to `box` (the tile's `extent`, reaching a pixel past it so
 * neighbours meet without a seam) and densified (see `densify`), and points outside `extent` are
 * left out (the neighbour draws them).
 */
export function reprojectableFeatures(
  features: RenderFeature[],
  extent: Extent,
  box: Extent,
): RenderFeature[] {
  const step = (extent[2]! - extent[0]!) / DENSIFY_STEPS
  const origin = [extent[0]!, extent[3]!] as const
  const result: RenderFeature[] = []
  for (const feature of features) {
    const type = feature.getType()
    const flat = feature.getFlatCoordinates()
    if (type === 'Point' || type === 'MultiPoint') {
      if (containsXY(extent, flat[0]!, flat[1]!)) result.push(feature)
      continue
    }
    const ends = feature.getEnds() ?? [flat.length]
    const [west, south, east, north] = boundsOf(flat)
    if (west >= box[0]! && south >= box[1]! && east <= box[2]! && north <= box[3]!) {
      // Inside the tile, as most features are: nothing to clip.
      const densified = densify(flat, ends, step, origin)
      result.push(reprojectable(feature, type, densified.flat, densified.ends, extent, box))
      continue
    }
    const parts: number[][] = []
    let start = 0
    for (const end of ends) {
      const part = flat.slice(start, end)
      start = end
      if (type === 'Polygon') {
        const ring = clipRing(part, box)
        if (ring) parts.push(ring)
      } else parts.push(...clipLine(part, box))
    }
    if (!parts.length) continue
    let length = 0
    const clipped = densify(
      parts.flat(),
      parts.map((part) => (length += part.length)),
      step,
      origin,
    )
    result.push(reprojectable(feature, type, clipped.flat, clipped.ends, extent, box))
  }
  return result
}

/** The property of a clipped area that lists the edges cut along its tile (see `cutEdges`). */
const CUT_EDGES = Symbol('cut edges')

/**
 * The indices in `flat` of the segments of an area's rings that lie along an edge of the tile:
 * where `reprojectableFeatures` cut it (`box`), or where the tiles were cut (`extent`, for tiles
 * without a buffer).
 */
export function cutEdges(
  flat: readonly number[],
  ends: readonly number[],
  extent: Extent,
  box: Extent,
) {
  const tolerance = (extent[2]! - extent[0]!) * 1e-9
  const on = (value: number, a: number, b: number, c: number, d: number) =>
    Math.abs(value - a) <= tolerance ||
    Math.abs(value - b) <= tolerance ||
    Math.abs(value - c) <= tolerance ||
    Math.abs(value - d) <= tolerance
  const cuts = new Set<number>()
  let start = 0
  for (const end of ends) {
    for (let index = start; index + 3 < end; index += 2) {
      const x0 = flat[index]!
      const y0 = flat[index + 1]!
      const x1 = flat[index + 2]!
      const y1 = flat[index + 3]!
      if (
        (Math.abs(x1 - x0) <= tolerance && on(x0, box[0]!, box[2]!, extent[0]!, extent[2]!)) ||
        (Math.abs(y1 - y0) <= tolerance && on(y0, box[1]!, box[3]!, extent[1]!, extent[3]!))
      )
        cuts.add(index)
    }
    start = end
  }
  return cuts
}

/** The outline of an area from `reprojectableFeatures` without the edges cut along its tile. */
export function areaOutline(feature: FeatureLike): RenderFeature | undefined {
  const area = feature as RenderFeature
  const cuts = area.get(CUT_EDGES as unknown as string) as Set<number> | undefined
  if (!cuts?.size) return area
  const flat = area.getFlatCoordinates()
  const lines: number[] = []
  const ends: number[] = []
  let start = 0
  for (const end of area.getEnds() ?? [flat.length]) {
    let open = false
    for (let index = start; index + 3 < end; index += 2) {
      if (cuts.has(index)) {
        if (open) ends.push(lines.length)
        open = false
        continue
      }
      if (!open) lines.push(flat[index]!, flat[index + 1]!)
      open = true
      lines.push(flat[index + 2]!, flat[index + 3]!)
    }
    if (open) ends.push(lines.length)
    start = end
  }
  return lines.length
    ? new RenderFeature('MultiLineString', lines, ends, 2, {}, undefined)
    : undefined
}

/**
 * A Mapbox GL style function for tiles drawn in another projection, which outlines areas only
 * along their own edges: `reprojectableFeatures` cuts areas along their tile, and ol-mapbox-style
 * outlines every filled area (in its `fill-outline-color`, or its fill colour), so the cuts would
 * be outlined across the map, over land and water.
 */
export function withoutCutOutlines(style: StyleFunction): StyleFunction {
  const split = new WeakMap<Style, { fill: Style; stroke: Style }>()
  return (feature, resolution) => {
    const styles = style(feature, resolution)
    if (!styles || (feature as RenderFeature).getType?.() !== 'Polygon') return styles
    return (Array.isArray(styles) ? styles : [styles]).flatMap((item) => {
      const stroke = item.getStroke()
      if (!stroke || item.getText()) return [item]
      let parts = split.get(item)
      if (!parts) {
        parts = { fill: new Style(), stroke: new Style({ geometry: areaOutline }) }
        split.set(item, parts)
      }
      const fill = item.getFill()
      parts.fill.setFill(fill)
      parts.stroke.setStroke(stroke)
      parts.fill.setZIndex(item.getZIndex())
      parts.stroke.setZIndex(item.getZIndex())
      return fill ? [parts.fill, parts.stroke] : [parts.stroke]
    })
  }
}

/**
 * Reads a service tile at its own extent (the `extent` it is read with is `overlapping`), clipped
 * and densified to be reprojected (`reprojectableFeatures`), and moves it into the map's
 * projection with `toView`.
 */
export class OverlapFormat extends MVT<RenderFeature> {
  private readonly toView: TransformFunction

  constructor(options: ConstructorParameters<typeof MVT>[0], toView: TransformFunction) {
    super(options)
    this.toView = toView
  }

  override readFeatures(source: ArrayBuffer, options?: ReadOptions): RenderFeature[] {
    const box = options?.extent
    // Without its extent a tile can't be placed, let alone moved into the map's projection.
    if (!box) throw new Error('A reprojected vector tile is read with its extent')
    const margin = ((box[2]! - box[0]!) * TILE_OVERLAP) / (1 + 2 * TILE_OVERLAP)
    const own: Extent = [box[0]! + margin, box[1]! + margin, box[2]! - margin, box[3]! - margin]
    const features = reprojectableFeatures(
      super.readFeatures(source, { ...options, extent: own }),
      own,
      box,
    )
    for (const feature of features) feature.applyTransform(this.toView)
    return features
  }
}

/** How many service tiles a reprojected source keeps, for the tiles of the map that share them. */
const SERVICE_TILE_CACHE = 256

/**
 * The size of the tiles of the map a reprojected source puts together, in pixels: that of the
 * grid OpenLayers draws a source in another projection on. Larger tiles reach further past the
 * view, so they read more service tiles (three times as many when zoomed in on a city).
 */
const MAP_TILE_SIZE = 256

/**
 * How far past a tile of the map, in pixels, the lines and areas drawn in it may lie: a wide
 * stroke just outside the tile still reaches into it. OpenLayers' default `renderBuffer`.
 */
const RENDER_BUFFER = 100

/**
 * The points of `parts` (read service tiles) in `extent` (a tile of the map, at `resolution`), and
 * their lines and areas within `RENDER_BUFFER` of it.
 */
export function featuresIn(
  parts: readonly RenderFeature[][],
  extent: Extent,
  resolution: number,
): RenderFeature[] {
  const around = buffer(extent, RENDER_BUFFER * resolution)
  const result: RenderFeature[] = []
  for (const part of parts)
    for (const feature of part) {
      const type = feature.getType()
      if (type === 'Point' || type === 'MultiPoint') {
        // In one tile only, so a label is placed once.
        const flat = feature.getFlatCoordinates()
        if (containsXY(extent, flat[0]!, flat[1]!)) result.push(feature)
      } else if (intersects(around, feature.getExtent())) result.push(feature)
    }
  return result
}

/**
 * The source of a basemap whose vector tiles are in another projection than the map's (a Web
 * Mercator service drawn in Equal Earth). Its tiles are tiles of the map's projection, each put
 * together from the service tiles it covers, which are read once each (`OverlapFormat`: clipped
 * to their tile, reaching a pixel past it, and moved into the map's projection) and kept for the
 * neighbouring tiles of the map. The service tiles are chosen as OpenLayers would (by resolution,
 * up to the last level the service has), so the style's zoom levels keep matching the data.
 *
 * OpenLayers can draw a source in another projection itself, but then each tile of the map is
 * drawn service tile by service tile, all the style layers of one before the next: where two
 * service tiles overlap along a curve, the later one's lower layers (the light sea under the deep
 * sea) showed through its anti-aliased edge as a hairline. And it reprojected every vertex each
 * time it drew a tile, which held the map for seconds while zooming. Here each tile of the map is
 * one tile to OpenLayers, drawn style layer by style layer, with features in the map's projection.
 *
 * @param template The service's tile URL (`{z}`, `{x}`, `{y}`), read when a tile loads.
 */
export function reprojectedTileSource(
  config: VectorTileLayerConfig,
  view: Projection,
  template: () => string,
  attributions?: ReturnType<typeof attributionText>,
): VectorTileSource<RenderFeature> {
  const tiles = getProjection(config.sourceProjection)!
  const serviceGrid = config.tileGrid
    ? new TileGrid(tileGridOptions(config.tileGrid))
    : createXYZ({ extent: extentFromProjection(tiles), maxZoom: 22, tileSize: 512 })
  const lastZoom = Math.min(config.maxSourceZoom ?? Infinity, serviceGrid.getMaxZoom())
  const format = new OverlapFormat({ idProperty: config.featureIdField }, getTransform(tiles, view))
  const unitRatio = (view.getMetersPerUnit() ?? 1) / (tiles.getMetersPerUnit() ?? 1)
  const urlOf = ([z, x, y]: [number, number, number]) => {
    const rows = serviceGrid.getFullTileRange(z)
    return renderXYZTemplate(template(), z, x, y, rows ? rows.getHeight() - 1 : undefined)
  }
  // Read service tiles, most recently used last.
  const read = new Map<string, Promise<RenderFeature[]>>()
  const readTile = (coord: TileCoord): Promise<RenderFeature[]> => {
    const url = urlOf(coord as [number, number, number])
    let features = read.get(url)
    if (features) read.delete(url)
    else {
      const reading = fetchBytes(url).then((bytes) =>
        format.readFeatures(bytes, {
          extent: overlapping(serviceGrid.getTileCoordExtent(coord)),
          featureProjection: tiles,
        }),
      )
      // A failure is forgotten, so the tile is asked for again when the map needs it.
      reading.catch(() => {
        if (read.get(url) === reading) read.delete(url)
      })
      features = reading
    }
    read.set(url, features)
    while (read.size > SERVICE_TILE_CACHE) read.delete(read.keys().next().value!)
    return features
  }
  /** The service tiles a tile of the map at `extent` and `resolution` is put together from. */
  const serviceTiles = (extent: Extent, resolution: number): TileCoord[] => {
    const zoom = Math.min(lastZoom, serviceGrid.getZForResolution(resolution * unitRatio, 1))
    // As OpenLayers: a pixel smaller, so no tile is read for less than half a pixel of the map.
    const inner = buffer(extent, -resolution)
    const area = getIntersection(transformExtent(inner, view, tiles, 8), serviceGrid.getExtent())
    const coords: TileCoord[] = []
    if (!isEmpty(area))
      serviceGrid.forEachTileCoord(area, zoom, (coord) => coords.push([...coord] as TileCoord))
    return coords
  }
  // Deep enough for the service's last level (a level more, as levels rarely line up); the map
  // draws deeper levels overzoomed.
  const extent = extentFromProjection(view)
  const topResolution = Math.max(getWidth(extent), getHeight(extent)) / MAP_TILE_SIZE
  const lastResolution = serviceGrid.getResolution(lastZoom) / unitRatio
  const grid = createXYZ({
    extent,
    tileSize: MAP_TILE_SIZE,
    maxZoom: Math.max(0, Math.ceil(Math.log2(topResolution / lastResolution)) + 1),
  })
  return new VectorTileSource<RenderFeature>({
    projection: view,
    tileGrid: grid,
    format,
    // The key of a tile of the map; its loader reads the service's tiles itself.
    tileUrlFunction: (coord) => `${template()}#${coord.join('/')}`,
    tileLoadFunction: (tile) => {
      const target = tile as VectorTile<RenderFeature>
      target.setLoader((extent, resolution) => {
        // Whatever fails (a service tile, reading it), the tile fails: the map never waits on it.
        Promise.resolve()
          .then(() => Promise.all(serviceTiles(extent, resolution).map(readTile)))
          .then((parts) => target.onLoad(featuresIn(parts, extent, resolution), view))
          .catch(() => target.onError())
      })
    },
    wrapX: false,
    ...(attributions ? { attributions } : {}),
  })
}

/**
 * Tile sources shared between layers that draw different style layers of the same tiles (an
 * ArcGIS basemap and its labels), so each tile is downloaded once.
 */
export class SharedSourcePool {
  private readonly entries = new Map<string, { source: VectorTileSource; users: number }>()

  /** The source for `key`, created by `create` for its first user; call `release` when done. */
  acquire(key: string, create: () => VectorTileSource) {
    const entry = this.entries.get(key) ?? { source: create(), users: 0 }
    entry.users += 1
    this.entries.set(key, entry)
    return {
      source: entry.source,
      release: () => {
        entry.users -= 1
        if (entry.users <= 0) this.entries.delete(key)
      },
    }
  }
}

/** Zoom levels a style is numbered to, past the last level of a service (drawn overzoomed). */
const STYLE_ZOOM_LEVELS = 25

/**
 * The resolutions that number the style's zoom levels. In the tiles' own projection, the tile
 * grid's. In a map of another projection (a reprojected basemap), the tile grid's continued by
 * halving (the map's zoom levels don't match the tiles', and tiles past a service's last level
 * are drawn overzoomed while the style's zoom keeps counting), in the map's units: the style
 * keeps switching its zoom-dependent layers at about the scale it does in its own projection.
 * Web Mercator tiles drawn in Equal Earth switch within 0.02 zoom levels of where they do in Web
 * Mercator at the equator (both are in metres).
 */
export function styleResolutions(
  config: VectorTileLayerConfig,
  projection: LayerEnvironment['projection'],
): number[] | undefined {
  const grid = config.tileGrid?.resolutions
  if (!grid?.length) return undefined
  const source = getProjection(config.sourceProjection)
  if (!source || equivalent(source, projection)) return [...grid]
  const resolutions = [...grid]
  while (resolutions.length < STYLE_ZOOM_LEVELS) resolutions.push(resolutions.at(-1)! / 2)
  const scale = (source.getMetersPerUnit() ?? 1) / (projection.getMetersPerUnit() ?? 1)
  return scale === 1 ? resolutions : resolutions.map((resolution) => resolution * scale)
}

/** Whether the layer's tiles are drawn in another projection than theirs (a reprojected basemap). */
function reprojects(config: VectorTileLayerConfig, env: Pick<LayerEnvironment, 'projection'>) {
  const tiles = getProjection(config.sourceProjection)
  return Boolean(tiles && !equivalent(tiles, env.projection))
}

/**
 * Applies a Mapbox GL style document to the layer: the document is fetched once per page, its
 * layers selected and the overrides applied, then handed to ol-mapbox-style.
 */
async function applyMapboxStyle(
  layer: VectorTileLayer,
  config: VectorTileLayerConfig,
  env: LayerEnvironment,
): Promise<void> {
  const options = config.mapboxStyle!
  const [{ applyStyle }, document] = await Promise.all([
    import('ol-mapbox-style'),
    loadStyleDocument(options.url),
  ])
  const prepared = prepareStyle(document, options.layers, options.overrides, (color) =>
    paint(color, env.theme),
  )
  for (const pattern of prepared.unmatched)
    warnOnce(
      `style-override:${options.url}:${pattern}`,
      `Style override "${pattern}" on ${config.id} matches no layer of the style. Style layer ` +
        `ids: ${document.layers
          .map((item) => item.id)
          .slice(0, 60)
          .join(', ')}`,
    )
  await applyStyle(layer, prepared.style, {
    styleUrl: options.url,
    source: options.source ?? '',
    updateSource: false,
    projection: config.sourceProjection,
    resolutions: styleResolutions(config, env.projection),
  })
  const serviceStyle = layer.getStyleFunction()
  if (serviceStyle && reprojects(config, env)) layer.setStyle(withoutCutOutlines(serviceStyle))
  // ol-mapbox-style paints a style's background only for whole maps.
  const background = prepared.style.layers.find(
    (item) => item.type === 'background' && item.layout?.['visibility'] !== 'none',
  )?.paint?.['background-color']
  if (typeof background === 'string') layer.setBackground(background)
}

export function buildVectorTileLayer(
  config: VectorTileLayerConfig,
  env: LayerEnvironment,
  report: LayerReporter,
  pool: SharedSourcePool,
): BuiltLayer {
  // Tiles drawn in another projection than theirs (a reprojected basemap).
  const reprojected = reprojects(config, env)
  if (reprojected) registerReprojection(getProjection(config.sourceProjection)!, env.projection)
  const create = () =>
    reprojected
      ? reprojectedTileSource(
          config,
          env.projection,
          () => withTime(config.url, env.time),
          attributionText(config.attribution),
        )
      : new VectorTileSource({
          format: new MVT({ idProperty: config.featureIdField }),
          url: withTime(config.url, env.time),
          projection: config.sourceProjection,
          maxZoom: config.maxSourceZoom,
          tileGrid: config.tileGrid
            ? new TileGrid(tileGridOptions(lastSourceLevel(config.tileGrid, config.maxSourceZoom)))
            : undefined,
          wrapX: config.wrapX,
          attributions: attributionText(config.attribution),
        })
  // A timed source changes its URL, so it can't be shared.
  const shared =
    timeMode(config) === 'url'
      ? undefined
      : pool.acquire(
          JSON.stringify([
            config.url,
            config.sourceProjection,
            // Reprojected tiles hold their features in the map's projection.
            reprojected && env.projection.getCode(),
            config.maxSourceZoom,
            config.tileGrid,
            config.wrapX,
            config.featureIdField,
          ]),
          create,
        )
  const source = shared?.source ?? create()
  const thematic = config.style ? thematicLayerStyle(config, config.style, env) : undefined
  const changes = new Set<LayerChange>(thematic?.changes)
  const layer = new VectorTileLayer({
    ...layerOptions(config),
    source,
    declutter: true,
    style: thematic?.style,
  })
  let disposed = false
  // Until its style document is applied the layer is loading, whatever its tiles do: a map with
  // a style that fails is not ready before the failure is known.
  let styling = Boolean(config.mapboxStyle)
  let tilesLoading = false
  let tilesFailed = false
  const tileReport: LayerReporter = {
    ...report,
    loading: (loading) => {
      tilesLoading = loading
      if (loading) tilesFailed = false
      if (loading || !styling) report.loading(loading)
    },
    fail: (message, cause) => {
      tilesLoading = false
      tilesFailed = true
      report.fail(message, cause)
    },
  }
  /** Applies the style document again, for overrides that follow the light and dark themes. */
  let restyle: (() => void) | undefined
  if (config.mapboxStyle) {
    report.loading(true)
    const apply = () =>
      applyMapboxStyle(layer, config, env)
        .then(() => {
          if (disposed) return
          if (styling) {
            styling = false
            if (!tilesLoading && !tilesFailed) report.loading(false)
          }
          if (!config.selectable) return
          const serviceStyle = layer.getStyleFunction()
          if (serviceStyle) layer.setStyle(withSelection(config, env, serviceStyle))
        })
        .catch((error: unknown) => {
          if (disposed) return
          styling = false
          report.fail(`Could not load the style for ${config.title}`, error)
        })
    void apply()
    if (config.selectable) changes.add('selection')
    if (config.mapboxStyle.overrides?.some((item) => item.color && isCssColor(item.color)))
      restyle = () => void apply()
  }
  const redraw = redrawOn(layer, changes)
  const keys = watchTiles(source, config, tileReport)
  return {
    layer,
    update: (change) => {
      if (change === 'theme') restyle?.()
      if (change === 'time' && timeMode(config) === 'url') {
        // A reprojected source reads the URL as its tiles load.
        if (reprojected) source.refresh()
        else source.setUrl(withTime(config.url, env.time))
      }
      redraw(change)
    },
    dispose: () => {
      disposed = true
      unByKey(keys)
      shared?.release()
    },
  }
}
