// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { afterRenderEffect, computed, signal } from '@angular/core'
import type { Signal } from '@angular/core'
import {
  arcgisServiceUrls,
  cachedArcgisService,
  loadArcgisService,
  resolveArcgisConfig,
  withoutArcgisLayers,
} from './core/arcgis'
import type { MapConfig, MapError } from './types'

export type ArcgisConfig = {
  /** The configuration to render: resolved, unresolved while loading, or without ArcGIS layers after a failure. */
  config: Signal<MapConfig | undefined>
  /** ArcGIS services are still being read; the map waits so it starts in the right projection. */
  pending: Signal<boolean>
  /** Why an ArcGIS service could not be used. */
  error: Signal<MapError | null>
}

type Resolved = { config: MapConfig | undefined; pending: boolean; error: MapError | null }

function serviceError(cause: unknown): MapError {
  return {
    code: 'SOURCE_LOAD_FAILED',
    message: `Could not load the ArcGIS basemap: ${cause instanceof Error ? cause.message : String(cause)}`,
    recoverable: true,
    cause,
  }
}

/**
 * Reads the ArcGIS services an `arcgis-vector-tiles` layer points at (once per page) and returns
 * the configuration with those layers turned into ordinary vector tile layers. The services are
 * read in the browser only (after render), never on the server. Call it in an injection context.
 */
export function arcgisConfig(config: Signal<MapConfig | undefined>): ArcgisConfig {
  const urls = computed(() => {
    const value = config()
    return value ? arcgisServiceUrls(value) : []
  })
  const key = computed(() => urls().join('\n'))
  const loaded = signal<{ key: string; error?: MapError }>({ key: '' })
  // The service cache is not a signal: `loaded` changes once a load settles, to read it again.
  const ready = computed(() => {
    loaded()
    return urls().every((url) => cachedArcgisService(url))
  })

  afterRenderEffect((onCleanup) => {
    const services = key()
    if (!services || ready()) return
    let cancelled = false
    Promise.all(services.split('\n').map((url) => loadArcgisService(url))).then(
      () => {
        if (!cancelled) loaded.set({ key: services })
      },
      (cause: unknown) => {
        if (!cancelled) loaded.set({ key: services, error: serviceError(cause) })
      },
    )
    onCleanup(() => {
      cancelled = true
    })
  })

  const loadError = computed(() => {
    const current = loaded()
    return current.key === key() ? (current.error ?? null) : null
  })
  const resolved = computed<Resolved>(() => {
    const value = config()
    if (!value || !urls().length) return { config: value, pending: false, error: null }
    if (ready()) {
      try {
        return {
          config: resolveArcgisConfig(value, (url) => cachedArcgisService(url)!),
          pending: false,
          error: null,
        }
      } catch (cause) {
        return { config: withoutArcgisLayers(value), pending: false, error: serviceError(cause) }
      }
    }
    const error = loadError()
    if (error) return { config: withoutArcgisLayers(value), pending: false, error }
    return { config: value, pending: true, error: null }
  })
  return {
    config: computed(() => resolved().config),
    pending: computed(() => resolved().pending),
    error: computed(() => resolved().error),
  }
}
