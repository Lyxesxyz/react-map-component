// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import type Feature from 'ol/Feature.js'
import type { FeatureLike } from 'ol/Feature.js'
import { createEmpty, extend, isEmpty } from 'ol/extent.js'
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
import { normalizeLegend } from './legend-model'
import { ensureConfiguredProjection } from './projections'
import { hasFrame } from './time'
import { validateLayerConfigs } from './validation'
import { RULE_PROPERTY } from './webgl-style'
import { fingerprint } from '../utils'
import { featureIdOf, sameSelection, uniqueAttributions } from './layers/common'
import type { BuiltLayer, LayerChange, LayerEnvironment, LayerReporter } from './layers/common'
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
  /** A feature without an id was reported (once per layer). */
  missingIdReported?: boolean
}

type LayerRegistryCallbacks = {
  loadGeoJson: GeoJsonLoader
  onError: (error: MapError) => void
  onStatus: (status: LayerStatus[]) => void
  onMetric?: (layerId: string, durationMs: number, success: boolean) => void
  /** A layer object was swapped (canvas to WebGL after a large dataset loaded). */
  onLayerReplaced?: () => void
}

/** A visible vector layer the SVG export can draw: its features and its opacity. */
export type SvgVectorLayer = {
  config: GeoJsonLayerConfig
  features: Feature[]
  opacity: number
}

/** A selectable feature under the pointer, and the feature itself. */
export type FeatureHit = { candidate: FeatureCandidate; feature: FeatureLike }

/**
 * What identifies a built layer: its config without `visible` and `opacity` (applied to the
 * layer as they change), with inline data keyed by identity.
 */
export function configSignature(config: MapLayerConfig): string {
  return fingerprint({ ...config, visible: undefined, opacity: undefined })
}

/** Whether `zoom` is within the layer's `minZoom`–`maxZoom`. */
function inZoomRange(config: MapLayerConfig, zoom: number): boolean {
  return zoom >= (config.minZoom ?? -Infinity) && zoom <= (config.maxZoom ?? Infinity)
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

function disposeBuilt(built: BuiltLayer): void {
  built.dispose?.()
  built.layer.dispose()
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

  /**
   * Builds, keeps or rebuilds a layer per config; returns them in `configs` order (the drawing
   * order). If a layer can't be built, nothing changes and the error is thrown.
   */
  reconcile(configs: MapLayerConfig[]): BaseLayer[] {
    validateLayerConfigs(configs)
    const next = new Map<string, LayerRecord>()
    const created: LayerRecord[] = []
    try {
      for (const config of configs) {
        const existing = this.records.get(config.id)
        const signature = configSignature(config)
        if (existing?.signature === signature) {
          existing.config = config
          existing.baseVisible = config.visible ?? true
          existing.built.layer.setOpacity(config.opacity ?? 1)
          next.set(config.id, existing)
        } else {
          const record = this.create(config, signature)
          created.push(record)
          next.set(config.id, record)
        }
      }
    } catch (cause) {
      for (const record of created) disposeBuilt(record.built)
      throw cause
    }
    for (const [id, record] of this.records) if (next.get(id) !== record) disposeBuilt(record.built)
    this.records = next
    configs.forEach((config, index) => next.get(config.id)!.built.layer.setZIndex(index))
    for (const record of next.values()) this.applyVisibility(record)
    this.emitStatus()
    return this.layers()
  }

  setZoom(zoom: number): void {
    if (zoom === this.env.zoom) return
    this.env.zoom = zoom
    this.update('zoom')
    this.emitStatus()
  }

  setTime(time: string | null): void {
    if (time === this.env.time) return
    this.env.time = time
    this.update('time')
    this.emitStatus()
  }

  /** Applies new canvas colors and font; redraws only when something changed. */
  setTheme(theme: CanvasTheme): void {
    if (JSON.stringify(theme) === JSON.stringify(this.env.theme)) return
    this.env.theme = theme
    this.update('theme')
  }

  setSelection(selection: MapSelection | null): void {
    if (sameSelection(selection, this.env.selection)) return
    this.env.selection = selection
    this.update('selection')
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

  getOpacity(layerId: string): number {
    return this.records.get(layerId)?.built.layer.getOpacity() ?? 1
  }

  /** The current layer objects in drawing order (after any canvas-to-WebGL swap). */
  layers(): BaseLayer[] {
    return [...this.records.values()].map((record) => record.built.layer)
  }

  getBaseVisible(layerId: string): boolean {
    return this.records.get(layerId)?.baseVisible ?? false
  }

  /** A loaded feature of a layer by selection id, when the layer keeps its features. */
  getFeature(layerId: string, featureId: string): FeatureLike | undefined {
    return this.records.get(layerId)?.built.feature?.(featureId)
  }

  /** The combined extent of the loaded features of the visible layers among `layerIds`. */
  dataExtent(layerIds: Iterable<string>): number[] | undefined {
    const extent = createEmpty()
    for (const id of layerIds) {
      const record = this.records.get(id)
      if (!record?.built.layer.getVisible()) continue
      const layerExtent = record.built.extent?.()
      if (layerExtent) extend(extent, layerExtent)
    }
    return isEmpty(extent) ? undefined : extent
  }

  /** Visible layers whose images can't be exported. */
  getVisibleNonExportableLayerIds(): string[] {
    return this.visibleRecords()
      .filter((record) => record.config.exportable === false)
      .map((record) => record.config.id)
  }

  /** The statuses of the visible layers, with whether each is `required`. */
  getVisibleStatuses(): Array<LayerStatus & { required: boolean }> {
    return this.visibleRecords().map((record) => ({
      ...this.statusOf(record),
      required: record.config.required === true,
    }))
  }

  /** The visible layers as vector features, or `undefined` when one of them is an image. */
  getVisibleVectorLayers(): SvgVectorLayer[] | undefined {
    const visible = this.visibleRecords()
    if (visible.some((record) => record.config.kind !== 'geojson' || !record.built.vectorFeatures))
      return undefined
    return visible.map((record) => ({
      config: record.config as GeoJsonLayerConfig,
      features: record.built.vectorFeatures!(),
      opacity: record.built.layer.getOpacity(),
    }))
  }

  getStatuses(): LayerStatus[] {
    return [...this.records.values()].map((record) => this.statusOf(record))
  }

  getLegends(): NormalizedLegend[] {
    return [...this.records.values()].flatMap(({ config, baseVisible }) => {
      const legend = normalizeLegend(config, baseVisible, this.env.time)
      return legend ? [legend] : []
    })
  }

  getAttributions(): AttributionSpec[] {
    return uniqueAttributions(
      this.visibleRecords().flatMap((record) => record.config.attribution ?? []),
    )
  }

  /** The selectable features among `hits` (top-most first), each described once. */
  candidates(hits: Array<{ feature: FeatureLike; layer: BaseLayer }>): FeatureHit[] {
    const result: FeatureHit[] = []
    const seen = new Set<string>()
    for (const { feature: hit, layer } of hits) {
      // A cluster bubble stands for its points: one point is that feature; more are not
      // selectable (clicking zooms in instead).
      const members = hit.get('features') as FeatureLike[] | undefined
      if (Array.isArray(members) && members.length !== 1) continue
      const feature = Array.isArray(members) ? members[0]! : hit
      const candidate = this.describe(String(layer.get('mapLayerId') ?? ''), feature)
      const key = candidate && `${candidate.layerId}\n${candidate.featureId}`
      if (!candidate || seen.has(key!)) continue
      seen.add(key!)
      result.push({ candidate, feature })
    }
    return result
  }

  /** A selectable feature as a candidate: ids, layer title and allowed properties. */
  describe(layerId: string, feature: FeatureLike): FeatureCandidate | undefined {
    const record = this.records.get(layerId)
    const config = record?.config
    if (!config || !('selectable' in config) || !config.selectable) return undefined
    const featureId = featureIdOf(feature, config.featureIdField)
    if (featureId === undefined) {
      if (!record.missingIdReported) {
        record.missingIdReported = true
        this.callbacks.onError(
          mapError(
            'FEATURE_ID_MISSING',
            `A feature in ${config.title} has no "${config.featureIdField ?? 'id'}", so it can't be selected`,
            true,
            config.id,
          ),
        )
      }
      return undefined
    }
    const properties = jsonProperties(feature)
    return {
      layerId,
      featureId,
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
    for (const record of this.records.values()) disposeBuilt(record.built)
    this.records.clear()
  }

  private create(config: MapLayerConfig, signature: string): LayerRecord {
    if (config.kind === 'mvt' && config.sourceProjectionDefinition)
      ensureConfiguredProjection(config.sourceProjectionDefinition)
    if (
      'sourceProjection' in config &&
      config.sourceProjection &&
      !getProjection(config.sourceProjection)
    )
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
    const active = () => this.records.get(config.id) === record
    const report: LayerReporter = {
      loading: (loading) => {
        record.loading = loading
        if (!loading) delete record.error
        if (active()) this.emitStatus()
      },
      fail: (message, cause) => {
        record.loading = false
        record.error = mapError('SOURCE_LOAD_FAILED', message, !config.required, config.id, cause)
        if (!active()) return
        this.callbacks.onError(record.error)
        this.emitStatus()
      },
      metric: (durationMs, success) => this.callbacks.onMetric?.(config.id, durationMs, success),
      replaced: (next) => {
        const previous = record.built.layer
        next.layer.setOpacity(previous.getOpacity())
        next.layer.setZIndex(previous.getZIndex() ?? 0)
        record.built = next
        this.applyVisibility(record)
        previous.dispose()
        if (active()) this.callbacks.onLayerReplaced?.()
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

  /** Tells every layer the map state changed; zoom and time also change what is shown. */
  private update(change: LayerChange): void {
    for (const record of this.records.values()) {
      record.built.update(change)
      if (change === 'zoom' || change === 'time') this.applyVisibility(record)
    }
  }

  private statusOf({ config, loading, error }: LayerRecord): LayerStatus {
    return {
      id: config.id,
      loading,
      ...(error ? { error } : {}),
      ...(hasFrame(config, this.env.time) ? {} : { noData: true }),
      ...(inZoomRange(config, this.env.zoom) ? {} : { scaleUnavailable: true }),
    }
  }

  private visibleRecords(): LayerRecord[] {
    return [...this.records.values()].filter((record) => record.built.layer.getVisible())
  }

  /** Shown when asked for, within its zoom range, and with data for the current time. */
  private applyVisibility(record: LayerRecord): void {
    const { config } = record
    record.built.layer.setVisible(
      record.baseVisible && inZoomRange(config, this.env.zoom) && hasFrame(config, this.env.time),
    )
  }

  private emitStatus(): void {
    this.callbacks.onStatus(this.getStatuses())
  }
}
