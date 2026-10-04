// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { BasemapConfig, MapLayerConfig, ProjectionId } from '../types'
import { MapConfigurationError } from './errors'

// Checks the renderer makes before building layers. `validateMapConfig` reports the same
// problems earlier, with paths; these guard maps built from configs that skipped it.

/** Throws a `MapConfigurationError` for the first layer the renderer can't build. */
export function validateLayerConfigs(configs: MapLayerConfig[]): void {
  const ids = new Set<string>()
  for (const config of configs) {
    if (!config.id.trim()) throw new MapConfigurationError('Layer IDs cannot be empty')
    if (ids.has(config.id)) throw new MapConfigurationError(`Duplicate layer ID: ${config.id}`)
    ids.add(config.id)
    if (!config.title.trim())
      throw new MapConfigurationError(`Layer ${config.id} needs a title`, config.id)
    if (config.opacity !== undefined && (config.opacity < 0 || config.opacity > 1))
      throw new MapConfigurationError(
        `Layer ${config.id} opacity must be between 0 and 1`,
        config.id,
      )
    // GeoJSON features without an id get one when loaded; tiles need a field.
    if (
      config.kind !== 'heatmap' &&
      config.kind !== 'geojson' &&
      config.selectable &&
      !config.featureIdField
    )
      throw new MapConfigurationError(
        `Selectable layer ${config.id} needs featureIdField`,
        config.id,
      )
    if (config.time && !config.time.available.length)
      throw new MapConfigurationError(
        `Timed layer ${config.id} needs available time values`,
        config.id,
      )
    if (config.kind === 'heatmap') {
      if (config.selectable)
        throw new MapConfigurationError(
          `Heatmap layer ${config.id} cannot be selectable`,
          config.id,
        )
      if (config.time?.mode === 'wms-parameter')
        throw new MapConfigurationError(
          `Heatmap layer ${config.id} does not support WMS parameter time mode`,
          config.id,
        )
      for (const stops of [config.radiusStops, config.blurStops])
        if (stops?.some((stop, index) => index > 0 && stop.zoom <= stops[index - 1]!.zoom))
          throw new MapConfigurationError(
            `Heatmap layer ${config.id} zoom stops must be strictly ascending`,
            config.id,
          )
    }
    if (
      config.kind === 'wmts' &&
      config.tileGrid.resolutions.length !== config.tileGrid.matrixIds.length
    )
      throw new MapConfigurationError(
        `WMTS layer ${config.id} needs one matrix ID per resolution`,
        config.id,
      )
    if (config.kind === 'mvt') {
      if (!config.style && !config.mapboxStyle)
        throw new MapConfigurationError(
          `MVT layer ${config.id} needs a thematic or Mapbox style`,
          config.id,
        )
      if (!config.tileGrid?.resolutions.length && config.tileGrid)
        throw new MapConfigurationError(
          `MVT layer ${config.id} needs at least one tile-grid resolution`,
          config.id,
        )
      if (
        config.sourceProjectionDefinition &&
        config.sourceProjectionDefinition.code !== config.sourceProjection
      )
        throw new MapConfigurationError(
          `MVT layer ${config.id} projection definition must match its source projection`,
          config.id,
        )
    }
  }
}

/** Throws a `MapConfigurationError` for the first basemap the renderer can't build. */
export function validateBasemaps(basemaps: BasemapConfig[]): void {
  const ids = new Set<string>()
  for (const basemap of basemaps) {
    if (!basemap.id.trim() || !basemap.title.trim())
      throw new MapConfigurationError('Basemaps need non-empty IDs and titles')
    if (ids.has(basemap.id)) throw new MapConfigurationError(`Duplicate basemap ID: ${basemap.id}`)
    ids.add(basemap.id)
    if (!basemap.supportedProjections.length)
      throw new MapConfigurationError(`Basemap ${basemap.id} needs a supported projection`)
  }
}

/** The basemap to show in `projection`: the requested one, else its fallback, else any. */
export function compatibleBasemap(
  basemaps: BasemapConfig[],
  requestedId: string | undefined,
  projection: ProjectionId,
): BasemapConfig {
  const requested = basemaps.find((item) => item.id === requestedId)
  if (requested?.supportedProjections.includes(projection)) return requested
  const fallback = basemaps.find(
    (item) =>
      item.supportedProjections.includes(projection) && item.fallbackFor?.includes(projection),
  )
  const firstCompatible = basemaps.find((item) => item.supportedProjections.includes(projection))
  const result = fallback ?? firstCompatible
  if (!result) throw new MapConfigurationError(`No basemap supports ${projection}`)
  return result
}

/** The colour behind a basemap's layers. */
export function backgroundOf(basemap: BasemapConfig): string {
  return basemap.backgroundColor ?? 'var(--geo-stage)'
}
