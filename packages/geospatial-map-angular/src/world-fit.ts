// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { afterRenderEffect, computed, signal, untracked } from '@angular/core'
import type { Signal } from '@angular/core'
import { hasDefaultZoom } from './config/normalize'
import { fitWorldView, registerLayerProjections, zoomLimits } from './core/projections'
import type { MapConfig, MapViewState } from './types'

export type WorldFit = {
  /** The configuration with the fitted starting view, once measured. */
  config: Signal<MapConfig | undefined>
  /** The map is waiting to be measured. */
  pending: Signal<boolean>
}

/**
 * With `view.fitWorld` (by default when the configuration sets no zoom), measures the map
 * before it starts and replaces the starting zoom with the one that fits the whole world. Reset
 * zoom then returns to that view. A map with no size yet (in a hidden tab, for example) keeps the
 * configured view. It measures after render (`earlyRead`), so never on the server. Call it in an
 * injection context.
 */
export function worldFit(
  config: Signal<MapConfig | undefined>,
  target: Signal<HTMLElement | undefined>,
  enabled: Signal<boolean>,
): WorldFit {
  const key = computed(() => {
    const value = config()
    return enabled() && value && (value.view.fitWorld ?? hasDefaultZoom(value.initialState.view))
      ? JSON.stringify([value.initialState.view, value.data.basemaps.map((item) => item.id)])
      : ''
  })
  const fitted = signal<{ key: string; view?: MapViewState }>({ key: '' })

  afterRenderEffect({
    earlyRead: () => {
      const current = key()
      const element = target()
      if (!current || fitted().key === current || !element) return
      const value = untracked(config)
      if (!value) return
      try {
        registerLayerProjections([
          ...value.data.basemaps.flatMap((basemap) => basemap.layers),
          ...value.data.layers,
        ])
        const view = fitWorldView(
          value.initialState.view,
          element.clientWidth,
          element.clientHeight,
          zoomLimits(value.view),
        )
        fitted.set({ key: current, view })
      } catch {
        fitted.set({ key: current })
      }
    },
  })

  const resolved = computed<{ config: MapConfig | undefined; pending: boolean }>(() => {
    const value = config()
    const current = key()
    if (!value || !current) return { config: value, pending: false }
    const fit = fitted()
    if (fit.key !== current) return { config: value, pending: true }
    if (!fit.view) return { config: value, pending: false }
    return {
      config: { ...value, initialState: { ...value.initialState, view: fit.view } },
      pending: false,
    }
  })
  return {
    config: computed(() => resolved().config),
    pending: computed(() => resolved().pending),
  }
}
