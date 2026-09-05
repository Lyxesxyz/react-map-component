import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createMapController, MapController } from '../core/map-controller.js'
import type { MapControllerOptions } from '../core/map-controller.js'
import {
  formatMapMessage,
  mapThemeStyle,
  resolveMapMessages,
  resolveMapTheme,
  resolveMapUi,
  validateMapConfig,
} from '../config.js'
import type {
  ExportFormat,
  FeatureEvent,
  GeospatialMapHandle,
  GeospatialMapProps,
  LayerStateEvent,
  MapActions,
  MapCallbacks,
  MapError,
  MapLayerConfig,
  MapSelection,
  MapSlotContext,
  MapState,
  MapStateChange,
  ProjectionChangeEvent,
  SerializedMapState,
  ViewChangeEvent,
} from '../types.js'
import { FeaturePopup } from '../ui/FeaturePopup.js'
import { LayerPanel } from '../ui/LayerPanel.js'
import { MapLegend } from '../ui/MapLegend.js'
import { MapToolbar } from '../ui/MapToolbar.js'
import { TimeControls } from '../ui/TimeControls.js'
import { ShapeAlert, ShapeBadge, ShapeButton } from '../ui/shapes.js'

const fallbackState: MapState = {
  view: { center: [0, 15], zoom: 1.2, projection: 'EPSG:8857', minZoom: 0, maxZoom: 20 },
  layers: {},
  selection: null,
  time: null,
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameMapState(left: MapState, right: MapState): boolean {
  const close = (a: number | undefined, b: number | undefined) =>
    Math.abs((a ?? 0) - (b ?? 0)) < 1e-7
  return (
    close(left.view.center[0], right.view.center[0]) &&
    close(left.view.center[1], right.view.center[1]) &&
    close(left.view.zoom, right.view.zoom) &&
    close(left.view.rotation, right.view.rotation) &&
    left.view.projection === right.view.projection &&
    left.activeBasemapId === right.activeBasemapId &&
    left.time === right.time &&
    same(left.selection, right.selection) &&
    same(left.layers, right.layers)
  )
}

function selectionFromEvent(event: FeatureEvent | null): MapSelection | null {
  if (!event) return null
  return {
    layerId: event.layerId,
    featureId: event.featureId,
    ...(event.boundarySetId ? { boundarySetId: event.boundarySetId } : {}),
    ...(event.geographyLevel ? { geographyLevel: event.geographyLevel } : {}),
  }
}

function applyState(layers: MapLayerConfig[], state: MapState): MapLayerConfig[] {
  return layers
    .map((layer, sourceOrder) => {
      const runtime = state.layers[layer.id]
      if (!runtime) return { layer, order: sourceOrder }
      const styled = runtime.style && 'style' in layer ? { ...layer, style: runtime.style } : layer
      return {
        layer: { ...styled, visible: runtime.visible, opacity: runtime.opacity },
        order: runtime.order,
      }
    })
    .sort((left, right) => left.order - right.order)
    .map((item) => item.layer)
}

function stateFromSerialized(
  serialized: SerializedMapState,
  layers: MapLayerConfig[],
  previous: MapState,
): MapState {
  return {
    view: serialized.view,
    ...(serialized.activeBasemapId ? { activeBasemapId: serialized.activeBasemapId } : {}),
    layers: Object.fromEntries(
      serialized.layers.map((item) => {
        const source = layers.find((layer) => layer.id === item.id)
        const style =
          previous.layers[item.id]?.style ??
          (source && 'style' in source ? source.style : undefined)
        return [
          item.id,
          {
            visible: item.visible,
            opacity: item.opacity,
            order: item.index,
            ...(style ? { style } : {}),
          },
        ]
      }),
    ),
    selection: serialized.selection ?? null,
    time: serialized.time ?? null,
  }
}

function download(blob: Blob, extension: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = `map.${extension}`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Reusable, versioned React geospatial component backed by an internal OpenLayers renderer. */
export const GeospatialMap = forwardRef<GeospatialMapHandle, GeospatialMapProps>(
  function GeospatialMap(props, forwardedRef) {
    const validation = useMemo(() => validateMapConfig(props.config), [props.config])
    const config = validation.success ? validation.config : undefined
    const generatedId = useId().replaceAll(':', '')
    const mapId = config?.id ?? `geospatial-map-${generatedId}`
    const initial = config?.initialState ?? fallbackState
    const ui = useMemo(() => resolveMapUi(config?.ui ?? {}), [config?.ui])
    const uiRef = useRef(ui)
    uiRef.current = ui
    const messages = useMemo(() => resolveMapMessages(config?.messages), [config?.messages])
    const theme = useMemo(() => resolveMapTheme(config?.theme), [config?.theme])
    const customControlIssues = useMemo(
      () =>
        ui.controlRail.groups
          .flatMap((group) => group.controls)
          .filter(
            (id) => id.startsWith('custom:') && !props.slots?.controls?.[id as `custom:${string}`],
          )
          .map((id) => ({
            path: '/ui/controlRail/groups',
            code: 'missing-renderer',
            message: `Custom control ${id} has no matching slots.controls renderer`,
          })),
      [props.slots?.controls, ui.controlRail.groups],
    )
    const invalidIssues = validation.success ? customControlIssues : validation.issues
    const valid = Boolean(config) && invalidIssues.length === 0
    const rootRef = useRef<HTMLElement>(null)
    const targetRef = useRef<HTMLDivElement>(null)
    const controllerRef = useRef<MapController | null>(null)
    const propsRef = useRef(props)
    propsRef.current = props
    const [internalState, setInternalState] = useState(initial)
    const currentState = props.state ?? internalState
    const stateRef = useRef(currentState)
    stateRef.current = currentState
    const [legends, setLegends] = useState<ReturnType<MapController['getLegends']>>([])
    const [statuses, setStatuses] = useState<ReturnType<MapController['getStatuses']>>([])
    const [selectedEvent, setSelectedEvent] = useState<FeatureEvent | null>(null)
    const [layerPanelOpen, setLayerPanelOpen] = useState(ui.layers.defaultOpen)
    const [settingsOpen, setSettingsOpen] = useState(ui.settings.defaultOpen)
    const [liveMessage, setLiveMessage] = useState(messages.mapLoading)
    const [uiError, setUiError] = useState<MapError | null>(null)

    useEffect(() => {
      if (props.state === undefined && config) setInternalState(config.initialState)
    }, [config, props.state])

    useEffect(() => {
      setLayerPanelOpen(ui.layers.defaultOpen)
      setSettingsOpen(ui.settings.defaultOpen)
    }, [ui.layers.defaultOpen, ui.settings.defaultOpen])

    const displayLayers = useMemo(
      () => applyState(config?.data.layers ?? [], currentState),
      [config?.data.layers, currentState],
    )
    const availableTimes = useMemo(
      () => [...new Set(displayLayers.flatMap((layer) => layer.time?.available ?? []))],
      [displayLayers],
    )

    const proposeState = (next: MapState, change: MapStateChange): boolean => {
      if (sameMapState(next, stateRef.current)) return false
      stateRef.current = next
      if (propsRef.current.state === undefined) setInternalState(next)
      propsRef.current.onStateChange?.(next, change)
      return true
    }

    const callbacksRef = useRef<MapCallbacks>({})
    callbacksRef.current = props
    const bridgesRef = useRef<MapCallbacks | undefined>(undefined)
    if (!bridgesRef.current) {
      bridgesRef.current = {
        onReady: (view) => {
          const next = { ...stateRef.current, view }
          proposeState(next, { domain: 'view', origin: 'external' })
          setLiveMessage(resolveMapMessages(propsRef.current.config.messages).mapReady)
          callbacksRef.current.onReady?.(view)
        },
        onViewChange: (event: ViewChangeEvent) => {
          const changed = proposeState(
            { ...stateRef.current, view: event.view },
            { domain: 'view', origin: event.origin },
          )
          if (changed) callbacksRef.current.onViewChange?.(event)
        },
        onProjectionChange: (event: ProjectionChangeEvent) => {
          const active = controllerRef.current?.getActiveBasemapId()
          proposeState(
            {
              ...stateRef.current,
              view: event.view,
              ...(active ? { activeBasemapId: active } : {}),
            },
            { domain: 'view', origin: event.origin },
          )
          const currentMessages = resolveMapMessages(propsRef.current.config.messages)
          setLiveMessage(
            formatMapMessage(currentMessages.projectionChanged, { projection: event.current }),
          )
          callbacksRef.current.onProjectionChange?.(event)
        },
        onFeatureHover: (event) => callbacksRef.current.onFeatureHover?.(event),
        onFeatureSelect: (event) => {
          if (!event && !uiRef.current.popup.closeOnMapClick) {
            controllerRef.current?.setSelection(stateRef.current.selection)
            return
          }
          setSelectedEvent(event)
          const currentMessages = resolveMapMessages(propsRef.current.config.messages)
          setLiveMessage(
            event
              ? formatMapMessage(currentMessages.selectedFeature, {
                  feature: String(event.properties.name ?? event.featureId),
                })
              : currentMessages.selectionCleared,
          )
          proposeState(
            { ...stateRef.current, selection: selectionFromEvent(event) },
            { domain: 'selection', origin: 'user' },
          )
          callbacksRef.current.onFeatureSelect?.(event)
        },
        onLayerStateChange: (event: LayerStateEvent) => {
          const serialized = controllerRef.current?.serialize()
          let changed = false
          if (serialized) {
            const next = stateFromSerialized(
              serialized,
              config?.data.layers ?? [],
              stateRef.current,
            )
            changed = proposeState(next, {
              domain: 'layers',
              origin: event.origin,
              layerId: event.layerId,
            })
          }
          setLegends(controllerRef.current?.getLegends() ?? [])
          if (changed) callbacksRef.current.onLayerStateChange?.(event)
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
          callbacksRef.current.onSymbologyChange?.(event)
        },
        onTimeChange: (event) => {
          proposeState(
            { ...stateRef.current, time: event.time },
            { domain: 'time', origin: event.origin },
          )
          const currentMessages = resolveMapMessages(propsRef.current.config.messages)
          setLiveMessage(
            event.time
              ? formatMapMessage(currentMessages.timeChanged, { time: event.time })
              : currentMessages.timeCleared,
          )
          callbacksRef.current.onTimeChange?.(event)
        },
        onError: (error) => {
          setUiError(error)
          callbacksRef.current.onError?.(error)
        },
        onStatusChange: (status) => {
          setStatuses(status)
          setLegends(controllerRef.current?.getLegends() ?? [])
          callbacksRef.current.onStatusChange?.(status)
        },
        onMetric: (metric) => callbacksRef.current.onMetric?.(metric),
      }
    }

    const projectionBehaviorKey = JSON.stringify(config?.view.projectionBehavior ?? {})
    const interactionsKey = JSON.stringify(config?.view.interactions ?? {})

    useEffect(() => {
      if (!valid || !config || !targetRef.current) return
      try {
        const options: MapControllerOptions = {
          id: mapId,
          target: targetRef.current,
          ariaLabel: config.accessibility.ariaLabel,
          view: currentState.view,
          layers: displayLayers,
          basemaps: config.data.basemaps,
          activeBasemapId: currentState.activeBasemapId,
          selection: currentState.selection,
          time: currentState.time,
          interactions: {
            ...config.view.interactions,
            ...(config.accessibility.keyboard !== undefined
              ? { keyboard: config.accessibility.keyboard }
              : {}),
          },
          ...(config.view.projectionBehavior
            ? { projectionBehavior: config.view.projectionBehavior }
            : {}),
          ...bridgesRef.current,
        }
        const controller = createMapController(options)
        controllerRef.current = controller
        const next = stateFromSerialized(controller.serialize(), config.data.layers, currentState)
        if (propsRef.current.state === undefined) setInternalState(next)
        setLegends(controller.getLegends())
        return () => {
          controller.destroy()
          controllerRef.current = null
        }
      } catch (cause) {
        const error = cause as MapError
        const mapped = error.code
          ? error
          : { code: 'CONFIG_INVALID' as const, message: String(cause), recoverable: false, cause }
        setUiError(mapped)
        callbacksRef.current.onError?.(mapped)
      }
    }, [interactionsKey, mapId, valid])

    useEffect(() => {
      const controller = controllerRef.current
      if (!valid || !config || !controller || !targetRef.current) return
      controller.update({
        id: mapId,
        target: targetRef.current,
        ariaLabel: config.accessibility.ariaLabel,
        view: currentState.view,
        layers: displayLayers,
        basemaps: config.data.basemaps,
        activeBasemapId: currentState.activeBasemapId,
        selection: currentState.selection,
        time: currentState.time,
        interactions: {
          ...config.view.interactions,
          ...(config.accessibility.keyboard !== undefined
            ? { keyboard: config.accessibility.keyboard }
            : {}),
        },
        ...(config.view.projectionBehavior
          ? { projectionBehavior: config.view.projectionBehavior }
          : {}),
        ...bridgesRef.current,
      })
      setLegends(controller.getLegends())
    }, [
      config,
      currentState.activeBasemapId,
      currentState.selection,
      currentState.time,
      currentState.view,
      displayLayers,
      interactionsKey,
      mapId,
      projectionBehaviorKey,
      valid,
    ])

    useEffect(() => {
      if (validation.success && customControlIssues.length === 0) return
      const issue = invalidIssues[0]
      const error: MapError = {
        code: 'CONFIG_INVALID',
        message: issue
          ? `${messages.invalidConfiguration}: ${issue.path} — ${issue.message}`
          : messages.invalidConfiguration,
        recoverable: false,
        cause: invalidIssues,
      }
      props.onError?.(error)
    }, [customControlIssues.length, validation.success, JSON.stringify(invalidIssues)])

    const getState = () =>
      controllerRef.current && config
        ? stateFromSerialized(
            controllerRef.current.serialize(),
            config.data.layers,
            stateRef.current,
          )
        : stateRef.current

    useImperativeHandle(
      forwardedRef,
      () => ({
        fit: (target, options) => controllerRef.current?.fit(target, options),
        fitSelection: (options) => controllerRef.current?.fitSelection(options) ?? false,
        exportImage: (options) => {
          if (!controllerRef.current) return Promise.reject(new Error('Map is not mounted'))
          return controllerRef.current.exportImage(options)
        },
        getState,
      }),
      [config],
    )

    const handleExport = async (extension: 'png' | 'jpeg' | 'svg') => {
      if (!config) return
      const format: ExportFormat =
        extension === 'png' ? 'image/png' : extension === 'jpeg' ? 'image/jpeg' : 'image/svg+xml'
      try {
        const blob = await controllerRef.current?.exportImage({
          format,
          includeLegend: true,
          includeAttribution: true,
          title: config.export?.title ?? config.accessibility.ariaLabel,
          ...config.export,
        })
        if (blob) download(blob, extension === 'jpeg' ? 'jpg' : extension)
      } catch (cause) {
        const error = cause as MapError
        setUiError(
          error.code
            ? error
            : { code: 'EXPORT_TIMEOUT', message: String(cause), recoverable: true },
        )
      }
    }

    const actions: MapActions = {
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
      },
      setLayerVisibility: (id, visible) => controllerRef.current?.setLayerVisibility(id, visible),
      setLayerOpacity: (id, opacity) => controllerRef.current?.setLayerOpacity(id, opacity),
      setTime: (time) => controllerRef.current?.setTime(time),
      clearSelection: () => {
        controllerRef.current?.setSelection(null)
        setSelectedEvent(null)
        proposeState(
          { ...stateRef.current, selection: null },
          { domain: 'selection', origin: 'user' },
        )
        callbacksRef.current.onFeatureSelect?.(null)
      },
    }
    const slotContext: MapSlotContext = { state: currentState, actions }

    if (!config || invalidIssues.length) {
      const issue = invalidIssues[0]
      const error: MapError = {
        code: 'CONFIG_INVALID',
        message: issue
          ? `${messages.invalidConfiguration}: ${issue.path} — ${issue.message}`
          : messages.invalidConfiguration,
        recoverable: false,
        cause: invalidIssues,
      }
      return (
        <section
          className={`geo-map-root ${props.className ?? ''}`.trim()}
          style={mapThemeStyle(theme) as CSSProperties}
        >
          <div className="geo-config-error" role="alert">
            {props.slots?.error?.(error, slotContext) ?? (
              <>
                <h2>{messages.invalidConfiguration}</h2>
                <p>{error.message}</p>
              </>
            )}
          </div>
        </section>
      )
    }

    const layerState =
      controllerRef.current?.serialize().layers ??
      displayLayers.map((layer, index) => ({
        id: layer.id,
        visible: currentState.layers[layer.id]?.visible ?? layer.visible ?? true,
        opacity: currentState.layers[layer.id]?.opacity ?? layer.opacity ?? 1,
        index,
      }))
    const loading = statuses.some((item) => item.loading)
    const noData = statuses.some((item) => item.noData)
    const scaleUnavailable = statuses.some((item) => item.scaleUnavailable)
    const timeEnabled = config.time?.enabled ?? !['embedded', 'grid'].includes(ui.profile)
    const fit = () => {
      if (
        ui.controlRail.fitTarget !== 'data' &&
        controllerRef.current?.fitSelection(config.view.fit)
      )
        return
      controllerRef.current?.fit([-180, -90, 180, 90], config.view.fit)
    }

    return (
      <section
        ref={rootRef}
        className={`geo-map-root geo-density-${theme.density} ${props.className ?? ''}`.trim()}
        data-map-id={mapId}
        style={mapThemeStyle(theme) as CSSProperties}
      >
        <div className="geo-map-stage">
          <div ref={targetRef} className="geo-map-viewport" />
          <MapToolbar
            view={currentState.view}
            basemaps={config.data.basemaps}
            activeBasemapId={currentState.activeBasemapId ?? ''}
            targets={config.data.zoomTargets ?? []}
            layersOpen={layerPanelOpen}
            layersEnabled={ui.layers.enabled}
            settingsOpen={settingsOpen}
            rail={ui.controlRail}
            settings={ui.settings}
            exportConfig={config.export ?? {}}
            messages={messages}
            hasSelection={Boolean(currentState.selection)}
            slotContext={slotContext}
            {...(props.slots ? { slots: props.slots } : {})}
            onProjection={actions.setProjection}
            onBasemap={actions.setBasemap}
            onZoom={actions.zoom}
            initialZoom={config.initialState.view.zoom}
            onResetZoom={() =>
              controllerRef.current?.setView({ zoom: config.initialState.view.zoom })
            }
            onLocate={(center) =>
              controllerRef.current?.setView({ center, zoom: ui.controlRail.locate.zoom })
            }
            onLocationError={(message) =>
              setUiError({ code: 'SOURCE_LOAD_FAILED', message, recoverable: true })
            }
            onTarget={(id) => {
              const target = config.data.zoomTargets?.find((item) => item.id === id)
              if (target)
                controllerRef.current?.fit(target.bounds, {
                  ...config.view.fit,
                  ...(target.maxZoom === undefined ? {} : { maxZoom: target.maxZoom }),
                })
            }}
            onFit={fit}
            onLayers={() => {
              setSettingsOpen(false)
              setLayerPanelOpen((open) => !open)
            }}
            onExport={(format) => void handleExport(format)}
            onFullscreen={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else {
                const target =
                  ui.controlRail.fullscreenTarget === 'container'
                    ? rootRef.current?.parentElement
                    : rootRef.current
                if (target) void target.requestFullscreen()
              }
            }}
            onSettings={(open) => {
              setLayerPanelOpen(false)
              setSettingsOpen(open)
            }}
          />
          {ui.hierarchy.enabled && config.data.hierarchy?.length ? (
            <nav
              className="geo-breadcrumbs"
              data-placement={ui.hierarchy.placement}
              aria-label="Geographic hierarchy"
            >
              {config.data.hierarchy.map((item, index) => (
                <span key={item.id}>
                  {index > 0 && <span aria-hidden="true">›</span>}
                  <ShapeButton
                    onClick={() => {
                      const target = config.data.zoomTargets?.find(
                        (candidate) => candidate.id === item.targetId,
                      )
                      if (target)
                        controllerRef.current?.fit(target.bounds, {
                          ...config.view.fit,
                          ...(target.maxZoom === undefined ? {} : { maxZoom: target.maxZoom }),
                        })
                    }}
                  >
                    {item.label}
                  </ShapeButton>
                </span>
              ))}
            </nav>
          ) : null}
          {ui.layers.enabled && layerPanelOpen && (
            <LayerPanel
              layers={displayLayers}
              state={layerState}
              statuses={statuses}
              legends={legends}
              config={ui.layers}
              messages={messages}
              slotContext={slotContext}
              {...(props.slots ? { slots: props.slots } : {})}
              onVisibility={actions.setLayerVisibility}
              onOpacity={actions.setLayerOpacity}
              onMove={(id, direction) => controllerRef.current?.reorderOverlay(id, direction)}
              onClose={() => setLayerPanelOpen(false)}
            />
          )}
          {ui.legend.enabled && (
            <MapLegend
              legends={legends}
              config={ui.legend}
              messages={messages}
              slotContext={slotContext}
              {...(props.slots ? { slots: props.slots } : {})}
            />
          )}
          {ui.popup.enabled && selectedEvent && (
            <FeaturePopup
              selection={selectedEvent}
              {...(props.slots ? { slots: props.slots } : {})}
              slotContext={slotContext}
              messages={messages}
              placement={ui.popup.placement}
              onClose={actions.clearSelection}
            />
          )}
          {ui.status.enabled && (
            <div className="geo-status-chips" data-placement={ui.status.placement}>
              {loading &&
                ui.status.showLoading &&
                (props.slots?.loading?.(slotContext) ?? (
                  <ShapeBadge>{messages.loading}</ShapeBadge>
                ))}
              {noData && ui.status.showNoData && <ShapeBadge>{messages.noDataForTime}</ShapeBadge>}
              {scaleUnavailable && ui.status.showScaleUnavailable && (
                <ShapeBadge>{messages.unavailableAtScale}</ShapeBadge>
              )}
              {!displayLayers.length && props.slots?.empty?.(slotContext)}
            </div>
          )}
          {timeEnabled && availableTimes.length > 0 && (
            <TimeControls
              values={availableTimes}
              value={currentState.time}
              {...(config.time?.speedsMs ? { speedsMs: config.time.speedsMs } : {})}
              {...(config.time?.defaultSpeedMs
                ? { defaultSpeedMs: config.time.defaultSpeedMs }
                : {})}
              {...(config.time?.autoplay !== undefined ? { autoplay: config.time.autoplay } : {})}
              {...(config.time?.loop !== undefined ? { loop: config.time.loop } : {})}
              {...(config.time?.frameFailurePolicy
                ? { frameFailurePolicy: config.time.frameFailurePolicy }
                : {})}
              {...((config.time?.reducedMotion ?? config.accessibility.reducedMotion)
                ? {
                    reducedMotion: config.time?.reducedMotion ?? config.accessibility.reducedMotion,
                  }
                : {})}
              {...(config.time?.placement ? { placement: config.time.placement } : {})}
              messages={messages}
              loading={statuses.some(
                (item) =>
                  item.loading && displayLayers.some((layer) => layer.id === item.id && layer.time),
              )}
              hasError={statuses.some(
                (item) =>
                  Boolean(item.error) &&
                  displayLayers.some(
                    (layer) => layer.id === item.id && layer.time && layer.required,
                  ),
              )}
              onChange={(time) => controllerRef.current?.setTime(time)}
            />
          )}
          {ui.errors.enabled && uiError && (
            <ShapeAlert data-placement={ui.errors.placement}>
              {props.slots?.error?.(uiError, slotContext) ?? <span>{uiError.message}</span>}
              {ui.errors.dismissible && uiError.recoverable && (
                <ShapeButton onClick={() => setUiError(null)}>{messages.dismiss}</ShapeButton>
              )}
            </ShapeAlert>
          )}
          {ui.attribution.enabled && (
            <footer
              className={`geo-attribution ${ui.attribution.compact ? 'geo-attribution-compact' : ''}`}
              data-placement={ui.attribution.placement}
              aria-label={messages.attribution}
            >
              {(controllerRef.current?.getAttributions() ?? []).map((item, index) => (
                <span key={`${item.label}-${index}`}>
                  {index > 0 && ' · '}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                  {item.version ? ` ${item.version}` : ''}
                  {item.authority ? ` · ${item.authority}` : ''}
                  {item.publishedAt ? ` · published ${item.publishedAt}` : ''}
                  {item.official === false ? ' (non-official)' : ''}
                  {item.usageRestrictions ? ` · ${item.usageRestrictions}` : ''}
                </span>
              ))}
            </footer>
          )}
        </div>
        <span className="geo-sr-only" aria-live="polite">
          {liveMessage}
        </span>
      </section>
    )
  },
)
