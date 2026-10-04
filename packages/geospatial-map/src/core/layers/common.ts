// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { FeatureLike } from 'ol/Feature.js'
import type Feature from 'ol/Feature.js'
import type BaseLayer from 'ol/layer/Base.js'
import type Projection from 'ol/proj/Projection.js'
import type TileSource from 'ol/source/Tile.js'
import type { EventsKey } from 'ol/events.js'
import type Style from 'ol/style/Style.js'
import type {
  AttributionSpec,
  GeoJsonLoader,
  LayerTimeSpec,
  MapLayerConfig,
  MapSelection,
} from '../../types'
import type { CanvasTheme } from '../canvas-theme'
import { selectionStyleForGeometry } from '../style-compiler'

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

/** How a layer reports its loading state. */
export type LayerReporter = {
  loading(loading: boolean): void
  fail(message: string, cause?: unknown): void
  metric(durationMs: number, success: boolean): void
  /** The layer object was replaced (canvas to GPU once a large dataset has loaded). */
  replaced(layer: BaseLayer): void
}

/** A change of map state that can alter how a layer looks. */
export type LayerDependency = 'zoom' | 'time' | 'selection' | 'theme'

export type BuiltLayer = {
  layer: BaseLayer
  /** Redraw the layer when one of these changes (unless a hook below handles it). */
  redrawOn: ReadonlySet<LayerDependency>
  setTime?(time: string | null): void
  onZoom?(zoom: number): void
  onSelection?(): void
  onTheme?(): void
  /** A loaded feature by selection id (vector layers; tiles don't keep features). */
  feature?(featureId: string): FeatureLike | undefined
  /** The features of a vector layer the SVG export can draw as vectors. */
  vectorFeatures?(): Feature[]
  dispose?(): void
}

/** OpenLayers options every layer shares. `mapLayerId` tells configured layers from others. */
export function layerOptions(config: MapLayerConfig) {
  return {
    opacity: config.opacity ?? 1,
    visible: config.visible ?? true,
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
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

/** A URL template with `{time}` filled in. */
export function withTime(template: string, time: string | null): string {
  return template.replaceAll('{time}', encodeURIComponent(time ?? ''))
}

/** Prefetch at most this many frames after the current one. */
const MAX_PREFETCH_FRAMES = 2

/** The time frames to prefetch after `time`, as configured by `prefetchFrames`. */
export function followingTimes(spec: LayerTimeSpec | undefined, time: string | null): string[] {
  const count = Math.min(MAX_PREFETCH_FRAMES, Math.max(0, spec?.prefetchFrames ?? 0))
  if (!count || !time || !spec) return []
  const index = spec.available.indexOf(time)
  return index < 0 ? [] : spec.available.slice(index + 1, index + 1 + count)
}

/** A feature's selection id: its own id, else the `featureIdField` value. */
export function featureIdOf(feature: FeatureLike, idField: string | undefined): string | undefined {
  const id = feature.getId() ?? (idField ? feature.get(idField) : undefined)
  return id === undefined || id === null ? undefined : String(id)
}

/** A style function that draws the selected feature highlighted and the others with `style`. */
export function withSelection<Args extends unknown[]>(
  config: MapLayerConfig,
  env: LayerEnvironment,
  style: (feature: FeatureLike, ...args: Args) => Style | Style[] | undefined | void,
) {
  return (feature: FeatureLike, ...args: Args) => {
    const selection = env.selection
    if (
      selection?.layerId === config.id &&
      featureIdOf(feature, config.featureIdField) === selection.featureId
    )
      return selectionStyleForGeometry(feature.getGeometry()?.getType() ?? '', env.theme)
    return style(feature, ...args)
  }
}

/** Reports a tile source's loading state; returns the listener keys to remove on dispose. */
export function watchTiles(
  source: TileSource,
  config: MapLayerConfig,
  report: LayerReporter,
): EventsKey[] {
  let pending = 0
  let startedAt = 0
  return [
    source.on('tileloadstart', () => {
      if (pending === 0) startedAt = performance.now()
      pending += 1
      report.loading(true)
    }),
    source.on('tileloadend', () => {
      pending = Math.max(0, pending - 1)
      report.loading(pending > 0)
      if (pending === 0) report.metric(performance.now() - startedAt, true)
    }),
    source.on('tileloaderror', (event: unknown) => {
      pending = Math.max(0, pending - 1)
      report.metric(performance.now() - startedAt, false)
      report.fail(`A tile failed to load for ${config.title}`, event)
    }),
  ]
}

/** Whether a style's symbols change size with zoom (`radiusStops`, `widthStops`). */
export function hasZoomStops(symbols: Iterable<{ kind: string }>): boolean {
  for (const symbol of symbols) {
    const stops =
      'radiusStops' in symbol ? symbol.radiusStops : 'widthStops' in symbol ? symbol.widthStops : []
    if (Array.isArray(stops) && stops.length) return true
  }
  return false
}
