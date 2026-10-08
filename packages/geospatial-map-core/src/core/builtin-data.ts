// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import type { FeatureCollection, MultiPolygon } from 'geojson'
import type { BuiltinGeoJson } from '../types'

/** Decodes one delta-encoded ring ([x0, y0, dx1, dy1, …] in 1/100 degree) to lon/lat pairs. */
function decodeRing(encoded: number[]): number[][] {
  const ring: number[][] = []
  let x = 0
  let y = 0
  for (let index = 0; index + 1 < encoded.length; index += 2) {
    x += encoded[index]!
    y += encoded[index + 1]!
    ring.push([x / 100, y / 100])
  }
  return ring
}

/** Loads a dataset bundled with the component. The data module is split out of the main bundle. */
export async function loadBuiltinGeoJson(data: BuiltinGeoJson): Promise<FeatureCollection> {
  if (data.builtin !== 'world') throw new Error(`Unknown built-in dataset: ${String(data.builtin)}`)
  const { worldOutlines } = await import('../world-data')
  const geometry: MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: worldOutlines.map((polygon) => polygon.map(decodeRing)),
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', id: 'world', properties: {}, geometry }],
  }
}
