// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import MVT from 'ol/format/MVT.js'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import VectorTileSource from 'ol/source/VectorTile.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'
import { unByKey } from 'ol/Observable.js'
import type { TileGridSpec, VectorTileLayerConfig } from '../../types'
import { warnOnce } from '../../utils'
import { isCssColor, paint } from '../canvas-theme'
import { compileThematicStyle } from '../style-compiler'
import { symbolRules } from '../symbol-rules'
import { loadStyleDocument, prepareStyle } from '../vector-style'
import {
  attributionText,
  hasZoomStops,
  layerOptions,
  watchTiles,
  withSelection,
  withTime,
} from './common'
import type { BuiltLayer, LayerDependency, LayerEnvironment, LayerReporter } from './common'

// Vector tile (`mvt`) layers, styled by a thematic style or a Mapbox GL style document (the
// format of ArcGIS vector tile styles).

/** An OpenLayers tile grid from the config's. */
export function tileGridFrom(grid: TileGridSpec): TileGrid {
  const size = grid.tileSize
  return new TileGrid({
    extent: [...grid.extent],
    origin: [...grid.origin],
    resolutions: grid.resolutions,
    tileSize: size === undefined || typeof size === 'number' ? size : [size[0], size[1]],
  })
}

/**
 * Tile sources shared between layers that draw different style layers of the same tiles (an
 * ArcGIS basemap and its labels), so each tile is downloaded once.
 */
export class SharedSourcePool {
  private readonly entries = new Map<string, { source: VectorTileSource; users: number }>()

  /** The source for `key`, created by `create` for its first user; call `release` when done. */
  acquire(key: string, create: () => VectorTileSource) {
    const entry = this.entries.get(key) ?? { source: create(), users: 0 }
    entry.users += 1
    this.entries.set(key, entry)
    return {
      source: entry.source,
      release: () => {
        entry.users -= 1
        if (entry.users <= 0) this.entries.delete(key)
      },
    }
  }
}

/**
 * Applies a Mapbox GL style document to the layer: the document is fetched once per page, its
 * layers selected and the overrides applied, then handed to ol-mapbox-style.
 */
async function applyMapboxStyle(
  layer: VectorTileLayer,
  config: VectorTileLayerConfig,
  env: LayerEnvironment,
): Promise<void> {
  const options = config.mapboxStyle!
  const [{ applyStyle }, document] = await Promise.all([
    import('ol-mapbox-style'),
    loadStyleDocument(options.url),
  ])
  const prepared = prepareStyle(document, options.layers, options.overrides, (color) =>
    paint(color, env.theme),
  )
  for (const pattern of prepared.unmatched)
    warnOnce(
      `style-override:${options.url}:${pattern}`,
      `Style override "${pattern}" on ${config.id} matches no layer of the style. Style layer ` +
        `ids: ${document.layers
          .map((item) => item.id)
          .slice(0, 60)
          .join(', ')}`,
    )
  await applyStyle(layer, prepared.style, {
    styleUrl: options.url,
    source: options.source ?? '',
    updateSource: false,
    projection: config.sourceProjection,
    resolutions: config.tileGrid?.resolutions,
  })
  // ol-mapbox-style paints a style's background only for whole maps.
  const background = prepared.style.layers.find(
    (item) => item.type === 'background' && item.layout?.['visibility'] !== 'none',
  )?.paint?.['background-color']
  if (typeof background === 'string') layer.setBackground(background)
}

export function buildVectorTileLayer(
  config: VectorTileLayerConfig,
  env: LayerEnvironment,
  report: LayerReporter,
  pool: SharedSourcePool,
): BuiltLayer {
  const create = () =>
    new VectorTileSource({
      format: new MVT({ idProperty: config.featureIdField }),
      url: withTime(config.url, env.time),
      projection: config.sourceProjection,
      maxZoom: config.maxSourceZoom,
      tileGrid: config.tileGrid ? tileGridFrom(config.tileGrid) : undefined,
      wrapX: config.wrapX,
      attributions: attributionText(config.attribution),
    })
  // A timed source changes its URL, so it can't be shared.
  const shared = config.time
    ? undefined
    : pool.acquire(
        JSON.stringify([
          config.url,
          config.sourceProjection,
          config.maxSourceZoom,
          config.tileGrid,
          config.wrapX,
          config.featureIdField,
        ]),
        create,
      )
  const source = shared?.source ?? create()
  const redrawOn = new Set<LayerDependency>()
  if (config.selectable) redrawOn.add('selection')
  let style
  if (config.style) {
    style = withSelection(
      config,
      env,
      compileThematicStyle(
        config.style,
        () => env.zoom,
        () => env.time,
        config.time,
        () => env.theme,
      ),
    )
    redrawOn.add('theme')
    if (config.time?.mode === 'property') redrawOn.add('time')
    if (hasZoomStops(symbolRules(config.style).map((rule) => rule.symbol))) redrawOn.add('zoom')
  }
  const layer = new VectorTileLayer({ ...layerOptions(config), source, declutter: true, style })
  let disposed = false
  let onTheme: (() => void) | undefined
  if (config.mapboxStyle) {
    const apply = () =>
      applyMapboxStyle(layer, config, env)
        .then(() => {
          if (disposed || !config.selectable) return
          const serviceStyle = layer.getStyleFunction()
          if (serviceStyle) layer.setStyle(withSelection(config, env, serviceStyle))
        })
        .catch((error: unknown) => {
          if (!disposed) report.fail(`Could not load the style for ${config.title}`, error)
        })
    void apply()
    // Override colours written as CSS variables follow the page's light and dark themes.
    if (config.mapboxStyle.overrides?.some((item) => item.color && isCssColor(item.color)))
      onTheme = () => void apply()
  }
  const keys = watchTiles(source, config, report)
  return {
    layer,
    redrawOn,
    ...(onTheme ? { onTheme } : {}),
    ...(config.time?.mode === 'url-template'
      ? { setTime: (time: string | null) => source.setUrl(withTime(config.url, time)) }
      : {}),
    dispose: () => {
      disposed = true
      unByKey(keys)
      shared?.release()
    },
  }
}
