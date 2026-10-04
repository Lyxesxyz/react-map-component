'use client'

// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { resolveMapUi } from './config/ui-profiles'
import { validateMapConfig } from './config/validate'
import { asMapError } from './core/errors'
import { createMapController } from './core/map-controller'
import type { MapController, MapControllerOptions } from './core/map-controller'
import { useIsomorphicLayoutEffect, useResettableState } from './hooks'
import { createMapBridge, emptyDerived } from './map-bridges'
import type { ControllerCallbacks, EngineLatest } from './map-bridges'
import type { MapStaticValue } from './map-context'
import { applyState, fallbackState } from './map-state'
import { resolveMapMessages } from './messages'
import type {
  MapConfig,
  MapError,
  MapLayerConfig,
  MapLoadStatus,
  MapPanelId,
  MapRootProps,
  MapRuntime,
  MapState,
} from './types'
import { useArcgisConfig } from './use-arcgis-config'
import { useWorldFit } from './use-world-fit'
import { fingerprint, warnOnce } from './utils'

// The engine: validates the configuration, owns one OpenLayers controller for the life of the
// map, and keeps React state (owned or controlled) and the controller in step. The controller
// callbacks and the actions live in `map-bridges.ts`.

function controllerOptions(
  mapId: string,
  target: HTMLElement,
  config: MapConfig,
  state: MapState,
  layers: MapLayerConfig[],
  callbacks: ControllerCallbacks,
): MapControllerOptions {
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
    projectionBehavior: config.view.projectionBehavior,
    ...callbacks,
  }
}

type EngineInput = {
  props: MapRootProps
  rootRef: RefObject<HTMLElement | null>
  targetRef: RefObject<HTMLDivElement | null>
}

export function useMapEngine({ props, rootRef, targetRef }: EngineInput) {
  // A config rebuilt on every render (written inline in a component) keeps the identity of the
  // first object with the same content, so it is not re-validated and does not reset the map.
  const [sourceConfig] = useResettableState(fingerprint(props.config), () => props.config)
  const validation = useMemo(() => validateMapConfig(sourceConfig), [sourceConfig])
  // ArcGIS layers configured by URL are read from their services before the map is created,
  // then (by default) the starting zoom is fitted to the size of the map.
  const arcgis = useArcgisConfig(validation.success ? validation.config : undefined)
  const worldFit = useWorldFit(arcgis.config, targetRef, !arcgis.pending)
  const config = worldFit.config
  const generatedId = useId().replaceAll(':', '')
  const mapId = config?.id ?? `geospatial-map-${generatedId}`
  const ui = useMemo(() => resolveMapUi(config?.ui), [config?.ui])
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
  // The renderer starts once the remote services that decide the projection are known.
  const ready = valid && !arcgis.pending && !worldFit.pending

  // Component-owned state starts over when the configured starting state changes; `state`
  // (controlled) wins when given.
  const [ownState, setOwnState] = useResettableState(
    config ? fingerprint(config.initialState) : '',
    () => config?.initialState ?? fallbackState,
  )
  const state = props.state ?? ownState
  const [openPanel, setOpenPanel] = useResettableState<MapPanelId | null>(
    `${ui.layerPanel.defaultOpen}|${ui.settings.defaultOpen}`,
    () => (ui.layerPanel.defaultOpen ? 'layers' : ui.settings.defaultOpen ? 'settings' : null),
  )
  const [derived, setDerived] = useState(emptyDerived)
  const [rendered, setRendered] = useState(false)
  const [liveMessage, setLiveMessage] = useState(messages.mapLoading)
  const [error, setError] = useState<MapError | null>(null)

  // Only layer state changes the layers: a pan keeps the same array (and parts don't re-render).
  const layerState = state.layers
  const layers = useMemo(
    () => applyState(config?.data.layers ?? [], layerState),
    [config, layerState],
  )
  const timesKey = JSON.stringify([
    ...new Set(layers.flatMap((layer) => layer.time?.available ?? [])),
  ])
  const times = useMemo(() => JSON.parse(timesKey) as string[], [timesKey])

  const inputs: EngineLatest = { props, config, ui, messages, state }
  // Created once; the bridge holds the controller and reads the latest inputs when called.
  const [bridge] = useState(() =>
    createMapBridge({
      initial: inputs,
      setOwnState,
      setDerived,
      setOpenPanel,
      setError,
      setLiveMessage,
      setRendered,
    }),
  )

  useIsomorphicLayoutEffect(() => {
    bridge.setLatest(inputs)
    bridge.setRoot(rootRef.current)
  })

  // Hints for the most common setup mistakes (logged once per page).
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
  useEffect(() => {
    if (arcgis.error) bridge.fail(arcgis.error)
  }, [arcgis.error, bridge])

  // Configuration errors are reported once per distinct problem (the map shows them itself).
  const reportedConfigError = useRef('')
  useEffect(() => {
    const key = configError ? JSON.stringify([configError.message, issues]) : ''
    if (key === reportedConfigError.current) return
    reportedConfigError.current = key
    if (configError) bridge.latest().props.onError?.(configError)
  }, [bridge, configError, issues])

  // One controller per map: created once the viewport exists, recreated only when the
  // interactions change (OpenLayers fixes them at creation).
  const interactionsKey = JSON.stringify(config?.view.interactions ?? {})
  useEffect(() => {
    const target = targetRef.current
    const { config: current, state: initial, props: host } = bridge.latest()
    if (!ready || !current || !target) return
    let controller: MapController
    try {
      controller = createMapController(
        controllerOptions(
          mapId,
          target,
          current,
          initial,
          applyState(current.data.layers, initial.layers),
          bridge.callbacks,
        ),
      )
    } catch (cause) {
      bridge.fail(asMapError(cause, 'CONFIG_INVALID'))
      return
    }
    bridge.attach(controller)
    bridge.sync()
    const stopRender = controller.onRender(bridge.rendered)
    let undoHost: void | (() => void)
    try {
      undoHost = host.onOpenLayersMap?.(controller.getOpenLayersMap())
    } catch (cause) {
      bridge.hookFailed(cause)
    }
    return () => {
      stopRender()
      if (typeof undoHost === 'function') undoHost()
      controller.destroy()
      bridge.attach(null)
      setRendered(false)
    }
  }, [bridge, interactionsKey, mapId, ready, targetRef])

  // Every change of configuration or state goes to the controller, which applies what differs.
  useEffect(() => {
    const controller = bridge.controller()
    const target = targetRef.current
    if (!ready || !config || !controller || !target) return
    controller.update(controllerOptions(mapId, target, config, state, layers, bridge.callbacks))
    bridge.sync()
  }, [bridge, config, layers, mapId, ready, state, targetRef])

  const { statuses } = derived
  const loading =
    !rendered || arcgis.pending || worldFit.pending || statuses.some((status) => status.loading)
  const mapStatus: MapLoadStatus = !valid ? 'error' : loading ? 'loading' : 'ready'
  const layerErrors = statuses.filter((status) => status.error).length

  const runtime = useMemo<MapRuntime>(
    () => ({
      state,
      layers,
      legends: derived.legends,
      statuses: arcgis.pending ? [{ id: 'arcgis-services', loading: true }] : statuses,
      attributions: derived.attributions,
      times,
      selectedFeature: derived.selectedFeature,
      error,
      openPanel,
      mapStatus,
    }),
    [arcgis.pending, derived, error, layers, mapStatus, openPanel, state, statuses, times],
  )
  const staticValue = useMemo<Omit<MapStaticValue, 'icons'> | null>(
    () => (config && valid ? { mapId, config, ui, messages, actions: bridge.actions } : null),
    [bridge, config, mapId, messages, ui, valid],
  )

  return {
    actions: bridge.actions,
    configError,
    layerErrors,
    liveMessage,
    mapId,
    mapStatus,
    messages,
    runtime,
    staticValue,
    theme: config?.theme,
  }
}
