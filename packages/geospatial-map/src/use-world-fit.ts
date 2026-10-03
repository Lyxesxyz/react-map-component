'use client'

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { fitWorldView, registerLayerProjections } from './core/projections'
import type { GeospatialMapConfigV1, MapViewState } from './types'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * With `view.fitWorld`, measures the map before it starts and replaces the configured starting
 * zoom with the one that fits the whole world. Reset zoom then returns to that view. A map with
 * no size yet (in a hidden tab, for example) keeps the configured view.
 */
export function useWorldFit(
  config: GeospatialMapConfigV1 | undefined,
  targetRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): { config: GeospatialMapConfigV1 | undefined; pending: boolean } {
  const key =
    enabled && config?.view.fitWorld
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
      const view = fitWorldView(config.initialState.view, target.clientWidth, target.clientHeight)
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
