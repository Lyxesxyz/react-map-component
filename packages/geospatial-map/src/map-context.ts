'use client'

// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import { defaultMapIcons } from './icons'
import type { MapContextValue, MapIcons, MapStaticValue } from './component-types'
import type { FeatureEvent, LonLat, MapActions, MapRuntime, MapSlotContext } from './types'

// What the parts read. The static value only changes with the configuration, so parts that only
// read the configuration or send commands (`useMapStatic`, `useMapActions`) don't re-render
// while the map moves. The live data is a store: `useMapRuntime(select)` re-renders a part only
// when what it selects changes.

/** The live map data, readable at any time and observable. */
export type MapRuntimeStore = {
  get(): MapRuntime
  set(runtime: MapRuntime): void
  subscribe(listener: () => void): () => void
}

export function createRuntimeStore(initial: MapRuntime): MapRuntimeStore {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (runtime) => {
      if (runtime === current) return
      current = runtime
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const MapStaticContext = createContext<MapStaticValue | null>(null)
export const MapRuntimeContext = createContext<MapRuntimeStore | null>(null)

function missingRoot(hook: string): never {
  throw new Error(`${hook} must be used inside <MapRoot> or <GeospatialMap>.`)
}

/** Configuration, UI policy, messages, actions and icons; does not re-render while the map moves. */
export function useMapStatic(): MapStaticValue {
  return useContext(MapStaticContext) ?? missingRoot('useMapStatic()')
}

/** Stable map actions; components using only this hook do not re-render when the map moves. */
export function useMapActions(): MapActions {
  return useMapStatic().actions
}

/** The map's icons by name, for custom parts that should match the built-in ones. */
export function useMapIcons(): MapIcons {
  return useContext(MapStaticContext)?.icons ?? defaultMapIcons
}

/**
 * One piece of the live map data: `useMapRuntime((map) => map.statuses)`. The part re-renders
 * only when that piece changes, so select a field and derive from it while rendering.
 */
export function useMapRuntime<T>(select: (runtime: MapRuntime) => T): T {
  const store = useContext(MapRuntimeContext) ?? missingRoot('useMapRuntime()')
  const read = () => select(store.get())
  return useSyncExternalStore(store.subscribe, read, read)
}

const everything = (runtime: MapRuntime) => runtime

/** Everything at once: configuration, live map data, and actions. Re-renders on every change. */
export function useMap(): MapContextValue {
  const staticValue = useMapStatic()
  const runtime = useMapRuntime(everything)
  return useMemo(() => ({ ...staticValue, ...runtime }), [staticValue, runtime])
}

/** The `{ state, actions }` object passed to preset slots. */
export function useSlotContext(): MapSlotContext {
  const actions = useMapActions()
  const state = useMapRuntime((runtime) => runtime.state)
  return useMemo(() => ({ state, actions }), [state, actions])
}

/**
 * Pixel position of `lonLat` inside the map stage, kept up to date while the map pans and zooms.
 * `null` when `lonLat` is `null` or the map has not laid out yet. Use it to place your own HTML
 * on the map (markers, labels, callouts): position it absolutely with `left`/`top` inside a part.
 */
export function useMapPixel(lonLat: LonLat | null | undefined): [number, number] | null {
  const actions = useMapActions()
  const longitude = lonLat?.[0]
  const latitude = lonLat?.[1]
  const getSnapshot = useCallback(() => {
    if (longitude === undefined || latitude === undefined) return ''
    const pixel = actions.pixelAt([longitude, latitude])
    return pixel ? `${Math.round(pixel[0])},${Math.round(pixel[1])}` : ''
  }, [actions, latitude, longitude])
  const key = useSyncExternalStore(actions.onRender, getSnapshot, () => '')
  return useMemo(() => {
    if (!key) return null
    const [x, y] = key.split(',').map(Number)
    return [x!, y!]
  }, [key])
}

/** The selectable feature under the pointer, or `null`. Re-renders only the calling component. */
export function useHoveredFeature(): FeatureEvent | null {
  const actions = useMapActions()
  return useSyncExternalStore(actions.onHoverChange, actions.getHoveredFeature, () => null)
}
