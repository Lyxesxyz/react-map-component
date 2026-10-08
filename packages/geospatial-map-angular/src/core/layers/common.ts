// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import type { FeatureLike } from 'ol/Feature.js'
import type Feature from 'ol/Feature.js'
import type BaseLayer from 'ol/layer/Base.js'
import type Projection from 'ol/proj/Projection.js'
import type TileSource from 'ol/source/Tile.js'
import type { EventsKey } from 'ol/events.js'
import type Style from 'ol/style/Style.js'
import type {
  AttributionSpec,
  GeoJsonLayerConfig,
  GeoJsonLoader,
  MapLayerConfig,
  MapSelection,
  ThematicStyleSpec,
  VectorTileLayerConfig,
} from '../../types'
import type { CanvasTheme } from '../canvas-theme'
import { compileThematicStyle, selectionStyle } from '../style-compiler'
import { symbolRules } from '../symbol-rules'
import { frameFilter } from '../time'

// What every layer builder receives and returns. A builder turns one layer config into an
// OpenLayers layer; the `LayerRegistry` keeps the builders' results in sync with the map.

/** The map state a layer draws with. Owned by the registry; builders read it when drawing. */
export type LayerEnvironment = {
  readonly projection: Projection
  readonly zoom: number
  readonly time: string | null
  readonly selection: MapSelection | null
  readonly theme: CanvasTheme
  readonly loadGeoJson: GeoJsonLoader
}

/** A change of the map state a layer may draw with. */
export type LayerChange = 'zoom' | 'time' | 'selection' | 'theme'

/** How a layer reports its loading state. */
export type LayerReporter = {
  loading(loading: boolean): void
  fail(message: string, cause?: unknown): void
  metric(durationMs: number, success: boolean): void
  /** The layer was rebuilt in place (canvas to GPU once a large dataset has loaded). */
  replaced(next: BuiltLayer): void
}

export type BuiltLayer = {
  layer: BaseLayer
  /** The map state changed: redraw what depends on it. */
  update(change: LayerChange): void
  /** A loaded feature by selection id (vector layers; tiles don't keep features). */
  feature?(featureId: string): FeatureLike | undefined
  /** The features of a vector layer the SVG export can draw as vectors. */
  vectorFeatures?(): Feature[]
  /** The extent of the loaded features, in map coordinates (vector layers). */
  extent?(): number[] | undefined
  /** Releases what the builder holds besides `layer` (which the registry disposes). */
  dispose?(): void
}

/** An `update` that redraws `layer` for the changes in `changes`. */
export function redrawOn(layer: BaseLayer, changes: ReadonlySet<LayerChange>) {
  return (change: LayerChange) => {
    if (changes.has(change)) layer.changed()
  }
}

/** OpenLayers options every layer shares. `mapLayerId` tells configured layers from others. */
export function layerOptions(config: MapLayerConfig) {
  return {
    opacity: config.opacity ?? 1,
    visible: config.visible ?? true,
    properties: { mapLayerId: config.id },
  }
}

/** Source attributions as OpenLayers HTML strings. */
export function attributionText(attributions: AttributionSpec[] | undefined): string[] | undefined {
  if (!attributions?.length) return undefined
  return attributions.map((item) => {
    const label = item.url
      ? `<a href="${item.url}" target="_blank" rel="noopener">${item.label}</a>`
      : item.label
    return [label, item.license, item.version].filter(Boolean).join(' · ')
  })
}

/** Attributions without repeats (same label and URL), in order. */
export function uniqueAttributions(items: Iterable<AttributionSpec>): AttributionSpec[] {
  const unique = new Map<string, AttributionSpec>()
  for (const item of items) unique.set(`${item.label}|${item.url ?? ''}`, item)
  return [...unique.values()]
}

/** Whether two selections are the same feature (or both empty). */
export function sameSelection(left: MapSelection | null, right: MapSelection | null): boolean {
  return left?.layerId === right?.layerId && left?.featureId === right?.featureId
}

/** A feature's selection id: its own id, else the `featureIdField` value. */
export function featureIdOf(feature: FeatureLike, idField: string | undefined): string | undefined {
  const id = feature.getId() ?? (idField ? feature.get(idField) : undefined)
  return id === undefined || id === null ? undefined : String(id)
}

/** Whether `feature` of layer `config` is the selected one. */
export function isSelected(
  config: MapLayerConfig,
  feature: FeatureLike,
  selection: MapSelection | null,
): boolean {
  if (selection?.layerId !== config.id) return false
  const idField = 'featureIdField' in config ? config.featureIdField : undefined
  return featureIdOf(feature, idField) === selection.featureId
}

/** A style function that draws the selected feature highlighted and the others with `style`. */
export function withSelection<Args extends unknown[]>(
  config: MapLayerConfig,
  env: LayerEnvironment,
  style: (feature: FeatureLike, ...args: Args) => Style | Style[] | undefined | void,
) {
  return (feature: FeatureLike, ...args: Args) =>
    isSelected(config, feature, env.selection)
      ? selectionStyle(feature.getGeometry()?.getType() ?? '', env.theme)
      : style(feature, ...args)
}

/**
 * The canvas style of a layer drawn by a thematic style (GeoJSON and vector tiles): the
 * selection highlight, the time frame filter, and the changes it must be redrawn for.
 */
export function thematicLayerStyle(
  config: GeoJsonLayerConfig | VectorTileLayerConfig,
  style: ThematicStyleSpec,
  env: LayerEnvironment,
) {
  const include = frameFilter(config, () => env.time)
  const changes = new Set<LayerChange>(['theme'])
  if (config.selectable) changes.add('selection')
  if (include) changes.add('time')
  if (hasZoomStops(symbolRules(style).map((rule) => rule.symbol))) changes.add('zoom')
  return { style: withSelection(config, env, compileThematicStyle(style, env, include)), changes }
}

/**
 * Reports a tile source's loading state, once per load cycle (from the first tile requested
 * until none is pending). A cycle in which tiles failed and none loaded fails the layer; a few
 * missing tiles (a 404 over the sea) don't. Returns the listener keys to remove on dispose.
 */
export function watchTiles(
  source: TileSource,
  config: MapLayerConfig,
  report: LayerReporter,
): EventsKey[] {
  let pending = 0
  let loaded = 0
  let failed = 0
  let startedAt = 0
  const settle = () => {
    pending = Math.max(0, pending - 1)
    if (pending > 0) return
    report.metric(performance.now() - startedAt, failed === 0)
    if (failed > 0 && loaded === 0) report.fail(`Tiles failed to load for ${config.title}`)
    else report.loading(false)
  }
  return [
    source.on('tileloadstart', () => {
      if (pending === 0) {
        startedAt = performance.now()
        loaded = 0
        failed = 0
        report.loading(true)
      }
      pending += 1
    }),
    source.on('tileloadend', () => {
      loaded += 1
      settle()
    }),
    source.on('tileloaderror', () => {
      failed += 1
      settle()
    }),
  ]
}

/** Whether a style's symbols change size with zoom (`radiusStops`, `widthStops`). */
function hasZoomStops(symbols: Iterable<{ kind: string }>): boolean {
  for (const symbol of symbols) {
    const stops =
      'radiusStops' in symbol ? symbol.radiusStops : 'widthStops' in symbol ? symbol.widthStops : []
    if (Array.isArray(stops) && stops.length) return true
  }
  return false
}
