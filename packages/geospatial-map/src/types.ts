import type { FeatureCollection } from 'geojson'
import type { ReactNode } from 'react'
import type { GeospatialMapConfigV1 as SchemaMapConfigV1 } from './config'

/** JSON-compatible value accepted in configuration and feature properties. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
/** Geographic longitude and latitude in decimal degrees. */
export type LonLat = readonly [longitude: number, latitude: number]
/** Geographic bounds ordered west, south, east, north. */
export type LonLatBounds = readonly [west: number, south: number, east: number, north: number]
/** Projections supported by the public renderer-neutral contract. */
export type ProjectionId = 'EPSG:8857' | 'EPSG:3857' | 'ESRI:EQUAL-EARTH-CM11'
/** Source of a map transition or event. */
export type MapOrigin = 'user' | 'prop' | 'projection-switch' | 'fit' | 'time' | 'external'

/** Serializable view state; centers always remain longitude/latitude. */
export type MapViewState = {
  /** Geographic center in decimal degrees. */
  center: LonLat
  /** Renderer zoom level. */
  zoom: number
  /** Active projection. */
  projection: ProjectionId
  /** Clockwise view rotation in radians. */
  rotation?: number
  /** Optional minimum zoom constraint. */
  minZoom?: number
  /** Optional maximum zoom constraint. */
  maxZoom?: number
}

/** Manual or zoom-threshold projection switching policy. */
export type ProjectionBehavior = {
  /** Manual preserves host selection; automatic follows zoom thresholds. */
  mode?: 'manual' | 'automatic'
  /** Automatic threshold below which Equal Earth is selected. */
  equalEarthBelowZoom?: number
  /** Automatic threshold at or above which Mercator is selected. */
  mercatorAtOrAboveZoom?: number
}

/** Human- and machine-readable source attribution. */
export type AttributionSpec = {
  /** Visible source label. */
  label: string
  /** Source or license destination. */
  url?: string
  /** License name or identifier. */
  license?: string
  /** Source dataset or service version. */
  version?: string
  /** Publishing authority. */
  authority?: string
  /** Publication date or year. */
  publishedAt?: string
  /** Additional use restrictions. */
  usageRestrictions?: string
  /** Whether the source is designated official by its provider. */
  official?: boolean
}

/** Numeric symbol property at one zoom level. */
export type ZoomStop = { zoom: number; value: number }

/** Renderer-neutral point symbol. */
export type PointSymbol = {
  /** Symbol discriminator. */
  kind: 'point'
  /** Marker geometry. */
  shape?: 'circle' | 'square' | 'triangle' | 'diamond'
  /** Marker radius in CSS pixels. */
  radius?: number
  /** Zoom-dependent marker radius. */
  radiusStops?: ZoomStop[]
  /** Fill color. */
  fillColor?: string
  /** Stroke color. */
  strokeColor?: string
  /** Stroke width in CSS pixels. */
  strokeWidth?: number
  /** Opacity from zero to one. */
  opacity?: number
  /** Feature property used for labels. */
  labelField?: string
  /** Label text color. */
  labelColor?: string
}

/** Renderer-neutral line symbol. */
export type LineSymbol = {
  /** Symbol discriminator. */
  kind: 'line'
  /** Line color. */
  color: string
  /** Line width in CSS pixels. */
  width?: number
  /** Zoom-dependent line width. */
  widthStops?: ZoomStop[]
  /** Stroke dash pattern. */
  dash?: number[]
  /** Opacity from zero to one. */
  opacity?: number
  /** Feature property used for labels. */
  labelField?: string
}

/** Renderer-neutral polygon symbol. */
export type PolygonSymbol = {
  /** Symbol discriminator. */
  kind: 'polygon'
  /** Fill color. */
  fillColor?: string
  /** Boundary stroke color. */
  strokeColor?: string
  /** Boundary stroke width in CSS pixels. */
  strokeWidth?: number
  /** Boundary dash pattern. */
  dash?: number[]
  /** Opacity from zero to one. */
  opacity?: number
  /** Feature property used for labels. */
  labelField?: string
  /** Label text color. */
  labelColor?: string
}

/** Point, line, or polygon symbol definition. */
export type SymbolSpec = PointSymbol | LineSymbol | PolygonSymbol

/** One explicit class in a thematic legend. */
export type LegendClass = {
  /** Optional stable class identifier. */
  id?: string
  /** Visible class label. */
  label: string
  /** Class symbol. */
  symbol: SymbolSpec
}

/** Constant, categorical, graduated, or continuous thematic style. */
export type ThematicStyleSpec =
  | {
      /** Constant-style discriminator. */
      type: 'constant'
      /** Symbol applied to every feature. */
      symbol: SymbolSpec
    }
  | {
      /** Categorical-style discriminator. */
      type: 'categorical'
      /** Feature property used for category matching. */
      field: string
      /** Explicit value-to-symbol classes. */
      categories: Array<LegendClass & { value: string | number | boolean }>
      /** Class used for unmatched values. */
      fallback?: LegendClass
      /** Explicit classes for missing or special values. */
      specialValues?: Array<LegendClass & { value: string | number | boolean | null }>
    }
  | {
      /** Graduated-style discriminator. */
      type: 'graduated'
      /** Numeric feature property used for classification. */
      field: string
      /** Ordered numeric class ranges. */
      classes: Array<LegendClass & { min?: number; max?: number }>
      /** Class used for absent values. */
      missing?: LegendClass
      /** Explicit classes for special values. */
      specialValues?: Array<LegendClass & { value: string | number | boolean | null }>
      /** Class used outside all ranges. */
      outOfRange?: LegendClass
    }
  | {
      /** Continuous-style discriminator. */
      type: 'continuous'
      /** Numeric feature property used for interpolation. */
      field: string
      /** Inclusive numeric interpolation domain. */
      domain: readonly [number, number]
      /** Ordered color interpolation stops. */
      stops: Array<{ value: number; color: string; label?: string }>
      /** Base geometry symbol receiving interpolated color. */
      symbol?: SymbolSpec
      /** Clamps values to the declared domain. */
      clamp?: boolean
      /** Class used for absent values. */
      missing?: LegendClass
      /** Explicit classes for special values. */
      specialValues?: Array<LegendClass & { value: string | number | boolean | null }>
      /** Class used outside the domain when not clamped. */
      outOfRange?: LegendClass
    }

/** One normalized row or ramp in a rendered legend. */
export type LegendEntry = {
  /** Stable legend-entry identifier. */
  id: string
  /** Visible entry label. */
  label: string
  /** Symbol or continuous gradient preview. */
  symbol: SymbolSpec | { kind: 'gradient'; stops: Array<{ value: number; color: string }> }
  /** Optional category or numeric range represented by the entry. */
  value?: string | number | boolean | readonly [number, number]
}

/** Layer legend metadata and optional explicit entries. */
export type LegendSpec = {
  /** Legend title. */
  title?: string
  /** Secondary title. */
  subtitle?: string
  /** Measurement units. */
  units?: string
  /** Explanatory description. */
  description?: string
  /** Source or methodology note. */
  sourceNote?: string
  /** Preferred legend visualization. */
  presentation?: 'list' | 'continuous-ramp' | 'size-ramp'
  /** Explicit entries; omitted entries are derived from thematic style. */
  entries?: LegendEntry[]
  /** Shows a visibility control in supported legend layouts. */
  showLayerToggle?: boolean
  /** Time-specific metadata and entries keyed by frame value. */
  byTime?: Record<
    string,
    {
      title?: string
      subtitle?: string
      units?: string
      description?: string
      sourceNote?: string
      entries?: LegendEntry[]
    }
  >
}

/** Time linkage for one data layer. */
export type LayerTimeSpec = {
  /** Ordered available frame identifiers. */
  available: string[]
  /** Mechanism used to select a frame. */
  mode: 'property' | 'url-template' | 'wms-parameter' | 'source-replacement'
  /** Property, template key, or service parameter used by the mechanism. */
  fieldOrParameter?: string
  /** Behavior when a frame has no data. */
  missingPolicy?: 'hide' | 'unavailable' | 'retain-last'
  /** Number of subsequent frames eligible for prefetch. */
  prefetchFrames?: number
}

/** Fields shared by every configured map layer. */
export type CommonLayerConfig = {
  /** Stable layer identifier. */
  id: string
  /** Visible layer title. */
  title: string
  /** Semantic layer role. */
  role: 'basemap' | 'indicator' | 'boundary' | 'reference'
  /** Initial visibility. */
  visible?: boolean
  /** Initial opacity from zero to one. */
  opacity?: number
  /** Minimum visible zoom. */
  minZoom?: number
  /** Maximum visible zoom. */
  maxZoom?: number
  /** Initial renderer stacking index. */
  zIndex?: number
  /** Allows user-driven reordering. */
  reorderable?: boolean
  /** Marks source failures as map-blocking. */
  required?: boolean
  /** Includes the layer in package layer controls. */
  showInLayerControl?: boolean
  /** Prevents reordering regardless of panel policy. */
  orderLocked?: boolean
  /** Optional visual grouping label. */
  group?: string
  /** Group in which only one layer may be visible. */
  exclusiveGroup?: string
  /** Enables feature hit detection. */
  selectable?: boolean
  /** Tie-break priority for overlapping selectable features. */
  hitPriority?: number
  /** Feature property containing a stable identifier. */
  featureIdField?: string
  /** Feature properties permitted in public interaction events. */
  propertyAllowlist?: string[]
  /** Boundary dataset identifier used in selections. */
  boundarySetId?: string
  /** Administrative or geographic level used in selections. */
  geographyLevel?: string
  /** Source attributions. */
  attribution?: AttributionSpec[]
  /** Optional time-series linkage. */
  time?: LayerTimeSpec
  /** Optional legend metadata. */
  legend?: LegendSpec
  /** Whether this source may be included in exports. */
  exportable?: boolean
}

/** GeoJSON vector layer configuration. */
export type GeoJsonLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'geojson'
  /** Inline feature collection or URL descriptor. */
  data: FeatureCollection | { url: string }
  /** Projection code of input coordinates; defaults to WGS 84. */
  dataProjection?: string
  /** Client-side thematic style. */
  style: ThematicStyleSpec
}

/** GeoJSON-backed aggregate density layer rendered as a heatmap. */
export type HeatmapLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'heatmap'
  /** Inline feature collection or URL descriptor. */
  data: FeatureCollection | { url: string }
  /** Projection code of input coordinates; defaults to WGS 84. */
  dataProjection?: string
  /** Numeric feature property used as a zero-to-one contribution weight. */
  weightField?: string
  /** Base heat radius in CSS pixels. */
  radius?: number
  /** Base blur radius in CSS pixels. */
  blur?: number
  /** Zoom-dependent heat radius; overrides `radius` when present. */
  radiusStops?: ZoomStop[]
  /** Zoom-dependent blur radius; overrides `blur` when present. */
  blurStops?: ZoomStop[]
  /** Low-to-high heat colors. */
  gradient?: string[]
}

/** Custom source projection definition used for tiled services. */
export type ProjectionDefinition = {
  /** Projection code. */
  code: string
  /** Proj4 definition string. */
  definition: string
  /** Projected coordinate extent. */
  extent?: readonly [number, number, number, number]
  /** Geographic world extent. */
  worldExtent?: readonly [number, number, number, number]
}

/** Explicit vector or raster tile matrix geometry. */
export type VectorTileGridSpec = {
  /** Full projected tile extent. */
  extent: readonly [number, number, number, number]
  /** Top-left tile origin. */
  origin: readonly [number, number]
  /** Resolution for each source zoom. */
  resolutions: number[]
  /** Scalar or width/height tile size. */
  tileSize?: number | readonly [number, number]
}

/** Mapbox Vector Tile layer configuration. */
export type VectorTileLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'mvt'
  /** URL template containing tile coordinates. */
  urlTemplate: string
  /** Projection code used by source tiles. */
  sourceProjection: string
  /** Optional custom source projection definition. */
  sourceProjectionDefinition?: ProjectionDefinition
  /** Source layer inside each MVT tile. */
  sourceLayer?: string
  /** Highest source zoom requested. */
  maxSourceZoom?: number
  /** Optional nonstandard tile grid. */
  tileGrid?: VectorTileGridSpec
  /** Wraps tiles horizontally across the antimeridian. */
  wrapX?: boolean
  /** Client-side thematic style. */
  style?: ThematicStyleSpec
  /** Optional Mapbox style document and source selector. */
  mapboxStyle?: {
    /** Style JSON URL. */
    url: string
    /** Source name selected from the style. */
    source?: string
  }
}

/** XYZ raster tile layer configuration. */
export type XyzLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'xyz'
  /** URL template containing tile coordinates. */
  urlTemplate: string
  /** Projection code used by source tiles. */
  sourceProjection: string
  /** Browser image CORS mode. */
  crossOrigin?: 'anonymous' | 'use-credentials'
  /** Highest source zoom requested. */
  maxSourceZoom?: number
}

/** Web Map Service layer configuration. */
export type WmsLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'wms'
  /** WMS service URL. */
  url: string
  /** GetMap parameters including `LAYERS`. */
  params: Record<string, string | number | boolean> & { LAYERS: string }
  /** Projection requested from the service. */
  sourceProjection: string
  /** Browser image CORS mode. */
  crossOrigin?: 'anonymous' | 'use-credentials'
  /** Requests tiled rather than single-image rendering. */
  tiled?: boolean
}

/** WMTS tile matrix geometry with service matrix identifiers. */
export type WmtsTileGridSpec = VectorTileGridSpec & {
  /** Matrix identifier corresponding to each resolution. */
  matrixIds: string[]
}

/** Web Map Tile Service layer configuration. */
export type WmtsLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'wmts'
  /** WMTS tile URL or template. */
  url: string
  /** Service layer identifier. */
  layer: string
  /** Service matrix-set identifier. */
  matrixSet: string
  /** Requested image MIME type. */
  format: string
  /** Projection used by the matrix set. */
  sourceProjection: string
  /** Optional service style identifier. */
  styleName?: string
  /** Explicit matrix geometry. */
  tileGrid: WmtsTileGridSpec
  /** Browser image CORS mode. */
  crossOrigin?: 'anonymous' | 'use-credentials'
}

/** Supported vector and raster layer source definitions. */
export type MapLayerConfig =
  | GeoJsonLayerConfig
  | HeatmapLayerConfig
  | VectorTileLayerConfig
  | XyzLayerConfig
  | WmsLayerConfig
  | WmtsLayerConfig

/** One projection-aware basemap composed from configured layers. */
export type BasemapConfig = {
  /** Stable basemap identifier. */
  id: string
  /** Visible basemap title. */
  title: string
  /** Projections in which this basemap may render. */
  supportedProjections: ProjectionId[]
  /** Ordered layers composing the basemap. */
  layers: MapLayerConfig[]
  /** Map background shown beneath basemap layers. */
  backgroundColor: string
  /** Basemap attributions. */
  attribution: AttributionSpec[]
  /** Whether the basemap may be included in output images. */
  exportable: boolean
  /** Projections for which this is a preferred fallback. */
  fallbackFor?: ProjectionId[]
  /** Marks a basemap that requires network access. */
  network?: boolean
}

/** Serializable identity for one selected geographic feature. */
export type MapSelection = {
  /** Layer containing the feature. */
  layerId: string
  /** Stable feature identifier. */
  featureId: string
  /** Optional boundary dataset identifier. */
  boundarySetId?: string
  /** Optional administrative or geographic level. */
  geographyLevel?: string
}

/** One selectable feature under the interaction point. */
export type FeatureCandidate = MapSelection & {
  /** Optional human-readable candidate title. */
  title?: string
  /** Allowlisted JSON-safe feature properties. */
  properties: Record<string, JsonValue>
}

/** Structured host event for selection and popup data retrieval. */
export type FeatureEvent = MapSelection & {
  /** Map instance that emitted the event. */
  mapId: string
  /** Geographic interaction coordinate. */
  coordinate: LonLat
  /** Allowlisted JSON-safe feature properties. */
  properties: Record<string, JsonValue>
  /** Other selectable features under the same interaction point. */
  candidates?: FeatureCandidate[]
  /** Input mechanism that caused selection. */
  interaction: 'click' | 'tap' | 'keyboard' | 'external'
}

/** View change payload. */
export type ViewChangeEvent = { view: MapViewState; origin: MapOrigin }
/** Projection transition payload. */
export type ProjectionChangeEvent = {
  /** Projection before the transition. */
  previous: ProjectionId
  /** Projection after the transition. */
  current: ProjectionId
  /** Canonical resulting view. */
  view: MapViewState
  /** Source of the transition. */
  origin: MapOrigin
}
/** Visibility, opacity, or order change payload. */
export type LayerStateEvent = {
  /** Affected layer identifier. */
  layerId: string
  /** Resulting visibility. */
  visible: boolean
  /** Resulting opacity. */
  opacity: number
  /** Resulting zero-based overlay index. */
  index: number
  /** Source of the transition. */
  origin: MapOrigin
}
/** Thematic style change payload. */
export type SymbologyChangeEvent = {
  /** Affected layer identifier. */
  layerId: string
  /** Resulting thematic style. */
  style: ThematicStyleSpec
  /** Source of the transition. */
  origin: MapOrigin
}
/** Time selection change payload. */
export type TimeChangeEvent = { time: string | null; origin: MapOrigin }

export type MapErrorCode =
  /** The versioned JSON-safe component configuration failed validation. */
  | 'CONFIG_INVALID'
  /** The requested projection is not supported by the current data or renderer. */
  | 'PROJECTION_UNSUPPORTED'
  /** The active basemap cannot render in the requested projection. */
  | 'BASEMAP_INCOMPATIBLE'
  /** A configured data source failed to load. */
  | 'SOURCE_LOAD_FAILED'
  /** A thematic style could not be compiled. */
  | 'STYLE_INVALID'
  /** A selectable feature has no stable identifier. */
  | 'FEATURE_ID_MISSING'
  /** A requested time frame failed to load. */
  | 'TIME_FRAME_FAILED'
  /** Browser cross-origin rules prevent image export. */
  | 'EXPORT_CORS_BLOCKED'
  /** Export did not finish within the configured timeout. */
  | 'EXPORT_TIMEOUT'

/** Structured configuration, source, renderer, or export error. */
export type MapError = {
  /** Stable error code. */
  code: MapErrorCode
  /** Human-readable error description. */
  message: string
  /** Whether the map can continue and the error can be dismissed. */
  recoverable: boolean
  /** Optional affected layer identifier. */
  layerId?: string
  /** Original validation issues or runtime cause. */
  cause?: unknown
}

/** Current load and availability state for one layer. */
export type LayerStatus = {
  /** Layer identifier. */
  id: string
  /** Whether the source is loading. */
  loading: boolean
  /** Current source or frame error. */
  error?: MapError
  /** Whether the active filters or frame contain no data. */
  noData?: boolean
  /** Whether the layer is outside its visible zoom range. */
  scaleUnavailable?: boolean
}

/** Legend model resolved for one layer and current frame. */
export type NormalizedLegend = {
  /** Source layer identifier. */
  layerId: string
  /** Legend title. */
  title: string
  /** Optional subtitle. */
  subtitle?: string
  /** Optional measurement units. */
  units?: string
  /** Optional explanatory description. */
  description?: string
  /** Optional source or methodology note. */
  sourceNote?: string
  /** Whether the source layer is visible. */
  visible: boolean
  /** Resolved legend entries. */
  entries: LegendEntry[]
}

/** Predefined geographic extent exposed in navigation controls. */
export type ZoomTarget = {
  /** Stable target identifier. */
  id: string
  /** Visible target label. */
  label: string
  /** Geographic target bounds. */
  bounds: LonLatBounds
  /** Optional parent target. */
  parentId?: string
  /** Optional administrative or geographic level. */
  geographyLevel?: string
  /** Maximum zoom after fitting the target. */
  maxZoom?: number
}

/** One item in an intuitive geographic hierarchy. */
export type HierarchyItem = {
  /** Stable hierarchy item identifier. */
  id: string
  /** Visible item label. */
  label: string
  /** Administrative or geographic level. */
  geographyLevel: string
  /** Optional predefined zoom target activated by the item. */
  targetId?: string
}

/** Geographic bounds accepted by fit operations. */
export type FitTarget = LonLatBounds | { bounds: LonLatBounds }
/** Animation and constraints applied to fit operations. */
export type FitOptions = {
  /** Viewport padding ordered top, right, bottom, left. */
  padding?: readonly [top: number, right: number, bottom: number, left: number]
  /** Fit animation duration in milliseconds. */
  duration?: number
  /** Maximum zoom after fitting. */
  maxZoom?: number
}

/** Supported report image MIME types. */
export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/svg+xml'
/** Options for one report-ready export operation. */
export type ExportOptions = {
  /** Output image MIME type. */
  format: ExportFormat
  /** Output width in pixels. */
  width?: number
  /** Output height in pixels. */
  height?: number
  /** Raster scale factor from one to three. */
  pixelRatio?: number
  /** JPEG encoder quality from zero to one. */
  quality?: number
  /** Report title. */
  title?: string
  /** Report subtitle. */
  subtitle?: string
  /** Optional selected-area label. */
  selectedAreaLabel?: string
  /** Includes normalized visible legends. */
  includeLegend?: boolean
  /** Includes required source attributions. */
  includeAttribution?: boolean
  /** Maximum source-settle duration in milliseconds. */
  timeoutMs?: number
}

/** Content and close action supplied to popup renderers. */
export type PopupContext = {
  /** Complete selected-feature event. */
  selection: FeatureEvent
  /** Clears selection and closes the popup. */
  close: () => void
}

/** Focused lifecycle and domain events emitted in addition to `onStateChange`. */
export type MapCallbacks = {
  /** Called after the OpenLayers renderer completes initialization. */
  onReady?: (view: MapViewState) => void
  /** Called after the visible view changes. */
  onViewChange?: (event: ViewChangeEvent) => void
  /** Called when the feature under the pointer changes. */
  onFeatureHover?: (event: FeatureEvent | null) => void
  /** Called when a selectable feature is selected or cleared. */
  onFeatureSelect?: (event: FeatureEvent | null) => void
  /** Called after visibility, opacity, or ordering changes. */
  onLayerStateChange?: (event: LayerStateEvent) => void
  /** Called after a thematic style changes through normal React state flow. */
  onSymbologyChange?: (event: SymbologyChangeEvent) => void
  /** Called after the map projection changes. */
  onProjectionChange?: (event: ProjectionChangeEvent) => void
  /** Called after the selected time changes. */
  onTimeChange?: (event: TimeChangeEvent) => void
  /** Called for configuration, source, rendering, and export failures. */
  onError?: (error: MapError) => void
  /** Called when aggregate layer loading and availability state changes. */
  onStatusChange?: (status: LayerStatus[]) => void
  /** Called with renderer timing measurements. */
  onMetric?: (metric: MapMetric) => void
}

/** Renderer performance measurement. */
export type MapMetric = {
  /** Measured operation. */
  name: 'ready' | 'source-load' | 'view-render' | 'export'
  /** Operation duration in milliseconds. */
  durationMs: number
  /** Optional measured layer. */
  layerId?: string
  /** Optional low-cardinality measurement context. */
  detail?: Record<string, string | number | boolean>
}

/** Legacy-compatible playback defaults used by time UI helpers. */
export type TimePlaybackOptions = {
  /** Available playback durations in milliseconds. */
  speedsMs?: number[]
  /** Initially selected playback duration. */
  defaultSpeedMs?: number
}

/** Mutable presentation state owned by the host or initialized by configuration. */
export type MapLayerState = {
  /** Whether the layer is rendered. */
  visible: boolean
  /** Layer opacity from zero to one. */
  opacity: number
  /** Zero-based display order among configured overlay layers. */
  order: number
  /** Optional host-controlled thematic style override. */
  style?: ThematicStyleSpec
}

/** Complete serializable state for one map. */
export type MapState = {
  /** Current center, zoom, rotation, constraints, and projection. */
  view: MapViewState
  /** Identifier of the active configured basemap. */
  activeBasemapId?: string
  /** Mutable state keyed by configured overlay layer identifier. */
  layers: Record<string, MapLayerState>
  /** Current feature selection, or `null` when nothing is selected. */
  selection: MapSelection | null
  /** Current ISO or application-defined time key, or `null`. */
  time: string | null
}

/** Mutable map-state domain. */
export type MapStateDomain = 'view' | 'basemap' | 'layers' | 'selection' | 'time' | 'symbology'

/** Describes why a complete state snapshot was proposed. */
export type MapStateChange = {
  /** State domain changed by this proposal. */
  domain: MapStateDomain
  /** Source of the state transition. */
  origin: MapOrigin
  /** Affected layer for layer and symbology transitions. */
  layerId?: string
}

/** Corner placement for package-owned floating UI. */
export type MapPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
/** Built-in UI configuration profile. */
export type MapUiProfileId = 'full' | 'compact' | 'embedded' | 'grid'
/** Package-owned map control identifier. */
export type BuiltInControlId =
  'zoom-in' | 'zoom-out' | 'reset-zoom' | 'locate' | 'layers' | 'fit' | 'settings' | 'fullscreen'
/** Built-in or registered custom map control identifier. */
export type MapControlId = BuiltInControlId | `custom:${string}`
/** Settings field identifier. */
export type SettingsFieldId = 'projection' | 'basemap' | 'zoom-target' | 'export'

/** Accessibility behavior and map-region labeling. */
export type AccessibilityConfig = {
  /** Accessible name applied to the interactive map region. */
  ariaLabel: string
  /** Enables renderer keyboard interactions; defaults to `true`. */
  keyboard?: boolean
  /** Controls whether component animation respects reduced-motion preferences. */
  reducedMotion?: 'respect' | 'ignore'
}

/** Fine-grained policy for renderer interactions. */
export type MapInteractionConfig = {
  /** Enables pointer and touch panning. */
  dragPan?: boolean
  /** Enables mouse-wheel and trackpad zoom. */
  wheelZoom?: boolean
  /** Enables double-click zoom. */
  doubleClickZoom?: boolean
  /** Enables pinch zoom. */
  pinchZoom?: boolean
  /** Enables keyboard navigation. */
  keyboard?: boolean
  /** Enables map rotation gestures. */
  rotate?: boolean
  /** Enables feature hover events. */
  hover?: boolean
  /** Enables feature selection events. */
  select?: boolean
  /** Selection hit tolerance in CSS pixels. */
  selectHitTolerance?: number
  /** Hover hit tolerance in CSS pixels. */
  hoverHitTolerance?: number
}

/** Stable policies for view behavior and interaction. */
export type ViewConfig = {
  /** Manual or zoom-driven projection switching policy. */
  projectionBehavior?: ProjectionBehavior
  /** Enabled renderer interactions. */
  interactions?: MapInteractionConfig
  /** Default animation and padding for fit operations. */
  fit?: FitOptions
}

/** JSON-safe map data, basemap, target, and hierarchy definitions. */
export type DataConfig = {
  /** Ordered vector, raster, boundary, and reference layers. */
  layers: MapLayerConfig[]
  /** Available basemap definitions. */
  basemaps: BasemapConfig[]
  /** Named extents exposed by the zoom-target UI. */
  zoomTargets?: ZoomTarget[]
  /** Ordered geographic navigation hierarchy. */
  hierarchy?: HierarchyItem[]
}

/** One visually grouped set of control-rail actions. */
export type ControlGroupConfig = {
  /** Stable group identifier. */
  id: string
  /** Exact ordered control identifiers; arrays replace profile defaults. */
  controls: MapControlId[]
}

/** Floating map control-rail configuration. */
export type ControlRailConfig = {
  /** Shows or hides the complete rail. */
  enabled?: boolean
  /** Corner in which the rail is anchored. */
  placement?: MapPlacement
  /** Ordered control groups. */
  groups?: ControlGroupConfig[]
  /** Zoom delta used by zoom buttons. */
  zoomStep?: number
  /** Browser geolocation options and destination zoom. */
  locate?: {
    /** Requests the browser's high-accuracy location mode. */
    enableHighAccuracy?: boolean
    /** Maximum location request duration in milliseconds. */
    timeoutMs?: number
    /** Maximum cached-location age in milliseconds. */
    maximumAgeMs?: number
    /** Zoom applied after a successful location result. */
    zoom?: number
  }
  /** Data target used by the fit control. */
  fitTarget?: 'selection' | 'data' | 'selection-or-data'
  /** Element entered into browser fullscreen. */
  fullscreenTarget?: 'map' | 'container'
}

/** Projection, basemap, target, and export settings panel. */
export type SettingsPanelConfig = {
  /** Enables the panel and its control-rail action. */
  enabled?: boolean
  /** Corner in which the panel is anchored. */
  placement?: MapPlacement
  /** Opens the panel on initial render and configuration replacement. */
  defaultOpen?: boolean
  /** Exact ordered list of settings fields. */
  fields?: SettingsFieldId[]
}

/** Layer-management panel policy. */
export type LayerPanelConfig = {
  /** Enables the panel and its control-rail action. */
  enabled?: boolean
  /** Corner in which the panel is anchored. */
  placement?: MapPlacement
  /** Opens the panel on initial render and configuration replacement. */
  defaultOpen?: boolean
  /** Allows consumers to toggle layer visibility. */
  allowVisibility?: boolean
  /** Allows consumers to edit opacity. */
  allowOpacity?: boolean
  /** Allows consumers to reorder unlocked layers. */
  allowReorder?: boolean
  /** Shows role, group, and source status metadata. */
  showMetadata?: boolean
  /** Organizes contiguous layers by configured group, semantic role, or not at all. */
  groupBy?: 'group' | 'role' | 'none'
  /** Shows secondary controls on demand or for every layer. */
  itemDetails?: 'disclosure' | 'always'
  /** Layer IDs whose secondary controls initially open in disclosure mode. */
  defaultExpandedLayerIds?: string[]
  /** Shows the first normalized legend symbol beside each layer title. */
  showSymbolPreview?: boolean
}

/** Contextual legend surface configuration. */
export type LegendPanelConfig = {
  /** Enables legend rendering. */
  enabled?: boolean
  /** Corner in which the legend is anchored. */
  placement?: MapPlacement
  /** Shows the legend immediately when applicable. */
  defaultOpen?: boolean
  /** Selects standard or space-efficient legend rendering. */
  layout?: 'list' | 'compact'
}

/** Selected-feature popup policy. */
export type PopupConfig = {
  /** Enables the package-owned popup shell. */
  enabled?: boolean
  /** Corner in which the popup is anchored. */
  placement?: MapPlacement
  /** Clears selection when the user clicks empty map space. */
  closeOnMapClick?: boolean
}

/** Basemap and data attribution surface configuration. */
export type AttributionConfig = {
  /** Enables visible attribution. Consumers remain responsible for source terms. */
  enabled?: boolean
  /** Corner in which attribution is anchored. */
  placement?: MapPlacement
  /** Uses the space-efficient attribution treatment. */
  compact?: boolean
}

/** Layer loading and availability surface configuration. */
export type StatusConfig = {
  /** Enables status rendering. */
  enabled?: boolean
  /** Corner in which status is anchored. */
  placement?: MapPlacement
  /** Shows in-progress layer loads. */
  showLoading?: boolean
  /** Shows layers with no data for the current filters or time. */
  showNoData?: boolean
  /** Shows layers outside their configured zoom range. */
  showScaleUnavailable?: boolean
}

/** Recoverable runtime error-surface configuration. */
export type ErrorPanelConfig = {
  /** Enables recoverable error rendering. */
  enabled?: boolean
  /** Corner in which runtime errors are anchored. */
  placement?: MapPlacement
  /** Allows consumers to dismiss recoverable errors. */
  dismissible?: boolean
}

/** Consumer overrides layered over the selected UI profile. */
export type MapUiConfig = {
  /** Base profile resolved before consumer overrides. */
  profile?: MapUiProfileId
  /** Control-rail visibility, placement, order, and behavior. */
  controlRail?: ControlRailConfig
  /** Settings panel visibility, placement, and fields. */
  settings?: SettingsPanelConfig
  /** Layer panel capabilities and presentation. */
  layers?: LayerPanelConfig
  /** Legend visibility and presentation. */
  legend?: LegendPanelConfig
  /** Selected-feature popup behavior. */
  popup?: PopupConfig
  /** Attribution presentation. */
  attribution?: AttributionConfig
  /** Loading and data-availability presentation. */
  status?: StatusConfig
  /** Recoverable error presentation. */
  errors?: ErrorPanelConfig
  /** Hierarchy breadcrumb visibility and placement. */
  hierarchy?: { enabled?: boolean; placement?: MapPlacement }
}

/** Fully defaulted UI profile after recursive resolution. */
export type ResolvedMapUiConfig = {
  /** Resolved profile identifier. */
  profile: MapUiProfileId
  /** Fully resolved control-rail policy. */
  controlRail: Required<Omit<ControlRailConfig, 'locate'>> & {
    locate: Required<NonNullable<ControlRailConfig['locate']>>
  }
  /** Fully resolved settings policy. */
  settings: Required<SettingsPanelConfig>
  /** Fully resolved layer-panel policy. */
  layers: Required<LayerPanelConfig>
  /** Fully resolved legend policy. */
  legend: Required<LegendPanelConfig>
  /** Fully resolved popup policy. */
  popup: Required<PopupConfig>
  /** Fully resolved attribution policy. */
  attribution: Required<AttributionConfig>
  /** Fully resolved status policy. */
  status: Required<StatusConfig>
  /** Fully resolved error-surface policy. */
  errors: Required<ErrorPanelConfig>
  /** Fully resolved hierarchy policy. */
  hierarchy: { enabled: boolean; placement: MapPlacement }
}

/** Time-series playback and failure behavior. */
export type TimeConfig = {
  /** Enables time controls when layers expose time values. */
  enabled?: boolean
  /** Corner in which time controls are anchored. */
  placement?: MapPlacement
  /** Available playback frame durations in milliseconds. */
  speedsMs?: number[]
  /** Initially selected playback frame duration. */
  defaultSpeedMs?: number
  /** Starts playback after initialization. */
  autoplay?: boolean
  /** Restarts playback after the final frame. */
  loop?: boolean
  /** Pauses, retains, or skips ahead after a required frame load failure. */
  frameFailurePolicy?: 'pause' | 'retain-last' | 'skip'
  /** Controls whether playback respects reduced-motion preferences. */
  reducedMotion?: 'respect' | 'ignore'
}

/** Report-ready image export policy and defaults. */
export type ExportConfig = Partial<Omit<ExportOptions, 'format'>> & {
  /** Enables export in the settings surface. */
  enabled?: boolean
  /** Allowed output MIME types. */
  formats?: ExportFormat[]
  /** Preferred format, displayed first when allowed. */
  defaultFormat?: ExportFormat
}

/**
 * JSON theme overrides. Each key maps to one `--geo-*` CSS custom property (see `theme.ts`);
 * only keys you set are written inline, so stylesheet defaults and overrides stay in control.
 */
export type MapThemeTokens = {
  /** Font stack used by all package-owned map UI. */
  fontFamily: string
  /** Primary text color. */
  textColor: string
  /** Secondary text color. */
  mutedColor: string
  /** Panel and control border color. */
  borderColor: string
  /** Primary panel surface. */
  surfaceColor: string
  /** Secondary panel surface. */
  softSurfaceColor: string
  /** Translucent floating-panel surface. */
  glassColor: string
  /** Primary interactive accent. */
  accentColor: string
  /** Hover and active accent. */
  accentHoverColor: string
  /** Destructive and error color. */
  dangerColor: string
  /** Keyboard focus-ring color. */
  focusColor: string
  /** Shared panel and control radius. */
  radius: string
  /** Shared floating-surface shadow. */
  shadow: string
  /** Map control width and minimum height. */
  controlSize: string
  /** Comfortable or space-efficient UI density. */
  density: 'comfortable' | 'compact'
}

/** English UI copy and templated announcements. */
export type MapMessages = {
  /** Initial loading announcement. */
  mapLoading: string
  /** Ready announcement. */
  mapReady: string
  /** Projection-change template with `{projection}`. */
  projectionChanged: string
  /** Selection template with `{feature}`. */
  selectedFeature: string
  /** Selection-cleared announcement. */
  selectionCleared: string
  /** Time-change template with `{time}`. */
  timeChanged: string
  /** Time-cleared announcement. */
  timeCleared: string
  /** Accessible name for the control rail. */
  mapControls: string
  /** Zoom-in action label. */
  zoomIn: string
  /** Zoom-out action label. */
  zoomOut: string
  /** Reset-to-initial-zoom action label. */
  resetZoom: string
  /** Geolocation action label. */
  findLocation: string
  /** Message shown when geolocation is unavailable. */
  locationUnavailable: string
  /** Message shown when geolocation fails or is denied. */
  locationDenied: string
  /** Layer-panel action label. */
  layers: string
  /** Fit-selection action label. */
  fitSelection: string
  /** Fit-data action label. */
  fitData: string
  /** Settings action label. */
  mapSettings: string
  /** Fullscreen action label. */
  fullscreen: string
  /** Settings panel heading. */
  mapOptions: string
  /** Settings panel description. */
  viewAndOutput: string
  /** Settings close-button label. */
  closeSettings: string
  /** Projection field label. */
  projection: string
  /** Equal Earth projection label. */
  equalEarth: string
  /** ArcGIS Equal Earth projection label. */
  equalEarthArcgis: string
  /** Web Mercator projection label. */
  mercator: string
  /** Basemap field label. */
  basemap: string
  /** Network-source badge label. */
  network: string
  /** Zoom-target field heading. */
  goToArea: string
  /** Zoom-target accessible label. */
  zoomToArea: string
  /** Zoom-target placeholder. */
  chooseArea: string
  /** Export field heading. */
  download: string
  /** Export field accessible label. */
  exportMap: string
  /** Export placeholder. */
  exportReportImage: string
  /** Layer panel eyebrow. */
  mapContent: string
  /** Layer panel accessible name. */
  mapLayers: string
  /** Layer panel close-button label. */
  closeLayers: string
  /** Visible-layer count template with `{visible}` and `{total}`. */
  layersVisible: string
  /** Layer details region template with `{layer}`. */
  layerOptions: string
  /** Expand-layer template with `{layer}`. */
  showLayerOptions: string
  /** Collapse-layer template with `{layer}`. */
  hideLayerOptions: string
  /** Fallback heading for layers without a configured group. */
  otherLayers: string
  /** Helper text for mutually exclusive layer groups. */
  oneLayerAtATime: string
  /** Opacity template with `{value}`. */
  opacity: string
  /** Exclusive-group helper label. */
  chooseOne: string
  /** Out-of-scale layer status. */
  unavailableAtScale: string
  /** No-data layer status. */
  noDataForTime: string
  /** Source-error layer status. */
  sourceError: string
  /** Move-up template with `{layer}`. */
  moveLayerUp: string
  /** Move-down template with `{layer}`. */
  moveLayerDown: string
  /** Legend heading. */
  legend: string
  /** Units template with `{units}`. */
  units: string
  /** Feature popup accessible name. */
  selectedFeatureDetails: string
  /** Feature popup close-button label. */
  closeFeatureDetails: string
  /** Time controls accessible name. */
  timeControls: string
  /** Playback start action label. */
  playTime: string
  /** Playback pause action label. */
  pauseTime: string
  /** Playback restart action label. */
  replayTime: string
  /** Previous-frame action label. */
  previousTime: string
  /** Next-frame action label. */
  nextTime: string
  /** Time slider accessible label. */
  selectedTime: string
  /** Playback-speed field label. */
  playbackSpeed: string
  /** Current-time template with `{time}`. */
  time: string
  /** Frame-loading status. */
  loadingFrame: string
  /** Frame-failure status. */
  frameUnavailable: string
  /** Generic loading label. */
  loading: string
  /** Dismiss action label. */
  dismiss: string
  /** Attribution surface accessible name. */
  attribution: string
  /** Invalid-configuration error heading. */
  invalidConfiguration: string
  /** Focused-grid return action label. */
  returnToGrid: string
  /** Grid focus template with `{title}`. */
  focusMap: string
  /** Breadcrumb navigation accessible name. */
  geographicHierarchy: string
  /** Attribution publication-date template with `{date}`. */
  publishedOn: string
  /** Attribution marker for non-official sources. */
  nonOfficial: string
  /** Error shown when a grid declares more than six maps. */
  tooManyGridMaps: string
}

/** Versioned, JSON-safe map configuration inferred from `mapConfigSchema`. */
export type GeospatialMapConfigV1 = SchemaMapConfigV1

/** One path-addressable structural or semantic configuration problem. */
export type ConfigIssue = {
  /** JSON Pointer-like path to the invalid value. */
  path: string
  /** Stable machine-readable validation category. */
  code: string
  /** Human-readable validation explanation. */
  message: string
}

/** Discriminated result returned by `validateMapConfig`. */
export type ConfigValidationResult =
  { success: true; config: GeospatialMapConfigV1 } | { success: false; issues: ConfigIssue[] }

/** Safe host actions available to package-owned extension slots. */
export type MapActions = {
  /** Changes zoom by a relative delta. */
  zoom(delta: number): void
  /** Fits the view to an explicit geographic target. */
  fit(target: FitTarget, options?: FitOptions): void
  /** Fits the current selection and reports whether one exists. */
  fitSelection(options?: FitOptions): boolean
  /** Requests a supported projection. */
  setProjection(projection: ProjectionId): void
  /** Activates a configured basemap. */
  setBasemap(id: string): void
  /** Changes one layer's visibility. */
  setLayerVisibility(layerId: string, visible: boolean): void
  /** Changes one layer's opacity. */
  setLayerOpacity(layerId: string, opacity: number): void
  /** Changes or clears the selected time. */
  setTime(time: string | null): void
  /** Clears the current feature selection. */
  clearSelection(): void
}

/** State and safe actions supplied to extension slots. */
export type MapSlotContext = {
  /** Current complete map state. */
  state: MapState
  /** Restricted package-owned action surface. */
  actions: MapActions
}

/** React extension points that retain package-owned shells and focus behavior. */
export type MapSlots = {
  /** Renders selected-feature content inside the package popup shell. */
  popup?: (context: PopupContext & MapSlotContext) => ReactNode
  /** Adds content to a package-owned panel header. */
  panelHeader?: (panel: 'settings' | 'layers' | 'legend', context: MapSlotContext) => ReactNode
  /** Adds content to a package-owned panel footer. */
  panelFooter?: (panel: 'settings' | 'layers' | 'legend', context: MapSlotContext) => ReactNode
  /** Replaces loading content while retaining the status shell. */
  loading?: (context: MapSlotContext) => ReactNode
  /** Replaces empty-state content while retaining the status shell. */
  empty?: (context: MapSlotContext) => ReactNode
  /** Replaces error content while retaining the alert shell. */
  error?: (error: MapError, context: MapSlotContext) => ReactNode
  /** Renderers keyed by registered `custom:*` control identifiers. */
  controls?: Partial<Record<`custom:${string}`, (context: MapSlotContext) => ReactNode>>
}

/** Public React props for one geospatial map. */
export type GeospatialMapProps = MapCallbacks & {
  /** Stable versioned configuration. */
  config: GeospatialMapConfigV1
  /** Complete controlled state; omit for component-owned state. */
  state?: MapState
  /** Optional class applied to the package root. */
  className?: string
  /** Restricted React extension points. */
  slots?: MapSlots
  /** Receives every proposed complete state and its change metadata. */
  onStateChange?: (state: MapState, change: MapStateChange) => void
}

/** Narrow imperative API for geometry-dependent operations. */
export type GeospatialMapHandle = {
  /** Fits the view to explicit geographic bounds. */
  fit(target: FitTarget, options?: FitOptions): void
  /** Fits the current selection and reports whether one exists. */
  fitSelection(options?: FitOptions): boolean
  /** Produces a report-ready image without downloading it. */
  exportImage(options: ExportOptions): Promise<Blob>
  /** Returns the current complete state snapshot. */
  getState(): MapState
}

/** Versioned state payload referencing a server-approved public map configuration. */
export type PublicEmbedConfig = {
  /** Embed payload version. */
  version: 1
  /** Server-owned public configuration identifier. */
  configId: string
  /** Approved initial map state. */
  state: MapState
}

/** Safe iframe snippet generation options. */
export type EmbedSnippetOptions = {
  /** Server-owned public configuration identifier. */
  configId: string
  /** Absolute embed page base URL. */
  embedBaseUrl: string
  /** Exact origins permitted for the embed URL. */
  approvedOrigins: string[]
  /** Accessible iframe title. */
  title?: string
  /** Iframe width attribute. */
  width?: string | number
  /** Iframe height attribute. */
  height?: string | number
}

/** Internal renderer serialization retained for export and controller reconciliation. */
export type SerializedMapState = {
  /** Serialization format version. */
  version: 1
  /** Serialized view. */
  view: MapViewState
  /** Active basemap identifier. */
  activeBasemapId?: string
  /** Ordered serialized overlay layers. */
  layers: Array<{ id: string; visible: boolean; opacity: number; index: number }>
  /** Serialized time selection. */
  time?: string | null
  /** Serialized feature selection. */
  selection?: MapSelection | null
}

/** One configured map cell in a comparison grid. */
export type MapGridItem = {
  /** Stable cell and map identifier. */
  id: string
  /** Visible and accessible cell title. */
  title: string
  /** Initial state for this cell. */
  initialState: MapState
  /** Optional cell-specific layers replacing shared layers. */
  layers?: MapLayerConfig[]
}

/** Versioned configuration for a maximum six-cell comparison grid. */
export type MapGridConfigV1 = {
  /** Grid configuration contract version. */
  version: 1
  /** Optional stable grid identifier. */
  id?: string
  /** Shared map configuration and default UI policies. */
  shared: GeospatialMapConfigV1
  /** One to six map cell definitions. */
  maps: MapGridItem[]
  /** Responsive grid geometry. */
  layout?: {
    /** Desktop column count. */
    columns?: 1 | 2 | 3
    /** Column count below 980 CSS pixels. */
    tabletColumns?: 1 | 2 | 3
    /** Column count below 680 CSS pixels. */
    mobileColumns?: 1 | 2 | 3
    /** Gap between cells in CSS pixels. */
    gapPx?: number
    /** Unfocused map viewport height in CSS pixels. */
    cellHeightPx?: number
  }
  /** State domains synchronized from an edited cell to peer cells. */
  sync?: { view?: boolean; layers?: boolean; time?: boolean; selection?: boolean }
  /** Focus-mode policy. */
  focus?: { enabled?: boolean }
}

/** Complete controlled or uncontrolled grid state. */
export type MapGridState = {
  /** Complete map state keyed by grid item identifier. */
  maps: Record<string, MapState>
  /** Focused grid item identifier, or `null` for the full grid. */
  focusedMapId: string | null
}

/** Public React props for a map comparison grid. */
export type MapGridProps = MapCallbacks & {
  /** Versioned grid configuration. */
  config: MapGridConfigV1
  /** Complete controlled grid state; omit for grid-owned state. */
  state?: MapGridState
  /** Optional class applied to the grid root. */
  className?: string
  /** Slots forwarded to each map cell. */
  slots?: MapSlots
  /** Receives complete grid state after a cell proposes a map-state change. */
  onStateChange?: (state: MapGridState, mapId: string, change: MapStateChange) => void
}
