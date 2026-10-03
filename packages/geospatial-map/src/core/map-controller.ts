import OlMap from 'ol/Map.js'
import type BaseLayer from 'ol/layer/Base.js'
import type { FeatureLike } from 'ol/Feature.js'
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js'
import { defaults as defaultControls } from 'ol/control/defaults.js'
import { toLonLat } from 'ol/proj.js'
import type { EventsKey } from 'ol/events.js'
import { unByKey } from 'ol/Observable.js'
import { fetchGeoJson, LayerRegistry } from './layer-factory'
import { mapError, MapConfigurationError } from './errors'
import { composeVectorSvg } from './svg-export'
import { canvasFont, readCanvasTheme } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import {
  boundsToProjection,
  createView,
  ensureConfiguredProjection,
  normalizeView,
  projectionForZoom,
  viewToState,
} from './projections'
import type {
  GeoJsonLoader,
  AttributionSpec,
  BasemapConfig,
  ExportOptions,
  FeatureEvent,
  FitOptions,
  FitTarget,
  LayerStateEvent,
  LayerStatus,
  MapCallbacks,
  MapInteractionConfig,
  MapLayerConfig,
  MapOrigin,
  MapSelection,
  MapViewState,
  NormalizedLegend,
  ProjectionId,
  ProjectionBehavior,
  SerializedMapState,
  ThematicStyleSpec,
} from '../types'

/** @internal */
export type MapControllerOptions = MapCallbacks & {
  id: string
  target: HTMLElement
  ariaLabel: string
  view: MapViewState
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

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateBasemaps(basemaps: BasemapConfig[]): void {
  const ids = new Set<string>()
  for (const basemap of basemaps) {
    if (!basemap.id.trim() || !basemap.title.trim())
      throw new MapConfigurationError('Basemaps need non-empty IDs and titles')
    if (ids.has(basemap.id)) throw new MapConfigurationError(`Duplicate basemap ID: ${basemap.id}`)
    ids.add(basemap.id)
    if (!basemap.supportedProjections.length)
      throw new MapConfigurationError(`Basemap ${basemap.id} needs a supported projection`)
  }
}

export function compatibleBasemap(
  basemaps: BasemapConfig[],
  requestedId: string | undefined,
  projection: ProjectionId,
): BasemapConfig {
  const requested = basemaps.find((item) => item.id === requestedId)
  if (requested?.supportedProjections.includes(projection)) return requested
  const fallback = basemaps.find(
    (item) =>
      item.supportedProjections.includes(projection) && item.fallbackFor?.includes(projection),
  )
  const firstCompatible = basemaps.find((item) => item.supportedProjections.includes(projection))
  const result = fallback ?? firstCompatible
  if (!result) throw new MapConfigurationError(`No basemap supports ${projection}`)
  return result
}

export class MapController {
  private readonly map: OlMap
  private readonly registry: LayerRegistry
  private readonly mapKeys: EventsKey[] = []
  private readonly resizeObserver?: ResizeObserver
  private options: MapControllerOptions
  private overlays: MapLayerConfig[]
  private basemaps: BasemapConfig[]
  private activeBasemap: BasemapConfig
  private viewState: MapViewState
  private selection: MapSelection | null
  private time: string | null
  private statuses: LayerStatus[] = []
  private destroyed = false
  private switchingProjection = false
  private hoverFrame?: number
  private viewRenderStarted = 0
  private lastSelectionExtent: { key: string; extent: number[] } | undefined

  constructor(options: MapControllerOptions) {
    const startedAt = performance.now()
    validateBasemaps(options.basemaps)
    this.options = options
    this.overlays = options.layers
    this.basemaps = options.basemaps
    this.registerConfiguredProjections(this.basemaps, this.overlays)
    this.viewState = normalizeView(options.view)
    this.activeBasemap = compatibleBasemap(
      this.basemaps,
      options.activeBasemapId,
      this.viewState.projection,
    )
    this.selection = options.selection ?? null
    this.time = options.time ?? null
    const view = createView(this.viewState)
    this.registry = new LayerRegistry(
      view.getProjection(),
      {
        loadGeoJson: (url, loadOptions) =>
          (this.options.loadGeoJson ?? fetchGeoJson)(url, loadOptions),
        onError: (error) => this.options.onError?.(error),
        onStatus: (statuses) => {
          this.statuses = statuses
          this.options.onStatusChange?.(statuses)
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
    this.registry.setTheme(readCanvasTheme(options.target))
    const layers = this.registry.reconcile(this.allLayers())
    this.registry.setZoom(this.viewState.zoom)
    this.registry.setTime(this.time)
    this.registry.setSelection(this.selection)
    this.map = new OlMap({
      target: options.target,
      view,
      layers,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      interactions: defaultInteractions({
        keyboard: options.interactions?.keyboard ?? true,
        dragPan: options.interactions?.dragPan ?? true,
        mouseWheelZoom: options.interactions?.wheelZoom ?? true,
        doubleClickZoom: options.interactions?.doubleClickZoom ?? true,
        pinchZoom: options.interactions?.pinchZoom ?? true,
        altShiftDragRotate: options.interactions?.rotate ?? false,
        pinchRotate: options.interactions?.rotate ?? false,
      }),
    })
    options.target.tabIndex = options.interactions?.keyboard === false ? -1 : 0
    options.target.setAttribute('role', 'application')
    options.target.setAttribute('aria-label', options.ariaLabel)
    options.target.style.background = this.activeBasemap.backgroundColor

    this.mapKeys.push(
      this.map.on('movestart', () => {
        this.viewRenderStarted = performance.now()
      }),
      this.map.on('moveend', () => this.handleMoveEnd()),
      this.map.on('singleclick', (event) => {
        if (this.options.interactions?.select !== false)
          this.selectAtPixel(event.pixel, event.coordinate)
      }),
      this.map.on('pointermove', (event) => {
        if (this.options.interactions?.hover !== false)
          this.scheduleHover(event.pixel, event.coordinate)
      }),
    )
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map.updateSize())
      this.resizeObserver.observe(options.target)
    }
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

  update(options: MapControllerOptions): void {
    this.assertActive()
    validateBasemaps(options.basemaps)
    const previous = this.options
    this.options = options
    options.target.setAttribute('aria-label', options.ariaLabel)
    options.target.tabIndex = options.interactions?.keyboard === false ? -1 : 0
    this.registry.setTheme(readCanvasTheme(options.target))
    if (!same(previous.basemaps, options.basemaps))
      this.setBasemaps(options.basemaps, options.activeBasemapId)
    else if (options.activeBasemapId !== previous.activeBasemapId && options.activeBasemapId)
      this.setBasemap(options.activeBasemapId, 'prop')
    if (!same(previous.layers, options.layers)) this.setLayers(options.layers)
    if (!same(previous.view, options.view)) this.setView(options.view, 'prop')
    if (!same(previous.selection ?? null, options.selection ?? null))
      this.setSelection(options.selection ?? null)
    if ((previous.time ?? null) !== (options.time ?? null))
      this.setTime(options.time ?? null, 'prop')
  }

  setView(view: MapViewState | Partial<MapViewState>, origin: MapOrigin = 'user'): void {
    this.assertActive()
    const merged = normalizeView({
      ...this.viewState,
      ...view,
      center: view.center ?? this.viewState.center,
    })
    const desired = projectionForZoom(
      merged.zoom,
      merged.projection,
      this.options.projectionBehavior,
    )
    if (desired !== merged.projection) merged.projection = desired
    this.replaceView(merged, origin)
  }

  setProjection(projection: ProjectionId, origin: MapOrigin = 'user'): void {
    if (projection === this.viewState.projection) return
    this.replaceView({ ...this.viewState, projection }, origin)
  }

  setBasemap(id: string, origin: MapOrigin = 'user'): void {
    const requested = this.basemaps.find((item) => item.id === id)
    if (!requested) throw new MapConfigurationError(`Unknown basemap ID: ${id}`)
    if (!requested.supportedProjections.includes(this.viewState.projection)) {
      this.options.onError?.(
        mapError(
          'BASEMAP_INCOMPATIBLE',
          `${requested.title} does not support ${this.viewState.projection}`,
          true,
        ),
      )
      return
    }
    this.activeBasemap = requested
    this.options.target.style.background = requested.backgroundColor
    this.map.setLayers(this.registry.reconcile(this.allLayers()) as BaseLayer[])
    this.emitLayerStates(origin)
  }

  setBasemaps(basemaps: BasemapConfig[], requestedId?: string): void {
    validateBasemaps(basemaps)
    this.registerConfiguredProjections(basemaps, this.overlays)
    this.basemaps = basemaps
    this.activeBasemap = compatibleBasemap(basemaps, requestedId, this.viewState.projection)
    this.options.target.style.background = this.activeBasemap.backgroundColor
    this.map.setLayers(this.registry.reconcile(this.allLayers()) as BaseLayer[])
  }

  setLayers(layers: MapLayerConfig[]): void {
    this.registerConfiguredProjections(this.basemaps, layers)
    this.overlays = layers
    this.map.setLayers(this.registry.reconcile(this.allLayers()) as BaseLayer[])
    this.registry.setTime(this.time)
    this.registry.setSelection(this.selection)
  }

  setLayerVisibility(layerId: string, visible: boolean, origin: MapOrigin = 'user'): void {
    const config = this.registry.getConfig(layerId)
    if (!config) throw new MapConfigurationError(`Unknown layer ID: ${layerId}`)
    if (!visible && config.required)
      throw new MapConfigurationError(`Required layer ${layerId} cannot be hidden`, layerId)
    if (visible && config.exclusiveGroup) {
      for (const candidate of this.allLayers()) {
        if (
          candidate.id !== layerId &&
          candidate.exclusiveGroup === config.exclusiveGroup &&
          this.registry.getBaseVisible(candidate.id)
        ) {
          this.registry.setVisibility(candidate.id, false)
          this.emitLayerState(candidate.id, origin)
        }
      }
    }
    if (!this.registry.setVisibility(layerId, visible))
      throw new MapConfigurationError(`Unknown layer ID: ${layerId}`)
    this.emitLayerState(layerId, origin)
  }

  setLayerOpacity(layerId: string, opacity: number, origin: MapOrigin = 'user'): void {
    if (!this.registry.setOpacity(layerId, opacity))
      throw new MapConfigurationError(`Unknown layer ID: ${layerId}`)
    const layer = this.registry.getLayer(layerId)!
    this.options.onLayerStateChange?.({
      layerId,
      visible: layer.getVisible(),
      opacity: layer.getOpacity(),
      index: this.allLayers().findIndex((item) => item.id === layerId),
      origin,
    })
  }

  reorderOverlay(layerId: string, direction: -1 | 1): void {
    const index = this.overlays.findIndex((item) => item.id === layerId)
    if (index < 0 || !this.overlays[index]?.reorderable || this.overlays[index]?.orderLocked) return
    const nextIndex = Math.min(this.overlays.length - 1, Math.max(0, index + direction))
    if (nextIndex === index) return
    if (this.overlays[nextIndex]?.orderLocked) return
    const next = [...this.overlays]
    const [item] = next.splice(index, 1)
    next.splice(nextIndex, 0, item!)
    this.setLayers(next)
    this.emitLayerStates('user')
  }

  setSelection(selection: MapSelection | null): void {
    this.selection = selection
    this.registry.setSelection(selection)
    if (!selection) this.lastSelectionExtent = undefined
  }

  setLayerStyle(layerId: string, style: ThematicStyleSpec, origin: MapOrigin = 'user'): void {
    const index = this.overlays.findIndex((layer) => layer.id === layerId)
    const current = this.overlays[index]
    if (index < 0 || !current || !('style' in current))
      throw new MapConfigurationError(`Layer ${layerId} does not support client symbology`, layerId)
    const next = [...this.overlays]
    next[index] = { ...current, style }
    this.setLayers(next)
    this.options.onSymbologyChange?.({ layerId, style, origin })
  }

  setTime(time: string | null, origin: MapOrigin = 'user'): void {
    this.time = time
    this.registry.setTime(time)
    this.options.onTimeChange?.({ time, origin })
  }

  fit(target: FitTarget, options: FitOptions = {}): void {
    const bounds = 'bounds' in target ? target.bounds : target
    const view = this.map.getView()
    view.fit(boundsToProjection(bounds, view.getProjection()), {
      padding: options.padding ? [...options.padding] : [40, 40, 40, 40],
      duration: options.duration ?? 300,
      maxZoom: options.maxZoom,
      callback: () => this.handleMoveEnd('fit'),
    })
  }

  fitSelection(options: FitOptions = {}): boolean {
    if (!this.selection) return false
    const key = `${this.selection.layerId}:${this.selection.featureId}`
    const extent =
      this.registry.getFeatureExtent(this.selection.layerId, this.selection.featureId) ??
      (this.lastSelectionExtent?.key === key ? this.lastSelectionExtent.extent : undefined)
    if (!extent) return false
    this.map.getView().fit(extent, {
      padding: options.padding ? [...options.padding] : [40, 40, 40, 40],
      duration: options.duration ?? 300,
      maxZoom: options.maxZoom,
      callback: () => this.handleMoveEnd('fit'),
    })
    return true
  }

  getView(): MapViewState {
    return viewToState(this.map.getView(), this.viewState)
  }

  getActiveBasemapId(): string {
    return this.activeBasemap.id
  }

  getLayers(): MapLayerConfig[] {
    return this.overlays
  }

  getLegends(): NormalizedLegend[] {
    return this.registry
      .getLegends()
      .filter((legend) => !this.activeBasemap.layers.some((item) => item.id === legend.layerId))
  }

  getStatuses(): LayerStatus[] {
    return this.statuses
  }

  getAttributions(): AttributionSpec[] {
    const unique = new Map<string, AttributionSpec>()
    for (const item of [...this.activeBasemap.attribution, ...this.registry.getAttributions()])
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
    const exportStarted = performance.now()
    const blockers = this.registry.getVisibleNonExportableLayerIds()
    if (!this.activeBasemap.exportable || blockers.length) {
      const layerId =
        blockers[0] ?? this.activeBasemap.layers.find((layer) => layer.exportable === false)?.id
      throw mapError(
        'EXPORT_CORS_BLOCKED',
        `Visible layer ${layerId ?? this.activeBasemap.title} is not exportable. Configure anonymous CORS access or choose an exportable source.`,
        true,
        layerId,
      )
    }
    const width = Math.max(320, Math.round(options.width ?? 1200))
    const height = Math.max(240, Math.round(options.height ?? 720))
    const ratio = Math.min(3, Math.max(1, options.pixelRatio ?? 1))
    const headerHeight = this.reportHeaderHeight(options)
    const legendWidth = options.includeLegend === false ? 0 : 280
    const mapWidth = width - legendWidth
    const mapHeight = height - headerHeight - (options.includeAttribution === false ? 12 : 38)
    const theme = readCanvasTheme(this.options.target)
    const originalSize = this.map.getSize()
    this.map.setSize([mapWidth * ratio, mapHeight * ratio])
    try {
      await this.waitForSourcesAndRender(options.timeoutMs ?? 10_000)
      const vectorLayers =
        options.format === 'image/svg+xml' ? this.registry.getVisibleVectorLayers() : undefined
      if (vectorLayers) {
        const svg = composeVectorSvg({
          width,
          height,
          headerHeight,
          legendWidth,
          attributionHeight: options.includeAttribution === false ? 12 : 38,
          pixelRatio: ratio,
          report: options,
          time: this.time,
          selection: this.selection,
          layers: vectorLayers,
          backgroundColor: this.activeBasemap.backgroundColor,
          coordinateToPixel: (coordinate) => this.map.getPixelFromCoordinate(coordinate),
          attribution: this.getAttributions()
            .map((item) => item.label)
            .join(' · '),
          scaleLabel: `Scale: zoom ${this.getView().zoom.toFixed(2)} · ${this.getView().projection}`,
          theme,
        })
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        this.options.onMetric?.({ name: 'export', durationMs: performance.now() - exportStarted })
        return blob
      }
      const mapCanvas = document.createElement('canvas')
      mapCanvas.width = mapWidth * ratio
      mapCanvas.height = mapHeight * ratio
      const mapContext = mapCanvas.getContext('2d')!
      for (const canvas of this.options.target.querySelectorAll<HTMLCanvasElement>(
        '.ol-layer canvas, canvas.ol-layer',
      )) {
        if (!canvas.width) continue
        const opacity = Number(canvas.parentElement?.style.opacity || canvas.style.opacity || 1)
        mapContext.globalAlpha = opacity
        const transform = canvas.style.transform
        const matrix = transform
          .match(/^matrix\(([^)]+)\)$/)?.[1]
          ?.split(',')
          .map(Number)
        if (matrix?.length === 6)
          mapContext.setTransform(...(matrix as [number, number, number, number, number, number]))
        else mapContext.setTransform(1, 0, 0, 1, 0, 0)
        mapContext.drawImage(canvas, 0, 0)
      }
      const report = this.composeReport(mapCanvas, width, height, ratio, options, theme)
      if (options.format === 'image/svg+xml') {
        let dataUrl: string
        try {
          dataUrl = report.toDataURL('image/png')
        } catch (cause) {
          throw mapError(
            'EXPORT_CORS_BLOCKED',
            'A visible layer blocks browser export because of CORS',
            true,
            undefined,
            cause,
          )
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><metadata>svg-wrapper: map content is rasterized</metadata><image href="${dataUrl}" width="${width}" height="${height}"/></svg>`
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        this.options.onMetric?.({ name: 'export', durationMs: performance.now() - exportStarted })
        return blob
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        report.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(mapError('EXPORT_CORS_BLOCKED', 'Could not encode map export', true)),
          options.format,
          options.quality ?? 0.92,
        )
      })
      this.options.onMetric?.({ name: 'export', durationMs: performance.now() - exportStarted })
      return blob
    } finally {
      if (originalSize) this.map.setSize(originalSize)
      this.map.renderSync()
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.hoverFrame !== undefined) cancelAnimationFrame(this.hoverFrame)
    this.resizeObserver?.disconnect()
    unByKey(this.mapKeys)
    this.registry.destroy()
    this.map.setTarget(undefined)
  }

  private allLayers(): MapLayerConfig[] {
    return [...this.activeBasemap.layers, ...this.overlays]
  }

  private registerConfiguredProjections(basemaps: BasemapConfig[], layers: MapLayerConfig[]): void {
    for (const layer of [...basemaps.flatMap((basemap) => basemap.layers), ...layers])
      if (layer.kind === 'mvt' && layer.sourceProjectionDefinition)
        ensureConfiguredProjection(layer.sourceProjectionDefinition)
  }

  private replaceView(next: MapViewState, origin: MapOrigin): void {
    const normalized = normalizeView(next)
    const previous = this.viewState.projection
    const projectionChanged = previous !== normalized.projection
    this.viewState = normalized
    if (projectionChanged) {
      this.switchingProjection = true
      this.activeBasemap = compatibleBasemap(
        this.basemaps,
        this.activeBasemap.id,
        normalized.projection,
      )
      this.options.target.style.background = this.activeBasemap.backgroundColor
    }
    const view = createView(normalized)
    this.map.setView(view)
    if (projectionChanged)
      this.map.setLayers(
        this.registry.setProjection(view.getProjection(), this.allLayers()) as BaseLayer[],
      )
    this.registry.setZoom(normalized.zoom)
    this.registry.setTime(this.time)
    this.registry.setSelection(this.selection)
    this.switchingProjection = false
    if (projectionChanged)
      this.options.onProjectionChange?.({
        previous,
        current: normalized.projection,
        view: this.getView(),
        origin: origin === 'user' ? 'user' : 'projection-switch',
      })
    this.options.onViewChange?.({ view: this.getView(), origin })
  }

  private handleMoveEnd(origin: MapOrigin = 'user'): void {
    if (this.destroyed || this.switchingProjection) return
    const state = this.getView()
    const desired = projectionForZoom(state.zoom, state.projection, this.options.projectionBehavior)
    if (desired !== state.projection) {
      this.replaceView({ ...state, projection: desired }, 'projection-switch')
      return
    }
    this.viewState = state
    this.registry.setZoom(state.zoom)
    this.options.onViewChange?.({ view: state, origin })
    if (this.viewRenderStarted)
      this.options.onMetric?.({
        name: 'view-render',
        durationMs: performance.now() - this.viewRenderStarted,
      })
  }

  private selectAtPixel(pixel: number[], coordinate: number[]): void {
    const hits: Array<{ feature: FeatureLike; layer: BaseLayer }> = []
    this.map.forEachFeatureAtPixel(
      pixel,
      (feature, layer) => {
        if (layer) hits.push({ feature, layer })
        return undefined
      },
      { hitTolerance: this.options.interactions?.selectHitTolerance ?? 7 },
    )
    const candidates = this.registry.candidates(hits)
    const selected = candidates[0]
    if (!selected) {
      this.setSelection(null)
      this.options.onFeatureSelect?.(null)
      return
    }
    const lonLat = toLonLat(coordinate, this.map.getView().getProjection())
    const event: FeatureEvent = {
      mapId: this.options.id,
      layerId: selected.layerId,
      featureId: selected.featureId,
      coordinate: [lonLat[0] ?? 0, lonLat[1] ?? 0],
      properties: selected.properties,
      candidates,
      interaction: matchMedia('(pointer: coarse)').matches ? 'tap' : 'click',
      ...(selected.boundarySetId ? { boundarySetId: selected.boundarySetId } : {}),
      ...(selected.geographyLevel ? { geographyLevel: selected.geographyLevel } : {}),
    }
    const selectedHit = hits.find((hit) => {
      const hitLayerId = String(hit.layer.get('mapLayerId') ?? '')
      const hitConfig = this.registry.getConfig(hitLayerId)
      const hitId =
        hit.feature.getId() ??
        (hitConfig?.featureIdField ? hit.feature.get(hitConfig.featureIdField) : undefined)
      return hitLayerId === selected.layerId && String(hitId) === selected.featureId
    })
    const selectedExtent = selectedHit?.feature.getGeometry()?.getExtent()
    if (selectedExtent)
      this.lastSelectionExtent = {
        key: `${selected.layerId}:${selected.featureId}`,
        extent: [...selectedExtent],
      }
    this.setSelection(event)
    this.options.onFeatureSelect?.(event)
  }

  private scheduleHover(pixel: number[], coordinate: number[]): void {
    if (!this.options.onFeatureHover) return
    if (this.hoverFrame !== undefined) cancelAnimationFrame(this.hoverFrame)
    this.hoverFrame = requestAnimationFrame(() => {
      const hits: Array<{ feature: FeatureLike; layer: BaseLayer }> = []
      this.map.forEachFeatureAtPixel(
        pixel,
        (feature, layer) => {
          if (layer) hits.push({ feature, layer })
          return undefined
        },
        {
          hitTolerance: this.options.interactions?.hoverHitTolerance ?? 3,
        },
      )
      const selected = this.registry.candidates(hits)[0]
      if (!selected) return this.options.onFeatureHover?.(null)
      const lonLat = toLonLat(coordinate, this.map.getView().getProjection())
      this.options.onFeatureHover?.({
        mapId: this.options.id,
        layerId: selected.layerId,
        featureId: selected.featureId,
        coordinate: [lonLat[0] ?? 0, lonLat[1] ?? 0],
        properties: selected.properties,
        interaction: 'external',
        ...(selected.boundarySetId ? { boundarySetId: selected.boundarySetId } : {}),
        ...(selected.geographyLevel ? { geographyLevel: selected.geographyLevel } : {}),
      })
    })
  }

  private emitLayerStates(origin: MapOrigin): void {
    this.allLayers().forEach((layer, index) => {
      const runtime = this.registry.getLayer(layer.id)
      if (!runtime) return
      const event: LayerStateEvent = {
        layerId: layer.id,
        visible: runtime.getVisible(),
        opacity: runtime.getOpacity(),
        index,
        origin,
      }
      this.options.onLayerStateChange?.(event)
    })
  }

  private emitLayerState(layerId: string, origin: MapOrigin): void {
    const runtime = this.registry.getLayer(layerId)
    if (!runtime) return
    this.options.onLayerStateChange?.({
      layerId,
      visible: this.registry.getBaseVisible(layerId),
      opacity: runtime.getOpacity(),
      index: this.allLayers().findIndex((item) => item.id === layerId),
      origin,
    })
  }

  private waitForRender(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () =>
          reject(
            mapError('EXPORT_TIMEOUT', 'Map export timed out while waiting for rendering', true),
          ),
        timeoutMs,
      )
      this.map.once('rendercomplete', () => {
        window.clearTimeout(timeout)
        resolve()
      })
      this.map.renderSync()
    })
  }

  private async waitForSourcesAndRender(timeoutMs: number): Promise<void> {
    const started = performance.now()
    while (this.registry.getVisibleRequiredStatuses().some((status) => status.loading)) {
      if (performance.now() - started >= timeoutMs)
        throw mapError(
          'EXPORT_TIMEOUT',
          'Map export timed out while waiting for required sources',
          true,
        )
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
    const failed = this.registry.getVisibleRequiredStatuses().find((status) => status.error)
    if (failed?.error) throw failed.error
    await document.fonts?.ready
    await this.waitForRender(Math.max(1, timeoutMs - (performance.now() - started)))
  }

  private composeReport(
    mapCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    ratio: number,
    options: ExportOptions,
    theme: CanvasTheme,
  ): HTMLCanvasElement {
    const report = document.createElement('canvas')
    report.width = width * ratio
    report.height = height * ratio
    const context = report.getContext('2d')!
    context.scale(ratio, ratio)
    context.fillStyle = theme.exportBackground
    context.fillRect(0, 0, width, height)
    context.fillStyle = theme.exportForeground
    context.font = canvasFont(theme, 24, 700)
    if (options.title) context.fillText(options.title, 24, 34)
    context.font = canvasFont(theme, 14)
    if (options.subtitle) context.fillText(options.subtitle, 24, 56)
    const headerHeight = this.reportHeaderHeight(options)
    const details = [
      this.time ? `Time: ${this.time}` : '',
      options.selectedAreaLabel ? `Selected area: ${options.selectedAreaLabel}` : '',
      `Scale: zoom ${this.getView().zoom.toFixed(2)} · ${this.getView().projection}`,
    ].filter(Boolean)
    context.font = canvasFont(theme, 12)
    if (details.length) context.fillText(details.join(' · '), 24, headerHeight - 12)
    const legendWidth = options.includeLegend === false ? 0 : 280
    const attributionHeight = options.includeAttribution === false ? 12 : 38
    const mapWidth = width - legendWidth
    const mapHeight = height - headerHeight - attributionHeight
    context.drawImage(
      mapCanvas,
      0,
      0,
      mapCanvas.width,
      mapCanvas.height,
      0,
      headerHeight,
      mapWidth,
      mapHeight,
    )
    if (options.includeLegend !== false)
      this.drawLegend(context, mapWidth + 20, headerHeight + 12, legendWidth - 36, theme)
    if (options.includeAttribution !== false) {
      context.font = canvasFont(theme, 11)
      context.fillStyle = theme.exportMuted
      const text = this.getAttributions()
        .map((item) => item.label)
        .join(' · ')
      context.fillText(text.slice(0, 180), 24, height - 14)
    }
    return report
  }

  private drawLegend(
    context: CanvasRenderingContext2D,
    x: number,
    startY: number,
    width: number,
    theme: CanvasTheme,
  ): void {
    let y = startY
    for (const legend of this.getLegends().filter((item) => item.visible)) {
      context.fillStyle = theme.exportForeground
      context.font = canvasFont(theme, 14, 700)
      context.fillText(legend.title, x, y)
      y += 20
      context.font = canvasFont(theme, 12)
      for (const entry of legend.entries) {
        if (entry.symbol.kind === 'gradient') {
          const gradient = context.createLinearGradient(x, y, x + Math.min(120, width), y)
          const min = entry.symbol.stops[0]?.value ?? 0
          const max = entry.symbol.stops.at(-1)?.value ?? 1
          for (const stop of entry.symbol.stops)
            gradient.addColorStop(max === min ? 0 : (stop.value - min) / (max - min), stop.color)
          context.fillStyle = gradient
          context.fillRect(x, y - 11, Math.min(120, width), 12)
        } else {
          context.fillStyle =
            entry.symbol.kind === 'line'
              ? entry.symbol.color
              : (entry.symbol.fillColor ?? entry.symbol.strokeColor ?? '#9ca3af')
          context.fillRect(x, y - 11, 18, 12)
        }
        context.fillStyle = theme.exportForeground
        context.fillText(entry.label, x + 26, y)
        y += 19
      }
      y += 10
    }
  }

  private reportHeaderHeight(options: ExportOptions): number {
    return options.title || options.subtitle || this.time || options.selectedAreaLabel ? 92 : 36
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
