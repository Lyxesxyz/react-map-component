'use client'

import { createContext, useContext, useMemo } from 'react'
import type {
  GeospatialMapConfigV1,
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
