// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import type { FeatureCollection, Geometry, Position } from 'geojson'

// A projection has a seam at its central meridian + 180°. Polygons and lines in longitude and
// latitude that cross it (Russia, Fiji and Alaska at ±180°; more with other central meridians)
// would be drawn the long way round, as bands across the whole map. They are cut at the seam,
// and a ring around a pole (Antarctica) is closed along the pole line instead.
//
// Output longitudes stay within ±180: OpenLayers reads anything beyond as the next copy of the
// world. Points on the seam are moved a hair inside their own side for the same reason.

const EPSILON = 1e-9

/** Longitude relative to the central meridian, in (-180, 180]. */
function relative(longitude: number, meridian: number): number {
  const value = ((((longitude - meridian) % 360) + 540) % 360) - 180
  return value === -180 ? 180 : value
}

function crossings(ring: number[][]): number {
  let count = 0
  for (let index = 1; index < ring.length; index++)
    if (Math.abs(ring[index]![0]! - ring[index - 1]![0]!) > 180) count++
  return count
}

/** Makes longitudes continuous along the ring (they may then pass ±180). */
function unwrap(ring: number[][]): number[][] {
  const result: number[][] = []
  let offset = 0
  ring.forEach((point, index) => {
    if (index > 0) {
      const step = point[0]! - ring[index - 1]![0]!
      if (step > 180) offset -= 360
      else if (step < -180) offset += 360
    }
    result.push([point[0]! + offset, ...point.slice(1)])
  })
  return result
}

/** The part of a closed ring on one side of the line x = `at` (Sutherland–Hodgman). */
function clipRing(ring: number[][], at: number, keepBelow: boolean): number[][] {
  const inside = (point: number[]) => (keepBelow ? point[0]! <= at : point[0]! >= at)
  const result: number[][] = []
  for (let index = 0; index < ring.length - 1; index++) {
    const current = ring[index]!
    const next = ring[index + 1]!
    if (inside(current)) result.push(current)
    if (inside(current) !== inside(next)) {
      const ratio = (at - current[0]!) / (next[0]! - current[0]!)
      result.push([at, current[1]! + ratio * (next[1]! - current[1]!)])
    }
  }
  if (result.length) result.push([...result[0]!])
  return result
}

/** Keeps a part's seam points (x = ±180) on the part's side of the seam. */
function inside(ring: number[][]): number[][] {
  return ring.map(([x, ...rest]) =>
    x! >= 180 ? [180 - EPSILON, ...rest] : x! <= -180 ? [-180 + EPSILON, ...rest] : [x!, ...rest],
  )
}

/**
 * A ring that crosses the seam once goes around a pole. It is reordered to start just after the
 * crossing and closed along the seam and the pole line.
 */
function closeAroundPole(ring: number[][]): number[][] {
  const open = ring.slice(0, -1)
  const count = open.length
  const jump = open.findIndex(
    (point, index) => Math.abs(open[(index + 1) % count]![0]! - point[0]!) > 180,
  )
  if (jump < 0) return ring
  const ordered = [...open.slice(jump + 1), ...open.slice(0, jump + 1)]
  const first = ordered[0]!
  const last = ordered.at(-1)!
  const edge = last[0]! > 0 ? 180 : -180
  const firstUnwrapped = first[0]! + (edge === 180 ? 360 : -360)
  const ratio = (edge - last[0]!) / (firstUnwrapped - last[0]!)
  const latitude = last[1]! + ratio * (first[1]! - last[1]!)
  const mean = ordered.reduce((sum, point) => sum + point[1]!, 0) / count
  const pole = mean < 0 ? -90 : 90
  return [
    [-edge, latitude],
    ...ordered,
    [edge, latitude],
    [edge, pole],
    [-edge, pole],
    [-edge, latitude],
  ]
}

/** Polygon rings (relative longitudes) split at the seam into one polygon per side. */
function splitPolygon(rings: number[][][]): number[][][][] {
  const outer = rings[0]
  if (!outer || crossings(outer) === 0) return [rings.map(inside)]
  if (crossings(outer) % 2 === 1)
    return [[inside(closeAroundPole(outer)), ...rings.slice(1).map(inside)]]
  const unwrapped = rings.map(unwrap)
  // The ring now passes +180 or -180; cut there and move the far part back by 360°.
  const max = Math.max(...unwrapped[0]!.map((point) => point[0]!))
  const seam = max > 180 ? 180 : -180
  const shift = seam === 180 ? -360 : 360
  const near = unwrapped.map((ring) => clipRing(ring, seam, seam === 180))
  const far = unwrapped
    .map((ring) => clipRing(ring, seam, seam !== 180))
    .map((ring) => ring.map(([x, ...rest]) => [x! + shift, ...rest]))
  return [near, far]
    .map((part) => part.filter((ring) => ring.length >= 4).map(inside))
    .filter((part) => part.length && part[0]!.length >= 4)
}

/** Line coordinates (relative longitudes) split where they cross the seam. */
function splitLine(line: number[][]): number[][][] {
  const parts: number[][][] = []
  let part: number[][] = []
  line.forEach((point, index) => {
    const previous = line[index - 1]
    if (previous && Math.abs(point[0]! - previous[0]!) > 180) {
      const edge = previous[0]! > 0 ? 180 : -180
      const next = point[0]! + (edge === 180 ? 360 : -360)
      const ratio = (edge - previous[0]!) / (next - previous[0]!)
      const latitude = previous[1]! + ratio * (point[1]! - previous[1]!)
      part.push([edge, latitude])
      parts.push(part)
      part = [[-edge, latitude]]
    }
    part.push(point)
  })
  parts.push(part)
  return parts.filter((item) => item.length >= 2).map(inside)
}

function needsCut(geometry: Geometry, meridian: number): boolean {
  const lines = (coordinates: Position[]) =>
    coordinates.some(([x]) => Math.abs(x!) > 180) ||
    crossings(coordinates.map(([x, ...rest]) => [relative(x!, meridian), ...rest])) > 0
  switch (geometry.type) {
    case 'LineString':
      return lines(geometry.coordinates)
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.some(lines)
    case 'MultiPolygon':
      return geometry.coordinates.some((polygon) => polygon.some(lines))
    case 'GeometryCollection':
      return geometry.geometries.some((item) => needsCut(item, meridian))
    default:
      return false
  }
}

function cut(geometry: Geometry, meridian: number): Geometry {
  const toRelative = (ring: Position[]) =>
    ring.map(([x, ...rest]) => [relative(x!, meridian), ...rest])
  // Back to longitudes within ±180 (the relative values are already inside the seam).
  const toAbsolute = (ring: number[][]) =>
    ring.map(([x, ...rest]) => {
      const longitude = x! + meridian
      return [
        longitude > 180 ? longitude - 360 : longitude < -180 ? longitude + 360 : longitude,
        ...rest,
      ]
    })
  switch (geometry.type) {
    case 'LineString':
    case 'MultiLineString': {
      const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
      const parts = lines.flatMap((line) => splitLine(toRelative(line))).map(toAbsolute)
      return parts.length === 1
        ? { type: 'LineString', coordinates: parts[0]! }
        : { type: 'MultiLineString', coordinates: parts }
    }
    case 'Polygon':
    case 'MultiPolygon': {
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
      const parts = polygons
        .flatMap((polygon) => splitPolygon(polygon.map(toRelative)))
        .map((polygon) => polygon.map(toAbsolute))
      return parts.length === 1
        ? { type: 'Polygon', coordinates: parts[0]! }
        : { type: 'MultiPolygon', coordinates: parts }
    }
    case 'GeometryCollection':
      return { ...geometry, geometries: geometry.geometries.map((item) => cut(item, meridian)) }
    default:
      return geometry
  }
}

/**
 * The collection with lines and polygons cut where they cross the seam opposite `meridian`, and
 * rings around a pole closed along it. Features that do not cross it are returned as they are.
 */
export function splitAtSeam(collection: FeatureCollection, meridian = 0): FeatureCollection {
  let changed = false
  const features = collection.features.map((feature) => {
    if (!feature.geometry || !needsCut(feature.geometry, meridian)) return feature
    changed = true
    return { ...feature, geometry: cut(feature.geometry, meridian) }
  })
  return changed ? { ...collection, features } : collection
}
