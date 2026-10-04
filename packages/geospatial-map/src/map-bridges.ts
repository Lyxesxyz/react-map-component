// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { fetchGeoJson } from './core/data-sources'
import { asMapError, mapError } from './core/errors'
import { sameSelection } from './core/layers/common'
import type { MapController, MapControllerOptions } from './core/map-controller'
import { featureLabel, fileExtension, sameJson, sameMapState } from './map-state'
import { formatMapMessage } from './messages'
import type {
  AttributionSpec,
  ExportOptions,
  FeatureEvent,
  LayerStatus,
  MapActions,
  MapConfig,
  MapError,
  MapLayerConfig,
  MapMessages,
  MapOrigin,
  MapPanelId,
  MapRootProps,
  MapSelection,
  MapState,
  MapStateChange,
  NormalizedLegend,
  ResolvedMapUiConfig,
} from './types'
import { downloadBlob } from './utils'

// The bridge between the OpenLayers controller and React, created once per map: the actions
// (stable for the life of the map) and the controller callbacks that turn renderer events into
// state proposals, `on*` callbacks and screen-reader announcements.
//
// The controller acts first (the map moves when it is dragged or asked to), then the bridge
// proposes the new state. Owned state takes it; a host controlling `state` answers with its
// next `state`, and if that differs from the proposal, the map is set back to the host's state.

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

/** The latest committed inputs. */
export type EngineLatest = {
  props: MapRootProps
  mapId: string
  config: MapConfig | undefined
  ui: ResolvedMapUiConfig
  messages: MapMessages
  state: MapState
  /** The configured layers with `state` applied, in drawing order. */
  layers: MapLayerConfig[]
}

export type BridgeInput = {
  /** The inputs of the first render. */
  initial: EngineLatest
  /** Component-owned state; only called when the host doesn't control `state`. */
  setOwnState: (state: MapState) => void
  /** A state was proposed to a host controlling `state`: render, to see its answer. */
  proposed: () => void
  setDerived: (update: (current: MapDerived) => MapDerived) => void
  /** The component-owned open panel; only called when the host doesn't control `openPanel`. */
  setOwnPanel: (panel: MapPanelId | null) => void
  setError: (error: MapError | null) => void
  setLiveMessage: (message: string) => void
  setRendered: (rendered: boolean) => void
}

type ControllerCallbacks = Pick<
  MapControllerOptions,
  | 'loadGeoJson'
  | 'onReady'
  | 'onViewChange'
  | 'onFeatureHover'
  | 'onFeatureSelect'
  | 'onLayerStateChange'
  | 'onTimeChange'
  | 'onError'
  | 'onStatusChange'
  | 'onMetric'
>

function sameFeature(left: FeatureEvent | null, right: FeatureEvent | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return (
    sameSelection(left, right) &&
    left.coordinate[0] === right.coordinate[0] &&
    left.coordinate[1] === right.coordinate[1] &&
    sameJson(left.properties, right.properties)
  )
}

/** The `config.export` fields that configure the format picker, not the report. */
const pickerSettings = new Set(['enabled', 'formats', 'defaultFormat'])

const selectionOf = (event: FeatureEvent | null): MapSelection | null =>
  event && { layerId: event.layerId, featureId: event.featureId }

export function createMapBridge(input: BridgeInput) {
  // What the bridge reads when called: the latest committed inputs (`setLatest`), the controller
  // (`attach`) and the map element (`setRoot`).
  let latest = input.initial
  let controller: MapController | null = null
  let root: HTMLElement | null = null
  /** The state proposed since the last commit, which later proposals build on. */
  let proposal: MapState | null = null
  /** A selection made from code whose feature hasn't loaded yet: `onFeatureSelect` waits for it. */
  let awaitingFeature: MapSelection | null = null
  const host = () => latest.props
  const text = () => latest.messages
  const current = () => proposal ?? latest.state
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

  /** Runs a controller call, showing what it throws as a map error. */
  const attempt = (run: (map: MapController) => void) => {
    if (!controller) return
    try {
      run(controller)
    } catch (cause) {
      fail(asMapError(cause, 'CONFIG_INVALID'))
    }
  }

  /** Proposes a complete state: owned state updates, `onStateChange` is told. */
  const proposeState = (next: MapState, change: MapStateChange): boolean => {
    if (sameMapState(next, current())) return false
    proposal = next
    if (host().state === undefined) input.setOwnState(next)
    else input.proposed()
    host().onStateChange?.(next, change)
    return true
  }

  /** Re-reads what the parts show from the renderer: legends, attributions, the selected feature. */
  const sync = () => {
    const map = controller
    if (!map) return
    const legends = map.getLegends()
    const attributions = map.getAttributions()
    const selectedFeature = map.describeSelection(current().selection)
    input.setDerived((derived) => {
      const next: MapDerived = {
        ...derived,
        legends: sameJson(derived.legends, legends) ? derived.legends : legends,
        attributions: sameJson(derived.attributions, attributions)
          ? derived.attributions
          : attributions,
        selectedFeature: sameFeature(derived.selectedFeature, selectedFeature)
          ? derived.selectedFeature
          : selectedFeature,
      }
      const unchanged =
        next.legends === derived.legends &&
        next.attributions === derived.attributions &&
        next.selectedFeature === derived.selectedFeature
      return unchanged ? derived : next
    })
    if (awaitingFeature && selectedFeature && sameSelection(awaitingFeature, selectedFeature)) {
      awaitingFeature = null
      host().onFeatureSelect?.(selectedFeature)
    }
  }

  /**
   * The one way the selection changes, from a click (`event`) or from code: the map highlights
   * it, the change is announced and proposed, and `onFeatureSelect` is told (once the feature
   * has loaded, for a selection made from code).
   */
  const applySelection = (
    selection: MapSelection | null,
    origin: MapOrigin,
    event?: FeatureEvent | null,
  ) => {
    controller?.setSelection(selection)
    if (sameSelection(selection, current().selection)) return
    const feature = event ?? controller?.describeSelection(selection) ?? null
    const name = feature
      ? (featureLabel(feature, latest.ui.tooltip.fields) ?? feature.featureId)
      : selection?.featureId
    announce(
      selection
        ? formatMapMessage(text().selectedFeature, { feature: name ?? '' })
        : text().selectionCleared,
    )
    proposeState({ ...current(), selection }, { domain: 'selection', origin })
    sync()
    awaitingFeature = selection && !feature ? selection : null
    if (!awaitingFeature) host().onFeatureSelect?.(feature)
  }

  const callbacks: ControllerCallbacks = {
    // The host's loader at the time of the load (it may be a new function every render).
    loadGeoJson: (url, options) => (host().loadGeoJson ?? fetchGeoJson)(url, options),
    onReady: (view) => {
      input.setRendered(true)
      proposeState({ ...current(), view }, { domain: 'view', origin: 'state' })
      announce(text().mapReady)
      sync()
      host().onReady?.(view)
    },
    onViewChange: (event) => {
      if (
        proposeState({ ...current(), view: event.view }, { domain: 'view', origin: event.origin })
      )
        host().onViewChange?.(event)
    },
    onFeatureHover: (event) => {
      const previous = hover.current
      hover.current = event
      if (previous || event) for (const listener of hover.listeners) listener()
      host().onFeatureHover?.(event)
    },
    onFeatureSelect: (event) => {
      // A click on empty map space keeps the selection when the popup is set not to close.
      if (!event && !latest.ui.popup.closeOnMapClick) {
        controller?.setSelection(current().selection)
        return
      }
      applySelection(selectionOf(event), 'user', event)
    },
    onLayerStateChange: (event) => {
      const map = controller
      if (!map) return
      const layers = Object.fromEntries(
        Object.entries(map.getLayerStates()).map(([id, layer]) => {
          const style = current().layers[id]?.style
          return [id, style ? { ...layer, style } : layer]
        }),
      )
      const changed = proposeState(
        { ...current(), layers },
        { domain: 'layers', origin: event.origin, layerId: event.layerId },
      )
      sync()
      if (changed) host().onLayerStateChange?.(event)
    },
    onTimeChange: (event) => {
      proposeState({ ...current(), time: event.time }, { domain: 'time', origin: event.origin })
      // A new `state` prop is the host's own doing: only other changes are announced.
      if (event.origin !== 'state')
        announce(
          event.time
            ? formatMapMessage(text().timeChanged, { time: event.time })
            : text().timeCleared,
        )
      host().onTimeChange?.(event)
    },
    onError: fail,
    onStatusChange: (statuses) => {
      input.setDerived((derived) =>
        sameJson(derived.statuses, statuses) ? derived : { ...derived, statuses },
      )
      // Loaded data can complete the selected feature and change legends.
      sync()
      host().onStatusChange?.(statuses)
    },
    onMetric: (metric) => host().onMetric?.(metric),
  }

  /** The controller options for the latest inputs. */
  const options = (target: HTMLElement): MapControllerOptions => {
    const { config, state, layers, messages, mapId } = latest
    if (!config) throw new Error('The map has no valid configuration')
    return {
      id: mapId,
      target,
      ariaLabel: config.accessibility.ariaLabel,
      view: state.view,
      zoomLimits: { minZoom: config.view.minZoom, maxZoom: config.view.maxZoom },
      layers,
      basemaps: config.data.basemaps,
      activeBasemapId: state.activeBasemapId,
      selection: state.selection,
      time: state.time,
      interactions: config.view.interactions,
      messages,
      ...callbacks,
    }
  }

  const fitDefaults = () => latest.config?.view.fit ?? {}

  /** The report options of `config.export` (not its picker settings), under `options`. */
  const exportOptions = (options: ExportOptions): ExportOptions => {
    const { config, ui } = latest
    const configured: Partial<ExportOptions> = Object.fromEntries(
      Object.entries(config?.export ?? {}).filter(([key]) => !pickerSettings.has(key)),
    )
    return {
      includeLegend: true,
      includeAttribution: true,
      ...(config ? { title: config.accessibility.ariaLabel } : {}),
      ...(ui.disclaimer.enabled && ui.disclaimer.text
        ? { disclaimer: `${ui.disclaimer.title || text().disclaimer}: ${ui.disclaimer.text}` }
        : {}),
      ...configured,
      ...options,
    }
  }

  const actions: MapActions = {
    zoom: (delta) => attempt((map) => map.setView({ zoom: map.getView().zoom + delta }, 'api')),
    setView: (view) => attempt((map) => map.setView(view, 'api')),
    resetZoom: () => {
      const zoom = latest.config?.initialState.view.zoom
      if (zoom !== undefined) attempt((map) => map.setView({ zoom }, 'api'))
    },
    fit: (target, options) => attempt((map) => map.fit(target, { ...fitDefaults(), ...options })),
    fitSelection: (options) => controller?.fitSelection({ ...fitDefaults(), ...options }) ?? false,
    fitContent: (policy = latest.ui.controls.fitTarget) => {
      const map = controller
      if (!map) return
      if (policy !== 'data' && map.fitSelection(fitDefaults())) return
      if (policy !== 'selection') map.fitData(fitDefaults())
    },
    fitZoomTarget: (targetId) => {
      const target = latest.config?.data.zoomTargets?.find((item) => item.id === targetId)
      if (target)
        actions.fit(target.bounds, target.maxZoom === undefined ? {} : { maxZoom: target.maxZoom })
    },
    setBasemap: (id) => {
      if (!controller?.setBasemap(id)) return
      proposeState(
        { ...current(), activeBasemapId: controller.getActiveBasemapId() },
        { domain: 'basemap', origin: 'api' },
      )
      sync()
    },
    setLayerVisibility: (id, visible) =>
      attempt((map) => map.setLayerVisibility(id, visible, 'api')),
    setLayerOpacity: (id, opacity) => attempt((map) => map.setLayerOpacity(id, opacity, 'api')),
    reorderLayer: (id, direction) => attempt((map) => map.reorderOverlay(id, direction, 'api')),
    setTime: (time) => attempt((map) => map.setTime(time, 'api')),
    select: (selection) => applySelection(selection, 'api'),
    clearSelection: () => applySelection(null, 'api'),
    setOpenPanel: (panel) => {
      if (host().openPanel === undefined) input.setOwnPanel(panel)
      host().onOpenPanelChange?.(panel)
    },
    toggleFullscreen: (target = latest.ui.controls.fullscreenTarget) => {
      if (document.fullscreenElement) {
        void document.exitFullscreen()
        return
      }
      const element = target === 'container' ? root?.parentElement : root
      if (element) void element.requestFullscreen()
    },
    exportImage: (options) =>
      controller
        ? controller.exportImage(exportOptions(options))
        : Promise.reject(new Error('The map is not mounted')),
    downloadImage: async (format) => {
      try {
        const blob = await actions.exportImage({ format })
        downloadBlob(blob, `map.${fileExtension[format]}`)
      } catch (cause) {
        fail(asMapError(cause, 'EXPORT_FAILED'))
      }
    },
    // The view as the map shows it now, also during an animation or a drag.
    getState: () => (controller ? { ...current(), view: controller.getView() } : current()),
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
    fail,
    options,
    /** The latest committed inputs; call after every render. */
    setLatest: (next: EngineLatest) => {
      latest = next
    },
    latest: () => latest,
    setRoot: (element: HTMLElement | null) => {
      root = element
    },
    /** The controller the actions drive. */
    attach: (map: MapController) => {
      controller = map
      sync()
    },
    /** The controller is gone: hover and what was read from it start over. */
    detach: () => {
      controller = null
      proposal = null
      if (hover.current) {
        hover.current = null
        for (const listener of hover.listeners) listener()
      }
      input.setDerived(() => emptyDerived)
      input.setRendered(false)
    },
    /**
     * Applies the latest committed inputs to the controller. When the host answered a proposal
     * with another state, the map is set back to the host's state.
     */
    commit: (target: HTMLElement) => {
      const rejected =
        proposal !== null &&
        latest.props.state !== undefined &&
        !sameMapState(latest.state, proposal)
      proposal = null
      attempt((map) => map.update(options(target), rejected))
      sync()
    },
    /** Tells the `onRender` listeners a frame was drawn. */
    notifyRender: () => {
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
