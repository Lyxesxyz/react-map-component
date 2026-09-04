import { useState } from 'react'
import type { MapGridProps, MapViewState } from '../types.js'
import { GeospatialMap } from './GeospatialMap.js'

export function MapGrid({
  maps,
  sharedLayers,
  syncView = false,
  onViewChange,
  ...shared
}: MapGridProps) {
  if (maps.length > 6) throw new Error('MapGrid supports at most six maps')
  const [views, setViews] = useState(() =>
    Object.fromEntries(maps.map((item) => [item.id, item.view])),
  )
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const updateView = (id: string, view: MapViewState) => {
    setViews((current) =>
      syncView
        ? Object.fromEntries(Object.keys(current).map((key) => [key, { ...view }]))
        : { ...current, [id]: view },
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
            layers={item.layers ?? sharedLayers}
            onViewChange={(event) => {
              updateView(item.id, event.view)
              onViewChange?.(event)
            }}
          />
        </article>
      ))}
    </div>
  )
}
