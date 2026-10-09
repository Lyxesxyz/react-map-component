// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { afterRenderEffect, computed, signal } from '@angular/core'
import type { Signal } from '@angular/core'
import {
  arcgisFallback,
  arcgisServiceUrls,
  cachedArcgisService,
  loadArcgisService,
  resolveArcgisConfig,
} from './core/arcgis'
import type { MapConfig, MapError } from './types'

export type ArcgisConfig = {
  /**
   * The configuration to render: resolved, unresolved while loading, or after a failure without
   * ArcGIS layers (basemaps that name a `fallbackBasemapId` replaced by it).
   */
  config: Signal<MapConfig | undefined>
  /** ArcGIS services are still being read; the map waits so it starts in the right projection. */
  pending: Signal<boolean>
  /** Why an ArcGIS service could not be used (`null` when a fallback basemap stands in). */
  error: Signal<MapError | null>
  /** Basemaps left out after a failure, by id, with the id of the basemap shown instead. */
  replaced: Signal<Readonly<Record<string, string>>>
}

type Resolved = {
  config: MapConfig | undefined
  pending: boolean
  error: MapError | null
  replaced: Readonly<Record<string, string>>
}

const noneReplaced: Readonly<Record<string, string>> = Object.freeze({})

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
  const loaded = signal<{ key: string; failed?: { cause: unknown } }>({ key: '' })
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
        if (!cancelled) loaded.set({ key: services, failed: { cause } })
      },
    )
    onCleanup(() => {
      cancelled = true
    })
  })

  const failed = computed(() => {
    const current = loaded()
    return current.key === key() ? current.failed : undefined
  })
  const resolved = computed<Resolved>(() => {
    const value = config()
    if (!value || !urls().length)
      return { config: value, pending: false, error: null, replaced: noneReplaced }
    if (ready()) {
      try {
        return {
          config: resolveArcgisConfig(value, (url) => cachedArcgisService(url)!),
          pending: false,
          error: null,
          replaced: noneReplaced,
        }
      } catch (cause) {
        return { ...arcgisFallback(value, cause), pending: false }
      }
    }
    const failure = failed()
    if (failure) return { ...arcgisFallback(value, failure.cause), pending: false }
    return { config: value, pending: true, error: null, replaced: noneReplaced }
  })
  return {
    config: computed(() => resolved().config),
    pending: computed(() => resolved().pending),
    error: computed(() => resolved().error),
    replaced: computed(() => resolved().replaced),
  }
}
