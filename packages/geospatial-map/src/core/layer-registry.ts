// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type Feature from 'ol/Feature.js'
import type { FeatureLike } from 'ol/Feature.js'
import type BaseLayer from 'ol/layer/Base.js'
import type Projection from 'ol/proj/Projection.js'
import { get as getProjection } from 'ol/proj.js'
import type {
  AttributionSpec,
  FeatureCandidate,
  GeoJsonLayerConfig,
  GeoJsonLoader,
  JsonValue,
  LayerStatus,
  MapError,
  MapLayerConfig,
  MapSelection,
  NormalizedLegend,
} from '../types'
import { defaultCanvasTheme } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import { mapError, MapConfigurationError } from './errors'
import { normalizeHeatmapLegend, normalizeLegend } from './legend-model'
import { ensureConfiguredProjection } from './projections'
import { validateLayerConfigs } from './validation'
import { RULE_PROPERTY } from './webgl-style'
import { fingerprint } from '../utils'
import { featureIdOf } from './layers/common'
import type { BuiltLayer, LayerDependency, LayerEnvironment, LayerReporter } from './layers/common'
import { buildWmsLayer, buildWmtsLayer, buildXyzLayer } from './layers/raster-layers'
import { buildGeoJsonLayer, buildHeatmapLayer } from './layers/vector-layer'
import { buildVectorTileLayer, SharedSourcePool } from './layers/vector-tile-layer'

// Keeps one OpenLayers layer per configured layer: builds, rebuilds when the config changes,
// orders, shows and hides them, and reports their statuses, legends and attributions.

type LayerRecord = {
  config: MapLayerConfig
  signature: string
  built: BuiltLayer
  /** Visibility the user or config asked for, before zoom and time limits. */
  baseVisible: boolean
  loading: boolean
  error?: MapError
}

type LayerRegistryCallbacks = {
  loadGeoJson: GeoJsonLoader
  onError: (error: MapError) => void
  onStatus: (status: LayerStatus[]) => void
  onMetric?: (layerId: string, durationMs: number, success: boolean) => void
  /** A layer object was swapped (canvas to WebGL after a large dataset loaded). */
  onLayerReplaced?: () => void
}

export type SvgVectorLayer = {
  config: GeoJsonLayerConfig
  features: Feature[]
}

/**
 * What identifies a built layer: its config without `visible` and `opacity` (applied to the
 * layer as they change), with inline data keyed by identity.
 */
export function configSignature(config: MapLayerConfig): string {
  return fingerprint({ ...config, visible: undefined, opacity: undefined })
}

/** A feature's properties as JSON, without the geometry and the renderer's own fields. */
function jsonProperties(feature: FeatureLike): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(feature.getProperties())) {
    if (key === 'geometry' || key === RULE_PROPERTY || value === undefined) continue
    if (typeof value === 'function') continue
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'getType' in value)
      continue
    result[key] = value as JsonValue
  }
  return result
}

export class LayerRegistry {
  private records = new Map<string, LayerRecord>()
  private readonly env: {
    -readonly [Key in keyof LayerEnvironment]: LayerEnvironment[Key]
  }
  private readonly tiles = new SharedSourcePool()
  private readonly callbacks: LayerRegistryCallbacks

  constructor(projection: Projection, callbacks: LayerRegistryCallbacks, time: string | null) {
    this.callbacks = callbacks
    this.env = {
      projection,
      zoom: 0,
      time,
      selection: null,
      theme: defaultCanvasTheme,
      loadGeoJson: callbacks.loadGeoJson,
    }
  }

  /** Builds, keeps or rebuilds a layer per config; returns them in `configs` order. */
  reconcile(configs: MapLayerConfig[]): BaseLayer[] {
    validateLayerConfigs(configs)
    const next = new Map<string, LayerRecord>()
    for (const config of configs) {
      const existing = this.records.get(config.id)
      const signature = configSignature(config)
      if (existing?.signature === signature) {
        existing.config = config
        if (config.visible !== undefined) existing.baseVisible = config.visible
        existing.built.layer.setOpacity(config.opacity ?? 1)
        next.set(config.id, existing)
      } else {
        existing?.built.dispose?.()
        next.set(config.id, this.create(config, signature))
      }
    }
    for (const [id, record] of this.records) if (!next.has(id)) record.built.dispose?.()
    this.records = next
    configs.forEach((config, index) =>
      this.records.get(config.id)?.built.layer.setZIndex(config.zIndex ?? index),
    )
    this.applyZoom()
    this.emitStatus()
    return this.layersFor(configs)
  }

  /** Rebuilds every layer for another map projection. */
  setProjection(projection: Projection, configs: MapLayerConfig[]): BaseLayer[] {
    this.env.projection = projection
    for (const record of this.records.values()) record.built.dispose?.()
    this.records.clear()
    return this.reconcile(configs)
  }

  setZoom(zoom: number): void {
    if (zoom === this.env.zoom) return
    this.env.zoom = zoom
    this.applyZoom()
    this.redraw('zoom')
    this.emitStatus()
  }

  setTime(time: string | null): void {
    if (time === this.env.time) return
    this.env.time = time
    for (const record of this.records.values()) record.built.setTime?.(time)
    this.applyZoom()
    this.redraw('time')
    this.emitStatus()
  }

  /** Applies new canvas colors and font; redraws only when something changed. */
  setTheme(theme: CanvasTheme): void {
    if (JSON.stringify(theme) === JSON.stringify(this.env.theme)) return
    this.env.theme = theme
    this.redraw('theme')
  }

  setSelection(selection: MapSelection | null): void {
    const previous = this.env.selection
    if (previous?.layerId === selection?.layerId && previous?.featureId === selection?.featureId)
      return
    this.env.selection = selection
    this.redraw('selection')
  }

  setVisibility(layerId: string, visible: boolean): boolean {
    const record = this.records.get(layerId)
    if (!record) return false
    record.baseVisible = visible
    this.applyVisibility(record)
    this.emitStatus()
    return true
  }

  setOpacity(layerId: string, opacity: number): boolean {
    const record = this.records.get(layerId)
    if (!record) return false
    record.built.layer.setOpacity(Math.min(1, Math.max(0, opacity)))
    return true
  }

  getConfig(layerId: string): MapLayerConfig | undefined {
    return this.records.get(layerId)?.config
  }

  getLayer(layerId: string): BaseLayer | undefined {
    return this.records.get(layerId)?.built.layer
  }

  /** Current layer objects for `configs`, in order (after any canvas-to-WebGL swap). */
  layersFor(configs: MapLayerConfig[]): BaseLayer[] {
    return configs.flatMap((config) => this.records.get(config.id)?.built.layer ?? [])
  }

  getBaseVisible(layerId: string): boolean {
    return this.records.get(layerId)?.baseVisible ?? false
  }

  /** A loaded feature of a layer by selection id, when the layer keeps its features. */
  getFeature(layerId: string, featureId: string): FeatureLike | undefined {
    return this.records.get(layerId)?.built.feature?.(featureId)
  }

  /** Visible layers whose images can't be exported. */
  getVisibleNonExportableLayerIds(): string[] {
    return this.visibleRecords()
      .filter((record) => record.config.exportable === false)
      .map((record) => record.config.id)
  }

  getVisibleRequiredStatuses(): LayerStatus[] {
    return this.getStatuses().filter((status) => {
      const record = this.records.get(status.id)
      return Boolean(record?.config.required && record.built.layer.getVisible())
    })
  }

  /** The visible layers as vector features, or `undefined` when one of them is an image. */
  getVisibleVectorLayers(): SvgVectorLayer[] | undefined {
    const visible = this.visibleRecords()
    if (visible.some((record) => record.config.kind !== 'geojson' || !record.built.vectorFeatures))
      return undefined
    return visible.map((record) => ({
      config: record.config as GeoJsonLayerConfig,
      features: record.built.vectorFeatures!(),
    }))
  }

  getStatuses(): LayerStatus[] {
    const { time, zoom } = this.env
    return [...this.records.values()].map(({ config, loading, error }) => ({
      id: config.id,
      loading,
      ...(error ? { error } : {}),
      ...(time && config.time && !config.time.available.includes(time) ? { noData: true } : {}),
      ...(zoom < (config.minZoom ?? -Infinity) || zoom > (config.maxZoom ?? Infinity)
        ? { scaleUnavailable: true }
        : {}),
    }))
  }

  getLegends(): NormalizedLegend[] {
    return [...this.records.values()].flatMap(({ config, baseVisible }) => {
      const legend =
        config.kind === 'heatmap'
          ? normalizeHeatmapLegend(config, baseVisible, this.env.time)
          : normalizeLegend(
              config.id,
              config.title,
              baseVisible,
              'style' in config ? config.style : undefined,
              config.legend,
              this.env.time,
            )
      return legend ? [legend] : []
    })
  }

  getAttributions(): AttributionSpec[] {
    const unique = new Map<string, AttributionSpec>()
    for (const record of this.visibleRecords())
      for (const item of record.config.attribution ?? [])
        unique.set(`${item.label}|${item.url ?? ''}`, item)
    return [...unique.values()]
  }

  /** Selectable features under the pointer, highest `hitPriority` first. */
  candidates(hits: Array<{ feature: FeatureLike; layer: BaseLayer }>): FeatureCandidate[] {
    const result: Array<FeatureCandidate & { priority: number }> = []
    for (const { feature: hit, layer } of hits) {
      // A cluster bubble stands for its points: one point is that feature; more are not
      // selectable (clicking zooms in instead).
      const members = hit.get('features') as FeatureLike[] | undefined
      if (Array.isArray(members) && members.length !== 1) continue
      const layerId = String(layer.get('mapLayerId') ?? '')
      const candidate = this.describe(layerId, Array.isArray(members) ? members[0]! : hit)
      if (candidate)
        result.push({ ...candidate, priority: this.records.get(layerId)!.config.hitPriority ?? 0 })
    }
    return result
      .sort((left, right) => right.priority - left.priority)
      .map(({ priority: _priority, ...candidate }) => candidate)
  }

  /** A selectable feature as a candidate: ids, layer metadata and allowed properties. */
  describe(layerId: string, feature: FeatureLike): FeatureCandidate | undefined {
    const config = this.records.get(layerId)?.config
    if (!config?.selectable) return undefined
    const featureId = featureIdOf(feature, config.featureIdField)
    if (featureId === undefined) {
      this.callbacks.onError(
        mapError(
          'FEATURE_ID_MISSING',
          `A feature in ${config.title} has no "${config.featureIdField ?? 'id'}", so it can't be selected`,
          true,
          config.id,
        ),
      )
      return undefined
    }
    const properties = jsonProperties(feature)
    return {
      layerId,
      featureId,
      ...(config.boundarySetId ? { boundarySetId: config.boundarySetId } : {}),
      ...(config.geographyLevel ? { geographyLevel: config.geographyLevel } : {}),
      title: config.title,
      properties: config.propertyAllowlist
        ? Object.fromEntries(
            config.propertyAllowlist
              .filter((key) => key in properties)
              .map((key) => [key, properties[key]!]),
          )
        : properties,
    }
  }

  destroy(): void {
    for (const record of this.records.values()) record.built.dispose?.()
    this.records.clear()
  }

  private create(config: MapLayerConfig, signature: string): LayerRecord {
    if (config.kind === 'mvt' && config.sourceProjectionDefinition)
      ensureConfiguredProjection(config.sourceProjectionDefinition)
    if ('sourceProjection' in config && !getProjection(config.sourceProjection))
      throw new MapConfigurationError(
        `Layer ${config.id} uses unsupported source projection ${config.sourceProjection}`,
        config.id,
      )
    const record = {
      config,
      signature,
      baseVisible: config.visible ?? true,
      loading: false,
    } as LayerRecord
    const report: LayerReporter = {
      loading: (loading) => {
        record.loading = loading
        if (!loading) delete record.error
        this.emitStatus()
      },
      fail: (message, cause) => {
        record.loading = false
        record.error = mapError('SOURCE_LOAD_FAILED', message, !config.required, config.id, cause)
        this.callbacks.onError(record.error)
        this.emitStatus()
      },
      metric: (durationMs, success) => this.callbacks.onMetric?.(config.id, durationMs, success),
      replaced: () => {
        if (this.records.get(config.id) === record) this.callbacks.onLayerReplaced?.()
      },
    }
    record.built = this.build(config, report)
    return record
  }

  private build(config: MapLayerConfig, report: LayerReporter): BuiltLayer {
    switch (config.kind) {
      case 'geojson':
        return buildGeoJsonLayer(config, this.env, report)
      case 'heatmap':
        return buildHeatmapLayer(config, this.env, report)
      case 'mvt':
        return buildVectorTileLayer(config, this.env, report, this.tiles)
      case 'xyz':
        return buildXyzLayer(config, this.env, report)
      case 'wms':
        return buildWmsLayer(config, this.env, report)
      case 'wmts':
        return buildWmtsLayer(config, this.env, report)
      case 'arcgis-vector-tiles':
        // Resolved to an `mvt` layer from the service metadata before the map is created.
        throw new MapConfigurationError(
          `ArcGIS layer ${config.id} was not resolved from its service`,
          config.id,
        )
    }
  }

  /** Redraws the layers that depend on `change`, through their own hook when they have one. */
  private redraw(change: LayerDependency): void {
    for (const { built } of this.records.values()) {
      const hook =
        change === 'selection' ? built.onSelection : change === 'theme' ? built.onTheme : undefined
      if (hook) hook()
      else if (built.redrawOn.has(change)) built.layer.changed()
    }
  }

  private visibleRecords(): LayerRecord[] {
    return [...this.records.values()].filter((record) => record.built.layer.getVisible())
  }

  private applyZoom(): void {
    for (const record of this.records.values()) {
      this.applyVisibility(record)
      record.built.onZoom?.(this.env.zoom)
    }
  }

  /** Shown when asked for, within its zoom range, and with data for the current time. */
  private applyVisibility(record: LayerRecord): void {
    const { config } = record
    const { zoom, time } = this.env
    const inRange =
      (config.minZoom === undefined || zoom >= config.minZoom) &&
      (config.maxZoom === undefined || zoom <= config.maxZoom)
    const hasFrame =
      !time ||
      !config.time ||
      config.time.available.includes(time) ||
      config.time.missingPolicy === 'retain-last'
    record.built.layer.setVisible(record.baseVisible && inRange && hasFrame)
  }

  private emitStatus(): void {
    this.callbacks.onStatus(this.getStatuses())
  }
}
