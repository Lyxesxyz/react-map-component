// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

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
import { canReorder } from './layer-order'
import { sameSelection, uniqueAttributions } from './layers/common'
import {
  ANIMATION_MS,
  boundsToProjection,
  createView,
  normalizeView,
  registerLayerProjections,
  sameView,
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
  LonLatBounds,
  MapCallbacks,
  MapInteractionConfig,
  MapLayerConfig,
  MapLayerState,
  MapMessages,
  MapOrigin,
  MapSelection,
  MapViewState,
  NormalizedLegend,
} from '../types'

// The map itself: one OpenLayers map in one projection, its view, the configured layers
// (through the `LayerRegistry`), and the events that report changes back to the map's engine
// (React or Angular).

const FIT_PADDING = 40
/** What "fit data" shows when no visible layer has loaded features. */
const WORLD: LonLatBounds = [-180, -85, 180, 85]

/** @internal */
export type MapControllerOptions = Omit<MapCallbacks, 'onReady'> & {
  id: string
  target: HTMLElement
  ariaLabel: string
  /** The view; its projection is the map's for the life of the controller. */
  view: MapViewState
  /** `view.minZoom` and `view.maxZoom` of the config. */
  zoomLimits?: { minZoom?: number | undefined; maxZoom?: number | undefined } | undefined
  layers: MapLayerConfig[]
  basemaps: BasemapConfig[]
  activeBasemapId?: string | undefined
  selection?: MapSelection | null | undefined
  time?: string | null | undefined
  interactions?: MapInteractionConfig | undefined
  /** Replaces `fetch` for GeoJSON `data: { url }` layers. */
  loadGeoJson?: GeoJsonLoader | undefined
  /** Text of exported reports. */
  messages: Pick<MapMessages, 'exportTime' | 'exportSelectedArea' | 'exportScale'>
  /** Called once the first frame is drawn. */
  onReady?: ((view: MapViewState) => void) | undefined
}

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
  /** The background last written to the map element. */
  private background = ''
  private destroyed = false
  /** An export resizes the map: its size and view moves are not the user's. */
  private exporting = false
  /** Exports run one after the other. */
  private exportQueue: Promise<unknown> = Promise.resolve()
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
          if (!this.destroyed) this.setManagedLayers(this.registry.layers())
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
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.exporting) this.map.updateSize()
      })
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
   * Applies new options from the engine. A value is applied when it changed since the last
   * options and differs from what the map shows, so the echo of a user's pan or click does nothing.
   * With `resync`, every value that differs from what the map shows is applied: the host
   * answered a proposed change with another state, and the host's state wins.
   */
  update(options: MapControllerOptions, resync = false): void {
    this.assertActive()
    const previous = resync ? this.liveOptions() : this.options
    this.options = options
    this.applyTarget()
    const basemapsChanged =
      options.basemaps !== previous.basemaps &&
      basemapsSignature(previous.basemaps) !== basemapsSignature(options.basemaps)
    const layersChanged =
      options.layers !== previous.layers &&
      signatureOf(previous.layers) !== signatureOf(options.layers)
    if (basemapsChanged || layersChanged) {
      if (basemapsChanged) {
        validateBasemaps(options.basemaps)
        this.basemaps = options.basemaps
        this.activeBasemap = compatibleBasemap(
          options.basemaps,
          options.activeBasemapId ?? this.activeBasemap.id,
          this.viewState.projection,
        )
      }
      if (layersChanged) this.overlays = options.layers
      this.reconcile()
    }
    if (
      !basemapsChanged &&
      options.activeBasemapId &&
      options.activeBasemapId !== previous.activeBasemapId &&
      options.activeBasemapId !== this.activeBasemap.id
    )
      this.setBasemap(options.activeBasemapId)
    const limits = zoomLimits(options.zoomLimits)
    const limitsChanged =
      limits.minZoom !== this.limits.minZoom || limits.maxZoom !== this.limits.maxZoom
    this.limits = limits
    const view = this.ownProjection(normalizeView(options.view, limits))
    if (
      limitsChanged ||
      (!sameView(view, this.ownProjection(normalizeView(previous.view, limits))) &&
        !sameView(view, this.viewState))
    )
      this.replaceView(view, 'state', limitsChanged)
    const selection = options.selection ?? null
    if (
      !sameSelection(selection, previous.selection ?? null) &&
      !sameSelection(selection, this.selection)
    )
      this.setSelection(selection)
    const time = options.time ?? null
    if (time !== (previous.time ?? null) && time !== this.time) this.setTime(time, 'state')
  }

  setView(view: Partial<MapViewState>, origin: MapOrigin = 'user'): void {
    this.assertActive()
    this.replaceView(
      this.ownProjection(normalizeView({ ...this.getView(), ...view }, this.limits)),
      origin,
    )
  }

  /**
   * Shows another basemap. Returns `false`, and reports `BASEMAP_INCOMPATIBLE`, when there is
   * no such basemap or it doesn't support the map's projection.
   */
  setBasemap(id: string): boolean {
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
      return false
    }
    if (requested === this.activeBasemap) return true
    this.activeBasemap = requested
    this.applyTarget()
    this.reconcile()
    return true
  }

  setLayerVisibility(layerId: string, visible: boolean, origin: MapOrigin = 'user'): void {
    const config = this.overlayConfig(layerId)
    if (!visible && config.required)
      throw new MapConfigurationError(`Required layer ${layerId} cannot be hidden`, layerId)
    if (visible && config.exclusiveGroup)
      for (const other of this.overlays)
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
    this.overlayConfig(layerId)
    this.registry.setOpacity(layerId, opacity)
    this.emitLayerState(layerId, origin)
  }

  /** Moves one of your layers up (`1`) or down (`-1`), unless it or its neighbour is locked. */
  reorderOverlay(layerId: string, direction: -1 | 1, origin: MapOrigin = 'user'): void {
    const index = this.overlays.findIndex((item) => item.id === layerId)
    if (!canReorder(this.overlays, index, direction)) return
    const next = [...this.overlays]
    const [item] = next.splice(index, 1)
    next.splice(index + direction, 0, item!)
    this.overlays = next
    this.reconcile()
    for (const layer of [next[index]!, next[index + direction]!])
      this.emitLayerState(layer.id, origin)
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
    if (time === this.time) return
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

  /** Fits the loaded features of your visible layers, or the world when there are none. */
  fitData(options: FitOptions = {}): void {
    const extent = this.registry.dataExtent(this.overlays.map((layer) => layer.id))
    if (extent) this.fitExtent(extent, options)
    else this.fit(WORLD, options)
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

  /** Visibility (as asked for), opacity and order of your layers, as in `MapState.layers`. */
  getLayerStates(): Record<string, MapLayerState> {
    return Object.fromEntries(
      this.overlays.map((layer, order) => [
        layer.id,
        {
          visible: this.registry.getBaseVisible(layer.id),
          opacity: this.registry.getOpacity(layer.id),
          order,
        },
      ]),
    )
  }

  /** Legends of your layers (not the basemap's), as shown in the legend panel and exports. */
  getLegends(): NormalizedLegend[] {
    const basemapLayers = new Set(this.activeBasemap.layers.map((layer) => layer.id))
    return this.registry.getLegends().filter((legend) => !basemapLayers.has(legend.layerId))
  }

  getAttributions(): AttributionSpec[] {
    return uniqueAttributions([
      ...(this.activeBasemap.attribution ?? []),
      ...this.registry.getAttributions(),
    ])
  }

  /** The map as a report image. Exports run one at a time, in the order they were asked for. */
  exportImage(options: ExportOptions): Promise<Blob> {
    const run = () => this.runExport(options)
    const result = this.exportQueue.then(run, run)
    this.exportQueue = result.catch(() => undefined)
    return result
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.interactions.dispose()
    this.resizeObserver?.disconnect()
    this.stopThemeWatch()
    unByKey(this.keys)
    this.registry.destroy()
    this.map.dispose()
  }

  private async runExport(options: ExportOptions): Promise<Blob> {
    this.assertActive()
    const started = performance.now()
    try {
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
          messages: this.options.messages,
          layers: this.registry,
          setExporting: (exporting) => {
            this.exporting = exporting
          },
        },
        options,
      )
      this.options.onMetric?.({ name: 'export', durationMs: performance.now() - started })
      return blob
    } finally {
      // The map element may have been resized while the export had the map.
      if (!this.destroyed) this.map.updateSize()
    }
  }

  /** What the map shows now, in the shape of the options (for `update` with `resync`). */
  private liveOptions(): MapControllerOptions {
    return {
      ...this.options,
      view: this.viewState,
      layers: this.overlays.map((layer) => ({
        ...layer,
        visible: this.registry.getBaseVisible(layer.id),
        opacity: this.registry.getOpacity(layer.id),
      })),
      activeBasemapId: this.activeBasemap.id,
      selection: this.selection,
      time: this.time,
    }
  }

  /** The config of one of your layers; throws for an unknown id. */
  private overlayConfig(layerId: string): MapLayerConfig {
    const config = this.overlays.find((layer) => layer.id === layerId)
    if (!config) throw new MapConfigurationError(`Unknown layer ID: ${layerId}`)
    return config
  }

  /** A view in the map's projection: the projection is fixed when the map is created. */
  private ownProjection(view: Required<MapViewState>): Required<MapViewState> {
    const projection = this.viewState.projection
    return view.projection === projection ? view : { ...view, projection }
  }

  private fitExtent(extent: number[], options: FitOptions): void {
    this.map.getView().fit(extent, {
      padding: options.padding ? [...options.padding] : Array(4).fill(FIT_PADDING),
      duration: options.duration ?? ANIMATION_MS,
      maxZoom: options.maxZoom,
      callback: () => this.handleMoveEnd('api'),
    })
  }

  /** Label, keyboard focus and background of the map element. */
  private applyTarget(): void {
    const { target, ariaLabel, interactions } = this.options
    target.tabIndex = interactions?.keyboard === false ? -1 : 0
    target.setAttribute('role', 'application')
    target.setAttribute('aria-label', ariaLabel)
    // Written only when it changes: the theme watcher re-reads colours on style changes.
    const background = backgroundOf(this.activeBasemap)
    if (background !== this.background) {
      this.background = background
      target.style.background = background
    }
  }

  /** Builds or updates the layers of the active basemap and yours, and puts them on the map. */
  private reconcile(): void {
    const layers = this.allLayers()
    registerLayerProjections(layers)
    this.applyTheme()
    this.setManagedLayers(this.registry.reconcile(layers))
  }

  /**
   * Puts the configured layers on the map in order, adding and removing only what changed, so
   * layers a host added (`getOpenLayersMap().addLayer(…)`) and its collection listeners stay.
   * Configured layers carry a `mapLayerId` property.
   */
  private setManagedLayers(layers: BaseLayer[]): void {
    const collection = this.map.getLayers()
    const wanted = new Set(layers)
    for (const layer of [...collection.getArray()])
      if (layer.get('mapLayerId') !== undefined && !wanted.has(layer)) collection.remove(layer)
    layers.forEach((layer, index) => {
      const at = collection.getArray().indexOf(layer)
      if (at === index) return
      if (at >= 0) collection.removeAt(at)
      collection.insertAt(index, layer)
    })
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

  private replaceView(next: Required<MapViewState>, origin: MapOrigin, newLimits = false): void {
    this.viewState = next
    if (newLimits) this.map.setView(createView(next, this.limits))
    else updateView(this.map.getView(), next)
    this.registry.setZoom(next.zoom)
    this.options.onViewChange?.({ view: this.getView(), origin })
  }

  private handleMoveEnd(origin: MapOrigin = 'user'): void {
    if (this.destroyed || this.exporting) return
    const state = this.getView()
    // The map settling where the controller put it (after a view change or an export).
    if (sameView(state, this.viewState)) return
    this.viewState = state
    this.registry.setZoom(state.zoom)
    this.options.onViewChange?.({ view: state, origin })
    if (this.moveStarted)
      this.options.onMetric?.({
        name: 'view-render',
        durationMs: performance.now() - this.moveStarted,
      })
  }

  /** Reports one of your layers' visibility (as asked for), opacity and order. */
  private emitLayerState(layerId: string, origin: MapOrigin): void {
    const state = this.getLayerStates()[layerId]
    if (state) this.options.onLayerStateChange?.({ layerId, ...state, origin })
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
