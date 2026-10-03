import { useMemo, useState } from 'react'
import { formatMapMessage, resolveMapMessages } from '../messages'
import type { GeospatialMapConfigV1, MapGridProps, MapGridState, MapState } from '../types'
import { GeospatialMap } from './GeospatialMap'

/** Renders up to six independently configured maps with optional state synchronization. */
export function MapGrid({
  config,
  state,
  className,
  slots,
  onStateChange,
  ...callbacks
}: MapGridProps) {
  const initial = useMemo<MapGridState>(
    () => ({
      maps: Object.fromEntries(config.maps.map((item) => [item.id, item.initialState])),
      focusedMapId: null,
    }),
    [config.maps],
  )
  const [internal, setInternal] = useState(initial)
  const current = state ?? internal
  const messages = resolveMapMessages(config.shared.messages)

  if (config.maps.length > 6)
    return (
      <div className="geo-config-error" role="alert">
        MapGrid supports at most six maps.
      </div>
    )

  const update = (
    mapId: string,
    nextMap: MapState,
    change: Parameters<NonNullable<MapGridProps['onStateChange']>>[2],
  ) => {
    const sync =
      config.sync?.[
        change.domain === 'symbology'
          ? 'layers'
          : (change.domain as keyof NonNullable<typeof config.sync>)
      ]
    const maps = Object.fromEntries(
      Object.entries(current.maps).map(([id, existing]) => {
        if (id === mapId) return [id, nextMap]
        if (!sync) return [id, existing]
        if (change.domain === 'view') return [id, { ...existing, view: nextMap.view }]
        if (change.domain === 'layers' || change.domain === 'symbology')
          return [id, { ...existing, layers: nextMap.layers }]
        if (change.domain === 'time') return [id, { ...existing, time: nextMap.time }]
        if (change.domain === 'selection')
          return [id, { ...existing, selection: nextMap.selection }]
        return [id, existing]
      }),
    )
    const next = { ...current, maps }
    if (state === undefined) setInternal(next)
    onStateChange?.(next, mapId, change)
  }

  const focus = (id: string) => {
    const next = { ...current, focusedMapId: current.focusedMapId === id ? null : id }
    if (state === undefined) setInternal(next)
  }

  return (
    <div
      className={`geo-map-grid ${current.focusedMapId ? 'geo-map-grid-focused' : ''} ${className ?? ''}`.trim()}
      style={
        {
          '--geo-grid-columns': config.layout?.columns ?? 3,
          '--geo-grid-tablet-columns': config.layout?.tabletColumns ?? 2,
          '--geo-grid-mobile-columns': config.layout?.mobileColumns ?? 1,
          '--geo-grid-gap': `${config.layout?.gapPx ?? 12}px`,
          '--geo-grid-cell-height': `${config.layout?.cellHeightPx ?? 340}px`,
        } as React.CSSProperties
      }
    >
      {config.maps
        .filter((item) => current.focusedMapId === null || current.focusedMapId === item.id)
        .map((item) => {
          const focused = current.focusedMapId === item.id
          const mapConfig: GeospatialMapConfigV1 = {
            ...config.shared,
            id: item.id,
            accessibility: {
              ...config.shared.accessibility,
              ariaLabel: `${config.shared.accessibility.ariaLabel}: ${item.title}`,
            },
            initialState: item.initialState,
            data: {
              ...config.shared.data,
              layers: item.layers ?? config.shared.data.layers,
            },
            ui: focused ? config.shared.ui : { profile: 'grid' },
          }
          return (
            <article
              key={item.id}
              className="geo-map-grid-cell"
              hidden={current.focusedMapId !== null && !focused}
            >
              <header className="geo-map-grid-cell-header">
                <h2>{item.title}</h2>
                {config.focus?.enabled !== false && (
                  <button className="geo-shape-button" onClick={() => focus(item.id)}>
                    {focused
                      ? messages.returnToGrid
                      : formatMapMessage(messages.focusMap, { title: item.title })}
                  </button>
                )}
              </header>
              <GeospatialMap
                {...callbacks}
                config={mapConfig}
                state={current.maps[item.id] ?? item.initialState}
                {...(slots ? { slots } : {})}
                onStateChange={(next, change) => update(item.id, next, change)}
              />
            </article>
          )
        })}
    </div>
  )
}
