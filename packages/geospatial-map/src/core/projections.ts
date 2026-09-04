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
import { MapConfigurationError } from './errors.js'
import type { LonLatBounds, MapViewState, ProjectionBehavior, ProjectionId } from '../types.js'

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
  if (current === 'EPSG:8857' && zoom >= mercatorAtOrAbove) return 'EPSG:3857'
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
  return new View({
    projection,
    center,
    resolution: zoomToResolution(normalized.zoom, projection, center),
    rotation: normalized.rotation,
    minResolution: zoomToResolution(normalized.maxZoom, projection, center),
    maxResolution: zoomToResolution(normalized.minZoom, projection, center),
    extent: normalized.projection === 'EPSG:8857' ? projection.getExtent() : undefined,
    constrainOnlyCenter: normalized.projection === 'EPSG:8857',
    showFullExtent: normalized.projection === 'EPSG:8857',
    multiWorld: normalized.projection === 'EPSG:3857',
  })
}

export function viewToState(view: View, constraints: MapViewState): MapViewState {
  const projection = view.getProjection()
  const center = view.getCenter() ?? [0, 0]
  const resolution = view.getResolution() ?? zoomToResolution(0, projection, center)
  const lonLat = toLonLat(center, projection)
  return {
    center: [lonLat[0] ?? 0, lonLat[1] ?? 0],
    zoom: resolutionToZoom(resolution, projection, center),
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
