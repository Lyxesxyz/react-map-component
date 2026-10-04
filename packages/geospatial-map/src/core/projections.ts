// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

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
  MapLayerConfig,
  MapViewState,
  ProjectionDefinition,
  ProjectionId,
} from '../types'

export const EQUAL_EARTH_EXTENT: [number, number, number, number] = [
  -17_243_959.06, -8_392_927.6, 17_243_959.06, 8_392_927.6,
]
export const MERCATOR_EXTENT: [number, number, number, number] = [
  -20_037_508.34, -20_037_508.34, 20_037_508.34, 20_037_508.34,
]
const WEB_MERCATOR_METERS_PER_PIXEL_ZOOM_ZERO = (2 * Math.PI * 6_378_137) / 256
/** Duration of the map's own view animations (fit, cluster zoom). */
export const ANIMATION_MS = 300
/** An Equal Earth projection centred on `meridian` (EPSG:8857 is centred on Greenwich). */
export function equalEarth(code: string, meridian = 0): ProjectionDefinition {
  return {
    code,
    definition: `+proj=eqearth +lon_0=${meridian} +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs`,
    extent: EQUAL_EARTH_EXTENT,
    worldExtent: [meridian - 180, -90, meridian + 180, 90],
  }
}

/** Registers a projection from its proj4 definition (once), with its extents. */
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

function getProjectionOrThrow(code: ProjectionId): Projection {
  if (code === 'EPSG:8857') return ensureConfiguredProjection(equalEarth('EPSG:8857'))
  const projection = getProjection(code)
  if (!projection)
    throw new MapConfigurationError(
      `Projection ${code} is not defined. Use a basemap in that projection (an ArcGIS basemap ` +
        'defines it from its service; a tile layer through sourceProjectionDefinition), or use ' +
        'EPSG:8857 (Equal Earth) or EPSG:3857 (Web Mercator).',
    )
  return projection
}

function metersPerPixelAtCenter(projection: Projection, center: number[]): number {
  return getPointResolution(projection, 1, center, 'm')
}

function zoomToResolution(zoom: number, projection: Projection, center: number[]): number {
  const groundResolution = WEB_MERCATOR_METERS_PER_PIXEL_ZOOM_ZERO / 2 ** zoom
  return groundResolution / metersPerPixelAtCenter(projection, center)
}

function resolutionToZoom(resolution: number, projection: Projection, center: number[]): number {
  const groundResolution = resolution * metersPerPixelAtCenter(projection, center)
  return Math.log2(WEB_MERCATOR_METERS_PER_PIXEL_ZOOM_ZERO / groundResolution)
}

/** The zoom range users can reach (`view.minZoom`, `view.maxZoom`). */
export type ZoomLimits = { minZoom: number; maxZoom: number }

export function zoomLimits(
  view: { minZoom?: number | undefined; maxZoom?: number | undefined } = {},
): ZoomLimits {
  const limits = { minZoom: view.minZoom ?? 0, maxZoom: view.maxZoom ?? 20 }
  if (limits.minZoom > limits.maxZoom)
    throw new MapConfigurationError('minZoom cannot exceed maxZoom')
  return limits
}

/** The view with its zoom within `limits` and every field set. */
export function normalizeView(
  view: MapViewState,
  limits: ZoomLimits = zoomLimits(),
): Required<MapViewState> {
  if (view.center[1] < -90 || view.center[1] > 90)
    throw new MapConfigurationError('Center latitude must be between -90 and 90')
  return {
    center: [view.center[0], view.center[1]],
    zoom: Math.min(limits.maxZoom, Math.max(limits.minZoom, view.zoom)),
    projection: view.projection,
    rotation: view.rotation ?? 0,
  }
}

export function createView(view: MapViewState, limits: ZoomLimits = zoomLimits()): View {
  const normalized = normalizeView(view, limits)
  const projection = getProjectionOrThrow(normalized.projection)
  const center = fromLonLat([...normalized.center], projection)
  const equalEarth = normalized.projection !== 'EPSG:3857'
  return new View({
    projection,
    center,
    resolution: zoomToResolution(normalized.zoom, projection, center),
    rotation: normalized.rotation,
    minResolution: zoomToResolution(limits.maxZoom, projection, center),
    maxResolution: zoomToResolution(limits.minZoom, projection, center),
    extent: equalEarth ? projection.getExtent() : undefined,
    constrainOnlyCenter: equalEarth,
    showFullExtent: equalEarth,
    multiWorld: normalized.projection === 'EPSG:3857',
  })
}

/** Moves `view` to `state` without replacing it (same projection and zoom limits). */
export function updateView(view: View, state: Required<MapViewState>): void {
  const normalized = state
  const projection = view.getProjection()
  const center = fromLonLat([...normalized.center], projection)
  view.setCenter(center)
  view.setResolution(zoomToResolution(normalized.zoom, projection, center))
  view.setRotation(normalized.rotation)
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

export function viewToState(view: View): Required<MapViewState> {
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
  }
}

export function boundsToProjection(bounds: LonLatBounds, projection: Projection): number[] {
  if (bounds[0] > bounds[2] || bounds[1] > bounds[3])
    throw new MapConfigurationError('Fit bounds must be ordered west, south, east, north')
  return transformExtent([...bounds], 'EPSG:4326', projection, 8)
}

/** Registers the projections that layers define, so views and sources can use them. */
export function registerLayerProjections(layers: MapLayerConfig[]): void {
  for (const layer of layers)
    if ('sourceProjectionDefinition' in layer && layer.sourceProjectionDefinition)
      ensureConfiguredProjection(layer.sourceProjectionDefinition)
}

/**
 * The starting view that shows the whole world in a map of `width` × `height` pixels. Web
 * Mercator is fitted by width (its poles are infinitely far), other projections by both sides.
 */
export function fitWorldView(
  view: MapViewState,
  width: number,
  height: number,
  limits: ZoomLimits = zoomLimits(),
): MapViewState {
  const projection = getProjectionOrThrow(view.projection)
  const extent = projection.getExtent()
  if (!extent || width <= 0 || height <= 0) return view
  const mercator = view.projection === 'EPSG:3857'
  const worldWidth = extent[2]! - extent[0]!
  const worldHeight = mercator ? worldWidth * 0.55 : extent[3]! - extent[1]!
  const resolution = Math.max(worldWidth / width, worldHeight / height) * 1.03
  const center = mercator
    ? [(extent[0]! + extent[2]!) / 2, fromLonLat([0, 15], projection)[1]!]
    : [(extent[0]! + extent[2]!) / 2, (extent[1]! + extent[3]!) / 2]
  const zoom = resolutionToZoom(resolution, projection, center)
  return {
    ...view,
    center: safeToLonLat(center, projection),
    zoom: Math.min(limits.maxZoom, Math.max(limits.minZoom, zoom)),
  }
}

/** A readable name for a projection code, for report captions. */
export function projectionLabel(code: string): string {
  if (code === 'EPSG:3857') return 'Web Mercator'
  const definition = proj4.defs(code) as { projName?: string } | undefined
  if (code === 'EPSG:8857' || /eqearth|equal.?earth/i.test(definition?.projName ?? ''))
    return 'Equal Earth'
  return code
}

/** View differences smaller than these are the same view (rounding in state round trips). */
const SAME_DEGREES = 1e-7
const SAME_ZOOM = 1e-6

/** Whether two views show the same place, ignoring rounding. */
export function sameView(left: MapViewState, right: MapViewState): boolean {
  const close = (a: number | undefined, b: number | undefined, tolerance: number) =>
    Math.abs((a ?? 0) - (b ?? 0)) < tolerance
  return (
    left.projection === right.projection &&
    close(left.center[0], right.center[0], SAME_DEGREES) &&
    close(left.center[1], right.center[1], SAME_DEGREES) &&
    close(left.zoom, right.zoom, SAME_ZOOM) &&
    close(left.rotation, right.rotation, SAME_ZOOM)
  )
}
