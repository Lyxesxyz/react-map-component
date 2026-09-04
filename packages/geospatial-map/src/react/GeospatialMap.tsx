import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createMapController, MapController } from '../core/map-controller.js'
import type {
  ExportFormat,
  FeatureEvent,
  GeospatialMapHandle,
  GeospatialMapProps,
  LayerStateEvent,
  MapCallbacks,
  MapControllerOptions,
  MapError,
  MapViewState,
  ProjectionChangeEvent,
  SerializedMapState,
  ViewChangeEvent,
} from '../types.js'
import { MapToolbar } from '../ui/MapToolbar.js'
import { LayerPanel } from '../ui/LayerPanel.js'
import { MapLegend } from '../ui/MapLegend.js'
import { TimeControls } from '../ui/TimeControls.js'
import { FeaturePopup } from '../ui/FeaturePopup.js'
import { ShapeAlert, ShapeBadge, ShapeButton } from '../ui/shapes.js'

const defaultView: MapViewState = {
  center: [0, 15],
  zoom: 1.2,
  projection: 'EPSG:8857',
  minZoom: 0,
  maxZoom: 20,
}

function initialLayerState(layers: GeospatialMapProps['layers']): SerializedMapState['layers'] {
  return layers.map((layer, index) => ({
    id: layer.id,
    visible: layer.visible ?? true,
    opacity: layer.opacity ?? 1,
    index,
  }))
}

function sameState(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function download(blob: Blob, extension: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = `map.${extension}`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const GeospatialMap = forwardRef<GeospatialMapHandle, GeospatialMapProps>(
  function GeospatialMap(props, forwardedRef) {
    const generatedId = useId().replaceAll(':', '')
    const mapId = props.id ?? `geospatial-map-${generatedId}`
    const rootRef = useRef<HTMLDivElement>(null)
    const targetRef = useRef<HTMLDivElement>(null)
    const controllerRef = useRef<MapController | null>(null)
    const callbacksRef = useRef<MapCallbacks>({})
    callbacksRef.current = props
    const firstTimedValue = props.layers.flatMap((layer) => layer.time?.available ?? [])[0]
    const [currentView, setCurrentView] = useState(props.view ?? props.defaultView ?? defaultView)
    const [activeBasemapId, setActiveBasemapId] = useState(
      props.activeBasemapId ?? props.defaultBasemapId ?? props.basemaps[0]?.id ?? '',
    )
    const [displayLayers, setDisplayLayers] = useState(props.layers)
    const [layerState, setLayerState] = useState(initialLayerState(props.layers))
    const [legends, setLegends] = useState<ReturnType<MapController['getLegends']>>([])
    const [statuses, setStatuses] = useState<ReturnType<MapController['getStatuses']>>([])
    const [selectedEvent, setSelectedEvent] = useState<FeatureEvent | null>(null)
    const [currentTime, setCurrentTime] = useState<string | null>(
      props.time ?? props.defaultTime ?? firstTimedValue ?? null,
    )
    const [layerPanelOpen, setLayerPanelOpen] = useState(false)
    const [liveMessage, setLiveMessage] = useState('Map loading')
    const [uiError, setUiError] = useState<MapError | null>(null)

    const availableTimes = useMemo(
      () => [...new Set(displayLayers.flatMap((layer) => layer.time?.available ?? []))],
      [displayLayers],
    )
    const projectionBehaviorKey = JSON.stringify(props.projectionBehavior ?? {})
    const controls = {
      projection: true,
      basemap: true,
      zoom: true,
      fit: true,
      layers: true,
      legend: true,
      time: true,
      export: true,
      fullscreen: true,
      ...props.controls,
    }

    const bridgesRef = useRef<MapCallbacks | undefined>(undefined)
    if (!bridgesRef.current) {
      bridgesRef.current = {
        onReady: (view) => {
          setCurrentView(view)
          setLiveMessage('Map ready')
          callbacksRef.current.onReady?.(view)
        },
        onViewChange: (event: ViewChangeEvent) => {
          setCurrentView(event.view)
          callbacksRef.current.onViewChange?.(event)
        },
        onProjectionChange: (event: ProjectionChangeEvent) => {
          setCurrentView(event.view)
          setActiveBasemapId(controllerRef.current?.getActiveBasemapId() ?? '')
          setLiveMessage(`Projection changed to ${event.current}`)
          callbacksRef.current.onProjectionChange?.(event)
        },
        onFeatureHover: (event) => callbacksRef.current.onFeatureHover?.(event),
        onFeatureSelect: (event) => {
          setSelectedEvent(event)
          setLiveMessage(
            event
              ? `Selected ${String(event.properties.name ?? event.featureId)}`
              : 'Selection cleared',
          )
          callbacksRef.current.onFeatureSelect?.(event)
        },
        onLayerStateChange: (event: LayerStateEvent) => {
          setLayerState((current) =>
            current.map((item) =>
              item.id === event.layerId
                ? { ...item, visible: event.visible, opacity: event.opacity, index: event.index }
                : item,
            ),
          )
          setLegends(controllerRef.current?.getLegends() ?? [])
          callbacksRef.current.onLayerStateChange?.(event)
        },
        onSymbologyChange: (event) => callbacksRef.current.onSymbologyChange?.(event),
        onTimeChange: (event) => {
          setCurrentTime(event.time)
          setLiveMessage(event.time ? `Time changed to ${event.time}` : 'Time cleared')
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

    useEffect(() => {
      if (!targetRef.current) return
      const controllerOptions: MapControllerOptions = {
        id: mapId,
        target: targetRef.current,
        ariaLabel: props.ariaLabel,
        view: props.view ?? props.defaultView ?? defaultView,
        layers: displayLayers,
        basemaps: props.basemaps,
        activeBasemapId,
        selection: props.selection ?? props.defaultSelection ?? null,
        time: currentTime,
        ...(props.projectionBehavior ? { projectionBehavior: props.projectionBehavior } : {}),
        ...bridgesRef.current,
      }
      const controller = createMapController(controllerOptions)
      controllerRef.current = controller
      setActiveBasemapId(controller.getActiveBasemapId())
      setLayerState(controller.serialize().layers)
      setLegends(controller.getLegends())
      return () => {
        controller.destroy()
        controllerRef.current = null
      }
      // The controller has its own prop reconciliation and must mount only once per DOM target.
    }, [])

    useEffect(() => {
      const controller = controllerRef.current
      if (!controller || !targetRef.current) return
      controller.update({
        id: mapId,
        target: targetRef.current,
        ariaLabel: props.ariaLabel,
        view: props.view ?? controller.getView(),
        ...(props.projectionBehavior ? { projectionBehavior: props.projectionBehavior } : {}),
        layers: displayLayers,
        basemaps: props.basemaps,
        activeBasemapId: props.activeBasemapId,
        selection: props.selection,
        time: props.time,
        ...bridgesRef.current,
      })
      const nextBasemapId = controller.getActiveBasemapId()
      const nextLayerState = controller.serialize().layers
      const nextLegends = controller.getLegends()
      setActiveBasemapId((current) => (current === nextBasemapId ? current : nextBasemapId))
      setLayerState((current) => (sameState(current, nextLayerState) ? current : nextLayerState))
      setLegends((current) => (sameState(current, nextLegends) ? current : nextLegends))
    }, [
      displayLayers,
      mapId,
      props.activeBasemapId,
      props.ariaLabel,
      props.basemaps,
      projectionBehaviorKey,
      props.selection,
      props.time,
      props.view,
    ])

    useEffect(() => {
      setDisplayLayers(props.layers)
    }, [props.layers])

    useImperativeHandle(
      forwardedRef,
      () => ({
        fit: (target, options) => controllerRef.current?.fit(target, options),
        fitSelection: (options) => controllerRef.current?.fitSelection(options) ?? false,
        setLayerStyle: (layerId, style) => controllerRef.current?.setLayerStyle(layerId, style),
        exportImage: (options) => {
          if (!controllerRef.current) return Promise.reject(new Error('Map is not mounted'))
          return controllerRef.current.exportImage(options)
        },
        getView: () => controllerRef.current?.getView() ?? currentView,
        serialize: () =>
          controllerRef.current?.serialize() ?? {
            version: 1,
            view: currentView,
            activeBasemapId,
            layers: layerState,
            time: currentTime,
            selection: props.selection ?? null,
          },
      }),
      [activeBasemapId, currentTime, currentView, layerState, props.selection],
    )

    const handleExport = async (extension: 'png' | 'jpeg' | 'svg') => {
      const format: ExportFormat =
        extension === 'png' ? 'image/png' : extension === 'jpeg' ? 'image/jpeg' : 'image/svg+xml'
      try {
        const blob = await controllerRef.current?.exportImage({
          format,
          includeLegend: true,
          includeAttribution: true,
          title: props.exportOptions?.title ?? props.ariaLabel,
          ...props.exportOptions,
        })
        if (blob) download(blob, extension === 'jpeg' ? 'jpg' : extension)
      } catch (error) {
        const mapped = error as MapError
        setUiError(
          mapped.code
            ? mapped
            : { code: 'EXPORT_TIMEOUT', message: String(error), recoverable: true },
        )
      }
    }

    return (
      <section
        ref={rootRef}
        className={`geo-map-root ${props.className ?? ''}`.trim()}
        data-map-id={mapId}
      >
        <MapToolbar
          view={currentView}
          basemaps={props.basemaps}
          activeBasemapId={activeBasemapId}
          targets={props.zoomTargets ?? []}
          showLayers={controls.layers}
          showProjection={controls.projection}
          showBasemap={controls.basemap}
          showZoom={controls.zoom}
          showFit={controls.fit}
          showExport={controls.export}
          showFullscreen={controls.fullscreen}
          hasSelection={Boolean(selectedEvent ?? props.selection ?? props.defaultSelection)}
          onProjection={(projection) => controllerRef.current?.setProjection(projection)}
          onBasemap={(id) => {
            controllerRef.current?.setBasemap(id)
            setActiveBasemapId(controllerRef.current?.getActiveBasemapId() ?? id)
          }}
          onZoom={(delta) => controllerRef.current?.setView({ zoom: currentView.zoom + delta })}
          onTarget={(id) => {
            const target = props.zoomTargets?.find((item) => item.id === id)
            if (target)
              controllerRef.current?.fit(
                target.bounds,
                target.maxZoom === undefined ? {} : { maxZoom: target.maxZoom },
              )
          }}
          onFitSelection={() => controllerRef.current?.fitSelection()}
          onLayers={() => setLayerPanelOpen((open) => !open)}
          onExport={(format) => void handleExport(format)}
          onFullscreen={() => {
            if (document.fullscreenElement) void document.exitFullscreen()
            else if (rootRef.current) void rootRef.current.requestFullscreen()
          }}
        />
        {props.hierarchy?.length ? (
          <nav className="geo-breadcrumbs" aria-label="Geographic hierarchy">
            {props.hierarchy.map((item, index) => (
              <span key={item.id}>
                {index > 0 && <span aria-hidden="true">›</span>}
                <ShapeButton
                  onClick={() => {
                    const target = props.zoomTargets?.find(
                      (candidate) => candidate.id === item.targetId,
                    )
                    if (target)
                      controllerRef.current?.fit(
                        target.bounds,
                        target.maxZoom === undefined ? {} : { maxZoom: target.maxZoom },
                      )
                  }}
                >
                  {item.label}
                </ShapeButton>
              </span>
            ))}
          </nav>
        ) : null}
        <div className="geo-map-stage">
          <div ref={targetRef} className="geo-map-viewport" />
          {layerPanelOpen && (
            <LayerPanel
              layers={displayLayers}
              state={layerState}
              statuses={statuses}
              onVisibility={(id, visible) => {
                controllerRef.current?.setLayerVisibility(id, visible)
                setLegends(controllerRef.current?.getLegends() ?? [])
              }}
              onOpacity={(id, opacity) => controllerRef.current?.setLayerOpacity(id, opacity)}
              onMove={(id, direction) => {
                controllerRef.current?.reorderOverlay(id, direction)
                setDisplayLayers(controllerRef.current?.getLayers() ?? displayLayers)
                setLayerState(controllerRef.current?.serialize().layers ?? layerState)
              }}
              onClose={() => setLayerPanelOpen(false)}
            />
          )}
          {controls.legend && <MapLegend legends={legends} />}
          {selectedEvent && (
            <FeaturePopup
              selection={selectedEvent}
              {...(props.renderPopup ? { render: props.renderPopup } : {})}
              onClose={() => {
                controllerRef.current?.setSelection(null)
                setSelectedEvent(null)
                callbacksRef.current.onFeatureSelect?.(null)
              }}
            />
          )}
          <div className="geo-status-chips">
            {statuses.some((item) => item.loading) && <ShapeBadge>Loading</ShapeBadge>}
            {statuses.some((item) => item.noData) && <ShapeBadge>No data for time</ShapeBadge>}
          </div>
        </div>
        {controls.time && availableTimes.length > 0 && (
          <TimeControls
            values={availableTimes}
            value={currentTime}
            {...(props.timePlayback?.speedsMs ? { speedsMs: props.timePlayback.speedsMs } : {})}
            {...(props.timePlayback?.defaultSpeedMs
              ? { defaultSpeedMs: props.timePlayback.defaultSpeedMs }
              : {})}
            loading={statuses.some(
              (item) =>
                item.loading && displayLayers.some((layer) => layer.id === item.id && layer.time),
            )}
            hasError={statuses.some(
              (item) =>
                Boolean(item.error) &&
                displayLayers.some((layer) => layer.id === item.id && layer.time && layer.required),
            )}
            onChange={(time) => controllerRef.current?.setTime(time)}
          />
        )}
        {uiError && (
          <ShapeAlert>
            <span>{uiError.message}</span>
            {uiError.recoverable && (
              <ShapeButton onClick={() => setUiError(null)}>Dismiss</ShapeButton>
            )}
          </ShapeAlert>
        )}
        <footer className="geo-attribution" aria-label="Map attribution">
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
        <span className="geo-sr-only" aria-live="polite">
          {liveMessage}
        </span>
        {props.children}
      </section>
    )
  },
)
