// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { FeatureCollection, Position } from 'geojson'
import type { GeoJsonLayerConfig, HeatmapLayerConfig } from '../types'

// Plain-language hints for the most common data mistakes, checked once when a layer's data
// loads. They go to the console; the map keeps working.

const list = (values: Iterable<unknown>, limit = 12) => {
  const items = [...values].map(String)
  return items.length > limit
    ? `${items.slice(0, limit).join(', ')}, … (${items.length} in all)`
    : items.join(', ')
}

function firstPosition(collection: FeatureCollection): Position | undefined {
  for (const feature of collection.features.slice(0, 50)) {
    let value: unknown = (feature.geometry as { coordinates?: unknown } | null)?.coordinates
    while (Array.isArray(value) && Array.isArray(value[0])) value = value[0]
    if (Array.isArray(value) && typeof value[0] === 'number') return value as Position
  }
  return undefined
}

/** Problems worth telling a developer about in a layer's loaded data. */
export function diagnoseLayerData(
  config: GeoJsonLayerConfig | HeatmapLayerConfig,
  collection: FeatureCollection,
): string[] {
  const name = `Layer "${config.id}"`
  const features = collection.features
  if (!features.length) return [`${name} loaded no features.`]
  const hints: string[] = []
  const properties = new Set(features.flatMap((feature) => Object.keys(feature.properties ?? {})))
  const known = properties.size ? list(properties) : '(none)'

  if (!config.sourceProjection || config.sourceProjection === 'EPSG:4326') {
    const position = firstPosition(collection)
    if (position && (Math.abs(position[0]!) > 360 || Math.abs(position[1]!) > 90))
      hints.push(
        `${name} has coordinates like [${position.slice(0, 2).join(', ')}], which are not ` +
          'longitude/latitude. Set sourceProjection to the projection of the data (for example ' +
          "'EPSG:3857').",
      )
  }

  const idField = config.kind === 'geojson' ? config.featureIdField : undefined
  if (idField) {
    const ids = features.map((feature) => feature.properties?.[idField])
    const missing = ids.filter((id) => id === undefined || id === null || id === '').length
    if (missing === features.length)
      hints.push(
        `${name} uses featureIdField "${idField}", but no feature has it. ` +
          `Properties: ${known}.`,
      )
    else if (missing)
      hints.push(`${missing} of ${features.length} features in ${name} have no "${idField}".`)
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const id of ids) {
      if (id === undefined || id === null) continue
      const key = String(id)
      if (seen.has(key)) duplicates.add(key)
      seen.add(key)
    }
    if (duplicates.size)
      hints.push(
        `${name} has features sharing a "${idField}" (${list(duplicates, 5)}); ` +
          'selection needs unique values.',
      )
  }

  if (config.kind === 'heatmap') return hints
  const style = config.style
  if (!('field' in style)) return hints
  const values = features.map((feature) => feature.properties?.[style.field])
  const present = values.filter((value) => value !== undefined && value !== null && value !== '')
  if (!present.length) {
    hints.push(
      `${name} is styled by "${style.field}", but its features have no such property. ` +
        `Properties: ${known}.`,
    )
    return hints
  }
  if (style.type === 'graduated' || style.type === 'continuous') {
    const numeric = present.filter((value) => Number.isFinite(Number(value)))
    if (!numeric.length)
      hints.push(
        `${name} is styled by "${style.field}" as numbers, but the values are text ` +
          `(${list(new Set(present), 5)}). Use a categorical style, or numeric values.`,
      )
  }
  if (style.type === 'categorical' && !style.fallback) {
    const categories = new Set(style.categories.map((category) => category.value))
    const special = new Set(style.specialValues?.map((item) => item.value) ?? [])
    const unmatched = new Set(
      present.filter((value) => !categories.has(value as never) && !special.has(value as never)),
    )
    if (unmatched.size)
      hints.push(
        `${name}: ${list(unmatched, 8)} in "${style.field}" match no category and are not drawn. ` +
          'Add categories, or a fallback.',
      )
  }
  return hints
}
