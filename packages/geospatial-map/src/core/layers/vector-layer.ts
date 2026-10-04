// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { FeatureLike } from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import HeatmapLayer from 'ol/layer/Heatmap.js'
import VectorLayer from 'ol/layer/Vector.js'
import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import Cluster from 'ol/source/Cluster.js'
import VectorSource from 'ol/source/Vector.js'
import type { GeoJsonLayerConfig, HeatmapLayerConfig } from '../../types'
import { defaultHeatmapGradient } from '../legend-model'
import { clusterStyle } from '../style-compiler'
import { interpolateStops } from '../symbols'
import { frameFilter } from '../time'
import {
  compileWebglStyle,
  ruleStamper,
  WEBGL_AUTO_THRESHOLD,
  webglUnsupportedReason,
} from '../webgl-style'
import { attributionText, layerOptions, redrawOn, thematicLayerStyle } from './common'
import type { BuiltLayer, LayerChange, LayerEnvironment, LayerReporter } from './common'
import { loadVectorData } from './vector-data'

// GeoJSON layers (canvas, GPU or clustered) and heatmaps.

const DEFAULT_CLUSTER_DISTANCE = 40
const DEFAULT_HEATMAP_RADIUS = 8
const DEFAULT_HEATMAP_BLUR = 15

let hardwareWebgl: boolean | undefined

/**
 * Whether the browser draws WebGL on a real GPU. Software rasterizers (SwiftShader, llvmpipe,
 * Microsoft Basic Render: virtual desktops, blocklisted drivers, servers) make the WebGL renderer
 * many times slower than the canvas, so `renderer: 'auto'` only picks WebGL on hardware.
 */
function hasHardwareWebgl(): boolean {
  if (hardwareWebgl !== undefined) return hardwareWebgl
  hardwareWebgl = false
  if (typeof document === 'undefined') return hardwareWebgl
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext('webgl', {
        failIfMajorPerformanceCaveat: true,
      })) as WebGLRenderingContext | null
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = String(
        gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '',
      )
      hardwareWebgl = !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    hardwareWebgl = false
  }
  return hardwareWebgl
}

function onlyPoints(source: VectorSource): boolean {
  return source.getFeatures().every((feature) => {
    const type = feature.getGeometry()?.getType()
    return type === 'Point' || type === 'MultiPoint'
  })
}

/** A feature's heat contribution: its weight from 0 to 1, or 1 when it has none. */
function heatmapWeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}

function newSource(config: GeoJsonLayerConfig | HeatmapLayerConfig) {
  return new VectorSource({ attributions: attributionText(config.attribution), wrapX: false })
}

/** What every vector layer offers: its features, their extent, and the data to release. */
function vectorParts(source: VectorSource, dispose: () => void) {
  return {
    feature: (featureId: string) => source.getFeatureById(featureId) ?? undefined,
    extent: () => (source.getFeatures().length ? [...source.getExtent()!] : undefined),
    dispose,
  }
}

export function buildHeatmapLayer(
  config: HeatmapLayerConfig,
  env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const source = newSource(config)
  const data = loadVectorData(config, source, env, report, () => undefined)
  const weightField = config.weightField ?? 'weight'
  const include = frameFilter(config, () => env.time)
  const weight = (feature: FeatureLike) =>
    include && !include(feature) ? 0 : heatmapWeight(feature.get(weightField))
  const radius = () =>
    interpolateStops(config.radiusStops, env.zoom, config.radius ?? DEFAULT_HEATMAP_RADIUS)
  const blur = () =>
    interpolateStops(config.blurStops, env.zoom, config.blur ?? DEFAULT_HEATMAP_BLUR)
  const layer = new HeatmapLayer({
    ...layerOptions(config),
    source,
    gradient: config.gradient ?? defaultHeatmapGradient,
    radius: radius(),
    blur: blur(),
    weight,
  })
  return {
    ...vectorParts(source, data.dispose),
    layer,
    update: (change) => {
      if (change === 'zoom') {
        layer.setRadius(radius())
        layer.setBlur(blur())
      } else if (change === 'time') {
        data.setTime?.(env.time)
        // The GPU keeps each feature's weight; setting the weight again rebuilds them.
        if (include) layer.setWeight(weight)
      }
    },
  }
}

export function buildGeoJsonLayer(
  config: GeoJsonLayerConfig,
  env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const source = newSource(config)
  // Inline data loads before the layer is chosen; URL data later, and may switch it to the GPU.
  let upgrade: () => void = () => undefined
  const data = loadVectorData(config, source, env, report, () => upgrade())
  const { style, changes } = thematicLayerStyle(config, config.style, env)
  const include = frameFilter(config, () => env.time)
  const parts = vectorParts(source, data.dispose)
  const timeData = (change: LayerChange) => {
    if (change === 'time') data.setTime?.(env.time)
  }

  if (config.cluster) {
    const clusters = new Cluster({
      source,
      distance: config.cluster.distance ?? DEFAULT_CLUSTER_DISTANCE,
      minDistance: config.cluster.minDistance ?? 0,
      wrapX: false,
      geometryFunction: (feature) => {
        const geometry = feature.getGeometry()
        return geometry instanceof Point && (!include || include(feature)) ? geometry : null
      },
    })
    const layer = new VectorLayer({
      ...layerOptions(config),
      source: clusters,
      style: (cluster) => {
        const members = cluster.get('features') as FeatureLike[] | undefined
        if (!members?.length) return undefined
        return members.length === 1 ? style(members[0]!) : clusterStyle(members.length, env.theme)
      },
    })
    const redraw = redrawOn(layer, changes)
    return {
      ...parts,
      layer,
      update: (change) => {
        timeData(change)
        // Time filters which points are clustered.
        if (change === 'time' && include) clusters.refresh()
        redraw(change)
      },
    }
  }

  const canvasLayer = (): BuiltLayer => {
    const layer = new VectorLayer({ ...layerOptions(config), source, style })
    const redraw = redrawOn(layer, changes)
    return {
      ...parts,
      layer,
      // Not clustered: the SVG export can draw the features as vectors.
      vectorFeatures: () => source.getFeatures(),
      update: (change) => {
        timeData(change)
        redraw(change)
      },
    }
  }

  const renderer = config.renderer ?? 'auto'
  const gpuAllowed = renderer !== 'canvas' && !webglUnsupportedReason(config)
  const wantsGpu = () =>
    gpuAllowed &&
    (renderer === 'webgl' ||
      (source.getFeatures().length >= WEBGL_AUTO_THRESHOLD &&
        onlyPoints(source) &&
        hasHardwareWebgl()))
  const selectedId = () => (env.selection?.layerId === config.id ? env.selection.featureId : '')
  const stamp = ruleStamper(config.style)
  let stamping = false

  const gpuLayer = (): BuiltLayer => {
    source.getFeatures().forEach(stamp)
    if (!stamping) {
      stamping = true
      source.on('addfeature', (event) => event.feature && stamp(event.feature))
    }
    const layer = new WebGLVectorLayer({
      ...layerOptions(config),
      source,
      style: compileWebglStyle(config, env.theme),
      variables: { selectedId: selectedId() },
    })
    return {
      ...parts,
      layer,
      vectorFeatures: () => source.getFeatures(),
      // The GPU style reads zoom itself; selection is a style variable; the theme a new style.
      update: (change) => {
        timeData(change)
        if (change === 'selection') layer.updateStyleVariables({ selectedId: selectedId() })
        if (change === 'theme') layer.setStyle(compileWebglStyle(config, env.theme))
      },
    }
  }

  let built = wantsGpu() ? gpuLayer() : canvasLayer()
  if (gpuAllowed && renderer === 'auto')
    upgrade = () => {
      if (built.layer instanceof WebGLVectorLayer || !wantsGpu()) return
      built = gpuLayer()
      report.replaced(built)
    }
  return built
}
