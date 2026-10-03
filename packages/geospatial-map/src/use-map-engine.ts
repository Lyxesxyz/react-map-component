'use client'

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createMapController } from './core/map-controller'
import type { MapController, MapControllerOptions } from './core/map-controller'
import { resolveMapUi, validateMapConfig } from './config'
import type { MapStaticValue } from './map-context'
import {
  applyState,
  configFingerprint,
  extensionForFormat,
  fallbackState,
  initialLayerState,
  sameJson,
  sameMapState,
  selectionFromEvent,
  stateFromSerialized,
} from './map-state'
import { formatMapMessage, resolveMapMessages } from './messages'
import type {
  AttributionSpec,
  FeatureEvent,
  GeoJsonLoader,
  GeospatialMapConfigV1,
  LayerStatus,
  MapApi,
  MapCallbacks,
  MapError,
  MapLayerConfig,
  MapPanelId,
  MapRootProps,
  MapRuntime,
  MapState,
  MapStateChange,
  NormalizedLegend,
  SerializedMapState,
} from './types'
import { downloadBlob, warnOnce } from './utils'
import { fetchGeoJson } from './core/data-sources'
import { useArcgisConfig } from './use-arcgis-config'
import { useWorldFit } from './use-world-fit'

// The engine owns one OpenLayers controller and turns its events into React state, public
// callbacks, and screen-reader announcements. The OpenLayers map leaves this file only through
// the explicit escape hatch (`onOpenLayersMap`, `actions.getOpenLayersMap()`).

/** `useLayoutEffect` in the browser, `useEffect` during server rendering (avoids the SSR warning). */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Keeps a ref pointing at the latest committed value, for use inside stable callbacks. */
function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  useIsomorphicLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

const WORLD: [number, number, number, number] = [-180, -90, 180, 90]

function controllerOptions(
  mapId: string,
  target: HTMLElement,
  config: GeospatialMapConfigV1,
  state: MapState,
  layers: MapLayerConfig[],
  bridges: ControllerHooks,
): MapControllerOptions {
  return {
    id: mapId,
    target,
    ariaLabel: config.accessibility.ariaLabel,
    view: state.view,
    layers,
    basemaps: config.data.basemaps,
    activeBasemapId: state.activeBasemapId,
    selection: state.selection,
    time: state.time,
    interactions: {
      ...config.view.interactions,
      ...(config.accessibility.keyboard !== undefined
        ? { keyboard: config.accessibility.keyboard }
        : {}),
    },
    ...(config.view.projectionBehavior
      ? { projectionBehavior: config.view.projectionBehavior }
      : {}),
    ...bridges,
  }
}

type ControllerHooks = MapCallbacks & { loadGeoJson: GeoJsonLoader }

function asMapError(cause: unknown, fallback: MapError['code']): MapError {
  const error = cause as Partial<MapError> | undefined
  return error?.code
    ? (error as MapError)
    : { code: fallback, message: String(cause), recoverable: fallback !== 'CONFIG_INVALID', cause }
}

type EngineInput = {
  props: MapRootProps
  rootRef: RefObject<HTMLElement | null>
  targetRef: RefObject<HTMLDivElement | null>
}

export function useMapEngine({ props, rootRef, targetRef }: EngineInput) {
  // A config rebuilt on every render (written inline in a component) keeps the identity of the
  // first object with the same content, so it is not re-validated and does not reset the map.
  const configKey = configFingerprint(props.config)
  const [stableConfig, setStableConfig] = useState({ key: configKey, config: props.config })
  if (stableConfig.key !== configKey) setStableConfig({ key: configKey, config: props.config })
  const sourceConfig = stableConfig.key === configKey ? stableConfig.config : props.config
  const validation = useMemo(() => validateMapConfig(sourceConfig), [sourceConfig])
  // ArcGIS layers configured by URL are read from their services before the map is created.
  const arcgis = useArcgisConfig(validation.success ? validation.config : undefined)
  // Then, by default, the starting zoom is fitted to the size of the map.
  const worldFit = useWorldFit(arcgis.config, targetRef, !arcgis.pending)
  const config = worldFit.config
  const generatedId = useId().replaceAll(':', '')
  const mapId = config?.id ?? `geospatial-map-${generatedId}`
  const ui = useMemo(() => resolveMapUi(config?.ui ?? {}), [config?.ui])
  const messages = useMemo(() => resolveMapMessages(config?.messages), [config?.messages])
  const { validate } = props
  const issues = useMemo(() => {
    if (!validation.success) return validation.issues
    return validate ? validate(validation.config, ui) : []
  }, [ui, validate, validation])
  const valid = Boolean(config) && issues.length === 0
  // The renderer starts once remote sources that decide the projection are known.
  const ready = valid && !arcgis.pending && !worldFit.pending
  const configError = useMemo<MapError | null>(() => {
    if (valid) return null
    const issue = issues[0]
    return {
      code: 'CONFIG_INVALID',
      message: issue
        ? `${messages.invalidConfiguration}: ${issue.path} — ${issue.message}`
        : messages.invalidConfiguration,
      recoverable: false,
      cause: issues,
    }
  }, [issues, messages.invalidConfiguration, valid])

  // Controlled (`props.state`) or component-owned state. Owned state resets only when the
  // configured starting state itself changes, not when other configuration changes.
  const [internalState, setInternalState] = useState(config?.initialState ?? fallbackState)
  const initialStateKey = config ? JSON.stringify(config.initialState) : ''
  const [stateSource, setStateSource] = useState(initialStateKey)
  if (stateSource !== initialStateKey) {
    setStateSource(initialStateKey)
    if (props.state === undefined && config) setInternalState(config.initialState)
  }
  const currentState = props.state ?? internalState

  const [panels, setPanels] = useState<Record<MapPanelId, boolean>>({
    layers: ui.layers.defaultOpen,
    settings: ui.settings.defaultOpen,
  })
  const panelDefaults = `${ui.layers.defaultOpen}|${ui.settings.defaultOpen}`
  const [panelSource, setPanelSource] = useState(panelDefaults)
  if (panelSource !== panelDefaults) {
    setPanelSource(panelDefaults)
    setPanels({ layers: ui.layers.defaultOpen, settings: ui.settings.defaultOpen })
  }

  const [legends, setLegends] = useState<NormalizedLegend[]>([])
  const [statuses, setStatuses] = useState<LayerStatus[]>([])
  const [attributions, setAttributions] = useState<AttributionSpec[]>([])
  const [rendererLayers, setRendererLayers] = useState<SerializedMapState['layers'] | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<FeatureEvent | null>(null)
  const [liveMessage, setLiveMessage] = useState(messages.mapLoading)
  const [error, setError] = useState<MapError | null>(null)

  const displayLayers = useMemo(
    () => applyState(config?.data.layers ?? [], currentState),
    [config?.data.layers, currentState],
  )
  const timesKey = JSON.stringify([
    ...new Set(displayLayers.flatMap((layer) => layer.time?.available ?? [])),
  ])
  const times = useMemo(() => JSON.parse(timesKey) as string[], [timesKey])
  const layerState = useMemo(
    () => rendererLayers ?? initialLayerState(displayLayers, currentState),
    [currentState, displayLayers, rendererLayers],
  )

  const controllerRef = useRef<MapController | null>(null)
  const stateRef = useRef(currentState)
  useIsomorphicLayoutEffect(() => {
    stateRef.current = currentState
  }, [currentState])
  const latest = useLatestRef({ props, config, ui, messages, currentState, displayLayers })

  // Created once: these closures read refs only when called (events and effects), never
  // during render, so the actions keep a stable identity for the life of the map.
  const [{ api, bridges, renderListeners }] = useState(() => {
    // Plain listener sets, not React state: hover and render ticks arrive every frame, and only
    // the parts that follow them (tooltips, anchored popups) should re-render.
    const hover = { current: null as FeatureEvent | null, listeners: new Set<() => void>() }
    const renderListeners = new Set<() => void>()
    const announce = (message: string) => setLiveMessage(message)
    const host = () => latest.current.props

    const proposeState = (next: MapState, change: MapStateChange): boolean => {
      if (sameMapState(next, stateRef.current)) return false
      stateRef.current = next
      if (host().state === undefined) setInternalState(next)
      host().onStateChange?.(next, change)
      return true
    }

    const syncDerived = () => {
      const controller = controllerRef.current
      if (!controller) return
      const nextLegends = controller.getLegends()
      const nextAttributions = controller.getAttributions()
      const nextLayers = controller.serialize().layers
      setLegends((current) => (sameJson(current, nextLegends) ? current : nextLegends))
      setAttributions((current) =>
        sameJson(current, nextAttributions) ? current : nextAttributions,
      )
      setRendererLayers((current) => (sameJson(current, nextLayers) ? current : nextLayers))
    }

    const bridges: ControllerHooks = {
      loadGeoJson: (url, options) =>
        (latest.current.props.loadGeoJson ?? fetchGeoJson)(url, options),
      onReady: (view) => {
        proposeState({ ...stateRef.current, view }, { domain: 'view', origin: 'external' })
        announce(latest.current.messages.mapReady)
        syncDerived()
        host().onReady?.(view)
      },
      onViewChange: (event) => {
        const changed = proposeState(
          { ...stateRef.current, view: event.view },
          { domain: 'view', origin: event.origin },
        )
        if (changed) host().onViewChange?.(event)
      },
      onProjectionChange: (event) => {
        const active = controllerRef.current?.getActiveBasemapId()
        proposeState(
          { ...stateRef.current, view: event.view, ...(active ? { activeBasemapId: active } : {}) },
          { domain: 'view', origin: event.origin },
        )
        announce(
          formatMapMessage(latest.current.messages.projectionChanged, {
            projection: event.current,
          }),
        )
        syncDerived()
        host().onProjectionChange?.(event)
      },
      onFeatureHover: (event) => {
        const previous = hover.current
        hover.current = event
        if (previous || event) for (const listener of hover.listeners) listener()
        host().onFeatureHover?.(event)
      },
      onFeatureSelect: (event) => {
        if (!event && !latest.current.ui.popup.closeOnMapClick) {
          controllerRef.current?.setSelection(stateRef.current.selection)
          return
        }
        setSelectedFeature(event)
        const text = latest.current.messages
        announce(
          event
            ? formatMapMessage(text.selectedFeature, {
                feature: String(event.properties.name ?? event.featureId),
              })
            : text.selectionCleared,
        )
        proposeState(
          { ...stateRef.current, selection: selectionFromEvent(event) },
          { domain: 'selection', origin: 'user' },
        )
        host().onFeatureSelect?.(event)
      },
      onLayerStateChange: (event) => {
        const serialized = controllerRef.current?.serialize()
        let changed = false
        if (serialized) {
          const next = stateFromSerialized(
            serialized,
            latest.current.config?.data.layers ?? [],
            stateRef.current,
          )
          changed = proposeState(next, {
            domain: 'layers',
            origin: event.origin,
            layerId: event.layerId,
          })
        }
        syncDerived()
        if (changed) host().onLayerStateChange?.(event)
      },
      onSymbologyChange: (event) => {
        const layer = stateRef.current.layers[event.layerId]
        if (layer)
          proposeState(
            {
              ...stateRef.current,
              layers: {
                ...stateRef.current.layers,
                [event.layerId]: { ...layer, style: event.style },
              },
            },
            { domain: 'symbology', origin: event.origin, layerId: event.layerId },
          )
        host().onSymbologyChange?.(event)
      },
      onTimeChange: (event) => {
        proposeState(
          { ...stateRef.current, time: event.time },
          { domain: 'time', origin: event.origin },
        )
        const text = latest.current.messages
        announce(
          event.time ? formatMapMessage(text.timeChanged, { time: event.time }) : text.timeCleared,
        )
        host().onTimeChange?.(event)
      },
      onError: (mapError) => {
        setError(mapError)
        host().onError?.(mapError)
      },
      onStatusChange: (status) => {
        setStatuses(status)
        syncDerived()
        host().onStatusChange?.(status)
      },
      onMetric: (metric) => host().onMetric?.(metric),
    }

    const fitOptions = () => latest.current.config?.view.fit ?? {}

    const api: MapApi & { syncDerived(): void } = {
      syncDerived,
      zoom: (delta) => controllerRef.current?.setView({ zoom: stateRef.current.view.zoom + delta }),
      fit: (target, options) => controllerRef.current?.fit(target, options),
      fitSelection: (options) => controllerRef.current?.fitSelection(options) ?? false,
      setProjection: (projection) => controllerRef.current?.setProjection(projection),
      setBasemap: (id) => {
        controllerRef.current?.setBasemap(id)
        proposeState(
          { ...stateRef.current, activeBasemapId: id },
          { domain: 'basemap', origin: 'user' },
        )
        syncDerived()
      },
      setLayerVisibility: (id, visible) => controllerRef.current?.setLayerVisibility(id, visible),
      setLayerOpacity: (id, opacity) => controllerRef.current?.setLayerOpacity(id, opacity),
      setTime: (time) => controllerRef.current?.setTime(time),
      clearSelection: () => {
        controllerRef.current?.setSelection(null)
        setSelectedFeature(null)
        proposeState(
          { ...stateRef.current, selection: null },
          { domain: 'selection', origin: 'user' },
        )
        host().onFeatureSelect?.(null)
      },
      setView: (view) => controllerRef.current?.setView(view),
      resetZoom: () => {
        const zoom = latest.current.config?.initialState.view.zoom
        if (zoom !== undefined) controllerRef.current?.setView({ zoom })
      },
      fitContent: (policy = latest.current.ui.controlRail.fitTarget) => {
        const controller = controllerRef.current
        if (!controller) return
        if (policy !== 'data' && controller.fitSelection(fitOptions())) return
        if (policy !== 'selection') controller.fit(WORLD, fitOptions())
      },
      fitZoomTarget: (targetId) => {
        const target = latest.current.config?.data.zoomTargets?.find((item) => item.id === targetId)
        if (target)
          controllerRef.current?.fit(target.bounds, {
            ...fitOptions(),
            ...(target.maxZoom === undefined ? {} : { maxZoom: target.maxZoom }),
          })
      },
      reorderLayer: (layerId, direction) =>
        controllerRef.current?.reorderOverlay(layerId, direction),
      setPanelOpen: (panel, open) => setPanels({ layers: false, settings: false, [panel]: open }),
      toggleFullscreen: (target = latest.current.ui.controlRail.fullscreenTarget) => {
        if (document.fullscreenElement) {
          void document.exitFullscreen()
          return
        }
        const element = target === 'container' ? rootRef.current?.parentElement : rootRef.current
        if (element) void element.requestFullscreen()
      },
      exportImage: (options) => {
        if (!controllerRef.current) return Promise.reject(new Error('Map is not mounted'))
        return controllerRef.current.exportImage(options)
      },
      downloadImage: async (format) => {
        const current = latest.current.config
        const controller = controllerRef.current
        if (!current || !controller) return
        try {
          const blob = await controller.exportImage({
            format,
            includeLegend: true,
            includeAttribution: true,
            ...(latest.current.ui.disclaimer.enabled && latest.current.ui.disclaimer.text
              ? {
                  disclaimer: `${latest.current.ui.disclaimer.title || latest.current.messages.disclaimer}: ${latest.current.ui.disclaimer.text}`,
                }
              : {}),
            title: current.export?.title ?? current.accessibility.ariaLabel,
            ...current.export,
          })
          const extension = extensionForFormat(format)
          downloadBlob(blob, `map.${extension === 'jpeg' ? 'jpg' : extension}`)
        } catch (cause) {
          setError(asMapError(cause, 'EXPORT_TIMEOUT'))
        }
      },
      getState: () => {
        const controller = controllerRef.current
        const current = latest.current.config
        return controller && current
          ? stateFromSerialized(controller.serialize(), current.data.layers, stateRef.current)
          : stateRef.current
      },
      announce,
      reportError: (mapError) => setError(mapError),
      dismissError: () => setError(null),
      getOpenLayersMap: () => controllerRef.current?.getOpenLayersMap() ?? null,
      pixelAt: (lonLat) => controllerRef.current?.pixelAt(lonLat) ?? null,
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
    return { api, bridges, renderListeners }
  })

  // Integration hints for the most common setup mistakes (logged once per page).
  const hasSelectHandler = Boolean(props.onFeatureSelect)
  useEffect(() => {
    if (hasSelectHandler && config && !config.data.layers.some((layer) => layer.selectable))
      warnOnce(
        'not-selectable',
        'onFeatureSelect is set, but no layer is selectable. GeoJSON layers are selectable by default; other layers need a featureIdField.',
      )
  }, [config, hasSelectHandler])
  const { fill } = props
  useEffect(() => {
    const root = rootRef.current
    if (!root || !valid) return
    if (!getComputedStyle(root).getPropertyValue('--geo-height').trim())
      warnOnce(
        'missing-css',
        'geospatial-map.css is not loaded. Import it once in your app entry, for example in main.tsx or app/layout.tsx.',
      )
    else if (fill && root.clientHeight < 40)
      warnOnce(
        'fill-height',
        'The map has `fill` but its parent has no height. Give the parent element a height.',
      )
  }, [fill, rootRef, valid])

  // An ArcGIS basemap that could not be read: the map still shows the data, with an alert.
  const arcgisError = arcgis.error
  useEffect(() => {
    if (!arcgisError) return
    api.reportError(arcgisError)
    latest.current.props.onError?.(arcgisError)
  }, [api, arcgisError, latest])

  // Report configuration errors once per distinct problem.
  const reportedConfigError = useRef('')
  useEffect(() => {
    const key = configError ? JSON.stringify([configError.message, issues]) : ''
    if (key === reportedConfigError.current) return
    reportedConfigError.current = key
    if (configError) latest.current.props.onError?.(configError)
  }, [configError, issues, latest])

  // Create the renderer once the viewport exists; recreate only when interactions change.
  const interactionsKey = JSON.stringify(config?.view.interactions ?? {})
  const projectionBehaviorKey = JSON.stringify(config?.view.projectionBehavior ?? {})
  useEffect(() => {
    const target = targetRef.current
    const { config: current, currentState: state, displayLayers: layers } = latest.current
    if (!ready || !current || !target) return
    let controller: MapController
    try {
      controller = createMapController(
        controllerOptions(mapId, target, current, state, layers, bridges),
      )
    } catch (cause) {
      const mapped = asMapError(cause, 'CONFIG_INVALID')
      api.reportError(mapped)
      latest.current.props.onError?.(mapped)
      return
    }
    controllerRef.current = controller
    const next = stateFromSerialized(controller.serialize(), current.data.layers, stateRef.current)
    if (latest.current.props.state === undefined) setInternalState(next)
    api.syncDerived()
    const stopRender = controller.onRender(() => {
      for (const listener of renderListeners) listener()
    })
    let undoHost: void | (() => void)
    try {
      undoHost = latest.current.props.onOpenLayersMap?.(controller.getOpenLayersMap())
    } catch (cause) {
      api.reportError(asMapError(cause, 'CONFIG_INVALID'))
    }
    return () => {
      stopRender()
      if (typeof undoHost === 'function') undoHost()
      controller.destroy()
      controllerRef.current = null
    }
  }, [api, bridges, interactionsKey, latest, mapId, ready, renderListeners, targetRef])

  // Reconcile configuration and state changes without recreating the renderer.
  useEffect(() => {
    const controller = controllerRef.current
    const target = targetRef.current
    if (!ready || !config || !controller || !target) return
    controller.update(
      controllerOptions(mapId, target, config, currentState, displayLayers, bridges),
    )
    api.syncDerived()
  }, [
    api,
    bridges,
    config,
    currentState,
    displayLayers,
    interactionsKey,
    mapId,
    projectionBehaviorKey,
    targetRef,
    ready,
  ])

  const runtime = useMemo<MapRuntime>(
    () => ({
      state: currentState,
      layers: displayLayers,
      layerState,
      legends,
      statuses: arcgis.pending ? [{ id: 'arcgis-services', loading: true }] : statuses,
      attributions,
      times,
      selectedFeature,
      error,
      panels,
    }),
    [
      attributions,
      currentState,
      displayLayers,
      error,
      layerState,
      legends,
      panels,
      selectedFeature,
      statuses,
      times,
      arcgis.pending,
    ],
  )
  const staticValue = useMemo<MapStaticValue | null>(
    () => (config && valid ? { mapId, config, ui, messages, actions: api } : null),
    [api, config, mapId, messages, ui, valid],
  )

  return { api, config, configError, liveMessage, mapId, messages, runtime, staticValue }
}
