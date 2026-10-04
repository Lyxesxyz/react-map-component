'use client'

// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { hasDefaultZoom } from './config/normalize'
import { fitWorldView, registerLayerProjections, zoomLimits } from './core/projections'
import { useIsomorphicLayoutEffect } from './hooks'
import type { MapConfig, MapViewState } from './types'

/**
 * With `view.fitWorld` (by default when the configuration sets no zoom), measures the map
 * before it starts and replaces the starting zoom with the one that fits the whole world. Reset
 * zoom then returns to that view. A map with no size yet (in a hidden tab, for example) keeps the
 * configured view.
 */
export function useWorldFit(
  config: MapConfig | undefined,
  targetRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): { config: MapConfig | undefined; pending: boolean } {
  const key =
    enabled && config && (config.view.fitWorld ?? hasDefaultZoom(config.initialState.view))
      ? JSON.stringify([config.initialState.view, config.data.basemaps.map((item) => item.id)])
      : ''
  const [fitted, setFitted] = useState<{ key: string; view?: MapViewState }>({ key: '' })

  useIsomorphicLayoutEffect(() => {
    if (!key || fitted.key === key || !config) return
    const target = targetRef.current
    if (!target) return
    try {
      registerLayerProjections([
        ...config.data.basemaps.flatMap((basemap) => basemap.layers),
        ...config.data.layers,
      ])
      const view = fitWorldView(
        config.initialState.view,
        target.clientWidth,
        target.clientHeight,
        zoomLimits(config.view),
      )
      setFitted({ key, view })
    } catch {
      setFitted({ key })
    }
  })

  const ready = fitted.key === key
  return useMemo(() => {
    if (!config || !key) return { config, pending: false }
    if (!ready) return { config, pending: true }
    if (!fitted.view) return { config, pending: false }
    return {
      config: { ...config, initialState: { ...config.initialState, view: fitted.view } },
      pending: false,
    }
  }, [config, fitted.view, key, ready])
}
