'use client'

import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { normalizeMapConfig } from './config/normalize'
import { GeospatialMap } from './geospatial-map'
import { useLatestRef } from './hooks'
import { formatMapMessage, resolveMapMessages } from './messages'
import { ShapeButton } from './shapes'
import type {
  MapConfigInput,
  MapGridConfig,
  MapGridItem,
  MapGridProps,
  MapGridState,
  MapState,
  MapStateChange,
} from './types'
import { cn } from './utils'

const MAX_MAPS = 6

/** The configuration of one cell: the shared one, with the cell's id, title, state and layers. */
function cellConfig(config: MapGridConfig, item: MapGridItem, focused: boolean): MapConfigInput {
  const { shared } = config
  return {
    ...shared,
    id: item.id,
    accessibility: {
      ...shared.accessibility,
      ariaLabel: `${shared.accessibility.ariaLabel}: ${item.title}`,
    },
    initialState: {
      ...shared.initialState,
      ...item.initialState,
      view: { ...shared.initialState?.view, ...item.initialState?.view },
    },
    data: { ...shared.data, layers: item.layers ?? shared.data.layers },
    // Unfocused cells show the compact grid UI, keeping your other `ui` settings.
    ui: focused ? (shared.ui ?? {}) : { ...shared.ui, profile: 'grid' },
  }
}

/** A change in one map applied to another, for the domains the grid synchronises. */
function synced(
  config: MapGridConfig,
  change: MapStateChange,
  source: MapState,
  target: MapState,
): MapState {
  const sync = config.sync ?? {}
  if (change.domain === 'view' && sync.view) return { ...target, view: source.view }
  if (change.domain === 'layers' && sync.layers) return { ...target, layers: source.layers }
  if (change.domain === 'time' && sync.time) return { ...target, time: source.time }
  if (change.domain === 'selection' && sync.selection)
    return { ...target, selection: source.selection }
  return target
}

/** Up to six maps side by side, optionally synchronised, each of which can be focused. */
export function MapGrid({
  config,
  state,
  className,
  cellClassName,
  slots,
  icons,
  onStateChange,
  ...callbacks
}: MapGridProps) {
  const initial = useMemo<MapGridState>(
    () => ({
      maps: Object.fromEntries(
        config.maps.map((item) => [
          item.id,
          normalizeMapConfig(cellConfig(config, item, false)).initialState,
        ]),
      ),
      focusedMapId: null,
    }),
    [config],
  )
  const [own, setOwn] = useState(initial)
  const current = state ?? own
  const latest = useLatestRef({ state, own, onStateChange })
  // Changes made in the same tick (two maps syncing at once) build on each other.
  const pending = useRef<MapGridState | null>(null)
  const messages = resolveMapMessages(config.shared.messages)

  if (config.maps.length > MAX_MAPS)
    return (
      <div className="geo-config-error" data-slot="map-grid-error" role="alert">
        {messages.tooManyGridMaps}
      </div>
    )

  /** Applies `next` to the grid state (owned or controlled) and reports it. */
  const commit = (
    next: (previous: MapGridState) => MapGridState,
    mapId: string | null,
    change?: MapStateChange,
  ) => {
    const { state: controlled, own: owned, onStateChange: report } = latest.current
    const result = next(pending.current ?? controlled ?? owned)
    pending.current = result
    queueMicrotask(() => {
      pending.current = null
    })
    if (!controlled) setOwn(result)
    report?.(result, mapId, change)
  }

  const update = (mapId: string, nextMap: MapState, change: MapStateChange) =>
    commit(
      (previous) => ({
        ...previous,
        maps: Object.fromEntries(
          Object.entries(previous.maps).map(([id, existing]) => [
            id,
            id === mapId ? nextMap : synced(config, change, nextMap, existing),
          ]),
        ),
      }),
      mapId,
      change,
    )

  const toggleFocus = (id: string) =>
    commit(
      (previous) => ({ ...previous, focusedMapId: previous.focusedMapId === id ? null : id }),
      null,
    )

  return (
    <div
      data-slot="map-grid"
      data-focused={current.focusedMapId ? '' : undefined}
      className={cn('geo-map-grid', current.focusedMapId && 'geo-map-grid-focused', className)}
      style={
        {
          '--geo-grid-columns': config.layout?.columns ?? 3,
          '--geo-grid-tablet-columns': config.layout?.tabletColumns ?? 2,
          '--geo-grid-mobile-columns': config.layout?.mobileColumns ?? 1,
          '--geo-grid-gap': `${config.layout?.gapPx ?? 12}px`,
          '--geo-grid-cell-height': `${config.layout?.cellHeightPx ?? 340}px`,
        } as CSSProperties
      }
    >
      {config.maps
        .filter((item) => current.focusedMapId === null || current.focusedMapId === item.id)
        .map((item) => {
          const focused = current.focusedMapId === item.id
          return (
            <article
              key={item.id}
              data-slot="map-grid-cell"
              className={cn('geo-map-grid-cell', cellClassName)}
            >
              <header className="geo-map-grid-cell-header">
                <h2 className="geo-map-grid-cell-title">{item.title}</h2>
                {config.focus?.enabled !== false && (
                  <ShapeButton onClick={() => toggleFocus(item.id)}>
                    {focused
                      ? messages.returnToGrid
                      : formatMapMessage(messages.focusMap, { title: item.title })}
                  </ShapeButton>
                )}
              </header>
              <GeospatialMap
                {...callbacks}
                config={cellConfig(config, item, focused)}
                state={current.maps[item.id] ?? initial.maps[item.id]!}
                {...(slots ? { slots } : {})}
                {...(icons ? { icons } : {})}
                onStateChange={(next, change) => update(item.id, next, change)}
              />
            </article>
          )
        })}
    </div>
  )
}
