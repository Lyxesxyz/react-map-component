// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import type ImageTile from 'ol/ImageTile.js'
import type Tile from 'ol/Tile.js'
import TileState from 'ol/TileState.js'
import TileLayer from 'ol/layer/Tile.js'
import TileWMS from 'ol/source/TileWMS.js'
import WMTS from 'ol/source/WMTS.js'
import XYZ from 'ol/source/XYZ.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'
import { unByKey } from 'ol/Observable.js'
import type { WmsLayerConfig, WmtsLayerConfig, XyzLayerConfig } from '../../types'
import { nextFrame, timeField, timeMode, withTime } from '../time'
import { attributionText, layerOptions, watchTiles } from './common'
import type { BuiltLayer, LayerEnvironment, LayerReporter } from './common'
import { tileGridOptions } from './vector-tile-layer'

// Image tile layers: XYZ, WMS and WMTS. They look the same whatever the map state, so they are
// never redrawn; a time change swaps their URL or parameters.

/** Browser CORS mode for tile images when the config sets none. */
const DEFAULT_CROSS_ORIGIN = 'anonymous'
/** Prefetched tile URLs kept per layer before the list is reset. */
const MAX_PREFETCHED_TILES = 64

const imageTileLoader =
  (crossOrigin: string, onLoaded: (url: string) => void) => (tile: Tile, url: string) => {
    const image = (tile as ImageTile).getImage() as HTMLImageElement
    image.crossOrigin = crossOrigin
    image.src = url
    image.addEventListener('load', () => onLoaded(url), { once: true })
    image.onerror = () => tile.setState(TileState.ERROR)
  }

export function buildXyzLayer(
  config: XyzLayerConfig,
  env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const crossOrigin = config.crossOrigin ?? DEFAULT_CROSS_ORIGIN
  const timed = timeMode(config) === 'url'
  const prefetched = new Set<string>()
  let time = env.time
  // When a tile loads, start loading the same tile of the next frame.
  const prefetch = (loadedUrl: string) => {
    const next = timed ? nextFrame(config, time) : undefined
    if (next === undefined || time === null) return
    const url = loadedUrl.replaceAll(encodeURIComponent(time), encodeURIComponent(next))
    if (prefetched.has(url) || prefetched.size >= MAX_PREFETCHED_TILES) return
    prefetched.add(url)
    const image = new Image()
    image.crossOrigin = crossOrigin
    image.src = url
  }
  const source = new XYZ({
    url: withTime(config.url, env.time),
    projection: config.sourceProjection,
    crossOrigin,
    maxZoom: config.maxSourceZoom,
    attributions: attributionText(config.attribution),
    tileLoadFunction: imageTileLoader(crossOrigin, prefetch),
  })
  const keys = watchTiles(source, config, report)
  return {
    layer: new TileLayer({ ...layerOptions(config), source }),
    update: (change) => {
      if (change !== 'time' || !timed) return
      time = env.time
      prefetched.clear()
      source.setUrl(withTime(config.url, time))
    },
    dispose: () => unByKey(keys),
  }
}

export function buildWmsLayer(
  config: WmsLayerConfig,
  env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const mode = timeMode(config)
  const parameter = timeField(config)
  const frame = () =>
    mode === 'parameter' ? { [parameter]: env.time ?? '' } : ({} as Record<string, string>)
  const source = new TileWMS({
    url: withTime(config.url, env.time),
    params: { ...config.params, ...frame() },
    projection: config.sourceProjection,
    crossOrigin: config.crossOrigin ?? DEFAULT_CROSS_ORIGIN,
    attributions: attributionText(config.attribution),
  })
  const keys = watchTiles(source, config, report)
  return {
    layer: new TileLayer({ ...layerOptions(config), source }),
    update: (change) => {
      if (change !== 'time') return
      if (mode === 'parameter') source.updateParams(frame())
      else if (mode === 'url') source.setUrl(withTime(config.url, env.time))
    },
    dispose: () => unByKey(keys),
  }
}

export function buildWmtsLayer(
  config: WmtsLayerConfig,
  _env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const source = new WMTS({
    url: config.url,
    layer: config.layer,
    matrixSet: config.matrixSet,
    format: config.format,
    projection: config.sourceProjection,
    style: config.styleName ?? 'default',
    tileGrid: new WMTSTileGrid({
      ...tileGridOptions(config.tileGrid),
      matrixIds: config.tileGrid.matrixIds,
    }),
    crossOrigin: config.crossOrigin ?? DEFAULT_CROSS_ORIGIN,
    attributions: attributionText(config.attribution),
  })
  const keys = watchTiles(source, config, report)
  return {
    layer: new TileLayer({ ...layerOptions(config), source }),
    update: () => undefined,
    dispose: () => unByKey(keys),
  }
}
