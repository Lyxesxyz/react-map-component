'use client'

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { normalizeMapConfig } from './config/normalize'
import { GeospatialMap } from './geospatial-map'
import { useResettableState } from './hooks'
import { formatMapMessage, resolveMapMessages } from './messages'
import { ShapeButton } from './shapes'
import type {
  MapCallbacks,
  MapConfigInput,
  MapGridCallbacks,
  MapGridConfig,
  MapGridItem,
  MapGridProps,
  MapGridState,
  MapState,
  MapStateChange,
} from './types'
import { cn, fingerprint } from './utils'

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

/** The grid's callbacks for one map: each also gets the map's id. */
function cellCallbacks(callbacks: MapGridCallbacks, mapId: string): MapCallbacks {
  return Object.fromEntries(
    Object.entries(callbacks)
      .filter(([, callback]) => typeof callback === 'function')
      .map(([name, callback]) => [
        name,
        (...args: unknown[]) => (callback as (...values: unknown[]) => void)(...args, mapId),
      ]),
  )
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
  // Each map starts from its configuration; a changed grid configuration starts them over.
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
  const [own, setOwn] = useResettableState(fingerprint(config), () => initial)
  const current = state ?? own
  const messages = resolveMapMessages(config.shared.messages)

  if (config.maps.length > MAX_MAPS)
    return (
      <div className="geo-config-error" data-slot="map-grid-error" role="alert">
        {messages.tooManyGridMaps}
      </div>
    )

  /** The state of a map: the grid's, or its starting state while the grid has none (a new map). */
  const mapState = (id: string) => current.maps[id] ?? initial.maps[id]!

  /** Applies `next` to the grid state (owned or controlled) and reports it. */
  const commit = (next: MapGridState, mapId: string | null, change?: MapStateChange) => {
    if (!state) setOwn(next)
    onStateChange?.(next, mapId, change)
  }

  /**
   * A map's new state, and the others' with what the grid synchronises. Changes a map made to
   * follow the grid (`origin: 'state'`) are not passed on, so they don't echo back.
   */
  const update = (mapId: string, next: MapState, change: MapStateChange) =>
    commit(
      {
        ...current,
        maps: Object.fromEntries(
          config.maps.map(({ id }) => [
            id,
            id === mapId
              ? next
              : change.origin === 'state'
                ? mapState(id)
                : synced(config, change, next, mapState(id)),
          ]),
        ),
      },
      mapId,
      change,
    )

  const toggleFocus = (id: string) =>
    commit({ ...current, focusedMapId: current.focusedMapId === id ? null : id }, null)

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
                {...cellCallbacks(callbacks, item.id)}
                config={cellConfig(config, item, focused)}
                state={mapState(item.id)}
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
