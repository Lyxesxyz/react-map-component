// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { basemapIssues, layerIssues } from '../config/validate'
import type { BasemapConfig, ConfigIssue, MapLayerConfig, ProjectionId } from '../types'
import { MapConfigurationError } from './errors'

// The renderer's checks before it builds layers: the rules of `validateMapConfig`, for maps
// built from configurations that skipped it. The first problem is thrown.

function throwFirst(issues: ConfigIssue[], layerIdAt: (index: number) => string | undefined) {
  const first = issues[0]
  if (!first) return
  const index = /^\/(\d+)/.exec(first.path)?.[1]
  throw new MapConfigurationError(
    first.message,
    index === undefined ? undefined : layerIdAt(Number(index)),
  )
}

/** Throws a `MapConfigurationError` for the first layer the renderer can't build. */
export function validateLayerConfigs(layers: MapLayerConfig[]): void {
  throwFirst(layerIssues(layers, ''), (index) => layers[index]?.id)
}

/** Throws a `MapConfigurationError` for the first basemap the renderer can't build. */
export function validateBasemaps(basemaps: BasemapConfig[]): void {
  throwFirst(basemapIssues(basemaps, ''), () => undefined)
}

/** The basemap to show in `projection`: the requested one if it supports it, else the first that does. */
export function compatibleBasemap(
  basemaps: BasemapConfig[],
  requestedId: string | undefined,
  projection: ProjectionId,
): BasemapConfig {
  const requested = basemaps.find((item) => item.id === requestedId)
  const result = requested?.supportedProjections.includes(projection)
    ? requested
    : basemaps.find((item) => item.supportedProjections.includes(projection))
  if (!result) throw new MapConfigurationError(`No basemap supports ${projection}`)
  return result
}

/** The colour behind a basemap's layers. */
export function backgroundOf(basemap: BasemapConfig): string {
  return basemap.backgroundColor ?? 'var(--geo-stage)'
}
