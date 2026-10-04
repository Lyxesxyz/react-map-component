// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { worldBasemap } from '../basemaps'
import type {
  GeoJsonLayerInput,
  MapConfig,
  MapConfigInput,
  MapLayerConfig,
  MapLayerInput,
  MapState,
  MapViewState,
  ThematicStyleSpec,
} from '../types'

// Fills in the short `MapConfigInput` form to a complete `MapConfig`.

/** Style of a layer configured without one: the primary colour, as fill, line or circle. */
export const defaultLayerStyle: ThematicStyleSpec = {
  type: 'constant',
  symbol: {
    kind: 'polygon',
    fillColor: 'var(--geo-primary)',
    strokeColor: 'var(--geo-background)',
    strokeWidth: 1,
    opacity: 0.75,
  },
}

/** Whole-world Equal Earth view used when a configuration declares no starting view. */
export const defaultInitialView: MapViewState = {
  center: [0, 20],
  zoom: 1.2,
  projection: 'EPSG:8857',
}

const isGeoJsonInput = (input: MapLayerInput): input is GeoJsonLayerInput =>
  input.kind === undefined || input.kind === 'geojson'

/**
 * Whether the starting view has the default zoom, so the configuration set none: such a map
 * starts fitted to the world unless `view.fitWorld` is `false`.
 */
export function hasDefaultZoom(view: MapViewState): boolean {
  return view.zoom === defaultInitialView.zoom
}

/**
 * A layer with its defaults: a GeoJSON layer (`kind` left out or `'geojson'`) gets its id as
 * title and `defaultLayerStyle`; GeoJSON layers, and vector tile layers with a `featureIdField`,
 * are selectable.
 */
export function completeLayer(input: MapLayerInput): MapLayerConfig {
  const layer: MapLayerConfig = isGeoJsonInput(input)
    ? {
        ...input,
        kind: 'geojson',
        title: input.title ?? input.id,
        style: input.style ?? defaultLayerStyle,
      }
    : input
  if (layer.kind === 'geojson' && layer.selectable === undefined)
    return { ...layer, selectable: true }
  if (layer.kind === 'mvt' && layer.selectable === undefined && layer.featureIdField)
    return { ...layer, selectable: true }
  return layer
}

/** The time frames offered by the layers, in order of first appearance. */
export function layerTimes(layers: readonly MapLayerConfig[]): string[] {
  return [...new Set(layers.flatMap((layer) => ('time' in layer && layer.time?.values) || []))]
}

/** The state of `layers` at the start: as configured, in order. */
export function initialLayerStates(layers: MapLayerConfig[]): MapState['layers'] {
  return Object.fromEntries(
    layers.map((layer, order) => [
      layer.id,
      { visible: layer.visible ?? true, opacity: layer.opacity ?? 1, order },
    ]),
  )
}

/**
 * A complete configuration from the short form:
 * - the `worldBasemap` when no basemaps are given;
 * - a starting view from `defaultInitialView` (in the first basemap's projection when no
 *   basemap supports Equal Earth), the first compatible basemap, and the layers' own state;
 * - layer defaults (`completeLayer`);
 * - the first time frame, when layers have time frames and no starting time is set.
 * A complete configuration passes through unchanged in content. Whether the map starts fitted to
 * the world is decided when it starts (`view.fitWorld`, by default when no zoom is set).
 */
export function normalizeMapConfig(input: MapConfigInput): MapConfig {
  const basemaps = input.data.basemaps?.length ? input.data.basemaps : [worldBasemap]
  const layers = input.data.layers.map(completeLayer)
  const partial = input.initialState ?? {}
  // A tile basemap is usually Web Mercator only: start in a projection some basemap supports.
  const projection = basemaps.some((basemap) =>
    basemap.supportedProjections.includes(defaultInitialView.projection),
  )
    ? defaultInitialView.projection
    : (basemaps[0]?.supportedProjections[0] ?? defaultInitialView.projection)
  const view: MapViewState = { ...defaultInitialView, projection, ...partial.view }
  const activeBasemapId =
    partial.activeBasemapId ??
    basemaps.find((basemap) => basemap.supportedProjections.includes(view.projection))?.id ??
    basemaps[0]?.id
  return {
    ...input,
    version: input.version ?? 1,
    view: input.view ?? {},
    ui: input.ui ?? {},
    data: { ...input.data, layers, basemaps },
    initialState: {
      view,
      ...(activeBasemapId ? { activeBasemapId } : {}),
      layers: { ...initialLayerStates(layers), ...partial.layers },
      selection: partial.selection ?? null,
      time: partial.time === undefined ? (layerTimes(layers)[0] ?? null) : partial.time,
    },
  }
}

/**
 * Checks the configuration against its types while you write it, and fills in the defaults
 * (see `normalizeMapConfig`). Call it outside components, or memoise the result.
 */
export function defineMapConfig(config: MapConfigInput): MapConfig {
  return normalizeMapConfig(config)
}
