import type { FeatureCollection } from 'geojson'
import type { ReactNode } from 'react'

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type LonLat = readonly [longitude: number, latitude: number]
export type LonLatBounds = readonly [west: number, south: number, east: number, north: number]
export type ProjectionId = 'EPSG:8857' | 'EPSG:3857'
export type MapOrigin = 'user' | 'prop' | 'projection-switch' | 'fit' | 'time' | 'external'

export type MapViewState = {
  center: LonLat
  zoom: number
  projection: ProjectionId
  rotation?: number
  minZoom?: number
  maxZoom?: number
}

export type ProjectionBehavior = {
  mode?: 'manual' | 'automatic'
  equalEarthBelowZoom?: number
  mercatorAtOrAboveZoom?: number
}

export type AttributionSpec = {
  label: string
  url?: string
  license?: string
  version?: string
  authority?: string
  publishedAt?: string
  usageRestrictions?: string
  official?: boolean
}

export type ZoomStop = { zoom: number; value: number }

export type PointSymbol = {
  kind: 'point'
  shape?: 'circle' | 'square' | 'triangle' | 'diamond'
  radius?: number
  radiusStops?: ZoomStop[]
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  opacity?: number
  labelField?: string
  labelColor?: string
}

export type LineSymbol = {
  kind: 'line'
  color: string
  width?: number
  widthStops?: ZoomStop[]
  dash?: number[]
  opacity?: number
  labelField?: string
}

export type PolygonSymbol = {
  kind: 'polygon'
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  dash?: number[]
  opacity?: number
  labelField?: string
  labelColor?: string
}

export type SymbolSpec = PointSymbol | LineSymbol | PolygonSymbol

export type LegendClass = {
  id?: string
  label: string
  symbol: SymbolSpec
}

export type ThematicStyleSpec =
  | { type: 'constant'; symbol: SymbolSpec }
  | {
      type: 'categorical'
      field: string
      categories: Array<LegendClass & { value: string | number | boolean }>
      fallback?: LegendClass
      specialValues?: Array<LegendClass & { value: string | number | boolean | null }>
    }
  | {
      type: 'graduated'
      field: string
      classes: Array<LegendClass & { min?: number; max?: number }>
      missing?: LegendClass
      specialValues?: Array<LegendClass & { value: string | number | boolean | null }>
      outOfRange?: LegendClass
    }
  | {
      type: 'continuous'
      field: string
      domain: readonly [number, number]
      stops: Array<{ value: number; color: string; label?: string }>
      symbol?: SymbolSpec
      clamp?: boolean
      missing?: LegendClass
      specialValues?: Array<LegendClass & { value: string | number | boolean | null }>
      outOfRange?: LegendClass
    }

export type LegendEntry = {
  id: string
  label: string
  symbol: SymbolSpec | { kind: 'gradient'; stops: Array<{ value: number; color: string }> }
  value?: string | number | boolean | readonly [number, number]
}

export type LegendSpec = {
  title?: string
  subtitle?: string
  units?: string
  description?: string
  sourceNote?: string
  presentation?: 'list' | 'continuous-ramp' | 'size-ramp'
  entries?: LegendEntry[]
  showLayerToggle?: boolean
}

export type LayerTimeSpec = {
  available: string[]
  mode: 'property' | 'url-template' | 'wms-parameter' | 'source-replacement'
  fieldOrParameter?: string
  missingPolicy?: 'hide' | 'unavailable' | 'retain-last'
  prefetchFrames?: number
}

export type CommonLayerConfig = {
  id: string
  title: string
  role: 'basemap' | 'indicator' | 'boundary' | 'reference'
  visible?: boolean
  opacity?: number
  minZoom?: number
  maxZoom?: number
  zIndex?: number
  reorderable?: boolean
  required?: boolean
  showInLayerControl?: boolean
  orderLocked?: boolean
  group?: string
  exclusiveGroup?: string
  selectable?: boolean
  hitPriority?: number
  featureIdField?: string
  propertyAllowlist?: string[]
  boundarySetId?: string
  geographyLevel?: string
  attribution?: AttributionSpec[]
  time?: LayerTimeSpec
  legend?: LegendSpec
  exportable?: boolean
}

export type GeoJsonLayerConfig = CommonLayerConfig & {
  kind: 'geojson'
  data: FeatureCollection | { url: string }
  dataProjection?: string
  style: ThematicStyleSpec
}

export type VectorTileLayerConfig = CommonLayerConfig & {
  kind: 'mvt'
  urlTemplate: string
  sourceProjection: string
  sourceLayer?: string
  maxSourceZoom?: number
  style: ThematicStyleSpec
}

export type XyzLayerConfig = CommonLayerConfig & {
  kind: 'xyz'
  urlTemplate: string
  sourceProjection: string
  crossOrigin?: 'anonymous' | 'use-credentials'
  maxSourceZoom?: number
}

export type WmsLayerConfig = CommonLayerConfig & {
  kind: 'wms'
  url: string
  params: Record<string, string | number | boolean> & { LAYERS: string }
  sourceProjection: string
  crossOrigin?: 'anonymous' | 'use-credentials'
  tiled?: boolean
}

export type WmtsTileGridSpec = {
  extent: readonly [number, number, number, number]
  origin: readonly [number, number]
  resolutions: number[]
  matrixIds: string[]
  tileSize?: number | readonly [number, number]
}

export type WmtsLayerConfig = CommonLayerConfig & {
  kind: 'wmts'
  url: string
  layer: string
  matrixSet: string
  format: string
  sourceProjection: string
  styleName?: string
  tileGrid: WmtsTileGridSpec
  crossOrigin?: 'anonymous' | 'use-credentials'
}

export type MapLayerConfig =
  GeoJsonLayerConfig | VectorTileLayerConfig | XyzLayerConfig | WmsLayerConfig | WmtsLayerConfig

export type BasemapConfig = {
  id: string
  title: string
  supportedProjections: ProjectionId[]
  layers: MapLayerConfig[]
  backgroundColor: string
  attribution: AttributionSpec[]
  exportable: boolean
  fallbackFor?: ProjectionId[]
  network?: boolean
}

export type MapSelection = {
  layerId: string
  featureId: string
  boundarySetId?: string
  geographyLevel?: string
}

export type FeatureCandidate = MapSelection & {
  title?: string
  properties: Record<string, JsonValue>
}

export type FeatureEvent = MapSelection & {
  mapId: string
  coordinate: LonLat
  properties: Record<string, JsonValue>
  candidates?: FeatureCandidate[]
  interaction: 'click' | 'tap' | 'keyboard' | 'external'
}

export type ViewChangeEvent = { view: MapViewState; origin: MapOrigin }
export type ProjectionChangeEvent = {
  previous: ProjectionId
  current: ProjectionId
  view: MapViewState
  origin: MapOrigin
}
export type LayerStateEvent = {
  layerId: string
  visible: boolean
  opacity: number
  index: number
  origin: MapOrigin
}
export type SymbologyChangeEvent = {
  layerId: string
  style: ThematicStyleSpec
  origin: MapOrigin
}
export type TimeChangeEvent = { time: string | null; origin: MapOrigin }

export type MapErrorCode =
  | 'CONFIG_INVALID'
  | 'PROJECTION_UNSUPPORTED'
  | 'BASEMAP_INCOMPATIBLE'
  | 'SOURCE_LOAD_FAILED'
  | 'STYLE_INVALID'
  | 'FEATURE_ID_MISSING'
  | 'TIME_FRAME_FAILED'
  | 'EXPORT_CORS_BLOCKED'
  | 'EXPORT_TIMEOUT'

export type MapError = {
  code: MapErrorCode
  message: string
  recoverable: boolean
  layerId?: string
  cause?: unknown
}

export type LayerStatus = {
  id: string
  loading: boolean
  error?: MapError
  noData?: boolean
  scaleUnavailable?: boolean
}

export type NormalizedLegend = {
  layerId: string
  title: string
  subtitle?: string
  units?: string
  description?: string
  sourceNote?: string
  visible: boolean
  entries: LegendEntry[]
}

export type ZoomTarget = {
  id: string
  label: string
  bounds: LonLatBounds
  parentId?: string
  geographyLevel?: string
  maxZoom?: number
}

export type HierarchyItem = {
  id: string
  label: string
  geographyLevel: string
  targetId?: string
}

export type FitTarget = LonLatBounds | { bounds: LonLatBounds }
export type FitOptions = {
  padding?: readonly [top: number, right: number, bottom: number, left: number]
  duration?: number
  maxZoom?: number
}

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/svg+xml'
export type ExportOptions = {
  format: ExportFormat
  width?: number
  height?: number
  pixelRatio?: number
  quality?: number
  title?: string
  subtitle?: string
  selectedAreaLabel?: string
  includeLegend?: boolean
  includeAttribution?: boolean
  timeoutMs?: number
}

export type MapControlsConfig = {
  projection?: boolean
  basemap?: boolean
  zoom?: boolean
  fit?: boolean
  layers?: boolean
  legend?: boolean
  time?: boolean
  export?: boolean
  fullscreen?: boolean
}

export type PopupContext = {
  selection: FeatureEvent
  close: () => void
}

export type MapCallbacks = {
  onReady?: (view: MapViewState) => void
  onViewChange?: (event: ViewChangeEvent) => void
  onFeatureHover?: (event: FeatureEvent | null) => void
  onFeatureSelect?: (event: FeatureEvent | null) => void
  onLayerStateChange?: (event: LayerStateEvent) => void
  onSymbologyChange?: (event: SymbologyChangeEvent) => void
  onProjectionChange?: (event: ProjectionChangeEvent) => void
  onTimeChange?: (event: TimeChangeEvent) => void
  onError?: (error: MapError) => void
  onStatusChange?: (status: LayerStatus[]) => void
  onMetric?: (metric: MapMetric) => void
}

export type MapMetric = {
  name: 'ready' | 'source-load' | 'view-render' | 'export'
  durationMs: number
  layerId?: string
  detail?: Record<string, string | number | boolean>
}

export type TimePlaybackOptions = {
  speedsMs?: number[]
  defaultSpeedMs?: number
}

export type MapControllerOptions = MapCallbacks & {
  id: string
  target: HTMLElement
  ariaLabel: string
  view: MapViewState
  projectionBehavior?: ProjectionBehavior | undefined
  layers: MapLayerConfig[]
  basemaps: BasemapConfig[]
  activeBasemapId?: string | undefined
  selection?: MapSelection | null | undefined
  time?: string | null | undefined
}

export type GeospatialMapProps = MapCallbacks & {
  id?: string
  className?: string
  ariaLabel: string
  view?: MapViewState
  defaultView?: MapViewState
  projectionBehavior?: ProjectionBehavior
  layers: MapLayerConfig[]
  basemaps: BasemapConfig[]
  activeBasemapId?: string
  defaultBasemapId?: string
  selection?: MapSelection | null
  defaultSelection?: MapSelection | null
  time?: string | null
  defaultTime?: string | null
  zoomTargets?: ZoomTarget[]
  hierarchy?: HierarchyItem[]
  controls?: MapControlsConfig
  exportOptions?: Partial<ExportOptions>
  timePlayback?: TimePlaybackOptions
  renderPopup?: (context: PopupContext) => ReactNode
  children?: ReactNode
}

export type GeospatialMapHandle = {
  fit(target: FitTarget, options?: FitOptions): void
  fitSelection(options?: FitOptions): boolean
  setLayerStyle(layerId: string, style: ThematicStyleSpec): void
  exportImage(options: ExportOptions): Promise<Blob>
  getView(): MapViewState
  serialize(): SerializedMapState
}

export type PublicEmbedConfig = {
  version: 1
  configId: string
  state: SerializedMapState
}

export type EmbedSnippetOptions = {
  configId: string
  embedBaseUrl: string
  approvedOrigins: string[]
  title?: string
  width?: string | number
  height?: string | number
}

export type SerializedMapState = {
  version: 1
  view: MapViewState
  activeBasemapId?: string
  layers: Array<{ id: string; visible: boolean; opacity: number; index: number }>
  time?: string | null
  selection?: MapSelection | null
}

export type MapGridItem = {
  id: string
  title: string
  view: MapViewState
  layers?: MapLayerConfig[]
}

export type MapGridProps = Omit<GeospatialMapProps, 'id' | 'view' | 'defaultView' | 'layers'> & {
  maps: MapGridItem[]
  sharedLayers: MapLayerConfig[]
  syncView?: boolean
}
