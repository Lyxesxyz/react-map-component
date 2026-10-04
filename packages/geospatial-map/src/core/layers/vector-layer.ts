// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { FeatureLike } from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import type BaseLayer from 'ol/layer/Base.js'
import HeatmapLayer from 'ol/layer/Heatmap.js'
import VectorLayer from 'ol/layer/Vector.js'
import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import Cluster from 'ol/source/Cluster.js'
import VectorSource from 'ol/source/Vector.js'
import type { GeoJsonLayerConfig, HeatmapLayerConfig } from '../../types'
import { defaultHeatmapGradient } from '../legend-model'
import {
  clusterStyle,
  compileThematicStyle,
  featureVisibleAtTime,
  interpolateStops,
} from '../style-compiler'
import { symbolRules } from '../symbol-rules'
import {
  compileWebglStyle,
  ruleStamper,
  WEBGL_AUTO_THRESHOLD,
  webglUnsupportedReason,
} from '../webgl-style'
import { attributionText, hasZoomStops, layerOptions, withSelection } from './common'
import type { BuiltLayer, LayerDependency, LayerEnvironment, LayerReporter } from './common'
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
export function hasHardwareWebgl(): boolean {
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

export function normalizeHeatmapWeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}

function newSource(config: GeoJsonLayerConfig | HeatmapLayerConfig) {
  return new VectorSource({ attributions: attributionText(config.attribution), wrapX: false })
}

export function buildHeatmapLayer(
  config: HeatmapLayerConfig,
  env: LayerEnvironment,
  report: LayerReporter,
): BuiltLayer {
  const source = newSource(config)
  const data = loadVectorData(config, source, env, report, () => undefined)
  const weightField = config.weightField ?? 'weight'
  const radius = (zoom: number) =>
    interpolateStops(config.radiusStops, zoom, config.radius ?? DEFAULT_HEATMAP_RADIUS)
  const blur = (zoom: number) =>
    interpolateStops(config.blurStops, zoom, config.blur ?? DEFAULT_HEATMAP_BLUR)
  const layer = new HeatmapLayer({
    ...layerOptions(config),
    source,
    gradient: config.gradient ?? defaultHeatmapGradient,
    radius: radius(env.zoom),
    blur: blur(env.zoom),
    weight: (feature) =>
      featureVisibleAtTime(feature, env.time, config.time)
        ? normalizeHeatmapWeight(feature.get(weightField))
        : 0,
  })
  return {
    layer,
    redrawOn: new Set(config.time?.mode === 'property' ? ['time'] : []),
    onZoom: (zoom) => {
      layer.setRadius(radius(zoom))
      layer.setBlur(blur(zoom))
    },
    ...(data.setTime ? { setTime: data.setTime } : {}),
    dispose: data.dispose,
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

  const thematic = compileThematicStyle(
    config.style,
    () => env.zoom,
    () => env.time,
    config.time,
    () => env.theme,
  )
  const canvasStyle = withSelection(config, env, thematic)
  const redrawOn = new Set<LayerDependency>(['theme'])
  if (config.selectable) redrawOn.add('selection')
  if (config.time?.mode === 'property') redrawOn.add('time')
  if (hasZoomStops(symbolRules(config.style).map((rule) => rule.symbol))) redrawOn.add('zoom')
  const base: Omit<BuiltLayer, 'layer'> = {
    redrawOn,
    feature: (featureId) => source.getFeatureById(featureId) ?? undefined,
    ...(data.setTime ? { setTime: data.setTime } : {}),
  }

  if (config.cluster) {
    const clusters = new Cluster({
      source,
      distance: config.cluster.distance ?? DEFAULT_CLUSTER_DISTANCE,
      minDistance: config.cluster.minDistance ?? 0,
      wrapX: false,
      geometryFunction: (feature) => {
        const geometry = feature.getGeometry()
        return geometry instanceof Point && featureVisibleAtTime(feature, env.time, config.time)
          ? geometry
          : null
      },
    })
    const layer = new VectorLayer({
      ...layerOptions(config),
      source: clusters,
      style: (cluster) => {
        const members = cluster.get('features') as FeatureLike[] | undefined
        if (!members?.length) return undefined
        return members.length === 1
          ? canvasStyle(members[0]!)
          : clusterStyle(members.length, env.theme)
      },
    })
    return {
      ...base,
      layer,
      // Time filters which points are clustered.
      ...(config.time?.mode === 'property' ? { setTime: () => clusters.refresh() } : {}),
      dispose: data.dispose,
    }
  }

  // Not clustered: the SVG export can draw the features as vectors.
  Object.assign(base, { vectorFeatures: () => source.getFeatures() })
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

  const gpuLayer = (from?: BaseLayer): BuiltLayer => {
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
    if (from) {
      layer.setOpacity(from.getOpacity())
      layer.setVisible(from.getVisible())
      layer.setZIndex(from.getZIndex() ?? 0)
    }
    return {
      ...base,
      layer,
      // The GPU style reads zoom and selection itself; only the theme needs a new style.
      redrawOn: new Set(),
      onSelection: () => layer.updateStyleVariables({ selectedId: selectedId() }),
      onTheme: () => layer.setStyle(compileWebglStyle(config, env.theme)),
      dispose: () => {
        data.dispose()
        // WebGL layers hold a GPU context until disposed.
        layer.dispose()
      },
    }
  }

  const built: BuiltLayer = wantsGpu()
    ? gpuLayer()
    : {
        ...base,
        layer: new VectorLayer({ ...layerOptions(config), source, style: canvasStyle }),
        dispose: data.dispose,
      }
  if (gpuAllowed && renderer === 'auto')
    upgrade = () => {
      if (built.layer instanceof WebGLVectorLayer || !wantsGpu()) return
      const previous = built.layer
      const next = gpuLayer(previous)
      Object.assign(built, next)
      previous.dispose()
      report.replaced(next.layer)
    }
  return built
}
