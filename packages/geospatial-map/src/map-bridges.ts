// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { fetchGeoJson } from './core/data-sources'
import { asMapError, mapError } from './core/errors'
import type { MapController, MapControllerOptions } from './core/map-controller'
import {
  extensionForFormat,
  sameJson,
  sameMapState,
  selectionFromEvent,
  stateFromSerialized,
} from './map-state'
import { formatMapMessage } from './messages'
import type {
  AttributionSpec,
  FeatureEvent,
  LayerStatus,
  MapActions,
  MapConfig,
  MapError,
  MapMessages,
  MapPanelId,
  MapRootProps,
  MapState,
  MapStateChange,
  NormalizedLegend,
  ResolvedMapUiConfig,
} from './types'
import { downloadBlob } from './utils'

// The bridge between the OpenLayers controller and React, created once per map: the actions
// (stable for the life of the map) and the controller callbacks that turn renderer events into
// state proposals, `on*` callbacks and screen-reader announcements. Everything here reads refs
// when called, never during render.

const WORLD: [number, number, number, number] = [-180, -90, 180, 90]

/** What the map knows from the renderer, shown by the parts. */
export type MapDerived = {
  legends: NormalizedLegend[]
  attributions: AttributionSpec[]
  statuses: LayerStatus[]
  selectedFeature: FeatureEvent | null
}

export const emptyDerived: MapDerived = {
  legends: [],
  attributions: [],
  statuses: [],
  selectedFeature: null,
}

/** The latest committed inputs; `state` is also updated as soon as a change is proposed. */
export type EngineLatest = {
  props: MapRootProps
  config: MapConfig | undefined
  ui: ResolvedMapUiConfig
  messages: MapMessages
  state: MapState
}

export type BridgeInput = {
  /** The inputs of the first render. */
  initial: EngineLatest
  /** Component-owned state; only called when the host doesn't control `state`. */
  setOwnState: (state: MapState) => void
  setDerived: (update: (current: MapDerived) => MapDerived) => void
  setOpenPanel: (panel: MapPanelId | null) => void
  setError: (error: MapError | null) => void
  setLiveMessage: (message: string) => void
  setRendered: (rendered: boolean) => void
}

export type ControllerCallbacks = Pick<
  MapControllerOptions,
  | 'loadGeoJson'
  | 'onReady'
  | 'onViewChange'
  | 'onProjectionChange'
  | 'onFeatureHover'
  | 'onFeatureSelect'
  | 'onLayerStateChange'
  | 'onTimeChange'
  | 'onError'
  | 'onStatusChange'
  | 'onMetric'
>

export function createMapBridge(input: BridgeInput) {
  // What the bridge reads when called: the latest committed inputs (`setLatest`), the controller
  // (`attach`) and the map element (`setRoot`).
  let latest = input.initial
  let controller: MapController | null = null
  let root: HTMLElement | null = null
  const host = () => latest.props
  const text = () => latest.messages
  const mapState = () => latest.state
  const ui = () => latest.ui
  const config = () => latest.config
  const announce = (message: string) => input.setLiveMessage(message)
  // Hover and frame ticks arrive every frame: plain listener sets, so only the parts that follow
  // them (tooltip, anchored popup) re-render.
  const hover = { current: null as FeatureEvent | null, listeners: new Set<() => void>() }
  const renderListeners = new Set<() => void>()

  /** Shows an error in the alert and passes it to `onError`. */
  const fail = (error: MapError) => {
    input.setError(error)
    host().onError?.(error)
  }

  /** Proposes a complete state: owned state updates, `onStateChange` is told. */
  const proposeState = (next: MapState, change: MapStateChange): boolean => {
    if (sameMapState(next, mapState())) return false
    latest = { ...latest, state: next }
    if (host().state === undefined) input.setOwnState(next)
    host().onStateChange?.(next, change)
    return true
  }

  /** Re-reads what the parts show from the renderer: legends, attributions, the selected feature. */
  const sync = () => {
    if (!controller) return
    const map = controller
    const legends = map.getLegends()
    const attributions = map.getAttributions()
    const selectedFeature = map.describeSelection(mapState().selection)
    input.setDerived((current) => {
      const next: MapDerived = {
        ...current,
        legends: sameJson(current.legends, legends) ? current.legends : legends,
        attributions: sameJson(current.attributions, attributions)
          ? current.attributions
          : attributions,
        selectedFeature: sameFeature(current.selectedFeature, selectedFeature)
          ? current.selectedFeature
          : selectedFeature,
      }
      const unchanged =
        next.legends === current.legends &&
        next.attributions === current.attributions &&
        next.selectedFeature === current.selectedFeature
      return unchanged ? current : next
    })
  }

  /** The renderer's layer state as public state. */
  const rendererState = () => {
    const map = controller
    return map ? stateFromSerialized(map.serialize(), mapState()) : mapState()
  }

  const fitOptions = () => config()?.view.fit ?? {}

  const callbacks: ControllerCallbacks = {
    loadGeoJson: (url, options) => (host().loadGeoJson ?? fetchGeoJson)(url, options),
    onReady: (view) => {
      input.setRendered(true)
      proposeState({ ...mapState(), view }, { domain: 'view', origin: 'external' })
      announce(text().mapReady)
      sync()
      host().onReady?.(view)
    },
    onViewChange: (event) => {
      const changed = proposeState(
        { ...mapState(), view: event.view },
        { domain: 'view', origin: event.origin },
      )
      if (changed) host().onViewChange?.(event)
    },
    onProjectionChange: (event) => {
      const active = controller?.getActiveBasemapId()
      proposeState(
        { ...mapState(), view: event.view, ...(active ? { activeBasemapId: active } : {}) },
        { domain: 'view', origin: event.origin },
      )
      announce(formatMapMessage(text().projectionChanged, { projection: event.current }))
      sync()
      host().onProjectionChange?.(event)
    },
    onFeatureHover: (event) => {
      const previous = hover.current
      hover.current = event
      if (previous || event) for (const listener of hover.listeners) listener()
      host().onFeatureHover?.(event)
    },
    onFeatureSelect: (event) => {
      // A click on empty map space keeps the selection when the popup is set not to close.
      if (!event && !ui().popup.closeOnMapClick) {
        controller?.setSelection(mapState().selection)
        return
      }
      announce(
        event
          ? formatMapMessage(text().selectedFeature, {
              feature: String(event.properties.name ?? event.featureId),
            })
          : text().selectionCleared,
      )
      proposeState(
        { ...mapState(), selection: selectionFromEvent(event) },
        { domain: 'selection', origin: 'user' },
      )
      sync()
      host().onFeatureSelect?.(event)
    },
    onLayerStateChange: (event) => {
      const changed = proposeState(rendererState(), {
        domain: 'layers',
        origin: event.origin,
        layerId: event.layerId,
      })
      sync()
      if (changed) host().onLayerStateChange?.(event)
    },
    onTimeChange: (event) => {
      proposeState({ ...mapState(), time: event.time }, { domain: 'time', origin: event.origin })
      announce(
        event.time
          ? formatMapMessage(text().timeChanged, { time: event.time })
          : text().timeCleared,
      )
      host().onTimeChange?.(event)
    },
    onError: fail,
    onStatusChange: (statuses) => {
      input.setDerived((current) =>
        sameJson(current.statuses, statuses) ? current : { ...current, statuses },
      )
      // Loaded data can complete the selected feature and change legends.
      sync()
      host().onStatusChange?.(statuses)
    },
    onMetric: (metric) => host().onMetric?.(metric),
  }

  const select = (selection: MapState['selection']) => {
    controller?.setSelection(selection)
    const changed = proposeState(
      { ...mapState(), selection },
      { domain: 'selection', origin: 'user' },
    )
    sync()
    if (changed) host().onFeatureSelect?.(controller?.describeSelection(selection) ?? null)
  }

  const actions: MapActions = {
    zoom: (delta) => controller?.setView({ zoom: mapState().view.zoom + delta }),
    setView: (view) => controller?.setView(view),
    resetZoom: () => {
      const zoom = config()?.initialState.view.zoom
      if (zoom !== undefined) controller?.setView({ zoom })
    },
    fit: (target, options) => controller?.fit(target, options),
    fitSelection: (options) => controller?.fitSelection(options) ?? false,
    fitContent: (policy = ui().controls.fitTarget) => {
      const map = controller
      if (!map) return
      if (policy !== 'data' && map.fitSelection(fitOptions())) return
      if (policy !== 'selection') map.fit(WORLD, fitOptions())
    },
    fitZoomTarget: (targetId) => {
      const target = config()?.data.zoomTargets?.find((item) => item.id === targetId)
      if (target)
        controller?.fit(target.bounds, {
          ...fitOptions(),
          ...(target.maxZoom === undefined ? {} : { maxZoom: target.maxZoom }),
        })
    },
    setProjection: (projection) => controller?.setProjection(projection),
    setBasemap: (id) => {
      controller?.setBasemap(id)
      const active = controller?.getActiveBasemapId()
      if (active)
        proposeState(
          { ...mapState(), activeBasemapId: active },
          { domain: 'basemap', origin: 'user' },
        )
      sync()
    },
    setLayerVisibility: (id, visible) => controller?.setLayerVisibility(id, visible),
    setLayerOpacity: (id, opacity) => controller?.setLayerOpacity(id, opacity),
    reorderLayer: (id, direction) => controller?.reorderOverlay(id, direction),
    setTime: (time) => controller?.setTime(time),
    select,
    clearSelection: () => select(null),
    setOpenPanel: (panel) => input.setOpenPanel(panel),
    toggleFullscreen: (target = ui().controls.fullscreenTarget) => {
      if (document.fullscreenElement) {
        void document.exitFullscreen()
        return
      }
      const element = target === 'container' ? root?.parentElement : root
      if (element) void element.requestFullscreen()
    },
    exportImage: (options) => {
      const map = controller
      return map ? map.exportImage(options) : Promise.reject(new Error('The map is not mounted'))
    },
    downloadImage: async (format) => {
      const { config, ui } = latest
      const map = controller
      if (!config || !map) return
      try {
        const blob = await map.exportImage({
          format,
          includeLegend: true,
          includeAttribution: true,
          ...(ui.disclaimer.enabled && ui.disclaimer.text
            ? { disclaimer: `${ui.disclaimer.title || text().disclaimer}: ${ui.disclaimer.text}` }
            : {}),
          title: config.export?.title ?? config.accessibility.ariaLabel,
          ...config.export,
        })
        const extension = extensionForFormat(format)
        downloadBlob(blob, `map.${extension === 'jpeg' ? 'jpg' : extension}`)
      } catch (cause) {
        fail(asMapError(cause, 'EXPORT_FAILED'))
      }
    },
    getState: rendererState,
    announce,
    reportError: fail,
    dismissError: () => input.setError(null),
    getOpenLayersMap: () => controller?.getOpenLayersMap() ?? null,
    pixelAt: (lonLat) => controller?.pixelAt(lonLat) ?? null,
    onRender: (listener) => {
      renderListeners.add(listener)
      return () => renderListeners.delete(listener)
    },
    getHoveredFeature: () => hover.current,
    onHoverChange: (listener) => {
      hover.listeners.add(listener)
      return () => hover.listeners.delete(listener)
    },
  }

  return {
    actions,
    callbacks,
    sync,
    fail,
    /** The latest committed inputs; call after every render. */
    setLatest: (next: EngineLatest) => {
      latest = next
    },
    latest: () => latest,
    /** The controller the actions drive, or `null` while there is none. */
    attach: (next: MapController | null) => {
      controller = next
    },
    controller: () => controller,
    setRoot: (element: HTMLElement | null) => {
      root = element
    },
    /** Tells the `onRender` listeners a frame was drawn. */
    rendered: () => {
      for (const listener of renderListeners) listener()
    },
    /** Reports a failure of the host's `onOpenLayersMap`. */
    hookFailed: (cause: unknown) =>
      fail(
        mapError(
          'HOOK_FAILED',
          `onOpenLayersMap failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          true,
          undefined,
          cause,
        ),
      ),
  }
}

export type MapBridge = ReturnType<typeof createMapBridge>

function sameFeature(left: FeatureEvent | null, right: FeatureEvent | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return (
    left.layerId === right.layerId &&
    left.featureId === right.featureId &&
    left.coordinate[0] === right.coordinate[0] &&
    left.coordinate[1] === right.coordinate[1] &&
    sameJson(left.properties, right.properties)
  )
}
