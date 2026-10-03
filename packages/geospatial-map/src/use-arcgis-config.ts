'use client'

// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { useEffect, useMemo, useState } from 'react'
import {
  arcgisServiceUrls,
  cachedArcgisService,
  loadArcgisService,
  resolveArcgisConfig,
  withoutArcgisLayers,
} from './core/arcgis'
import type { GeospatialMapConfigV1, MapError } from './types'

type ArcgisConfig = {
  /** The configuration to render: resolved, unresolved while loading, or without ArcGIS layers after a failure. */
  config: GeospatialMapConfigV1 | undefined
  /** ArcGIS services are still being read; the map waits so it starts in the right projection. */
  pending: boolean
  /** Why an ArcGIS service could not be used. */
  error: MapError | null
}

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
 * the configuration with those layers turned into ordinary vector tile layers.
 */
export function useArcgisConfig(config: GeospatialMapConfigV1 | undefined): ArcgisConfig {
  const urls = useMemo(() => (config ? arcgisServiceUrls(config) : []), [config])
  const key = urls.join('\n')
  const [loaded, setLoaded] = useState<{ key: string; error?: MapError }>({ key: '' })
  const ready = urls.every((url) => cachedArcgisService(url))

  useEffect(() => {
    if (!key || ready) return
    let cancelled = false
    Promise.all(key.split('\n').map((url) => loadArcgisService(url))).then(
      () => {
        if (!cancelled) setLoaded({ key })
      },
      (cause: unknown) => {
        if (!cancelled) setLoaded({ key, error: serviceError(cause) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, ready])

  const loadError = loaded.key === key ? (loaded.error ?? null) : null
  return useMemo<ArcgisConfig>(() => {
    if (!config || !urls.length) return { config, pending: false, error: null }
    if (ready) {
      try {
        return {
          config: resolveArcgisConfig(config, (url) => cachedArcgisService(url)!),
          pending: false,
          error: null,
        }
      } catch (cause) {
        return { config: withoutArcgisLayers(config), pending: false, error: serviceError(cause) }
      }
    }
    if (loadError) return { config: withoutArcgisLayers(config), pending: false, error: loadError }
    return { config, pending: true, error: null }
  }, [config, loadError, ready, urls])
}
