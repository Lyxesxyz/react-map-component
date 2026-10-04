// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

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
import { attributionText, followingTimes, layerOptions, watchTiles, withTime } from './common'
import type { BuiltLayer, LayerEnvironment, LayerReporter } from './common'

// Image tile layers: XYZ, WMS and WMTS. They look the same whatever the map state, so they are
// never redrawn by the registry; time changes swap their URL or parameters.

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
  const prefetched = new Set<string>()
  let time = env.time
  // When a tile loads, start loading the same tile of the next frames.
  const prefetch = (loadedUrl: string) => {
    if (!time || !config.url.includes('{time}')) return
    for (const next of followingTimes(config.time, time)) {
      const url = loadedUrl.replaceAll(encodeURIComponent(time), encodeURIComponent(next))
      if (prefetched.has(url) || prefetched.size >= MAX_PREFETCHED_TILES) continue
      prefetched.add(url)
      const image = new Image()
      image.crossOrigin = config.crossOrigin ?? 'anonymous'
      image.src = url
    }
  }
  const source = new XYZ({
    url: withTime(config.url, env.time),
    projection: config.sourceProjection,
    crossOrigin: config.crossOrigin ?? 'anonymous',
    maxZoom: config.maxSourceZoom,
    attributions: attributionText(config.attribution),
    tileLoadFunction: imageTileLoader(config.crossOrigin ?? 'anonymous', prefetch),
  })
  const keys = watchTiles(source, config, report)
  return {
    layer: new TileLayer({ ...layerOptions(config), source }),
    redrawOn: new Set(),
    ...(config.time?.mode === 'url-template'
      ? {
          setTime: (next: string | null) => {
            time = next
            prefetched.clear()
            source.setUrl(withTime(config.url, next))
          },
        }
      : {}),
    dispose: () => unByKey(keys),
  }
}

export function buildWmsLayer(
  config: WmsLayerConfig,
  _env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const source = new TileWMS({
    url: config.url,
    params: { ...config.params },
    projection: config.sourceProjection,
    crossOrigin: config.crossOrigin ?? 'anonymous',
    attributions: attributionText(config.attribution),
  })
  const keys = watchTiles(source, config, report)
  const parameter = config.time?.fieldOrParameter ?? 'TIME'
  return {
    layer: new TileLayer({ ...layerOptions(config), source }),
    redrawOn: new Set(),
    ...(config.time?.mode === 'wms-parameter'
      ? { setTime: (time: string | null) => source.updateParams({ [parameter]: time ?? '' }) }
      : {}),
    dispose: () => unByKey(keys),
  }
}

export function buildWmtsLayer(
  config: WmtsLayerConfig,
  _env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const size = config.tileGrid.tileSize
  const source = new WMTS({
    url: config.url,
    layer: config.layer,
    matrixSet: config.matrixSet,
    format: config.format,
    projection: config.sourceProjection,
    style: config.styleName ?? 'default',
    tileGrid: new WMTSTileGrid({
      extent: [...config.tileGrid.extent],
      origin: [...config.tileGrid.origin],
      resolutions: config.tileGrid.resolutions,
      matrixIds: config.tileGrid.matrixIds,
      tileSize: size === undefined || typeof size === 'number' ? size : [size[0], size[1]],
    }),
    crossOrigin: config.crossOrigin ?? 'anonymous',
    attributions: attributionText(config.attribution),
  })
  const keys = watchTiles(source, config, report)
  return {
    layer: new TileLayer({ ...layerOptions(config), source }),
    redrawOn: new Set(),
    dispose: () => unByKey(keys),
  }
}
