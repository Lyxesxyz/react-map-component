// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import type { MapLayerConfig } from '../types'

// How a layer follows the time frame, inferred from the layer itself. No OpenLayers imports:
// validation uses it too.

/**
 * - `'url'`: the URL has `{time}` and is requested again for each frame;
 * - `'parameter'`: a WMS layer gets the frame as a request parameter;
 * - `'property'`: features are filtered by a property.
 */
export type TimeMode = 'url' | 'parameter' | 'property'

/** The URL a layer would request again per frame, if it has one. */
function layerUrl(layer: MapLayerConfig): string | undefined {
  if (layer.kind === 'geojson' || layer.kind === 'heatmap')
    return 'url' in layer.data ? layer.data.url : undefined
  return layer.url
}

/** How the layer follows the time frame, or `undefined` when it doesn't (or can't). */
export function timeMode(layer: MapLayerConfig): TimeMode | undefined {
  if (!('time' in layer) || !layer.time) return undefined
  if (layerUrl(layer)?.includes('{time}')) return 'url'
  if (layer.kind === 'wms') return 'parameter'
  if (layer.kind === 'geojson' || layer.kind === 'heatmap' || layer.kind === 'mvt')
    return 'property'
  return undefined
}

/** The feature property (or WMS parameter) holding the frame. */
export function timeField(layer: MapLayerConfig): string {
  const field = 'time' in layer ? layer.time?.field : undefined
  return field ?? (layer.kind === 'wms' ? 'TIME' : 'time')
}

/** Whether the layer has something to show at `time`: always, unless it has time frames. */
export function hasFrame(layer: MapLayerConfig, time: string | null): boolean {
  if (!('time' in layer) || !layer.time) return true
  return time !== null && layer.time.values.includes(time)
}

/** The frame after `time` in the layer's frames, to load ahead. */
export function nextFrame(layer: MapLayerConfig, time: string | null): string | undefined {
  const values = 'time' in layer ? layer.time?.values : undefined
  if (!values || time === null) return undefined
  const index = values.indexOf(time)
  return index < 0 ? undefined : values[index + 1]
}

/** A URL template with `{time}` filled in. */
export function withTime(template: string, time: string | null): string {
  return template.replaceAll('{time}', encodeURIComponent(time ?? ''))
}

type Readable = { get(key: string): unknown }

/**
 * For a layer filtered by a time property, whether a feature belongs to the frame `time()`;
 * `undefined` for other layers (every feature is drawn).
 */
export function frameFilter(
  layer: MapLayerConfig,
  time: () => string | null,
): ((feature: Readable) => boolean) | undefined {
  if (timeMode(layer) !== 'property') return undefined
  const field = timeField(layer)
  return (feature) => {
    const frame = time()
    return frame !== null && String(feature.get(field)) === frame
  }
}
