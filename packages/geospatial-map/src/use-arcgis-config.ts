'use client'

// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { useEffect, useMemo, useState } from 'react'
import {
  arcgisFallback,
  arcgisServiceUrls,
  cachedArcgisService,
  loadArcgisService,
  resolveArcgisConfig,
} from './core/arcgis'
import type { MapConfig, MapError } from './types'

type ArcgisConfig = {
  /**
   * The configuration to render: resolved, unresolved while loading, or after a failure without
   * ArcGIS layers (basemaps that name a `fallbackBasemapId` replaced by it).
   */
  config: MapConfig | undefined
  /** ArcGIS services are still being read; the map waits so it starts in the right projection. */
  pending: boolean
  /** Why an ArcGIS service could not be used (`null` when a fallback basemap stands in). */
  error: MapError | null
  /** Basemaps left out after a failure, by id, with the id of the basemap shown instead. */
  replaced: Readonly<Record<string, string>>
}

const noneReplaced: Readonly<Record<string, string>> = Object.freeze({})

/**
 * Reads the ArcGIS services an `arcgis-vector-tiles` layer points at (once per page) and returns
 * the configuration with those layers turned into ordinary vector tile layers.
 */
export function useArcgisConfig(config: MapConfig | undefined): ArcgisConfig {
  const urls = useMemo(() => (config ? arcgisServiceUrls(config) : []), [config])
  const key = urls.join('\n')
  const [loaded, setLoaded] = useState<{ key: string; failed?: { cause: unknown } }>({ key: '' })
  const ready = urls.every((url) => cachedArcgisService(url))

  useEffect(() => {
    if (!key || ready) return
    let cancelled = false
    Promise.all(key.split('\n').map((url) => loadArcgisService(url))).then(
      () => {
        if (!cancelled) setLoaded({ key })
      },
      (cause: unknown) => {
        if (!cancelled) setLoaded({ key, failed: { cause } })
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, ready])

  const failed = loaded.key === key ? loaded.failed : undefined
  return useMemo<ArcgisConfig>(() => {
    if (!config || !urls.length)
      return { config, pending: false, error: null, replaced: noneReplaced }
    if (ready) {
      try {
        return {
          config: resolveArcgisConfig(config, (url) => cachedArcgisService(url)!),
          pending: false,
          error: null,
          replaced: noneReplaced,
        }
      } catch (cause) {
        return { ...arcgisFallback(config, cause), pending: false }
      }
    }
    if (failed) return { ...arcgisFallback(config, failed.cause), pending: false }
    return { config, pending: true, error: null, replaced: noneReplaced }
  }, [config, failed, ready, urls])
}
