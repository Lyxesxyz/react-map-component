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
import { followingTimes, withTime } from './common'
import type { LayerEnvironment, LayerReporter } from './common'

// Fills a vector source from a layer's `data`: a URL (through `loadGeoJson`, reloaded per time
// frame when the URL has `{time}`), built-in boundaries, rows with coordinates, or inline GeoJSON.

export type VectorData = {
  /** Present when the data changes with the time frame. */
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
 * Loads `config.data` into `source`. `onLoaded` runs after each load (inline data loads before
 * this returns).
 */
export function loadVectorData(
  config: GeoJsonLayerConfig | HeatmapLayerConfig,
  source: VectorSource,
  env: LayerEnvironment,
  report: LayerReporter,
  onLoaded: () => void,
): VectorData {
  const format = new GeoJSON()
  let disposed = false
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
    setFeatureIds(source, config.featureIdField)
    onLoaded()
  }
  const data = config.data

  if ('url' in data) {
    const { url, format: dataFormat, longitude, latitude } = data
    const options = {
      ...(dataFormat ? { format: dataFormat } : {}),
      ...(longitude ? { longitude } : {}),
      ...(latitude ? { latitude } : {}),
    }
    let abort: AbortController | undefined
    let loadedTime: string | null | undefined
    const load = (time: string | null) => {
      if (time === loadedTime) return
      loadedTime = time
      abort?.abort()
      abort = new AbortController()
      const startedAt = performance.now()
      report.loading(true)
      env
        .loadGeoJson(withTime(url, time), { ...options, signal: abort.signal })
        .then((collection) => {
          show(collection)
          report.loading(false)
          report.metric(performance.now() - startedAt, true)
          for (const next of followingTimes(config.time, time))
            void env
              .loadGeoJson(withTime(url, next), { ...options, prefetch: true })
              .catch(() => undefined)
        })
        .catch((error: unknown) => {
          if (isAbort(error) || disposed) return
          report.metric(performance.now() - startedAt, false)
          report.fail(`Could not load ${config.title}: ${reason(error)}`, error)
        })
    }
    load(env.time)
    const timed = config.time?.mode === 'source-replacement' || config.time?.mode === 'url-template'
    return {
      ...(timed ? { setTime: load } : {}),
      dispose: () => {
        disposed = true
        abort?.abort()
      },
    }
  }

  if ('builtin' in data) {
    report.loading(true)
    loadBuiltinGeoJson(data)
      .then((collection) => {
        if (disposed) return
        show(collection)
        report.loading(false)
      })
      .catch((error: unknown) => {
        if (!disposed) report.fail(`Could not load ${config.title}: ${reason(error)}`, error)
      })
  } else if ('rows' in data) {
    try {
      show(rowsToFeatureCollection(data.rows, data, config.id))
    } catch (error) {
      report.fail(`Could not read the rows of ${config.title}: ${reason(error)}`, error)
    }
  } else show(data)
  return {
    dispose: () => {
      disposed = true
    },
  }
}
