'use client'

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import type {
  FeatureEvent,
  GeospatialMapConfigV1,
  LonLat,
  MapApi,
  MapContextValue,
  MapMessages,
  MapRuntime,
  MapSlotContext,
  ResolvedMapUiConfig,
} from './types'

// Two contexts: the static one only changes with the configuration, so components that only
// send commands (`useMapActions`) do not re-render while the map moves.

export type MapStaticValue = {
  mapId: string
  config: GeospatialMapConfigV1
  ui: ResolvedMapUiConfig
  messages: MapMessages
  actions: MapApi
}

export const MapStaticContext = createContext<MapStaticValue | null>(null)
export const MapRuntimeContext = createContext<MapRuntime | null>(null)

function missingRoot(hook: string): never {
  throw new Error(`${hook} must be used inside <MapRoot> or <GeospatialMap>.`)
}

/** Configuration, live map data, and actions for building custom map parts. */
export function useMap(): MapContextValue {
  const staticValue = useContext(MapStaticContext)
  const runtime = useContext(MapRuntimeContext)
  if (!staticValue || !runtime) missingRoot('useMap()')
  return useMemo(() => ({ ...staticValue, ...runtime }), [staticValue, runtime])
}

/** Stable map actions; components using only this hook do not re-render when the map moves. */
export function useMapActions(): MapApi {
  const staticValue = useContext(MapStaticContext)
  if (!staticValue) missingRoot('useMapActions()')
  return staticValue.actions
}

/** The `{ state, actions }` object passed to preset slots. */
export function useSlotContext(): MapSlotContext {
  const { state, actions } = useMap()
  return useMemo(() => ({ state, actions }), [state, actions])
}

/** Configuration, UI policy, messages and actions; does not re-render while the map moves. */
export function useMapStatic(): MapStaticValue {
  const staticValue = useContext(MapStaticContext)
  if (!staticValue) missingRoot('useMapStatic()')
  return staticValue
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
