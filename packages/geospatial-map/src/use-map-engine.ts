'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createMapController } from './core/map-controller'
import type { MapController, MapControllerOptions } from './core/map-controller'
import { resolveMapUi, validateMapConfig } from './config'
import type { MapStaticValue } from './map-context'
import {
  applyState,
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
import { downloadBlob, useIsomorphicLayoutEffect, useLatestRef } from './utils'

// The engine owns one OpenLayers controller and turns its events into React state, public
// callbacks, and screen-reader announcements. OpenLayers objects never leave this file.

const WORLD: [number, number, number, number] = [-180, -90, 180, 90]

function controllerOptions(
  mapId: string,
  target: HTMLElement,
  config: GeospatialMapConfigV1,
  state: MapState,
  layers: MapLayerConfig[],
  bridges: MapCallbacks,
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
  const validation = useMemo(() => validateMapConfig(props.config), [props.config])
  const config = validation.success ? validation.config : undefined
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

  // Controlled (`props.state`) or component-owned state. A new configuration resets owned state.
  const [internalState, setInternalState] = useState(config?.initialState ?? fallbackState)
  const [stateSource, setStateSource] = useState(config)
  if (stateSource !== config) {
    setStateSource(config)
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

  const { api, bridges } = useMemo(() => {
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

    const bridges: MapCallbacks = {
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
      onFeatureHover: (event) => host().onFeatureHover?.(event),
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
    }
    return { api, bridges }
  }, [latest, rootRef])

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
    if (!valid || !current || !target) return
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
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [api, bridges, interactionsKey, latest, mapId, targetRef, valid])

  // Reconcile configuration and state changes without recreating the renderer.
  useEffect(() => {
    const controller = controllerRef.current
    const target = targetRef.current
    if (!valid || !config || !controller || !target) return
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
    valid,
  ])

  const runtime = useMemo<MapRuntime>(
    () => ({
      state: currentState,
      layers: displayLayers,
      layerState,
      legends,
      statuses,
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
    ],
  )
  const staticValue = useMemo<MapStaticValue | null>(
    () => (config && valid ? { mapId, config, ui, messages, actions: api } : null),
    [api, config, mapId, messages, ui, valid],
  )

  return { api, config, configError, liveMessage, mapId, messages, runtime, staticValue }
}
