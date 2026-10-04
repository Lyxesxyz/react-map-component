// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { FeatureCollection } from 'geojson'
import GeoJSON from 'ol/format/GeoJSON.js'
import type VectorSource from 'ol/source/Vector.js'
import proj4 from 'proj4'
import type { GeoJsonLayerConfig, HeatmapLayerConfig } from '../../types'
import { warnOnce } from '../../utils'
import { loadBuiltinGeoJson } from '../builtin-data'
import { rowsToFeatureCollection } from '../data-sources'
import { diagnoseLayerData } from '../diagnostics'
import { splitAtSeam } from '../seam'
import { nextFrame, timeMode, withTime } from '../time'
import type { LayerEnvironment, LayerReporter } from './common'

// Fills a vector source from a layer's `data`: a URL (through `loadGeoJson`, reloaded per time
// frame when the URL has `{time}`), built-in boundaries, rows with coordinates, or inline GeoJSON.
// Only the latest load is shown: a slower earlier one, or one finishing after the layer was
// removed, is dropped.

export type VectorData = {
  /** Loads the frame's data, when the URL has `{time}`. */
  setTime?(time: string | null): void
  dispose(): void
}

/** Longitude of the map projection's centre; its seam is 180° away. */
function centralMeridian(env: LayerEnvironment): number {
  const definition = proj4.defs(env.projection.getCode()) as { long0?: number } | undefined
  return ((definition?.long0 ?? 0) * 180) / Math.PI
}

/**
 * Ids for selection: the `featureIdField` value, else the GeoJSON id, else the feature's
 * position in the data (stable as long as the data is).
 */
function setFeatureIds(source: VectorSource, idField: string | undefined): void {
  source.getFeatures().forEach((feature, index) => {
    const id = idField ? feature.get(idField) : undefined
    if (id !== undefined && id !== null) feature.setId(String(id))
    else if (feature.getId() === undefined) feature.setId(String(index))
  })
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * Loads `config.data` into `source`. `onLoaded` runs after each load that is shown (inline data
 * loads before this returns).
 */
export function loadVectorData(
  config: GeoJsonLayerConfig | HeatmapLayerConfig,
  source: VectorSource,
  env: LayerEnvironment,
  report: LayerReporter,
  onLoaded: () => void,
): VectorData {
  const format = new GeoJSON()
  /** Increases with every load and on dispose; a result is shown only if it is still current. */
  let generation = 0
  const show = (data: FeatureCollection) => {
    for (const hint of diagnoseLayerData(config, data)) warnOnce(`data:${config.id}:${hint}`, hint)
    const lonLat = !config.sourceProjection || config.sourceProjection === 'EPSG:4326'
    source.clear(true)
    source.addFeatures(
      format.readFeatures(lonLat ? splitAtSeam(data, centralMeridian(env)) : data, {
        dataProjection: config.sourceProjection ?? 'EPSG:4326',
        featureProjection: env.projection,
      }),
    )
    setFeatureIds(source, 'featureIdField' in config ? config.featureIdField : undefined)
    onLoaded()
  }
  /** Shows the result of `load` unless a newer load (or dispose) came first. */
  const run = (load: () => Promise<FeatureCollection>, onFailed?: () => void) => {
    const current = ++generation
    const startedAt = performance.now()
    report.loading(true)
    load().then(
      (collection) => {
        if (current !== generation) return
        show(collection)
        report.loading(false)
        report.metric(performance.now() - startedAt, true)
      },
      (error: unknown) => {
        if (current !== generation || isAbort(error)) return
        onFailed?.()
        report.metric(performance.now() - startedAt, false)
        report.fail(`Could not load ${config.title}: ${reason(error)}`, error)
      },
    )
  }
  const dispose = () => {
    generation += 1
  }
  const data = config.data

  if ('url' in data) {
    const { url, format: dataFormat, longitude, latitude } = data
    const options = {
      layerId: config.id,
      ...(dataFormat ? { format: dataFormat } : {}),
      ...(longitude ? { longitude } : {}),
      ...(latitude ? { latitude } : {}),
    }
    const timed = timeMode(config) === 'url'
    let abort: AbortController | undefined
    let shownTime: string | null | undefined
    const load = (time: string | null) => {
      if (time === shownTime) return
      shownTime = time
      abort?.abort()
      const controller = new AbortController()
      abort = controller
      run(
        async () => {
          const collection = await env.loadGeoJson(withTime(url, time), {
            ...options,
            signal: controller.signal,
          })
          // Load the next frame ahead, so playback doesn't wait for it.
          const next = timed ? nextFrame(config, time) : undefined
          if (next !== undefined)
            void env
              .loadGeoJson(withTime(url, next), { ...options, prefetch: true })
              .catch(() => undefined)
          return collection
        },
        // A failed frame is requested again the next time it is shown.
        () => {
          if (shownTime === time) shownTime = undefined
        },
      )
    }
    load(env.time)
    return {
      ...(timed ? { setTime: load } : {}),
      dispose: () => {
        dispose()
        abort?.abort()
      },
    }
  }

  if ('builtin' in data) run(() => loadBuiltinGeoJson(data))
  else if ('rows' in data) {
    try {
      show(rowsToFeatureCollection(data.rows, data, config.id))
    } catch (error) {
      report.fail(`Could not read the rows of ${config.title}: ${reason(error)}`, error)
    }
  } else show(data)
  return { dispose }
}
