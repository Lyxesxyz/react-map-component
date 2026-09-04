import { useRef, useState } from 'react'
import type { LayerStateEvent, MapGridProps, MapViewState } from '../types.js'
import { GeospatialMap } from './GeospatialMap.js'

export function MapGrid({
  maps,
  sharedLayers,
  syncView = false,
  onViewChange,
  onTimeChange,
  onLayerStateChange,
  ...shared
}: MapGridProps) {
  if (maps.length > 6) throw new Error('MapGrid supports at most six maps')
  const [views, setViews] = useState(() =>
    Object.fromEntries(maps.map((item) => [item.id, item.view])),
  )
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [sharedTime, setSharedTime] = useState(shared.time ?? shared.defaultTime ?? null)
  const [runtimeLayers, setRuntimeLayers] = useState(sharedLayers)
  const layerIndices = useRef(
    Object.fromEntries(sharedLayers.map((layer, index) => [layer.id, index])),
  )
  const updateView = (id: string, view: MapViewState) => {
    setViews((current) =>
      syncView
        ? Object.fromEntries(Object.keys(current).map((key) => [key, { ...view }]))
        : { ...current, [id]: view },
    )
  }
  const updateLayers = (event: LayerStateEvent) => {
    layerIndices.current[event.layerId] = event.index
    setRuntimeLayers((current) =>
      current
        .map((layer) =>
          layer.id === event.layerId
            ? { ...layer, visible: event.visible, opacity: event.opacity }
            : layer,
        )
        .sort(
          (left, right) =>
            (layerIndices.current[left.id] ?? 0) - (layerIndices.current[right.id] ?? 0),
        ),
    )
  }
  return (
    <div className={`geo-map-grid ${focusedId ? 'geo-map-grid-focused' : ''}`.trim()}>
      {maps.map((item) => (
        <article
          key={item.id}
          className="geo-map-grid-cell"
          hidden={focusedId !== null && focusedId !== item.id}
        >
          <header className="geo-map-grid-cell-header">
            <h2>{item.title}</h2>
            <button
              className="geo-shape-button"
              onClick={() => setFocusedId((current) => (current === item.id ? null : item.id))}
            >
              {focusedId === item.id ? 'Return to grid' : `Focus ${item.title}`}
            </button>
          </header>
          <GeospatialMap
            {...shared}
            id={item.id}
            ariaLabel={`${shared.ariaLabel}: ${item.title}`}
            view={views[item.id] ?? item.view}
            layers={item.layers ?? runtimeLayers}
            time={sharedTime}
            onViewChange={(event) => {
              updateView(item.id, event.view)
              onViewChange?.(event)
            }}
            onTimeChange={(event) => {
              setSharedTime(event.time)
              onTimeChange?.(event)
            }}
            onLayerStateChange={(event) => {
              updateLayers(event)
              onLayerStateChange?.(event)
            }}
          />
        </article>
      ))}
    </div>
  )
}
