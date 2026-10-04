// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import OlMap from 'ol/Map.js'
import type BaseLayer from 'ol/layer/Base.js'
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js'
import { defaults as defaultControls } from 'ol/control/defaults.js'
import { fromLonLat } from 'ol/proj.js'
import type { EventsKey } from 'ol/events.js'
import { unByKey } from 'ol/Observable.js'
import { collectCssColors, readCanvasTheme, watchColorScheme } from './canvas-theme'
import { fetchGeoJson } from './data-sources'
import { mapError, MapConfigurationError } from './errors'
import { exportMapImage } from './export'
import { MapInteractions } from './interaction'
import { configSignature, LayerRegistry } from './layer-registry'
import {
  boundsToProjection,
  createView,
  getProjectionOrThrow,
  normalizeView,
  projectionForZoom,
  sameView,
  registerLayerProjections,
  updateView,
  viewToState,
  zoomLimits,
} from './projections'
import type { ZoomLimits } from './projections'
import { backgroundOf, compatibleBasemap, validateBasemaps } from './validation'
import type {
  AttributionSpec,
  BasemapConfig,
  ExportOptions,
  FeatureEvent,
  FitOptions,
  FitTarget,
  GeoJsonLoader,
  LonLat,
  MapCallbacks,
  MapInteractionConfig,
  MapLayerConfig,
  MapOrigin,
  MapSelection,
  MapViewState,
  NormalizedLegend,
  ProjectionBehavior,
  ProjectionId,
  SerializedMapState,
} from '../types'

// The map itself: one OpenLayers map, its view and projection, the configured layers (through
// the `LayerRegistry`), and the events that report changes back to React.

const FIT_PADDING = 40
const ANIMATION_MS = 300

/** @internal */
export type MapControllerOptions = MapCallbacks & {
  id: string
  target: HTMLElement
  ariaLabel: string
  view: MapViewState
  /** `view.minZoom` and `view.maxZoom` of the config. */
  zoomLimits?: { minZoom?: number | undefined; maxZoom?: number | undefined } | undefined
  projectionBehavior?: ProjectionBehavior | undefined
  layers: MapLayerConfig[]
  basemaps: BasemapConfig[]
  activeBasemapId?: string | undefined
  selection?: MapSelection | null | undefined
  time?: string | null | undefined
  interactions?: MapInteractionConfig | undefined
  /** Replaces `fetch` for GeoJSON `data: { url }` layers. */
  loadGeoJson?: GeoJsonLoader | undefined
}

const sameSelection = (left: MapSelection | null, right: MapSelection | null) =>
  left?.layerId === right?.layerId && left?.featureId === right?.featureId

/** A layer list's content, including the visibility and opacity the registry applies in place. */
const signatureOf = (layers: MapLayerConfig[]) =>
  layers.map((layer) => `${configSignature(layer)}|${layer.visible}|${layer.opacity}`).join('\n')
const basemapsSignature = (basemaps: BasemapConfig[]) =>
  JSON.stringify(basemaps.map(({ layers, ...basemap }) => [basemap, signatureOf(layers)]))

export class MapController {
  private readonly map: OlMap
  private readonly registry: LayerRegistry
  private readonly interactions: MapInteractions
  private readonly keys: EventsKey[] = []
  private readonly resizeObserver?: ResizeObserver
  private readonly stopThemeWatch: () => void
  private options: MapControllerOptions
  private overlays: MapLayerConfig[]
  private basemaps: BasemapConfig[]
  private activeBasemap: BasemapConfig
  private viewState: Required<MapViewState>
  private limits: ZoomLimits
  private selection: MapSelection | null
  private time: string | null
  private destroyed = false
  /** The view is resized for an export or replaced for a projection; its moves aren't the user's. */
  private quiet = false
  private moveStarted = 0

  constructor(options: MapControllerOptions) {
    const startedAt = performance.now()
    validateBasemaps(options.basemaps)
    this.options = options
    this.overlays = options.layers
    this.basemaps = options.basemaps
    registerLayerProjections([
      ...this.basemaps.flatMap((basemap) => basemap.layers),
      ...this.overlays,
    ])
    this.limits = zoomLimits(options.zoomLimits)
    this.viewState = normalizeView(options.view, this.limits)
    this.activeBasemap = compatibleBasemap(
      this.basemaps,
      options.activeBasemapId,
      this.viewState.projection,
    )
    this.selection = options.selection ?? null
    this.time = options.time ?? null
    const view = createView(this.viewState, this.limits)
    this.registry = new LayerRegistry(
      view.getProjection(),
      {
        loadGeoJson: (url, loadOptions) =>
          (this.options.loadGeoJson ?? fetchGeoJson)(url, loadOptions),
        onError: (error) => this.options.onError?.(error),
        onStatus: (statuses) => this.options.onStatusChange?.(statuses),
        onLayerReplaced: () => {
          if (!this.destroyed) this.setManagedLayers(this.registry.layersFor(this.allLayers()))
        },
        onMetric: (layerId, durationMs, success) =>
          this.options.onMetric?.({
            name: 'source-load',
            durationMs,
            layerId,
            detail: { success },
          }),
      },
      this.time,
    )
    this.applyTheme()
    this.registry.setZoom(this.viewState.zoom)
    this.registry.setSelection(this.selection)
    const interactions = options.interactions
    this.map = new OlMap({
      target: options.target,
      view,
      layers: this.registry.reconcile(this.allLayers()),
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      interactions: defaultInteractions({
        keyboard: interactions?.keyboard ?? true,
        dragPan: interactions?.dragPan ?? true,
        mouseWheelZoom: interactions?.wheelZoom ?? true,
        doubleClickZoom: interactions?.doubleClickZoom ?? true,
        pinchZoom: interactions?.pinchZoom ?? true,
        altShiftDragRotate: interactions?.rotate ?? false,
        pinchRotate: interactions?.rotate ?? false,
      }),
    })
    this.applyTarget()
    this.interactions = new MapInteractions(this.map, this.registry, {
      mapId: () => this.options.id,
      config: () => this.options.interactions,
      select: (event) => {
        this.setSelection(event)
        this.options.onFeatureSelect?.(event)
      },
      hover: () => this.options.onFeatureHover,
      moved: () => this.handleMoveEnd('user'),
    })
    this.keys.push(
      this.map.on('movestart', () => {
        this.moveStarted = performance.now()
      }),
      this.map.on('moveend', () => this.handleMoveEnd()),
    )
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map.updateSize())
      this.resizeObserver.observe(options.target)
    }
    this.stopThemeWatch = watchColorScheme(options.target, () => {
      if (!this.destroyed) this.applyTheme()
    })
    queueMicrotask(() => {
      if (this.destroyed) return
      this.map.once('rendercomplete', () => {
        if (this.destroyed) return
        this.options.onReady?.(this.getView())
        this.options.onMetric?.({ name: 'ready', durationMs: performance.now() - startedAt })
      })
      this.map.render()
    })
  }

  /**
   * Applies new options from React. A value is applied when it changed since the last options
   * and differs from what the map shows, so the echo of a user's pan or click does nothing.
   */
  update(options: MapControllerOptions): void {
    this.assertActive()
    const previous = this.options
    this.options = options
    this.applyTarget()
    if (basemapsSignature(previous.basemaps) !== basemapsSignature(options.basemaps))
      this.setBasemaps(options.basemaps, options.activeBasemapId)
    else if (
      options.activeBasemapId !== previous.activeBasemapId &&
      options.activeBasemapId &&
      options.activeBasemapId !== this.activeBasemap.id
    )
      this.setBasemap(options.activeBasemapId, 'prop')
    if (signatureOf(previous.layers) !== signatureOf(options.layers)) this.setLayers(options.layers)
    const limits = zoomLimits(options.zoomLimits)
    const limitsChanged =
      limits.minZoom !== this.limits.minZoom || limits.maxZoom !== this.limits.maxZoom
    this.limits = limits
    const view = normalizeView(options.view, limits)
    if (
      limitsChanged ||
      (!sameView(view, normalizeView(previous.view, limits)) && !sameView(view, this.viewState))
    )
      this.replaceView(view, 'prop', limitsChanged)
    const selection = options.selection ?? null
    if (
      !sameSelection(selection, previous.selection ?? null) &&
      !sameSelection(selection, this.selection)
    )
      this.setSelection(selection)
    const time = options.time ?? null
    if (time !== (previous.time ?? null) && time !== this.time) this.setTime(time, 'prop')
  }

  setView(view: Partial<MapViewState>, origin: MapOrigin = 'user'): void {
    this.assertActive()
    const merged = normalizeView({ ...this.getView(), ...view }, this.limits)
    merged.projection = projectionForZoom(
      merged.zoom,
      merged.projection,
      this.options.projectionBehavior,
    )
    this.replaceView(merged, origin)
  }

  setProjection(projection: ProjectionId, origin: MapOrigin = 'user'): void {
    if (projection === this.viewState.projection) return
    this.replaceView({ ...this.getView(), projection }, origin)
  }

  setBasemap(id: string, origin: MapOrigin = 'user'): void {
    const requested = this.basemaps.find((item) => item.id === id)
    if (!requested || !requested.supportedProjections.includes(this.viewState.projection)) {
      this.options.onError?.(
        mapError(
          'BASEMAP_INCOMPATIBLE',
          requested
            ? `${requested.title} does not support ${this.viewState.projection}`
            : `There is no basemap "${id}"`,
          true,
        ),
      )
      return
    }
    this.activeBasemap = requested
    this.options.target.style.background = backgroundOf(requested)
    this.setManagedLayers(this.registry.reconcile(this.allLayers()))
    for (const layer of this.allLayers()) this.emitLayerState(layer.id, origin)
  }

  setBasemaps(basemaps: BasemapConfig[], requestedId?: string): void {
    validateBasemaps(basemaps)
    registerLayerProjections(basemaps.flatMap((basemap) => basemap.layers))
    this.basemaps = basemaps
    this.activeBasemap = compatibleBasemap(basemaps, requestedId, this.viewState.projection)
    this.options.target.style.background = backgroundOf(this.activeBasemap)
    this.applyTheme()
    this.setManagedLayers(this.registry.reconcile(this.allLayers()))
  }

  setLayers(layers: MapLayerConfig[]): void {
    registerLayerProjections(layers)
    this.overlays = layers
    this.applyTheme()
    this.setManagedLayers(this.registry.reconcile(this.allLayers()))
  }

  setLayerVisibility(layerId: string, visible: boolean, origin: MapOrigin = 'user'): void {
    const config = this.registry.getConfig(layerId)
    if (!config) throw new MapConfigurationError(`Unknown layer ID: ${layerId}`)
    if (!visible && config.required)
      throw new MapConfigurationError(`Required layer ${layerId} cannot be hidden`, layerId)
    if (visible && config.exclusiveGroup)
      for (const other of this.allLayers())
        if (
          other.id !== layerId &&
          other.exclusiveGroup === config.exclusiveGroup &&
          this.registry.getBaseVisible(other.id)
        ) {
          this.registry.setVisibility(other.id, false)
          this.emitLayerState(other.id, origin)
        }
    this.registry.setVisibility(layerId, visible)
    this.emitLayerState(layerId, origin)
  }

  setLayerOpacity(layerId: string, opacity: number, origin: MapOrigin = 'user'): void {
    if (!this.registry.setOpacity(layerId, opacity))
      throw new MapConfigurationError(`Unknown layer ID: ${layerId}`)
    this.emitLayerState(layerId, origin)
  }

  /** Moves one of your layers up or down by one, unless it or its neighbour is locked. */
  reorderOverlay(layerId: string, direction: -1 | 1): void {
    const index = this.overlays.findIndex((item) => item.id === layerId)
    const target = index + direction
    const movable = (layer: MapLayerConfig | undefined) => layer && layer.reorderable !== false
    if (index < 0 || target < 0 || target >= this.overlays.length) return
    if (!movable(this.overlays[index]) || !movable(this.overlays[target])) return
    const next = [...this.overlays]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item!)
    this.setLayers(next)
    for (const layer of this.overlays) this.emitLayerState(layer.id, 'user')
  }

  setSelection(selection: MapSelection | null): void {
    this.selection = selection
    this.registry.setSelection(selection)
  }

  /** The feature event for a selection (from a click or from the host), when it is loaded. */
  describeSelection(selection: MapSelection | null): FeatureEvent | null {
    return this.interactions.describe(selection)
  }

  setTime(time: string | null, origin: MapOrigin = 'user'): void {
    this.time = time
    this.registry.setTime(time)
    this.options.onTimeChange?.({ time, origin })
  }

  fit(target: FitTarget, options: FitOptions = {}): void {
    const bounds = 'bounds' in target ? target.bounds : target
    this.fitExtent(boundsToProjection(bounds, this.map.getView().getProjection()), options)
  }

  /** Fits the selected feature; `false` when there is none or its extent isn't known. */
  fitSelection(options: FitOptions = {}): boolean {
    const extent = this.selection && this.interactions.selectionExtent(this.selection)
    if (!extent) return false
    this.fitExtent(extent, options)
    return true
  }

  /** The OpenLayers map, for integrations the configuration does not cover. */
  getOpenLayersMap(): OlMap {
    return this.map
  }

  /** Pixel position of a longitude/latitude in the map viewport, or `null` before layout. */
  pixelAt(lonLat: LonLat): [number, number] | null {
    if (!this.map.getSize() || !Number.isFinite(lonLat[0]) || !Number.isFinite(lonLat[1]))
      return null
    const coordinate = fromLonLat([lonLat[0], lonLat[1]], this.map.getView().getProjection())
    const pixel = this.map.getPixelFromCoordinate(coordinate) as number[] | null
    return pixel ? [pixel[0]!, pixel[1]!] : null
  }

  /** Calls `listener` after every rendered frame: pans, zooms, animations, and resizes. */
  onRender(listener: () => void): () => void {
    const key = this.map.on('postrender', listener)
    return () => unByKey(key)
  }

  getView(): Required<MapViewState> {
    return viewToState(this.map.getView())
  }

  getActiveBasemapId(): string {
    return this.activeBasemap.id
  }

  /** Legends of your layers (not the basemap's), as shown in the legend panel and exports. */
  getLegends(): NormalizedLegend[] {
    const basemapLayers = new Set(this.activeBasemap.layers.map((layer) => layer.id))
    return this.registry.getLegends().filter((legend) => !basemapLayers.has(legend.layerId))
  }

  getAttributions(): AttributionSpec[] {
    const unique = new Map<string, AttributionSpec>()
    for (const item of [
      ...(this.activeBasemap.attribution ?? []),
      ...this.registry.getAttributions(),
    ])
      unique.set(`${item.label}|${item.url ?? ''}`, item)
    return [...unique.values()]
  }

  serialize(): SerializedMapState {
    return {
      version: 1,
      view: this.getView(),
      activeBasemapId: this.activeBasemap.id,
      layers: this.overlays.map((layer, index) => ({
        id: layer.id,
        visible: this.registry.getBaseVisible(layer.id),
        opacity: this.registry.getLayer(layer.id)?.getOpacity() ?? layer.opacity ?? 1,
        index,
      })),
      time: this.time,
      selection: this.selection,
    }
  }

  async exportImage(options: ExportOptions): Promise<Blob> {
    const started = performance.now()
    const blob = await exportMapImage(
      {
        map: this.map,
        target: this.options.target,
        theme: this.readTheme(),
        time: this.time,
        selection: this.selection,
        view: this.getView(),
        basemap: this.activeBasemap,
        legends: this.getLegends(),
        attribution: this.getAttributions()
          .map((item) => item.label)
          .join(' · '),
        layers: this.registry,
        setExporting: (exporting) => {
          this.quiet = exporting
        },
      },
      options,
    )
    this.options.onMetric?.({ name: 'export', durationMs: performance.now() - started })
    return blob
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.interactions.dispose()
    this.resizeObserver?.disconnect()
    this.stopThemeWatch()
    unByKey(this.keys)
    this.registry.destroy()
    this.map.setTarget(undefined)
  }

  private fitExtent(extent: number[], options: FitOptions): void {
    this.map.getView().fit(extent, {
      padding: options.padding ? [...options.padding] : Array(4).fill(FIT_PADDING),
      duration: options.duration ?? ANIMATION_MS,
      maxZoom: options.maxZoom,
      callback: () => this.handleMoveEnd('fit'),
    })
  }

  /** Label, keyboard focus and background of the map element. */
  private applyTarget(): void {
    const { target, ariaLabel, interactions } = this.options
    target.tabIndex = interactions?.keyboard === false ? -1 : 0
    target.setAttribute('role', 'application')
    target.setAttribute('aria-label', ariaLabel)
    target.style.background = backgroundOf(this.activeBasemap)
  }

  /**
   * Replaces the configured layers while keeping layers a host added through
   * `getOpenLayersMap().addLayer(…)`. Configured layers carry a `mapLayerId` property.
   */
  private setManagedLayers(layers: BaseLayer[]): void {
    const external = this.map
      .getLayers()
      .getArray()
      .filter((layer) => layer.get('mapLayerId') === undefined)
    this.map.setLayers([...layers, ...external])
  }

  /** Canvas colors and font from the CSS tokens, including `var()` colors used by the layers. */
  private readTheme() {
    return readCanvasTheme(
      this.options.target,
      collectCssColors(this.options.basemaps, this.options.layers),
    )
  }

  private applyTheme(): void {
    this.registry.setTheme(this.readTheme())
  }

  /** Drawing order: basemap, your layers, then basemap layers marked `aboveOverlays` (labels, borders). */
  private allLayers(): MapLayerConfig[] {
    const below = this.activeBasemap.layers.filter((layer) => !layer.aboveOverlays)
    const above = this.activeBasemap.layers.filter((layer) => layer.aboveOverlays)
    return [...below, ...this.overlays, ...above]
  }

  private replaceView(next: MapViewState, origin: MapOrigin, newLimits = false): void {
    const normalized = normalizeView(next, this.limits)
    const previous = this.viewState
    const projectionChanged = previous.projection !== normalized.projection
    if (projectionChanged) {
      // Check before changing anything, so a failed switch leaves the map as it was.
      try {
        getProjectionOrThrow(normalized.projection)
        this.activeBasemap = compatibleBasemap(
          this.basemaps,
          this.activeBasemap.id,
          normalized.projection,
        )
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        this.options.onError?.(mapError('BASEMAP_INCOMPATIBLE', message, true, undefined, cause))
        return
      }
      this.options.target.style.background = backgroundOf(this.activeBasemap)
    }
    this.viewState = normalized
    this.quiet = true
    try {
      const view = this.map.getView()
      if (projectionChanged || newLimits) {
        const replacement = createView(normalized, this.limits)
        this.map.setView(replacement)
        if (projectionChanged)
          this.setManagedLayers(
            this.registry.setProjection(replacement.getProjection(), this.allLayers()),
          )
      } else updateView(view, normalized)
    } finally {
      this.quiet = false
    }
    this.registry.setZoom(normalized.zoom)
    if (projectionChanged)
      this.options.onProjectionChange?.({
        previous: previous.projection,
        current: normalized.projection,
        view: this.getView(),
        origin: origin === 'user' ? 'user' : 'projection-switch',
      })
    this.options.onViewChange?.({ view: this.getView(), origin })
  }

  private handleMoveEnd(origin: MapOrigin = 'user'): void {
    if (this.destroyed || this.quiet) return
    const state = this.getView()
    // The map settling where the controller put it (after a view change or an export).
    if (sameView(state, this.viewState)) return
    const desired = projectionForZoom(state.zoom, state.projection, this.options.projectionBehavior)
    if (desired !== state.projection) {
      this.replaceView({ ...state, projection: desired }, 'projection-switch')
      return
    }
    this.viewState = state
    this.registry.setZoom(state.zoom)
    this.options.onViewChange?.({ view: state, origin })
    if (this.moveStarted)
      this.options.onMetric?.({
        name: 'view-render',
        durationMs: performance.now() - this.moveStarted,
      })
  }

  /** Reports a layer's visibility (as asked for, before zoom limits), opacity and position. */
  private emitLayerState(layerId: string, origin: MapOrigin): void {
    const layer = this.registry.getLayer(layerId)
    if (!layer) return
    this.options.onLayerStateChange?.({
      layerId,
      visible: this.registry.getBaseVisible(layerId),
      opacity: layer.getOpacity(),
      index: this.allLayers().findIndex((item) => item.id === layerId),
      origin,
    })
  }

  private assertActive(): void {
    if (this.destroyed) throw new Error('This map controller has been destroyed')
  }
}

export function createMapController(options: MapControllerOptions): MapController {
  if (!(options.target instanceof HTMLElement))
    throw new MapConfigurationError('Map target must be an HTMLElement')
  return new MapController(options)
}
