// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import {
  DestroyRef,
  NgZone,
  afterRenderEffect,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core'
import type { Signal } from '@angular/core'
import { arcgisConfig } from './arcgis-config'
import { defineMapConfig, layerTimes } from './config/normalize'
import { resolveMapUi } from './config/ui-profiles'
import { validateMapConfig } from './config/validate'
import { asMapError } from './core/errors'
import { createMapController } from './core/map-controller'
import type { MapController } from './core/map-controller'
import { MAP_ICONS } from './icons'
import { createMapBridge, emptyDerived } from './map-bridges'
import type { EngineLatest, MapDerived } from './map-bridges'
import type { MapContext } from './map-context'
import { applyState, defaultOpenPanel, fallbackState } from './map-state'
import { injectUniqueId } from './signals'
import { defaultMapMessages, resolveMapMessages } from './messages'
import type {
  MapConfigValidator,
  MapIcons,
  MapOpenLayersHook,
  MapStaticValue,
} from './component-types'
import type {
  GeoJsonLoader,
  MapActions,
  MapCallbacks,
  MapConfig,
  MapConfigInput,
  MapError,
  MapHostInputs,
  MapLoadStatus,
  MapPanelId,
  MapRuntime,
  MapState,
  MapStateChange,
} from './types'
import { fingerprint, safeId, warnOnce } from './utils'
import { worldFit } from './world-fit'

// The engine: validates the configuration, owns one OpenLayers controller for the life of the
// map, and keeps the signals (owned or controlled state) and the controller in step. The
// controller callbacks and the actions live in `map-bridges.ts`, shared with the React version.
// OpenLayers is created and driven outside the Angular zone (a no-op without zone.js); map
// events reach the UI only by writing signals and emitting outputs.

/** What the root gives the engine: its inputs, its outputs (as callbacks) and its elements. */
export type MapEngineHost = {
  config: Signal<MapConfigInput>
  state: Signal<MapState | undefined>
  openPanel: Signal<MapPanelId | null | undefined>
  fill: Signal<boolean>
  icons: Signal<Partial<MapIcons> | undefined>
  loadGeoJson: Signal<GeoJsonLoader | undefined>
  onOpenLayersMap: Signal<MapOpenLayersHook | undefined>
  /** `<geo-map-root [validate]>`; read when the configuration is checked. */
  validate: () => MapConfigValidator | undefined
  /** The OpenLayers target (`.geo-map-viewport`), while it is rendered. */
  viewport: Signal<HTMLElement | undefined>
  /** The map element (the root's host). */
  root: HTMLElement
  /** The outputs: every callback of `MapHostInputs` except the inputs above. */
  outputs: Required<MapCallbacks> & {
    onStateChange: (state: MapState, change: MapStateChange) => void
    onOpenPanelChange: (panel: MapPanelId | null) => void
  }
}

/** Actions that return a promise keep the caller's zone, so its `then` updates the view. */
const zoneAwareActions = new Set<keyof MapActions>(['exportImage', 'downloadImage'])

let fallbackConfigValue: MapConfig | undefined
/** What parts read while the configuration is invalid (the root shows the error panel). */
function fallbackConfig(): MapConfig {
  return (fallbackConfigValue ??= defineMapConfig({
    accessibility: { ariaLabel: defaultMapMessages.invalidConfiguration },
    data: { layers: [] },
  }))
}

/** Creates the engine of one map. Call it in the root's injection context (a field initializer). */
export function createMapEngine(host: MapEngineHost) {
  const zone = inject(NgZone)
  const appIcons = inject(MAP_ICONS)
  // The config `id` wins; ids only link ARIA attributes.
  const generatedId = injectUniqueId('geospatial-map')
  let destroyed = false
  inject(DestroyRef).onDestroy(() => {
    destroyed = true
  })
  const outside = <T>(run: () => T): T => untracked(() => zone.runOutsideAngular(run))

  // A config rebuilt on every change detection (written inline in a template or a getter) keeps
  // the identity of the first object with the same content, so it is not re-validated and does
  // not reset the map.
  const sourceConfig = computed(() => host.config(), {
    equal: (left, right) => left === right || fingerprint(left) === fingerprint(right),
  })
  const validation = computed(() => validateMapConfig(sourceConfig()))
  // ArcGIS layers configured by URL are read from their services before the map is created,
  // then (by default) the starting zoom is fitted to the size of the map.
  const arcgis = arcgisConfig(
    computed(() => {
      const result = validation()
      return result.success ? result.config : undefined
    }),
  )
  const fitted = worldFit(
    arcgis.config,
    host.viewport,
    computed(() => !arcgis.pending()),
  )
  const config = fitted.config
  const mapId = computed(() => safeId(config()?.id ?? generatedId))
  const uiInput = computed(() => config()?.ui)
  const ui = computed(() => resolveMapUi(uiInput()))
  const messagesInput = computed(() => config()?.messages)
  const messages = computed(() => resolveMapMessages(messagesInput()))
  const issues = computed(() => {
    const result = validation()
    if (!result.success) return result.issues
    const validate = host.validate()
    return validate ? validate(result.config, ui()) : []
  })
  const valid = computed(() => Boolean(config()) && issues().length === 0)
  const configError = computed<MapError | null>(() => {
    if (valid()) return null
    const issue = issues()[0]
    const { invalidConfiguration } = messages()
    return {
      code: 'CONFIG_INVALID',
      message: issue
        ? `${invalidConfiguration}: ${issue.path} — ${issue.message}`
        : invalidConfiguration,
      recoverable: false,
      cause: issues(),
    }
  })
  // The renderer starts once the remote services that decide the projection are known.
  const ready = computed(() => valid() && !arcgis.pending() && !fitted.pending())
  // Once started, the map stays while the configuration is valid, even while a changed one is
  // being read (its ArcGIS services, its world fit): the changes are applied when it is ready.
  const started = linkedSignal<{ valid: boolean; ready: boolean }, boolean>({
    source: () => ({ valid: valid(), ready: ready() }),
    computation: (source, previous) =>
      source.ready || (previous?.source.valid === source.valid && previous.value),
  })

  // Component-owned state starts over when the configured starting state changes; `state`
  // (controlled) wins when given. The same for the open panel and `openPanel`.
  const initialState = computed(
    () => {
      const value = config()
      return {
        key: value ? fingerprint(value.initialState) : '',
        state: value?.initialState ?? fallbackState,
      }
    },
    { equal: (left, right) => left.key === right.key },
  )
  const ownState = linkedSignal(() => initialState().state)
  const state = computed(() => host.state() ?? ownState())
  const panelDefaults = computed(
    () => {
      const resolved = ui()
      return {
        key: `${resolved.layerPanel.defaultOpen}|${resolved.settings.defaultOpen}`,
        panel: defaultOpenPanel(resolved),
      }
    },
    { equal: (left, right) => left.key === right.key },
  )
  const ownPanel = linkedSignal<MapPanelId | null>(() => panelDefaults().panel)
  const openPanel = computed(() => {
    const controlled = host.openPanel()
    return controlled === undefined ? ownPanel() : controlled
  })
  const derived = signal<MapDerived>(emptyDerived)
  const rendered = signal(false)
  const announced = signal<string | null>(null)
  const liveMessage = computed(() => announced() ?? messages().mapLoading)
  const error = signal<MapError | null>(null)
  // Counts states proposed to a host controlling `state`: each commits, to compare its answer.
  const proposals = signal(0)

  // Only layer state changes the layers: a pan keeps the same array (and parts don't update).
  const layerState = computed(() => state().layers)
  const layers = computed(() => applyState(config()?.data.layers ?? [], layerState()))
  const configLayers = computed(() => config()?.data.layers)
  const times = computed(() => layerTimes(configLayers() ?? []))

  // The bridge reads these when called. Outputs aren't emitted once the root is destroyed.
  const emit =
    <A extends unknown[]>(output: (...args: A) => void) =>
    (...args: A) => {
      if (!destroyed) untracked(() => output(...args))
    }
  const callbacks: Required<MapCallbacks> &
    Pick<MapHostInputs, 'onStateChange' | 'onOpenPanelChange'> = {
    onStateChange: emit(host.outputs.onStateChange),
    onOpenPanelChange: emit(host.outputs.onOpenPanelChange),
    onReady: emit(host.outputs.onReady),
    onViewChange: emit(host.outputs.onViewChange),
    onFeatureHover: emit(host.outputs.onFeatureHover),
    onFeatureSelect: emit(host.outputs.onFeatureSelect),
    onLayerStateChange: emit(host.outputs.onLayerStateChange),
    onTimeChange: emit(host.outputs.onTimeChange),
    onError: emit(host.outputs.onError),
    onStatusChange: emit(host.outputs.onStatusChange),
    onMetric: emit(host.outputs.onMetric),
  }
  // The inputs as the bridge sees them: `state` and `openPanel` are absent when not bound.
  const props = computed<MapHostInputs>(() => {
    const controlledState = host.state()
    const controlledPanel = host.openPanel()
    const loadGeoJson = host.loadGeoJson()
    const onOpenLayersMap = host.onOpenLayersMap()
    return {
      ...callbacks,
      ...(controlledState === undefined ? {} : { state: controlledState }),
      ...(controlledPanel === undefined ? {} : { openPanel: controlledPanel }),
      ...(loadGeoJson ? { loadGeoJson } : {}),
      ...(onOpenLayersMap ? { onOpenLayersMap } : {}),
    }
  })
  const latest = computed<EngineLatest>(() => ({
    props: props(),
    mapId: mapId(),
    config: config(),
    ui: ui(),
    messages: messages(),
    state: state(),
    layers: layers(),
  }))

  // Created once; the bridge holds the controller and reads the latest inputs when called. The
  // inputs aren't set yet, so it starts from defaults; `setLatest` runs before it is used.
  const bridge = createMapBridge({
    initial: {
      props: callbacks,
      mapId: generatedId,
      config: undefined,
      ui: resolveMapUi(),
      messages: defaultMapMessages,
      state: fallbackState,
      layers: [],
    },
    setOwnState: (next) => ownState.set(next),
    proposed: () => proposals.update((count) => count + 1),
    setDerived: (update) => derived.update(update),
    setOwnPanel: (panel) => ownPanel.set(panel),
    setError: (next) => error.set(next),
    setLiveMessage: (message) => announced.set(message),
    setRendered: (value) => rendered.set(value),
  })
  bridge.setRoot(host.root)
  effect(() => {
    const next = latest()
    untracked(() => bridge.setLatest(next))
  })

  // Every action runs outside the Angular zone, so the OpenLayers frames it starts don't run
  // change detection in apps that use zone.js. Actions returning a promise keep the caller's zone.
  const actions = Object.fromEntries(
    Object.entries(bridge.actions).map(([name, action]) => [
      name,
      zoneAwareActions.has(name as keyof MapActions)
        ? action
        : (...args: unknown[]) =>
            zone.runOutsideAngular(() => (action as (...values: unknown[]) => unknown)(...args)),
    ]),
  ) as MapActions

  // Hints for the most common setup mistakes (logged once per page).
  afterRenderEffect(() => {
    const fill = host.fill()
    if (!valid()) return
    const root = host.root
    const view = root.ownerDocument.defaultView
    if (!view?.getComputedStyle(root).getPropertyValue('--geo-height').trim())
      warnOnce(
        'missing-css',
        'geospatial-map.css is not loaded. Add it to "styles" in angular.json, or @import it in src/styles.css.',
      )
    else if (fill && root.clientHeight < 40)
      warnOnce(
        'fill-height',
        'The map has `fill` but its parent has no height. Give the parent element a height.',
      )
  })

  // An ArcGIS basemap that could not be read: the map still shows the data, with an alert.
  effect(() => {
    const failure = arcgis.error()
    if (failure) untracked(() => bridge.fail(failure))
  })

  // Configuration errors are reported once per distinct problem (the map shows them itself).
  let reportedConfigError = ''
  afterRenderEffect(() => {
    const failure = configError()
    const key = failure ? JSON.stringify([failure.message, issues()]) : ''
    if (key === reportedConfigError) return
    reportedConfigError = key
    if (failure) callbacks.onError(failure)
  })

  // One controller per map, created when it is first ready. Only what OpenLayers fixes at
  // creation recreates it: the interactions, and the projection.
  const interactionsKey = computed(() => JSON.stringify(config()?.view.interactions ?? {}))
  const projection = computed(() => config()?.initialState.view.projection)
  afterRenderEffect((onCleanup) => {
    const target = host.viewport()
    interactionsKey()
    projection()
    if (!started() || !target) return
    outside(() => {
      bridge.setLatest(latest())
      let controller: MapController
      try {
        controller = createMapController(bridge.options(target))
      } catch (cause) {
        bridge.fail(asMapError(cause, 'CONFIG_INVALID'))
        return
      }
      bridge.attach(controller)
      const stopRender = controller.onRender(bridge.notifyRender)
      let undoHost: void | (() => void)
      try {
        undoHost = bridge.latest().props.onOpenLayersMap?.(controller.getOpenLayersMap())
      } catch (cause) {
        bridge.hookFailed(cause)
      }
      onCleanup(() =>
        outside(() => {
          stopRender()
          if (typeof undoHost === 'function') undoHost()
          controller.destroy()
          bridge.detach()
        }),
      )
    })
  })

  // Every change of configuration or state goes to the controller, which applies what differs.
  afterRenderEffect(() => {
    const target = host.viewport()
    config()
    layers()
    mapId()
    proposals()
    state()
    if (!ready() || !target) return
    outside(() => {
      bridge.setLatest(latest())
      bridge.commit(target)
    })
  })

  const loading = computed(
    () =>
      !rendered() ||
      arcgis.pending() ||
      fitted.pending() ||
      derived().statuses.some((status) => status.loading),
  )
  const mapStatus = computed<MapLoadStatus>(() =>
    !valid() ? 'error' : loading() ? 'loading' : 'ready',
  )
  const layerErrors = computed(() => derived().statuses.filter((status) => status.error).length)

  const runtime = computed<MapRuntime>(() => ({
    state: state(),
    layers: layers(),
    ...derived(),
    times: times(),
    error: error(),
    openPanel: openPanel(),
    mapStatus: mapStatus(),
  }))
  const icons = computed<MapIcons>(() => {
    const own = host.icons()
    return own ? { ...appIcons, ...own } : appIcons
  })
  const staticConfig = computed(() => (valid() ? config()! : fallbackConfig()))
  const staticValue = computed<MapStaticValue>(() => ({
    mapId: mapId(),
    config: staticConfig(),
    ui: ui(),
    messages: messages(),
    actions,
    icons: icons(),
  }))
  const context: MapContext = { staticValue, runtime, actions }

  return {
    actions,
    context,
    configError,
    layerErrors,
    liveMessage,
    mapId,
    mapStatus,
    messages,
    runtime,
    staticValue,
    theme: computed(() => config()?.theme),
    valid,
  }
}

export type MapEngine = ReturnType<typeof createMapEngine>
