import View from 'ol/View.js'
import type Projection from 'ol/proj/Projection.js'
import {
  fromLonLat,
  get as getProjection,
  getPointResolution,
  toLonLat,
  transformExtent,
} from 'ol/proj.js'
import { register } from 'ol/proj/proj4.js'
import proj4 from 'proj4'
import { MapConfigurationError } from './errors'
import type {
  LonLatBounds,
  MapViewState,
  ProjectionBehavior,
  ProjectionDefinition,
  ProjectionId,
} from '../types'

export const EQUAL_EARTH_EXTENT = [-17_243_959.06, -8_392_927.6, 17_243_959.06, 8_392_927.6]
const WEB_MERCATOR_METERS_PER_PIXEL_ZOOM_ZERO = (2 * Math.PI * 6_378_137) / 256
let equalEarthRegistered = false

export function ensureEqualEarthProjection(): Projection {
  if (!equalEarthRegistered) {
    proj4.defs(
      'EPSG:8857',
      '+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs',
    )
    register(proj4)
    equalEarthRegistered = true
  }
  const projection = getProjection('EPSG:8857')
  if (!projection) throw new MapConfigurationError('Proj4 failed to register EPSG:8857')
  projection.setGlobal(true)
  projection.setExtent(EQUAL_EARTH_EXTENT)
  projection.setWorldExtent([-180, -90, 180, 90])
  return projection
}

export function ensureConfiguredProjection(definition: ProjectionDefinition): Projection {
  if (!getProjection(definition.code)) {
    proj4.defs(definition.code, definition.definition)
    register(proj4)
  }
  const projection = getProjection(definition.code)
  if (!projection) throw new MapConfigurationError(`Proj4 failed to register ${definition.code}`)
  if (definition.extent) projection.setExtent([...definition.extent])
  if (definition.worldExtent) {
    projection.setGlobal(true)
    projection.setWorldExtent([...definition.worldExtent])
  }
  return projection
}

export function projectionForZoom(
  zoom: number,
  current: ProjectionId,
  behavior: ProjectionBehavior = {},
): ProjectionId {
  if ((behavior.mode ?? 'manual') === 'manual') return current
  const equalEarthBelow = behavior.equalEarthBelowZoom ?? 3.5
  const mercatorAtOrAbove = behavior.mercatorAtOrAboveZoom ?? 4
  if (equalEarthBelow >= mercatorAtOrAbove)
    throw new MapConfigurationError('Equal Earth threshold must be lower than Mercator threshold')
  if (current === 'EPSG:3857' && zoom < equalEarthBelow) return 'EPSG:8857'
  if (current !== 'EPSG:3857' && zoom >= mercatorAtOrAbove) return 'EPSG:3857'
  return current
}

export function getProjectionOrThrow(code: ProjectionId): Projection {
  if (code === 'EPSG:8857') return ensureEqualEarthProjection()
  const projection = getProjection(code)
  if (!projection) throw new MapConfigurationError(`Projection ${code} is unavailable`)
  return projection
}

function metersPerPixelAtCenter(projection: Projection, center: number[]): number {
  return getPointResolution(projection, 1, center, 'm')
}

export function zoomToResolution(zoom: number, projection: Projection, center: number[]): number {
  const groundResolution = WEB_MERCATOR_METERS_PER_PIXEL_ZOOM_ZERO / 2 ** zoom
  return groundResolution / metersPerPixelAtCenter(projection, center)
}

export function resolutionToZoom(
  resolution: number,
  projection: Projection,
  center: number[],
): number {
  const groundResolution = resolution * metersPerPixelAtCenter(projection, center)
  return Math.log2(WEB_MERCATOR_METERS_PER_PIXEL_ZOOM_ZERO / groundResolution)
}

export function normalizeView(view: MapViewState): Required<MapViewState> {
  const minZoom = view.minZoom ?? 0
  const maxZoom = view.maxZoom ?? 20
  if (minZoom > maxZoom) throw new MapConfigurationError('minZoom cannot exceed maxZoom')
  if (view.center[1] < -90 || view.center[1] > 90)
    throw new MapConfigurationError('Center latitude must be between -90 and 90')
  return {
    ...view,
    center: [view.center[0], view.center[1]],
    zoom: Math.min(maxZoom, Math.max(minZoom, view.zoom)),
    rotation: view.rotation ?? 0,
    minZoom,
    maxZoom,
  }
}

export function createView(view: MapViewState): View {
  const normalized = normalizeView(view)
  const projection = getProjectionOrThrow(normalized.projection)
  const center = fromLonLat([...normalized.center], projection)
  const equalEarth = normalized.projection !== 'EPSG:3857'
  return new View({
    projection,
    center,
    resolution: zoomToResolution(normalized.zoom, projection, center),
    rotation: normalized.rotation,
    minResolution: zoomToResolution(normalized.maxZoom, projection, center),
    maxResolution: zoomToResolution(normalized.minZoom, projection, center),
    extent: equalEarth ? projection.getExtent() : undefined,
    constrainOnlyCenter: equalEarth,
    showFullExtent: equalEarth,
    multiWorld: normalized.projection === 'EPSG:3857',
  })
}

/** The inverse projection of `coordinate`, or `undefined` when it lies outside the world. */
function finiteLonLat(coordinate: number[], projection: Projection): number[] | undefined {
  const lonLat = toLonLat(coordinate, projection)
  if (!Number.isFinite(lonLat[0]) || !Number.isFinite(lonLat[1])) return undefined
  // Outside the outline some inverses return a wrapped longitude instead of NaN; a point is
  // inside only if projecting the result forward lands where it started.
  const back = fromLonLat(lonLat, projection)
  const tolerance = Math.max(1, Math.abs(coordinate[0] ?? 0) * 1e-6)
  return Math.abs((back[0] ?? 0) - (coordinate[0] ?? 0)) <= tolerance &&
    Math.abs((back[1] ?? 0) - (coordinate[1] ?? 0)) <= tolerance
    ? lonLat
    : undefined
}

/**
 * `toLonLat` that never returns NaN. An Equal Earth view can be panned so its center sits in a
 * corner of the projection's rectangular extent, outside the rounded world outline, where the
 * inverse projection is undefined (NaN, or a wrong wrapped longitude). Such points are moved
 * horizontally onto the world's edge.
 */
export function safeToLonLat(coordinate: number[], projection: Projection): [number, number] {
  const x = coordinate[0] ?? 0
  const extent = projection.getExtent()
  const y = extent
    ? Math.min(extent[3]!, Math.max(extent[1]!, coordinate[1] ?? 0))
    : (coordinate[1] ?? 0)
  const direct = finiteLonLat([x, y], projection)
  if (direct) return [direct[0]!, direct[1]!]
  let inside = 0
  let outside = x
  for (let step = 0; step < 30; step++) {
    const middle = (inside + outside) / 2
    if (finiteLonLat([middle, y], projection)) inside = middle
    else outside = middle
  }
  const edge = finiteLonLat([inside, y], projection) ?? [0, 0]
  return [edge[0]!, edge[1]!]
}

export function viewToState(view: View, constraints: MapViewState): MapViewState {
  const projection = view.getProjection()
  const center = view.getCenter() ?? [0, 0]
  const lonLat = safeToLonLat(center, projection)
  // Scale is measured at a point inside the world, which the raw center may not be.
  const scaleCenter = fromLonLat(lonLat, projection)
  const resolution = view.getResolution() ?? zoomToResolution(0, projection, scaleCenter)
  return {
    center: lonLat,
    zoom: resolutionToZoom(resolution, projection, scaleCenter),
    projection: projection.getCode() as ProjectionId,
    rotation: view.getRotation(),
    minZoom: constraints.minZoom ?? 0,
    maxZoom: constraints.maxZoom ?? 20,
  }
}

export function boundsToProjection(bounds: LonLatBounds, projection: Projection): number[] {
  if (bounds[0] > bounds[2] || bounds[1] > bounds[3])
    throw new MapConfigurationError('Fit bounds must be ordered west, south, east, north')
  return transformExtent([...bounds], 'EPSG:4326', projection, 8)
}
