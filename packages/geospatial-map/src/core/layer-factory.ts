import type { FeatureCollection } from 'geojson'
import Feature from 'ol/Feature.js'
import type { FeatureLike } from 'ol/Feature.js'
import type ImageTile from 'ol/ImageTile.js'
import type Tile from 'ol/Tile.js'
import type TileSource from 'ol/source/Tile.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import MVT from 'ol/format/MVT.js'
import type BaseLayer from 'ol/layer/Base.js'
import Point from 'ol/geom/Point.js'
import HeatmapLayer from 'ol/layer/Heatmap.js'
import TileLayer from 'ol/layer/Tile.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import WebGLVectorLayer from 'ol/layer/WebGLVector.js'
import Cluster from 'ol/source/Cluster.js'
import type Projection from 'ol/proj/Projection.js'
import VectorSource from 'ol/source/Vector.js'
import VectorTileSource from 'ol/source/VectorTile.js'
import TileWMS from 'ol/source/TileWMS.js'
import WMTS from 'ol/source/WMTS.js'
import XYZ from 'ol/source/XYZ.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'
import TileState from 'ol/TileState.js'
import type { EventsKey } from 'ol/events.js'
import { unByKey } from 'ol/Observable.js'
import { get as getProjection } from 'ol/proj.js'
import { mapError, MapConfigurationError } from './errors'
import { defaultHeatmapGradient, normalizeHeatmapLegend, normalizeLegend } from './legend-model'
import { ensureConfiguredProjection } from './projections'
import {
  clusterStyle,
  compileThematicStyle,
  featureVisibleAtTime,
  interpolateStops,
  selectionStyleForGeometry,
} from './style-compiler'
import { compileWebglStyle, WEBGL_AUTO_THRESHOLD, webglUnsupportedReason } from './webgl-style'
import proj4 from 'proj4'
import { loadBuiltinGeoJson } from './builtin-data'
import { diagnoseLayerData } from './diagnostics'
import { splitAtSeam } from './seam'
import { fetchGeoJson, rowsToFeatureCollection } from './data-sources'
import { loadStyleDocument, prepareStyle } from './vector-style'
import { warnOnce } from '../utils'
import { defaultCanvasTheme, isCssColor, paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import type {
  GeoJsonLoader,
  AttributionSpec,
  CommonLayerConfig,
  FeatureCandidate,
  GeoJsonLayerConfig,
  JsonValue,
  LayerStatus,
  MapError,
  MapLayerConfig,
  MapSelection,
  NormalizedLegend,
} from '../types'

type LayerRecord = {
  config: MapLayerConfig
  signature: string
  layer: BaseLayer
  dispose: () => void
  loading: boolean
  error?: MapError
  baseVisible: boolean
  setTime?: (time: string | null) => void
  featureExtent?: (featureId: string) => number[] | undefined
  /** Pushes the current selection into a WebGL style. */
  onSelection?: () => void
  /** Rebuilds a WebGL style after the canvas theme changed. */
  onTheme?: () => void
  /** Clustered layers are rasterized in SVG exports. */
  rasterExport?: boolean
}

type LayerRegistryCallbacks = {
  loadGeoJson?: GeoJsonLoader
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

function configSignature(config: MapLayerConfig): string {
  return JSON.stringify(config)
}

function attributionText(attributions: AttributionSpec[] | undefined): string[] | undefined {
  if (!attributions?.length) return undefined
  return attributions.map((item) => {
    const label = item.url
      ? `<a href="${item.url}" target="_blank" rel="noopener">${item.label}</a>`
      : item.label
    return [label, item.license, item.version].filter(Boolean).join(' · ')
  })
}

function replaceTime(template: string, time: string | null): string {
  return template.replaceAll('{time}', encodeURIComponent(time ?? ''))
}

function jsonProperties(
  feature: Feature | { getProperties(): Record<string, unknown> },
): Record<string, JsonValue> {
  const properties = { ...feature.getProperties() }
  delete properties.geometry
  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value) ||
      (typeof value === 'object' && value !== null)
    )
      result[key] = value as JsonValue
  }
  return result
}

export function normalizeHeatmapWeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}

export function validateLayerConfigs(configs: MapLayerConfig[]): void {
  const ids = new Set<string>()
  for (const config of configs) {
    if (!config.id.trim()) throw new MapConfigurationError('Layer IDs cannot be empty')
    if (ids.has(config.id)) throw new MapConfigurationError(`Duplicate layer ID: ${config.id}`)
    ids.add(config.id)
    if (!config.title.trim())
      throw new MapConfigurationError(`Layer ${config.id} needs a title`, config.id)
    if (config.opacity !== undefined && (config.opacity < 0 || config.opacity > 1))
      throw new MapConfigurationError(
        `Layer ${config.id} opacity must be between 0 and 1`,
        config.id,
      )
    // GeoJSON features without an id get one when loaded; tiles need a field.
    if (
      config.kind !== 'heatmap' &&
      config.kind !== 'geojson' &&
      config.selectable &&
      !config.featureIdField
    )
      throw new MapConfigurationError(
        `Selectable layer ${config.id} needs featureIdField`,
        config.id,
      )
    if (config.time && !config.time.available.length)
      throw new MapConfigurationError(
        `Timed layer ${config.id} needs available time values`,
        config.id,
      )
    if (config.kind === 'heatmap') {
      if (config.selectable)
        throw new MapConfigurationError(
          `Heatmap layer ${config.id} cannot be selectable`,
          config.id,
        )
      if (config.time?.mode === 'wms-parameter')
        throw new MapConfigurationError(
          `Heatmap layer ${config.id} does not support WMS parameter time mode`,
          config.id,
        )
      for (const stops of [config.radiusStops, config.blurStops])
        if (stops?.some((stop, index) => index > 0 && stop.zoom <= stops[index - 1]!.zoom))
          throw new MapConfigurationError(
            `Heatmap layer ${config.id} zoom stops must be strictly ascending`,
            config.id,
          )
    }
    if (
      config.kind === 'wmts' &&
      config.tileGrid.resolutions.length !== config.tileGrid.matrixIds.length
    )
      throw new MapConfigurationError(
        `WMTS layer ${config.id} needs one matrix ID per resolution`,
        config.id,
      )
    if (config.kind === 'mvt') {
      if (!config.style && !config.mapboxStyle)
        throw new MapConfigurationError(
          `MVT layer ${config.id} needs a thematic or Mapbox style`,
          config.id,
        )
      if (!config.tileGrid?.resolutions.length && config.tileGrid)
        throw new MapConfigurationError(
          `MVT layer ${config.id} needs at least one tile-grid resolution`,
          config.id,
        )
      if (
        config.sourceProjectionDefinition &&
        config.sourceProjectionDefinition.code !== config.sourceProjection
      )
        throw new MapConfigurationError(
          `MVT layer ${config.id} projection definition must match its source projection`,
          config.id,
        )
    }
  }
}

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

/**
 * Ids for selection: the `featureIdField` value, else the GeoJSON id, else the feature's
 * position in the data (stable as long as the data is).
 */
function setFeatureIds(
  source: VectorSource,
  config: Pick<CommonLayerConfig, 'featureIdField'>,
): void {
  source.getFeatures().forEach((feature, index) => {
    const id = config.featureIdField ? feature.get(config.featureIdField) : undefined
    if (id !== undefined && id !== null) feature.setId(String(id))
    else if (feature.getId() === undefined) feature.setId(String(index))
  })
}

function createImageTileLoadFunction(onLoaded?: (url: string) => void) {
  return (tile: Tile, url: string) => {
    const image = (tile as ImageTile).getImage() as HTMLImageElement
    image.crossOrigin = 'anonymous'
    image.src = url
    image.addEventListener('load', () => onLoaded?.(url), { once: true })
    image.onerror = () => tile.setState(TileState.ERROR)
  }
}

export class LayerRegistry {
  private records = new Map<string, LayerRecord>()
  private projection: Projection
  private zoom = 0
  private time: string | null
  private selection: MapSelection | null = null
  private theme: CanvasTheme = defaultCanvasTheme
  private readonly sharedTileSources = new Map<
    string,
    { source: VectorTileSource; users: number }
  >()
  private readonly callbacks: LayerRegistryCallbacks

  constructor(
    projection: Projection,
    callbacks: LayerRegistryCallbacks,
    initialTime: string | null = null,
  ) {
    this.projection = projection
    this.callbacks = callbacks
    this.time = initialTime
  }

  reconcile(configs: MapLayerConfig[]): BaseLayer[] {
    validateLayerConfigs(configs)
    const next = new Map<string, LayerRecord>()
    for (const config of configs) {
      const existing = this.records.get(config.id)
      const signature = configSignature(config)
      if (existing?.signature === signature) next.set(config.id, existing)
      else {
        existing?.dispose()
        next.set(config.id, this.create(config, signature))
      }
    }
    for (const [id, record] of this.records) if (!next.has(id)) record.dispose()
    this.records = next
    this.applyOrder(configs)
    this.applyZoom(this.zoom)
    this.emitStatus()
    return configs.map((config) => this.records.get(config.id)!.layer)
  }

  setProjection(projection: Projection, configs: MapLayerConfig[]): BaseLayer[] {
    this.projection = projection
    for (const record of this.records.values()) record.dispose()
    this.records.clear()
    return this.reconcile(configs)
  }

  setZoom(zoom: number): void {
    this.zoom = zoom
    this.applyZoom(zoom)
    for (const record of this.records.values()) record.layer.changed()
    this.emitStatus()
  }

  setTime(time: string | null): void {
    this.time = time
    for (const record of this.records.values()) {
      record.setTime?.(time)
      record.layer.changed()
    }
    this.emitStatus()
  }

  /** Applies new canvas colors and font; redraws only when something changed. */
  setTheme(theme: CanvasTheme): void {
    if (JSON.stringify(theme) === JSON.stringify(this.theme)) return
    this.theme = theme
    for (const record of this.records.values()) {
      record.onTheme?.()
      record.layer.changed()
    }
  }

  setSelection(selection: MapSelection | null): void {
    this.selection = selection
    for (const record of this.records.values()) {
      record.onSelection?.()
      record.layer.changed()
    }
  }

  setVisibility(layerId: string, visible: boolean): boolean {
    const record = this.records.get(layerId)
    if (!record) return false
    record.baseVisible = visible
    this.applyRecordVisibility(record)
    this.emitStatus()
    return true
  }

  setOpacity(layerId: string, opacity: number): boolean {
    const record = this.records.get(layerId)
    if (!record) return false
    record.layer.setOpacity(Math.min(1, Math.max(0, opacity)))
    return true
  }

  reorder(layerIds: string[]): BaseLayer[] {
    const configs = layerIds
      .map((id) => this.records.get(id)?.config)
      .filter(Boolean) as MapLayerConfig[]
    if (configs.length !== this.records.size || new Set(layerIds).size !== this.records.size)
      throw new MapConfigurationError('Layer order must contain every active layer ID exactly once')
    this.applyOrder(configs)
    return configs.map((config) => this.records.get(config.id)!.layer)
  }

  getConfig(layerId: string): MapLayerConfig | undefined {
    return this.records.get(layerId)?.config
  }

  getLayer(layerId: string): BaseLayer | undefined {
    return this.records.get(layerId)?.layer
  }

  /** Current layer objects for `configs`, in order (after any canvas-to-WebGL swap). */
  layersFor(configs: MapLayerConfig[]): BaseLayer[] {
    return configs.flatMap((config) => this.records.get(config.id)?.layer ?? [])
  }

  getBaseVisible(layerId: string): boolean {
    return this.records.get(layerId)?.baseVisible ?? false
  }

  getFeatureExtent(layerId: string, featureId: string): number[] | undefined {
    return this.records.get(layerId)?.featureExtent?.(featureId)
  }

  getVisibleNonExportableLayerIds(): string[] {
    return [...this.records.values()]
      .filter((record) => record.layer.getVisible() && record.config.exportable === false)
      .map((record) => record.config.id)
  }

  getVisibleRequiredStatuses(): LayerStatus[] {
    return this.getStatuses().filter((status) => {
      const record = this.records.get(status.id)
      return Boolean(record?.config.required && record.layer.getVisible())
    })
  }

  getVisibleVectorLayers(): SvgVectorLayer[] | undefined {
    const visible = [...this.records.values()].filter((record) => record.layer.getVisible())
    if (visible.some((record) => record.config.kind !== 'geojson' || record.rasterExport))
      return undefined
    return visible.map((record) => ({
      config: record.config as GeoJsonLayerConfig,
      features: (record.layer as VectorLayer).getSource()?.getFeatures() ?? [],
    }))
  }

  getStatuses(): LayerStatus[] {
    return [...this.records.values()].map((record) => ({
      id: record.config.id,
      loading: record.loading,
      ...(record.error ? { error: record.error } : {}),
      ...(this.time && record.config.time && !record.config.time.available.includes(this.time)
        ? { noData: true }
        : {}),
      ...(this.zoom < (record.config.minZoom ?? Number.NEGATIVE_INFINITY) ||
      this.zoom > (record.config.maxZoom ?? Number.POSITIVE_INFINITY)
        ? { scaleUnavailable: true }
        : {}),
    }))
  }

  getLegends(): NormalizedLegend[] {
    return [...this.records.values()]
      .map((record) => {
        if (record.config.kind === 'heatmap')
          return normalizeHeatmapLegend(record.config, record.baseVisible, this.time)
        return normalizeLegend(
          record.config.id,
          record.config.title,
          record.baseVisible,
          'style' in record.config ? record.config.style : undefined,
          record.config.legend,
          this.time,
        )
      })
      .filter(Boolean) as NormalizedLegend[]
  }

  getAttributions(): AttributionSpec[] {
    const unique = new Map<string, AttributionSpec>()
    for (const record of this.records.values()) {
      if (!record.layer.getVisible()) continue
      for (const item of record.config.attribution ?? [])
        unique.set(`${item.label}|${item.url ?? ''}`, item)
    }
    return [...unique.values()]
  }

  candidates(features: Array<{ feature: FeatureLike; layer: BaseLayer }>): FeatureCandidate[] {
    return features
      .map(({ feature: hit, layer }) => {
        // A cluster bubble stands for its points: one point is that feature, more are not
        // selectable (clicking zooms in instead).
        const members = hit.get('features') as FeatureLike[] | undefined
        if (Array.isArray(members) && members.length !== 1) return undefined
        const feature = Array.isArray(members) ? members[0]! : hit
        const layerId = String(layer.get('mapLayerId') ?? '')
        const config = this.records.get(layerId)?.config
        if (!config?.selectable) return undefined
        const rawId =
          feature.getId() ??
          (config.featureIdField ? feature.get(config.featureIdField) : undefined)
        if (rawId === undefined || rawId === null) {
          this.callbacks.onError(
            mapError(
              'FEATURE_ID_MISSING',
              `Feature in ${config.title} has no stable ID`,
              true,
              config.id,
            ),
          )
          return undefined
        }
        const allProperties = jsonProperties(feature)
        const properties = config.propertyAllowlist
          ? Object.fromEntries(
              config.propertyAllowlist
                .filter((key) => key in allProperties)
                .map((key) => [key, allProperties[key]!]),
            )
          : allProperties
        return {
          layerId,
          featureId: String(rawId),
          ...(config.boundarySetId ? { boundarySetId: config.boundarySetId } : {}),
          ...(config.geographyLevel ? { geographyLevel: config.geographyLevel } : {}),
          title: config.title,
          properties,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const left = this.records.get(a!.layerId)?.config.hitPriority ?? 0
        const right = this.records.get(b!.layerId)?.config.hitPriority ?? 0
        return right - left
      }) as FeatureCandidate[]
  }

  destroy(): void {
    for (const record of this.records.values()) record.dispose()
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
    const keys: EventsKey[] = []
    const record: LayerRecord = {
      config,
      signature,
      layer: undefined as unknown as BaseLayer,
      loading: false,
      baseVisible: config.visible ?? true,
      dispose: () => undefined,
    }
    const setLoading = (loading: boolean) => {
      record.loading = loading
      if (!loading) delete record.error
      this.emitStatus()
    }
    const fail = (message: string, cause?: unknown) => {
      record.loading = false
      record.error = mapError('SOURCE_LOAD_FAILED', message, !config.required, config.id, cause)
      this.callbacks.onError(record.error)
      this.emitStatus()
    }
    const common = {
      opacity: config.opacity ?? 1,
      visible: config.visible ?? true,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      properties: { mapLayerId: config.id },
    }
    let layer: BaseLayer
    let setTime: ((time: string | null) => void) | undefined
    let activeLoadStarted = 0
    let abortController: AbortController | undefined
    let disposed = false
    let afterLoad: (() => void) | undefined
    let releaseShared: (() => void) | undefined

    if (config.kind === 'geojson' || config.kind === 'heatmap') {
      const format = new GeoJSON()
      const source = new VectorSource({
        format,
        attributions: attributionText(config.attribution),
        wrapX: false,
      })
      const loadInline = (data: FeatureCollection) => {
        for (const hint of diagnoseLayerData(config, data))
          warnOnce(`data:${config.id}:${hint}`, hint)
        const longitudeLatitude = !config.dataProjection || config.dataProjection === 'EPSG:4326'
        source.clear(true)
        source.addFeatures(
          format.readFeatures(
            longitudeLatitude ? splitAtSeam(data, this.centralMeridian()) : data,
            {
              dataProjection: config.dataProjection ?? 'EPSG:4326',
              featureProjection: this.projection,
            },
          ),
        )
        setFeatureIds(source, config)
        afterLoad?.()
      }
      if ('url' in config.data) {
        const { url: sourceUrl, format, longitude, latitude } = config.data
        const dataOptions = {
          ...(format ? { format } : {}),
          ...(longitude ? { longitude } : {}),
          ...(latitude ? { latitude } : {}),
        }
        let loadedTime: string | null | undefined
        const load = (time: string | null) => {
          if (time === loadedTime) return
          loadedTime = time
          abortController?.abort()
          abortController = new AbortController()
          activeLoadStarted = performance.now()
          setLoading(true)
          const loadGeoJson = this.callbacks.loadGeoJson ?? fetchGeoJson
          void loadGeoJson(replaceTime(sourceUrl, time), {
            ...dataOptions,
            signal: abortController.signal,
          })
            .then(loadInline)
            .then(() => {
              setLoading(false)
              this.callbacks.onMetric?.(config.id, performance.now() - activeLoadStarted, true)
              const count = Math.min(2, Math.max(0, config.time?.prefetchFrames ?? 0))
              if (count && time && config.time) {
                const index = config.time.available.indexOf(time)
                for (const nextTime of config.time.available.slice(index + 1, index + 1 + count))
                  void loadGeoJson(replaceTime(sourceUrl, nextTime), {
                    ...dataOptions,
                    prefetch: true,
                  }).catch(() => undefined)
              }
            })
            .catch((error: unknown) => {
              if (error instanceof DOMException && error.name === 'AbortError') return
              this.callbacks.onMetric?.(config.id, performance.now() - activeLoadStarted, false)
              fail(
                `Could not load ${config.title}: ${error instanceof Error ? error.message : String(error)}`,
                error,
              )
            })
        }
        load(this.time)
        if (config.time?.mode === 'source-replacement' || config.time?.mode === 'url-template')
          setTime = load
      } else if ('builtin' in config.data) {
        setLoading(true)
        void loadBuiltinGeoJson(config.data)
          .then((data) => {
            if (disposed) return
            loadInline(data)
            setLoading(false)
          })
          .catch((error: unknown) => {
            if (!disposed) fail(`Could not load ${config.title}`, error)
          })
      } else if ('rows' in config.data) {
        try {
          loadInline(rowsToFeatureCollection(config.data.rows, config.data, config.id))
        } catch (error) {
          fail(`Could not read the rows of ${config.title}`, error)
        }
      } else loadInline(config.data)
      if (config.kind === 'heatmap') {
        const weightField = config.weightField ?? 'weight'
        layer = new HeatmapLayer({
          ...common,
          source,
          gradient: config.gradient ?? defaultHeatmapGradient,
          radius: interpolateStops(config.radiusStops, this.zoom, config.radius ?? 8),
          blur: interpolateStops(config.blurStops, this.zoom, config.blur ?? 15),
          weight: (feature) => {
            if (
              config.time?.mode === 'property' &&
              this.time &&
              String(feature.get(config.time.fieldOrParameter ?? 'time')) !== this.time
            )
              return 0
            const value = feature.get(weightField)
            return normalizeHeatmapWeight(value)
          },
        })
      } else {
        const thematicStyle = compileThematicStyle(
          config.style,
          () => this.zoom,
          () => this.time,
          config.time,
          () => this.theme,
        )
        const isSelected = (feature: FeatureLike) => {
          const id =
            feature.getId() ??
            (config.featureIdField ? feature.get(config.featureIdField) : undefined)
          return this.selection?.layerId === config.id && String(id) === this.selection.featureId
        }
        const canvasStyle = (feature: FeatureLike) =>
          isSelected(feature)
            ? selectionStyleForGeometry(feature.getGeometry()?.getType() ?? '', this.theme)
            : thematicStyle(feature)
        if (config.cluster) {
          const clusterSource = new Cluster({
            source,
            distance: config.cluster.distance ?? 40,
            minDistance: config.cluster.minDistance ?? 0,
            wrapX: false,
            geometryFunction: (feature) => {
              const geometry = feature.getGeometry()
              return geometry instanceof Point &&
                featureVisibleAtTime(feature, this.time, config.time)
                ? geometry
                : null
            },
          })
          layer = new VectorLayer({
            ...common,
            source: clusterSource,
            style: (cluster) => {
              const members = cluster.get('features') as FeatureLike[] | undefined
              if (!members?.length) return undefined
              return members.length === 1
                ? canvasStyle(members[0]!)
                : clusterStyle(members.length, this.theme)
            },
          })
          record.rasterExport = true
          if (config.time?.mode === 'property') setTime = () => clusterSource.refresh()
        } else {
          const renderer = config.renderer ?? 'auto'
          const gpuAllowed = renderer !== 'canvas' && !webglUnsupportedReason(config)
          const wantsGpu = () =>
            gpuAllowed &&
            (renderer === 'webgl' ||
              (source.getFeatures().length >= WEBGL_AUTO_THRESHOLD &&
                onlyPoints(source) &&
                hasHardwareWebgl()))
          const selectedId = () =>
            this.selection?.layerId === config.id ? this.selection.featureId : ''
          const webglLayer = () => {
            const gpu = new WebGLVectorLayer({
              ...common,
              source,
              style: compileWebglStyle(config, this.theme),
              variables: { selectedId: selectedId() },
            })
            record.onSelection = () => gpu.updateStyleVariables({ selectedId: selectedId() })
            record.onTheme = () => gpu.setStyle(compileWebglStyle(config, this.theme))
            return gpu
          }
          layer = wantsGpu()
            ? webglLayer()
            : new VectorLayer({ ...common, source, style: canvasStyle })
          // Data from a URL arrives after the layer exists: switch to the GPU once it is known
          // to be a large point dataset.
          if (gpuAllowed && renderer === 'auto')
            afterLoad = () => {
              if (disposed || record.layer instanceof WebGLVectorLayer || !wantsGpu()) return
              const previous = record.layer
              const next = webglLayer()
              next.setOpacity(previous.getOpacity())
              next.setVisible(previous.getVisible())
              next.setZIndex(previous.getZIndex() ?? 0)
              record.layer = next
              previous.dispose()
              this.callbacks.onLayerReplaced?.()
            }
        }
        record.featureExtent = (featureId) => {
          const extent = source.getFeatureById(featureId)?.getGeometry()?.getExtent()
          return extent ? [...extent] : undefined
        }
      }
    } else if (config.kind === 'mvt') {
      const configuredTileSize = config.tileGrid?.tileSize
      const tileGrid = config.tileGrid
        ? new TileGrid({
            extent: [...config.tileGrid.extent],
            origin: [...config.tileGrid.origin],
            resolutions: config.tileGrid.resolutions,
            tileSize:
              configuredTileSize === undefined || typeof configuredTileSize === 'number'
                ? configuredTileSize
                : [configuredTileSize[0], configuredTileSize[1]],
          })
        : undefined
      const createSource = () =>
        new VectorTileSource({
          format: new MVT({ idProperty: config.featureIdField }),
          url: replaceTime(config.urlTemplate, this.time),
          projection: config.sourceProjection,
          maxZoom: config.maxSourceZoom,
          tileGrid,
          wrapX: config.wrapX,
          attributions: attributionText(config.attribution),
        })
      // Layers drawing different style layers of the same tiles (an ArcGIS basemap and its
      // labels) share one source, so each tile is downloaded once.
      const sharedKey = config.time
        ? undefined
        : JSON.stringify([
            config.urlTemplate,
            config.sourceProjection,
            config.maxSourceZoom,
            config.tileGrid,
            config.wrapX,
            config.featureIdField,
          ])
      const shared = sharedKey ? this.sharedTileSources.get(sharedKey) : undefined
      const source = shared?.source ?? createSource()
      if (sharedKey) {
        const entry = shared ?? { source, users: 0 }
        entry.users += 1
        this.sharedTileSources.set(sharedKey, entry)
        releaseShared = () => {
          entry.users -= 1
          if (entry.users <= 0) this.sharedTileSources.delete(sharedKey)
        }
      }
      const thematicStyle = config.style
        ? compileThematicStyle(
            config.style,
            () => this.zoom,
            () => this.time,
            config.time,
            () => this.theme,
          )
        : undefined
      const vectorTileLayer = new VectorTileLayer({
        ...common,
        source,
        declutter: true,
        style: thematicStyle
          ? (feature) => {
              const id =
                feature.getId() ??
                (config.featureIdField ? feature.get(config.featureIdField) : undefined)
              if (this.selection?.layerId === config.id && String(id) === this.selection.featureId)
                return selectionStyleForGeometry(feature.getGeometry()?.getType() ?? '', this.theme)
              return thematicStyle(feature)
            }
          : undefined,
      })
      layer = vectorTileLayer
      const mapboxStyle = config.mapboxStyle
      if (mapboxStyle) {
        // The style document is fetched once and shared; layers are selected and overrides
        // applied before it is handed to ol-mapbox-style.
        const styleDocument = () =>
          loadStyleDocument(mapboxStyle.url).then((document) => {
            const prepared = prepareStyle(
              document,
              mapboxStyle.layers,
              mapboxStyle.overrides,
              (color) => paint(color, this.theme),
            )
            for (const pattern of prepared.unmatched)
              warnOnce(
                `style-override:${mapboxStyle.url}:${pattern}`,
                `Style override "${pattern}" on ${config.id} matches no layer of the style. ` +
                  `Style layer ids: ${document.layers
                    .map((layer) => layer.id)
                    .slice(0, 60)
                    .join(', ')}`,
              )
            return prepared.style
          })
        const apply = () =>
          Promise.all([import('ol-mapbox-style'), styleDocument()])
            .then(async ([{ applyStyle }, style]) => {
              await applyStyle(vectorTileLayer, style, {
                styleUrl: mapboxStyle.url,
                source: mapboxStyle.source ?? '',
                updateSource: false,
                projection: config.sourceProjection,
                resolutions: config.tileGrid?.resolutions,
              })
              // ol-mapbox-style paints a style's background only for whole maps.
              const background = style.layers.find(
                (layer) => layer.type === 'background' && layer.layout?.['visibility'] !== 'none',
              )?.paint?.['background-color']
              if (typeof background === 'string') vectorTileLayer.setBackground(background)
            })
            .then(() => {
              if (disposed || !config.selectable) return
              const serviceStyle = vectorTileLayer.getStyleFunction()
              if (!serviceStyle) return
              vectorTileLayer.setStyle((feature, resolution) => {
                const id =
                  feature.getId() ??
                  (config.featureIdField ? feature.get(config.featureIdField) : undefined)
                if (
                  this.selection?.layerId === config.id &&
                  String(id) === this.selection.featureId
                )
                  return selectionStyleForGeometry(
                    feature.getGeometry()?.getType() ?? '',
                    this.theme,
                  )
                return serviceStyle(feature, resolution)
              })
            })
            .catch((error: unknown) => {
              if (!disposed) fail(`Could not load the style for ${config.title}`, error)
            })
        void apply()
        // Override colours written as CSS variables follow the page's light and dark themes.
        if (mapboxStyle.overrides?.some((override) => override.color && isCssColor(override.color)))
          record.onTheme = () => void apply()
      }
      if (config.time?.mode === 'url-template')
        setTime = (time) => source.setUrl(replaceTime(config.urlTemplate, time))
      this.bindTileEvents(source, config, keys, setLoading, fail)
    } else if (config.kind === 'xyz') {
      const prefetched = new Set<string>()
      let activeTime = this.time
      const prefetchFollowingFrames = (loadedUrl: string) => {
        const count = Math.min(2, Math.max(0, config.time?.prefetchFrames ?? 0))
        if (!count || !activeTime || !config.time || !config.urlTemplate.includes('{time}')) return
        const index = config.time.available.indexOf(activeTime)
        for (const nextTime of config.time.available.slice(index + 1, index + 1 + count)) {
          const url = loadedUrl.replaceAll(
            encodeURIComponent(activeTime),
            encodeURIComponent(nextTime),
          )
          if (prefetched.has(url) || prefetched.size >= 64) continue
          prefetched.add(url)
          const image = new Image()
          image.crossOrigin = config.crossOrigin ?? 'anonymous'
          image.src = url
        }
      }
      const source = new XYZ({
        url: replaceTime(config.urlTemplate, this.time),
        projection: config.sourceProjection,
        crossOrigin: config.crossOrigin ?? 'anonymous',
        maxZoom: config.maxSourceZoom,
        attributions: attributionText(config.attribution),
        tileLoadFunction: createImageTileLoadFunction(prefetchFollowingFrames),
      })
      layer = new TileLayer({ ...common, source })
      if (config.time?.mode === 'url-template')
        setTime = (time) => {
          activeTime = time
          prefetched.clear()
          source.setUrl(replaceTime(config.urlTemplate, time))
        }
      this.bindTileEvents(source, config, keys, setLoading, fail)
    } else if (config.kind === 'wms') {
      const source = new TileWMS({
        url: config.url,
        params: { ...config.params },
        projection: config.sourceProjection,
        crossOrigin: config.crossOrigin ?? 'anonymous',
        attributions: attributionText(config.attribution),
      })
      layer = new TileLayer({ ...common, source })
      if (config.time?.mode === 'wms-parameter')
        setTime = (time) =>
          source.updateParams({ [config.time?.fieldOrParameter ?? 'TIME']: time ?? '' })
      this.bindTileEvents(source, config, keys, setLoading, fail)
    } else if (config.kind === 'arcgis-vector-tiles') {
      // Resolved to an `mvt` layer from the service metadata before the map is created.
      throw new MapConfigurationError(
        `ArcGIS layer ${config.id} was not resolved from its service`,
        config.id,
      )
    } else {
      const configuredTileSize = config.tileGrid.tileSize
      const grid = new WMTSTileGrid({
        extent: [...config.tileGrid.extent],
        origin: [...config.tileGrid.origin],
        resolutions: config.tileGrid.resolutions,
        matrixIds: config.tileGrid.matrixIds,
        tileSize:
          configuredTileSize === undefined || typeof configuredTileSize === 'number'
            ? configuredTileSize
            : [configuredTileSize[0], configuredTileSize[1]],
      })
      const source = new WMTS({
        url: config.url,
        layer: config.layer,
        matrixSet: config.matrixSet,
        format: config.format,
        projection: config.sourceProjection,
        style: config.styleName ?? 'default',
        tileGrid: grid,
        crossOrigin: config.crossOrigin ?? 'anonymous',
        attributions: attributionText(config.attribution),
      })
      layer = new TileLayer({ ...common, source })
      this.bindTileEvents(source, config, keys, setLoading, fail)
    }

    record.layer = layer
    record.dispose = () => {
      disposed = true
      abortController?.abort()
      unByKey(keys)
      releaseShared?.()
      // WebGL layers hold a GPU context until disposed.
      if (record.layer instanceof WebGLVectorLayer) record.layer.dispose()
    }
    if (setTime) record.setTime = setTime
    return record
  }

  private bindTileEvents(
    source: TileSource,
    config: MapLayerConfig,
    keys: EventsKey[],
    setLoading: (loading: boolean) => void,
    fail: (message: string, cause?: unknown) => void,
  ): void {
    let pending = 0
    let startedAt = 0
    keys.push(
      source.on('tileloadstart', () => {
        if (pending === 0) startedAt = performance.now()
        pending += 1
        setLoading(true)
      }),
      source.on('tileloadend', () => {
        pending = Math.max(0, pending - 1)
        setLoading(pending > 0)
        if (pending === 0) this.callbacks.onMetric?.(config.id, performance.now() - startedAt, true)
      }),
      source.on('tileloaderror', (event: unknown) => {
        pending = Math.max(0, pending - 1)
        this.callbacks.onMetric?.(config.id, performance.now() - startedAt, false)
        fail(`A tile failed to load for ${config.title}`, event)
      }),
    )
  }

  private applyOrder(configs: MapLayerConfig[]): void {
    configs.forEach((config, index) =>
      this.records.get(config.id)?.layer.setZIndex(config.zIndex ?? index),
    )
  }

  private applyZoom(zoom: number): void {
    for (const record of this.records.values()) {
      this.applyRecordVisibility(record, zoom)
      if (record.config.kind !== 'heatmap') continue
      const layer = record.layer as HeatmapLayer
      layer.setRadius(interpolateStops(record.config.radiusStops, zoom, record.config.radius ?? 8))
      layer.setBlur(interpolateStops(record.config.blurStops, zoom, record.config.blur ?? 15))
    }
  }

  private applyRecordVisibility(record: LayerRecord, zoom = this.zoom): void {
    const withinMin = record.config.minZoom === undefined || zoom >= record.config.minZoom
    const withinMax = record.config.maxZoom === undefined || zoom <= record.config.maxZoom
    const timeAvailable =
      !this.time ||
      !record.config.time ||
      record.config.time.available.includes(this.time) ||
      record.config.time.missingPolicy === 'retain-last'
    record.layer.setVisible(record.baseVisible && withinMin && withinMax && timeAvailable)
  }

  /** Longitude of the map projection's centre; its seam is 180° away. */
  private centralMeridian(): number {
    const definition = proj4.defs(this.projection.getCode()) as { long0?: number } | undefined
    return ((definition?.long0 ?? 0) * 180) / Math.PI
  }

  private emitStatus(): void {
    this.callbacks.onStatus(this.getStatuses())
  }
}
