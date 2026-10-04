import type { FeatureCollection } from 'geojson'
import type OlMap from 'ol/Map.js'
import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react'

/** JSON-compatible value accepted in configuration and feature properties. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
/** Geographic longitude and latitude in decimal degrees. */
export type LonLat = readonly [longitude: number, latitude: number]
/** Geographic bounds ordered west, south, east, north. */
export type LonLatBounds = readonly [west: number, south: number, east: number, north: number]
/**
 * Map projection code. Equal Earth (`EPSG:8857`) and Web Mercator (`EPSG:3857`) are built in;
 * any other code works once a basemap defines it (an ArcGIS basemap does this from its service,
 * a tile layer through `sourceProjectionDefinition`). The projection is a developer setting:
 * users cannot change it from the map.
 */
export type ProjectionId = 'EPSG:8857' | 'EPSG:3857' | (string & {})
/** Source of a map transition or event. */
export type MapOrigin = 'user' | 'prop' | 'projection-switch' | 'fit' | 'time' | 'external'

/** Where the map is looking. The center is always longitude/latitude, whatever the projection. */
export type MapViewState = {
  /** Geographic center in decimal degrees. */
  center: LonLat
  /** Zoom level (Web Mercator scale, so the same zoom shows the same scale in any projection). */
  zoom: number
  /** Active projection. */
  projection: ProjectionId
  /** Clockwise view rotation in radians. */
  rotation?: number
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
  /** Explicit entries; omitted entries are derived from thematic style. */
  entries?: LegendEntry[]
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
  /** Lets users move the layer in the layer panel. Default `true`; `false` keeps it in place. */
  reorderable?: boolean
  /** Marks source failures as map-blocking. */
  required?: boolean
  /** Includes the layer in package layer controls. */
  showInLayerControl?: boolean
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
  /** Basemap layers only: draw above your data layers (labels, borders). */
  aboveOverlays?: boolean
}

/** Data bundled with the component and loaded on first use: `'world'` is Natural Earth 1:110m country outlines. */
export type BuiltinGeoJson = { builtin: 'world' }

/** Format of data at a URL. Usually detected from the URL; set it when the URL does not show it. */
export type DataFormat = 'geojson' | 'csv' | 'json' | 'arcgis'

/**
 * Data from a URL: a GeoJSON file, an ArcGIS feature layer (`…/FeatureServer/0`, a `/query?…`
 * URL, or an ArcGIS Online item page), a CSV file, or JSON rows. Rows become points from their
 * longitude and latitude columns.
 */
export type UrlData = {
  url: string
  /** Format, when the URL does not show it (an API endpoint, for example). */
  format?: DataFormat
  /** Longitude column of CSV or JSON rows; detected from common names (lon, lng, longitude, x). */
  longitude?: string
  /** Latitude column of CSV or JSON rows; detected from common names (lat, latitude, y). */
  latitude?: string
}

/** Rows you already have (from your own API, for example) with longitude and latitude columns. */
export type RowData = {
  rows: Array<Record<string, JsonValue>>
  /** Longitude column; detected from common names (lon, lng, longitude, x). */
  longitude?: string
  /** Latitude column; detected from common names (lat, latitude, y). */
  latitude?: string
}

/** GeoJSON layer data: inline GeoJSON or rows, a URL, or a dataset bundled with the component. */
export type GeoJsonData = FeatureCollection | UrlData | RowData | BuiltinGeoJson

/** GeoJSON vector layer configuration. */
export type GeoJsonLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'geojson'
  /** Inline feature collection, URL descriptor, or bundled dataset. */
  data: GeoJsonData
  /** Projection of the data's coordinates. Default `'EPSG:4326'` (longitude/latitude). */
  sourceProjection?: string
  /** Proj4 definition, when `sourceProjection` is not built in (see `ProjectionDefinition`). */
  sourceProjectionDefinition?: ProjectionDefinition
  /** Client-side thematic style. */
  style: ThematicStyleSpec
  /**
   * How features are drawn. `'auto'` (default) uses WebGL for point layers with 5,000 or more
   * features when the browser has GPU acceleration; `'webgl'` always uses WebGL; `'canvas'`
   * never does. WebGL draws point symbols without labels; other styles use the canvas.
   */
  renderer?: 'auto' | 'canvas' | 'webgl'
  /**
   * Groups nearby points into a counted bubble; clicking a bubble zooms in to its points.
   * Point layers only; drawn by the canvas renderer.
   */
  cluster?: ClusterConfig
}

/** Point clustering for a GeoJSON layer. */
export type ClusterConfig = {
  /** Distance in pixels within which points are grouped. Default 40. */
  distance?: number
  /** Minimum distance in pixels between bubbles. Default 0. */
  minDistance?: number
}

/** GeoJSON-backed aggregate density layer rendered as a heatmap. */
export type HeatmapLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'heatmap'
  /** Inline feature collection, URL descriptor, or bundled dataset. */
  data: GeoJsonData
  /** Projection of the data's coordinates. Default `'EPSG:4326'` (longitude/latitude). */
  sourceProjection?: string
  /** Proj4 definition, when `sourceProjection` is not built in (see `ProjectionDefinition`). */
  sourceProjectionDefinition?: ProjectionDefinition
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

/** A projection the map doesn't know, defined for proj4 (find definitions on epsg.io). */
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

/** A tile grid that isn't the standard Web Mercator one. */
export type TileGridSpec = {
  /** Full projected tile extent. */
  extent: readonly [number, number, number, number]
  /** Top-left tile origin. */
  origin: readonly [number, number]
  /** Resolution for each source zoom. */
  resolutions: number[]
  /** Scalar or width/height tile size. */
  tileSize?: number | readonly [number, number]
}

/** A Mapbox GL style document (the format of ArcGIS vector tile styles) and what to draw of it. */
export type MapboxStyleSpec = {
  /** Style JSON URL. */
  url: string
  /** Source name selected from the style. */
  source?: string
  /** Style layers to draw: ids or `*` patterns, `'reference'` (labels and borders), or `'base'` (the rest). Default: all. */
  layers?: StyleLayerSelection
  /** Changes to the style's layers: colours, widths, visibility. */
  overrides?: StyleOverride[]
}

/** Mapbox Vector Tile layer configuration. */
export type VectorTileLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'mvt'
  /** Tile URL template with `{z}`, `{x}`, `{y}` (and `{time}` for timed layers). */
  url: string
  /** Projection code used by source tiles. */
  sourceProjection: string
  /** Proj4 definition, when `sourceProjection` is not built in. */
  sourceProjectionDefinition?: ProjectionDefinition
  /** Highest source zoom requested. */
  maxSourceZoom?: number
  /** Optional nonstandard tile grid. */
  tileGrid?: TileGridSpec
  /** Wraps tiles horizontally across the antimeridian. */
  wrapX?: boolean
  /** Client-side thematic style. */
  style?: ThematicStyleSpec
  /** A Mapbox GL style document to draw the tiles with. */
  mapboxStyle?: MapboxStyleSpec
}

/**
 * Which style layers a vector-tile layer draws: style layer ids or `*` patterns
 * (`'Boundary line/*'`), `'reference'` (text labels and boundary lines), or `'base'` (everything
 * else).
 */
export type StyleLayerSelection = 'reference' | 'base' | string[]

/** A change to the style layers whose id matches `layers`. */
export type StyleOverride = {
  /** Style layer id, or a pattern with `*`, for example `'Boundary line/Admin1*'`. */
  layers: string
  /** Show or hide the matching layers. */
  visible?: boolean
  /** Line, fill, text or background colour (CSS colour or `var(--token)`). */
  color?: string
  /** Line width in pixels. */
  width?: number
  /** Opacity from 0 to 1. */
  opacity?: number
  /** Any other Mapbox GL paint properties, for example `{ 'line-dasharray': [2, 2] }`. */
  paint?: Record<string, JsonValue>
  /** Any other Mapbox GL layout properties. */
  layout?: Record<string, JsonValue>
}

/**
 * An ArcGIS vector tile basemap or layer, configured with just its URL. The component reads the
 * service when the map loads: projection, tile grid, style and attribution. Use `arcgisBasemap()`
 * for a basemap.
 */
export type ArcGISVectorTileLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'arcgis-vector-tiles'
  /**
   * A `…/VectorTileServer` URL, an ArcGIS Online item page (`…/home/item.html?id=…`) of a vector
   * tile service or vector tile style, or the item id.
   */
  url: string
  /**
   * Which style layers to draw and how to change them (border colours and widths, hidden
   * layers). `url` defaults to the service's own style.
   */
  mapboxStyle?: Omit<MapboxStyleSpec, 'url'> & { url?: string }
  /** Only for services in a spatial reference the component does not recognise. */
  sourceProjectionDefinition?: ProjectionDefinition
}

/** XYZ raster tile layer configuration. */
export type XyzLayerConfig = CommonLayerConfig & {
  /** Source discriminator. */
  kind: 'xyz'
  /** Tile URL template with `{z}`, `{x}`, `{y}` (and `{time}` for timed layers). */
  url: string
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
}

/** WMTS tile matrix geometry with service matrix identifiers. */
export type WmtsTileGridSpec = TileGridSpec & {
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
  | ArcGISVectorTileLayerConfig

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
  /** Colour behind the basemap layers (the sea, usually). Default `var(--geo-stage)`. */
  backgroundColor?: string
  /** Basemap attributions. Default: the attributions of its layers. */
  attribution?: AttributionSpec[]
  /** Whether the basemap may be included in exported images. Default `true`. */
  exportable?: boolean
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
/** Time selection change payload. */
export type TimeChangeEvent = { time: string | null; origin: MapOrigin }

export type MapErrorCode =
  /** The configuration is invalid; the map shows why instead of rendering. */
  | 'CONFIG_INVALID'
  /** No basemap supports the requested projection, so the switch was refused. */
  | 'BASEMAP_INCOMPATIBLE'
  /** A layer's data, tiles or style failed to load. `layerId` names the layer. */
  | 'SOURCE_LOAD_FAILED'
  /** A selectable layer has features without the id `featureIdField` names. */
  | 'FEATURE_ID_MISSING'
  /** The browser could not (or was not allowed to) report the user's location. */
  | 'LOCATION_UNAVAILABLE'
  /** `onOpenLayersMap` threw. */
  | 'HOOK_FAILED'
  /** A visible layer's images can't be exported (no CORS, or `exportable: false`). */
  | 'EXPORT_CORS_BLOCKED'
  /** Layers did not finish loading within the export's `timeoutMs`. */
  | 'EXPORT_TIMEOUT'
  /** Export failed for another reason; `cause` has the original error. */
  | 'EXPORT_FAILED'

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

/**
 * Whether the map is usable: `loading` until the first frame is drawn and while any layer
 * loads, `ready` after that, `error` when the configuration is invalid. Mirrored on the map
 * element as `data-status` for tests and agents.
 */
export type MapLoadStatus = 'loading' | 'ready' | 'error'

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
  /**
   * Text printed under the map. The built-in export uses the configured disclaimer; set
   * `export: { disclaimer: '' }` to leave it out.
   */
  disclaimer?: string
  /** Maximum source-settle duration in milliseconds. */
  timeoutMs?: number
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

/** Mutable presentation state owned by the host or initialized by configuration. */
export type MapLayerState = {
  /** Whether the layer is shown (before its zoom range and time frames are applied). */
  visible: boolean
  /** Layer opacity from zero to one. */
  opacity: number
  /** Zero-based drawing order among your layers. */
  order: number
  /** Optional host-controlled thematic style override. */
  style?: ThematicStyleSpec
}

/** Complete serializable state for one map. */
export type MapState = {
  /** Current center, zoom, rotation and projection. */
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

/** A starting state where every field may be left out (see `MapConfigInput.initialState`). */
export type MapStateInput = Partial<Omit<MapState, 'view' | 'layers'>> & {
  view?: Partial<MapViewState>
  layers?: Record<string, MapLayerState>
}

/** Mutable map-state domain. */
export type MapStateDomain = 'view' | 'basemap' | 'layers' | 'selection' | 'time'

/** Describes why a complete state snapshot was proposed. */
export type MapStateChange = {
  /** State domain changed by this proposal. */
  domain: MapStateDomain
  /** Source of the state transition. */
  origin: MapOrigin
  /** Affected layer for layer transitions. */
  layerId?: string
}

/** Corner placement for package-owned floating UI. */
export type MapPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
/** Built-in UI configuration profile. */
export type MapUiProfileId = 'full' | 'compact' | 'embedded' | 'grid'
/** Package-owned map control identifier. */
export type BuiltInControlId =
  'zoom-in' | 'zoom-out' | 'reset-zoom' | 'locate' | 'layers' | 'fit' | 'settings' | 'fullscreen'
/** Built-in or custom map control identifier; render custom ones with `customControls`. */
export type MapControlId = BuiltInControlId | `custom:${string}`
/** Settings field identifier. */
export type SettingsFieldId = 'basemap' | 'zoom-target' | 'export'

/** Accessibility behavior and map-region labeling. */
export type AccessibilityConfig = {
  /** Accessible name applied to the interactive map region. */
  ariaLabel: string
  /**
   * `'respect'` (default) follows the user's reduced-motion setting: time playback doesn't start
   * by itself. `'ignore'` autoplays anyway.
   */
  reducedMotion?: 'respect' | 'ignore'
}

/** Which ways of moving and touching the map are on. All default to on, except `rotate`. */
export type MapInteractionConfig = {
  /** Pointer and touch panning. */
  dragPan?: boolean
  /** Mouse-wheel and trackpad zoom. */
  wheelZoom?: boolean
  /** Double-click zoom. */
  doubleClickZoom?: boolean
  /** Pinch zoom. */
  pinchZoom?: boolean
  /** Arrow keys and +/- on the focused map. */
  keyboard?: boolean
  /** Rotation gestures (alt+shift drag, two-finger twist). Default `false`. */
  rotate?: boolean
  /** Hover events and the tooltip. */
  hover?: boolean
  /** Click and tap selection. */
  select?: boolean
  /** Selection hit tolerance in CSS pixels. Default 7. */
  selectHitTolerance?: number
  /** Hover hit tolerance in CSS pixels. Default 3. */
  hoverHitTolerance?: number
}

/** How the view behaves: zoom limits, interactions, fitting and projection switching. */
export type ViewConfig = {
  /** Lowest zoom users can reach. Default 0. */
  minZoom?: number
  /** Highest zoom users can reach. Default 20. */
  maxZoom?: number
  /**
   * Start with the whole world filling the map, whatever its size; Reset zoom returns there.
   * Default: on when the configuration sets no starting zoom.
   */
  fitWorld?: boolean
  /** Enabled interactions. */
  interactions?: MapInteractionConfig
  /** Default animation and padding for fit operations. */
  fit?: FitOptions
  /** Manual or zoom-driven projection switching policy. */
  projectionBehavior?: ProjectionBehavior
}

/** JSON-safe map data, basemap, target, and hierarchy definitions. */
export type DataConfig = {
  /** Ordered vector, raster, boundary, and reference layers. */
  layers: MapLayerConfig[]
  /** Available basemap definitions. */
  basemaps: BasemapConfig[]
  /** Named extents exposed by the zoom-target UI. */
  zoomTargets?: ZoomTarget[]
  /** Ordered geographic navigation hierarchy (shown by `MapBreadcrumbs`). */
  hierarchy?: HierarchyItem[]
}

/** One visually grouped set of controls. */
export type ControlGroupConfig = {
  /** Stable group identifier. */
  id: string
  /** Exact ordered control identifiers; arrays replace profile defaults. */
  controls: MapControlId[]
}

/** The control rail (`MapControls`). */
export type ControlsConfig = {
  /** Shows or hides the whole rail. */
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
  /** What the fit control fits. */
  fitTarget?: FitTargetPolicy
  /** Element entered into browser fullscreen. */
  fullscreenTarget?: 'map' | 'container'
}

/** What "fit" fits: the selection, the data, or the selection when there is one. */
export type FitTargetPolicy = 'selection' | 'data' | 'selection-or-data'

/** The settings panel (`MapSettings`): basemap, zoom targets and export. */
export type SettingsPanelConfig = {
  /** Enables the panel and its control. */
  enabled?: boolean
  /** Corner in which the panel is anchored. */
  placement?: MapPlacement
  /** Opens the panel on first render. */
  defaultOpen?: boolean
  /** Exact ordered list of settings fields. */
  fields?: SettingsFieldId[]
}

/** The layer panel (`MapLayerPanel`). */
export type LayerPanelConfig = {
  /** Enables the panel and its control. */
  enabled?: boolean
  /** Corner in which the panel is anchored. */
  placement?: MapPlacement
  /** Opens the panel on first render. */
  defaultOpen?: boolean
  /** Lets users show and hide layers. */
  allowVisibility?: boolean
  /** Lets users change opacity. */
  allowOpacity?: boolean
  /** Lets users reorder layers that are `reorderable`. */
  allowReorder?: boolean
  /** Shows role, group, and source status metadata. */
  showMetadata?: boolean
  /** Organizes contiguous layers by configured group, semantic role, or not at all. */
  groupBy?: 'group' | 'role' | 'none'
  /** Shows secondary controls on demand or for every layer. */
  itemDetails?: 'disclosure' | 'always'
  /** Layer IDs whose secondary controls initially open in disclosure mode. */
  defaultExpandedLayerIds?: string[]
  /** Shows the first legend symbol beside each layer title. */
  showSymbolPreview?: boolean
}

/** The legend (`MapLegend`). */
export type LegendPanelConfig = {
  /** Enables the legend. */
  enabled?: boolean
  /** Corner in which the legend is anchored. */
  placement?: MapPlacement
  /** Starts expanded. */
  defaultOpen?: boolean
  /** Standard or space-efficient rows. */
  layout?: 'list' | 'compact'
}

/** A disclaimer: a small button in a bottom corner that expands to show the text. */
export type DisclaimerConfig = {
  /** Shows the disclaimer in the `<GeospatialMap>` layout. Default: on when `text` is set. */
  enabled?: boolean
  /** The disclaimer text. */
  text?: string
  /** Button label and heading; defaults to the `disclaimer` message ("Disclaimer"). */
  title?: string
  /** Bottom corner of the button. Default `'bottom-left'`. */
  placement?: 'bottom-left' | 'bottom-right'
  /** Start expanded. Default `false`. */
  defaultOpen?: boolean
}

/** The selected-feature popup (`MapPopup`). */
export type PopupConfig = {
  /** Enables the popup. */
  enabled?: boolean
  /** Corner in which the popup is anchored. */
  placement?: MapPlacement
  /** Clears selection when the user clicks empty map space. */
  closeOnMapClick?: boolean
  /**
   * Where the popup opens: in the `placement` corner, or next to the clicked feature
   * (`'feature'`). On narrow maps both become a bottom sheet.
   */
  anchor?: 'corner' | 'feature'
}

/** Hover tooltip for selectable features (`MapTooltip`). */
export type TooltipConfig = {
  /** Shows the tooltip in the `<GeospatialMap>` layout. */
  enabled?: boolean
  /** Feature properties to try, in order; the first one present is shown. Default `name`, `title`, `label`. */
  fields?: string[]
}

/** Source attribution (`MapAttribution`). */
export type AttributionConfig = {
  /** Enables visible attribution. Consumers remain responsible for source terms. */
  enabled?: boolean
  /** Corner in which attribution is anchored. */
  placement?: MapPlacement
  /** Uses the space-efficient attribution treatment. */
  compact?: boolean
}

/** Layer loading and availability chips (`MapStatusChips`). */
export type StatusChipsConfig = {
  /** Enables the chips. */
  enabled?: boolean
  /** Corner in which they are anchored. */
  placement?: MapPlacement
  /** Shows in-progress layer loads. */
  showLoading?: boolean
  /** Shows layers with no data for the current time. */
  showNoData?: boolean
  /** Shows layers outside their configured zoom range. */
  showScaleUnavailable?: boolean
}

/** The error alert (`MapErrorAlert`). */
export type ErrorAlertConfig = {
  /** Enables the alert. */
  enabled?: boolean
  /** Corner in which it is anchored. */
  placement?: MapPlacement
  /** Lets users dismiss recoverable errors. */
  dismissible?: boolean
}

/** Geographic breadcrumbs (`MapBreadcrumbs`) for `data.hierarchy`. */
export type BreadcrumbsConfig = {
  /** Enables the breadcrumbs. */
  enabled?: boolean
  /** Corner in which they are anchored. */
  placement?: MapPlacement
}

/** Time slider and playback (`MapTimeControls`), shown when layers have time values. */
export type TimeControlsConfig = {
  /** Enables the time controls. */
  enabled?: boolean
  /** Corner in which they are anchored. */
  placement?: MapPlacement
  /** Playback frame durations users can choose, in milliseconds. */
  speedsMs?: number[]
  /** Initially selected frame duration; one of `speedsMs`. */
  defaultSpeedMs?: number
  /** Starts playback after the map loads (not with reduced motion). */
  autoplay?: boolean
  /** Restarts playback after the final frame. */
  loop?: boolean
  /** When a frame fails to load: stop playback (`'pause'`, default) or go on (`'skip'`). */
  frameFailurePolicy?: 'pause' | 'skip'
}

/**
 * Which parts the map shows and how they behave. Each key configures the part of the same name
 * (`controls` → `MapControls`, `layerPanel` → `MapLayerPanel`, …) and is layered over `profile`.
 */
export type MapUiConfig = {
  /** Base profile resolved before your overrides. Default `'full'`. */
  profile?: MapUiProfileId
  controls?: ControlsConfig
  settings?: SettingsPanelConfig
  layerPanel?: LayerPanelConfig
  legend?: LegendPanelConfig
  popup?: PopupConfig
  tooltip?: TooltipConfig
  disclaimer?: DisclaimerConfig
  attribution?: AttributionConfig
  statusChips?: StatusChipsConfig
  errorAlert?: ErrorAlertConfig
  breadcrumbs?: BreadcrumbsConfig
  time?: TimeControlsConfig
}

/** `MapUiConfig` with every default filled in. */
export type ResolvedMapUiConfig = {
  profile: MapUiProfileId
  controls: Required<Omit<ControlsConfig, 'locate'>> & {
    locate: Required<NonNullable<ControlsConfig['locate']>>
  }
  settings: Required<SettingsPanelConfig>
  layerPanel: Required<LayerPanelConfig>
  legend: Required<LegendPanelConfig>
  popup: Required<PopupConfig>
  tooltip: Required<TooltipConfig>
  disclaimer: Required<DisclaimerConfig>
  attribution: Required<AttributionConfig>
  statusChips: Required<StatusChipsConfig>
  errorAlert: Required<ErrorAlertConfig>
  breadcrumbs: Required<BreadcrumbsConfig>
  time: Required<TimeControlsConfig>
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
 * A design token `config.theme` can set, by name: each is the `--geo-*` CSS custom property of
 * the same name (`mutedForeground` → `--geo-muted-foreground`). The stylesheet stays the place to
 * theme every map; `config.theme` is for one map whose look comes from data.
 */
export type MapThemeToken =
  | 'fontFamily'
  | 'foreground'
  | 'background'
  | 'muted'
  | 'mutedForeground'
  | 'border'
  | 'overlay'
  | 'primary'
  | 'primaryForeground'
  | 'primaryHover'
  | 'destructive'
  | 'ring'
  | 'stage'
  | 'radius'
  | 'shadow'
  | 'controlSize'

/** Per-map token overrides; only the keys you set are written, inline on the map root. */
export type MapTheme = Partial<Record<MapThemeToken, string>> & {
  /** Comfortable or space-efficient UI density. */
  density?: 'comfortable' | 'compact'
}

/** English UI copy and templated announcements. */
export type MapMessages = {
  /** Initial loading announcement. */
  mapLoading: string
  /** Disclaimer button label and heading. */
  disclaimer: string
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
  /** Opacity slider label with `{layer}`. */
  layerOpacity: string
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

/**
 * A complete map configuration: what `defineMapConfig` returns and `validateMapConfig` checks.
 * You usually write the shorter `MapConfigInput`, which fills in everything but the layers.
 */
export type MapConfig = {
  /** Configuration format version. */
  version?: 1
  /** Stable DOM id for the map; generated when left out. */
  id?: string
  /** Accessible name and reduced-motion policy. */
  accessibility: AccessibilityConfig
  /** Where the map starts: view, basemap, layer state, selection and time. */
  initialState: MapState
  /** Zoom limits, interactions, fitting and projection switching. */
  view: ViewConfig
  /** Layers, basemaps, zoom targets and hierarchy. */
  data: DataConfig
  /** Which parts the map shows and how they behave. */
  ui: MapUiConfig
  /** Export defaults (title, size, formats). */
  export?: ExportConfig
  /** Per-map design token overrides. */
  theme?: MapTheme
  /** UI text overrides (translations). */
  messages?: Partial<MapMessages>
}

/**
 * The authoring form of the configuration. Everything except `accessibility` and `data.layers`
 * may be left out: `defineMapConfig` and `validateMapConfig` fill in a plain basemap, a world
 * view, the `full` UI profile, and the starting layer state. A complete `MapConfig` is also a
 * valid input.
 */
export type MapConfigInput = Omit<MapConfig, 'initialState' | 'view' | 'data' | 'ui'> & {
  /** Starting view and state; omitted fields use defaults derived from the layers. */
  initialState?: MapStateInput
  /** Zoom limits, interactions, fitting and projection switching. */
  view?: ViewConfig
  /** Layers (required), basemaps (default: the world basemap), targets, and hierarchy. */
  data: Omit<DataConfig, 'basemaps' | 'layers'> & {
    basemaps?: BasemapConfig[]
    layers: MapLayerInput[]
  }
  /** Which parts the map shows; default: the `full` profile. */
  ui?: MapUiConfig
}

/**
 * A data layer in the short config form: `{ id, data }` is enough. `kind` defaults to
 * `'geojson'`, `role` to `'indicator'`, `title` to the id, and `style` to the primary colour,
 * drawn as fills, lines or circles to suit the data.
 */
export type GeoJsonLayerInput = Omit<GeoJsonLayerConfig, 'kind' | 'role' | 'title' | 'style'> & {
  kind?: 'geojson'
  role?: CommonLayerConfig['role']
  title?: string
  style?: ThematicStyleSpec
}

/** Any layer in the short config form. */
export type MapLayerInput = MapLayerConfig | GeoJsonLayerInput

/** What a data loader is asked for: the layer's `data` settings, plus fetch options. */
export type GeoJsonLoaderOptions = {
  signal?: AbortSignal
  prefetch?: boolean
  format?: DataFormat
  longitude?: string
  latitude?: string
  /**
   * Extra `fetch` options for `fetchGeoJson`, for example `{ headers: { Authorization } }` or
   * `{ credentials: 'include' }`. Used for every request, including ArcGIS paging.
   */
  init?: RequestInit
}

/**
 * Loads `data: { url }` layers. Wrap the exported `fetchGeoJson` to add headers or tokens while
 * keeping its format handling (ArcGIS paging, CSV, rows).
 */
export type GeoJsonLoader = (
  url: string,
  options: GeoJsonLoaderOptions,
) => Promise<FeatureCollection>

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
  { success: true; config: MapConfig } | { success: false; issues: ConfigIssue[] }

/** The floating panels opened from the controls; one is open at a time. */
export type MapPanelId = 'layers' | 'settings'

/**
 * Everything you can do to a map: from `useMapActions()` in a part, from `slots`, and from the
 * component `ref`. The identity is stable for the life of the map.
 */
export type MapActions = {
  /** Changes zoom by a relative delta. */
  zoom(delta: number): void
  /** Moves the view; omitted fields keep their current value. */
  setView(view: Partial<MapViewState>): void
  /** Returns to the starting zoom. */
  resetZoom(): void
  /** Fits the view to geographic bounds. */
  fit(target: FitTarget, options?: FitOptions): void
  /** Fits the selected feature; `false` when there is none or it isn't loaded. */
  fitSelection(options?: FitOptions): boolean
  /** Fits the selection, the data, or the selection when there is one (default from config). */
  fitContent(policy?: FitTargetPolicy): void
  /** Fits a configured zoom target by identifier. */
  fitZoomTarget(targetId: string): void
  /** Switches projection (a basemap must support it). */
  setProjection(projection: ProjectionId): void
  /** Activates a configured basemap. */
  setBasemap(id: string): void
  /** Shows or hides a layer. */
  setLayerVisibility(layerId: string, visible: boolean): void
  /** Changes a layer's opacity (0–1). */
  setLayerOpacity(layerId: string, opacity: number): void
  /** Moves one of your layers up (1) or down (-1) in drawing order. */
  reorderLayer(layerId: string, direction: -1 | 1): void
  /** Changes or clears the time frame. */
  setTime(time: string | null): void
  /** Selects a feature (opening its popup), or clears the selection with `null`. */
  select(selection: MapSelection | null): void
  /** Clears the selection and closes the popup. */
  clearSelection(): void
  /** Opens a panel (closing the other), or closes it with `null`. */
  setOpenPanel(panel: MapPanelId | null): void
  /** Toggles fullscreen for the map or its container. */
  toggleFullscreen(target?: 'map' | 'container'): void
  /** Produces a report-ready image without downloading it. */
  exportImage(options: ExportOptions): Promise<Blob>
  /** Exports with the configured report options and downloads the file. */
  downloadImage(format: ExportFormat): Promise<void>
  /** The current complete state. */
  getState(): MapState
  /** Announces a message through the map's polite live region. */
  announce(message: string): void
  /** Shows an error in the map's error alert and passes it to `onError`. */
  reportError(error: MapError): void
  /** Hides the error alert. */
  dismissError(): void
  /** The underlying OpenLayers map, or `null` before it mounts. See `onOpenLayersMap`. */
  getOpenLayersMap(): OlMap | null
  /** Pixel position of a longitude/latitude inside the map stage, or `null` before layout. */
  pixelAt(lonLat: LonLat): [number, number] | null
  /** Calls `listener` after every rendered frame (pans, zooms, resizes). Returns an unsubscribe. */
  onRender(listener: () => void): () => void
  /** The selectable feature under the pointer, or `null`. */
  getHoveredFeature(): FeatureEvent | null
  /** Calls `listener` when the hovered feature changes. Returns an unsubscribe. */
  onHoverChange(listener: () => void): () => void
}

/** What the component `ref` gives you: the same actions as `useMapActions()`. */
export type GeospatialMapHandle = MapActions

/** State and actions passed to slots. */
export type MapSlotContext = {
  /** Current complete map state. */
  state: MapState
  /** Every map action. */
  actions: MapActions
}

/** Content and close action supplied to popup renderers. */
export type PopupContext = MapSlotContext & {
  /** The selected feature. */
  selection: FeatureEvent
  /** Clears selection and closes the popup. */
  close: () => void
}

/**
 * Content for the `<GeospatialMap>` layout's popup, tooltip and custom controls. For anything
 * else (panel headers, loading and error content), compose the parts with `<MapRoot>`.
 */
export type MapSlots = {
  /** Selected-feature content inside the popup. */
  popup?: (context: PopupContext) => ReactNode
  /** The hover tooltip for a feature; return `null` to show none. */
  tooltip?: (feature: FeatureEvent) => ReactNode
  /** Renderers for `custom:*` control ids in `ui.controls.groups`. */
  controls?: CustomControls
}

/** Renderers keyed by `custom:*` control id. */
export type CustomControls = Partial<
  Record<`custom:${string}`, (context: MapSlotContext) => ReactNode>
>

/**
 * An icon component: anything that renders an SVG and accepts `className` and `aria-hidden`
 * (lucide-react, @carbon/icons-react, react-icons, your own). Size and stroke come from CSS
 * (`--geo-icon-size`, `--geo-icon-stroke`).
 */
export type MapIcon = ComponentType<{
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

/** The icons the map renders, by role. */
export type MapIconName =
  | 'ZoomIn'
  | 'ZoomOut'
  | 'ResetZoom'
  | 'Locate'
  | 'Spinner'
  | 'Layers'
  | 'Fit'
  | 'Settings'
  | 'Fullscreen'
  | 'Close'
  | 'Collapse'
  | 'Expand'
  | 'MoveUp'
  | 'MoveDown'
  | 'Previous'
  | 'Next'
  | 'Play'
  | 'Pause'
  | 'Replay'

/** A complete icon set. Pass a partial one to the `icons` prop to replace some of them. */
export type MapIcons = Record<MapIconName, MapIcon>

/** Props shared by `<MapRoot>` (composable) and the `<GeospatialMap>` preset. */
export type MapRootProps = MapCallbacks &
  Omit<ComponentPropsWithoutRef<'section'>, keyof MapCallbacks | 'children'> & {
    /** Map configuration: the short `MapConfigInput` form or a complete `MapConfig`. */
    config: MapConfigInput
    /** Complete controlled state; omit for component-owned state. */
    state?: MapState
    /** Receives every proposed complete state and its change metadata. */
    onStateChange?: (state: MapState, change: MapStateChange) => void
    /** Map parts (`<MapControls>`, `<MapLegend>`, …) rendered on top of the map viewport. */
    children?: ReactNode
    /** Fill the parent element's height instead of using `--geo-height`. */
    fill?: boolean
    /**
     * Icons for this map, by role (`{ ZoomIn, Layers, Close, … }`); the rest come from
     * `icons.ts`. To change the icons of every map in your app, edit `icons.ts` instead.
     */
    icons?: Partial<MapIcons>
    /** Custom loader for GeoJSON `data: { url }` layers (auth headers, credentials, caching). */
    loadGeoJson?: GeoJsonLoader
    /**
     * Receives the underlying OpenLayers map once it exists, for integrations the configuration
     * does not cover (drawing, measuring, your own layers). Return a function to undo your
     * changes; it runs before the map is destroyed or recreated. Layers you add are kept when
     * the configured layers change; give them a `zIndex` above the configured ones (for example 100).
     */
    onOpenLayersMap?: (map: OlMap) => void | (() => void)
    /** Extra semantic checks; any issue renders the configuration-error shell. */
    validate?: (config: MapConfig, ui: ResolvedMapUiConfig) => ConfigIssue[]
    /** Replaces the configuration-error message content. */
    renderConfigError?: (error: MapError, context: MapSlotContext) => ReactNode
  }

/** Public React props for the ready-made `<GeospatialMap>` layout. */
export type GeospatialMapProps = Omit<MapRootProps, 'validate' | 'renderConfigError'> & {
  /** Popup, tooltip and custom-control content. */
  slots?: MapSlots
}

/** Live map data shared with every part through context. */
export type MapRuntime = {
  /** Current complete map state. */
  state: MapState
  /** Configured overlays with state applied, in drawing order. */
  layers: MapLayerConfig[]
  /** Legends for the current layers, styles, and time. */
  legends: NormalizedLegend[]
  /** Load, error, and availability status per layer. */
  statuses: LayerStatus[]
  /** Attribution for the active basemap and visible layers. */
  attributions: AttributionSpec[]
  /** Union of time values offered by time-aware layers. */
  times: string[]
  /** The selected feature (from a click or from `state.selection`), or `null`. */
  selectedFeature: FeatureEvent | null
  /** Error shown in the alert, or `null`. */
  error: MapError | null
  /** The open floating panel, or `null`. */
  openPanel: MapPanelId | null
  /** `loading`, `ready` or `error`; also on the map element as `data-status`. */
  mapStatus: MapLoadStatus
}

/** Value returned by `useMap()`. */
export type MapContextValue = MapRuntime & {
  /** Stable DOM-safe map identifier. */
  mapId: string
  /** Validated configuration. */
  config: MapConfig
  /** Configuration UI resolved against its profile. */
  ui: ResolvedMapUiConfig
  /** Messages resolved against the English defaults. */
  messages: MapMessages
  /** Every map action, with a stable identity. */
  actions: MapActions
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

/** One map in a comparison grid. */
export type MapGridItem = {
  /** Stable cell and map identifier. */
  id: string
  /** Visible and accessible cell title. */
  title: string
  /** Where this map starts; omitted fields come from `shared`. */
  initialState?: MapStateInput
  /** Layers for this map instead of the shared ones. */
  layers?: MapLayerInput[]
}

/** A grid of up to six synchronised maps. */
export type MapGridConfig = {
  /** Configuration format version. */
  version?: 1
  /** Optional stable grid identifier. */
  id?: string
  /** What every map shares: the short or complete map configuration. */
  shared: MapConfigInput
  /** One to six maps. */
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
  /** What a change in one map applies to the others. */
  sync?: { view?: boolean; layers?: boolean; time?: boolean; selection?: boolean }
  /** Whether a map can be focused (shown alone, with the full UI). Default `true`. */
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
  /** Grid configuration. */
  config: MapGridConfig
  /** Complete controlled grid state; omit for grid-owned state. */
  state?: MapGridState
  /** Optional class applied to the grid root. */
  className?: string
  /** Optional class applied to every grid cell. */
  cellClassName?: string
  /** Slots forwarded to each map cell. */
  slots?: MapSlots
  /** Icons for every map cell. */
  icons?: Partial<MapIcons>
  /**
   * Receives the complete grid state after any change: a map's state (with its id and the
   * change) or the focused map (with `change` undefined).
   */
  onStateChange?: (state: MapGridState, mapId: string | null, change?: MapStateChange) => void
}

/** @internal What the renderer reports about its layers. */
export type SerializedMapState = {
  version: 1
  view: MapViewState
  activeBasemapId?: string
  layers: Array<{ id: string; visible: boolean; opacity: number; index: number }>
  time?: string | null
  selection?: MapSelection | null
}
