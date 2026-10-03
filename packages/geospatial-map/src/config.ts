import Type, { type Static, type TObjectOptions, type TProperties, type TSchema } from 'typebox'
import Value from 'typebox/value'
import type { FeatureCollection } from 'geojson'
import type {
  AccessibilityConfig,
  ConfigIssue,
  ConfigValidationResult,
  DataConfig,
  ExportConfig,
  MapMessages,
  MapState,
  MapThemeTokens,
  MapUiConfig,
  MapUiProfileId,
  ResolvedMapUiConfig,
  TimeConfig,
  ViewConfig,
} from './types'

const strict = <const T extends TProperties>(properties: T, options: TObjectOptions = {}) =>
  Type.Object(properties, { ...options, additionalProperties: false })
const optional = Type.Optional
const string = Type.String({ minLength: 1 })
const unit = Type.Number({ minimum: 0, maximum: 1 })
const projection = Type.Union([
  Type.Literal('EPSG:8857'),
  Type.Literal('EPSG:3857'),
  Type.Literal('ESRI:EQUAL-EARTH-CM11'),
])
const placement = Type.Union([
  Type.Literal('top-left'),
  Type.Literal('top-right'),
  Type.Literal('bottom-left'),
  Type.Literal('bottom-right'),
])
const lonLat = Type.Tuple([Type.Number(), Type.Number()])
const bounds = Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()])
const zoomStop = strict({ zoom: Type.Number(), value: Type.Number() })

const pointSymbol = strict({
  kind: Type.Literal('point'),
  shape: optional(
    Type.Union([
      Type.Literal('circle'),
      Type.Literal('square'),
      Type.Literal('triangle'),
      Type.Literal('diamond'),
    ]),
  ),
  radius: optional(Type.Number({ minimum: 0 })),
  radiusStops: optional(Type.Array(zoomStop)),
  fillColor: optional(Type.String()),
  strokeColor: optional(Type.String()),
  strokeWidth: optional(Type.Number({ minimum: 0 })),
  opacity: optional(unit),
  labelField: optional(Type.String()),
  labelColor: optional(Type.String()),
})
const lineSymbol = strict({
  kind: Type.Literal('line'),
  color: Type.String(),
  width: optional(Type.Number({ minimum: 0 })),
  widthStops: optional(Type.Array(zoomStop)),
  dash: optional(Type.Array(Type.Number({ minimum: 0 }))),
  opacity: optional(unit),
  labelField: optional(Type.String()),
})
const polygonSymbol = strict({
  kind: Type.Literal('polygon'),
  fillColor: optional(Type.String()),
  strokeColor: optional(Type.String()),
  strokeWidth: optional(Type.Number({ minimum: 0 })),
  dash: optional(Type.Array(Type.Number({ minimum: 0 }))),
  opacity: optional(unit),
  labelField: optional(Type.String()),
  labelColor: optional(Type.String()),
})
const symbol = Type.Union([pointSymbol, lineSymbol, polygonSymbol])
const legendClass = strict({ id: optional(Type.String()), label: string, symbol })
const specialLegendClass = strict({
  id: optional(Type.String()),
  label: string,
  symbol,
  value: Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]),
})
const thematicStyle = Type.Union([
  strict({ type: Type.Literal('constant'), symbol }),
  strict({
    type: Type.Literal('categorical'),
    field: string,
    categories: Type.Array(
      strict({
        id: optional(Type.String()),
        label: string,
        symbol,
        value: Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
      }),
    ),
    fallback: optional(legendClass),
    specialValues: optional(Type.Array(specialLegendClass)),
  }),
  strict({
    type: Type.Literal('graduated'),
    field: string,
    classes: Type.Array(
      strict({
        id: optional(Type.String()),
        label: string,
        symbol,
        min: optional(Type.Number()),
        max: optional(Type.Number()),
      }),
    ),
    missing: optional(legendClass),
    specialValues: optional(Type.Array(specialLegendClass)),
    outOfRange: optional(legendClass),
  }),
  strict({
    type: Type.Literal('continuous'),
    field: string,
    domain: Type.Tuple([Type.Number(), Type.Number()]),
    stops: Type.Array(
      strict({ value: Type.Number(), color: Type.String(), label: optional(Type.String()) }),
      { minItems: 2 },
    ),
    symbol: optional(symbol),
    clamp: optional(Type.Boolean()),
    missing: optional(legendClass),
    specialValues: optional(Type.Array(specialLegendClass)),
    outOfRange: optional(legendClass),
  }),
])

const attribution = strict({
  label: string,
  url: optional(Type.String()),
  license: optional(Type.String()),
  version: optional(Type.String()),
  authority: optional(Type.String()),
  publishedAt: optional(Type.String()),
  usageRestrictions: optional(Type.String()),
  official: optional(Type.Boolean()),
})
const legendEntry = strict({
  id: string,
  label: string,
  symbol: Type.Union([
    symbol,
    strict({
      kind: Type.Literal('gradient'),
      stops: Type.Array(strict({ value: Type.Number(), color: Type.String() })),
    }),
  ]),
  value: optional(
    Type.Union([
      Type.String(),
      Type.Number(),
      Type.Boolean(),
      Type.Tuple([Type.Number(), Type.Number()]),
    ]),
  ),
})
const legendFrame = strict({
  title: optional(Type.String()),
  subtitle: optional(Type.String()),
  units: optional(Type.String()),
  description: optional(Type.String()),
  sourceNote: optional(Type.String()),
  entries: optional(Type.Array(legendEntry)),
})
const legend = strict({
  title: optional(Type.String()),
  subtitle: optional(Type.String()),
  units: optional(Type.String()),
  description: optional(Type.String()),
  sourceNote: optional(Type.String()),
  presentation: optional(
    Type.Union([Type.Literal('list'), Type.Literal('continuous-ramp'), Type.Literal('size-ramp')]),
  ),
  entries: optional(Type.Array(legendEntry)),
  showLayerToggle: optional(Type.Boolean()),
  byTime: optional(Type.Record(Type.String(), legendFrame)),
})
const layerTime = strict({
  available: Type.Array(Type.String(), { minItems: 1, uniqueItems: true }),
  mode: Type.Union([
    Type.Literal('property'),
    Type.Literal('url-template'),
    Type.Literal('wms-parameter'),
    Type.Literal('source-replacement'),
  ]),
  fieldOrParameter: optional(Type.String()),
  missingPolicy: optional(
    Type.Union([Type.Literal('hide'), Type.Literal('unavailable'), Type.Literal('retain-last')]),
  ),
  prefetchFrames: optional(Type.Integer({ minimum: 0 })),
})
const commonLayer = {
  id: string,
  title: string,
  role: Type.Union([
    Type.Literal('basemap'),
    Type.Literal('indicator'),
    Type.Literal('boundary'),
    Type.Literal('reference'),
  ]),
  visible: optional(Type.Boolean()),
  opacity: optional(unit),
  minZoom: optional(Type.Number()),
  maxZoom: optional(Type.Number()),
  zIndex: optional(Type.Number()),
  reorderable: optional(Type.Boolean()),
  required: optional(Type.Boolean()),
  showInLayerControl: optional(Type.Boolean()),
  orderLocked: optional(Type.Boolean()),
  group: optional(Type.String()),
  exclusiveGroup: optional(Type.String()),
  selectable: optional(Type.Boolean()),
  hitPriority: optional(Type.Number()),
  featureIdField: optional(Type.String()),
  propertyAllowlist: optional(Type.Array(Type.String())),
  boundarySetId: optional(Type.String()),
  geographyLevel: optional(Type.String()),
  attribution: optional(Type.Array(attribution)),
  time: optional(layerTime),
  legend: optional(legend),
  exportable: optional(Type.Boolean()),
}
const projectionDefinition = strict({
  code: string,
  definition: string,
  extent: optional(bounds),
  worldExtent: optional(bounds),
})
const tileGrid = strict({
  extent: bounds,
  origin: Type.Tuple([Type.Number(), Type.Number()]),
  resolutions: Type.Array(Type.Number({ exclusiveMinimum: 0 }), { minItems: 1 }),
  tileSize: optional(
    Type.Union([Type.Number({ exclusiveMinimum: 0 }), Type.Tuple([Type.Number(), Type.Number()])]),
  ),
})
const featureData = Type.Union([
  strict({ url: string }),
  strict({
    type: Type.Literal('FeatureCollection'),
    features: Type.Unsafe<FeatureCollection['features']>(Type.Unknown()),
  }),
])
const mapLayer = Type.Union([
  strict({
    ...commonLayer,
    kind: Type.Literal('geojson'),
    data: featureData,
    dataProjection: optional(Type.String()),
    style: thematicStyle,
  }),
  strict({
    ...commonLayer,
    kind: Type.Literal('heatmap'),
    data: featureData,
    dataProjection: optional(Type.String()),
    weightField: optional(string),
    radius: optional(Type.Number({ minimum: 0 })),
    blur: optional(Type.Number({ minimum: 0 })),
    radiusStops: optional(Type.Array(zoomStop, { minItems: 1 })),
    blurStops: optional(Type.Array(zoomStop, { minItems: 1 })),
    gradient: optional(Type.Array(Type.String(), { minItems: 2 })),
  }),
  strict({
    ...commonLayer,
    kind: Type.Literal('mvt'),
    urlTemplate: string,
    sourceProjection: string,
    sourceProjectionDefinition: optional(projectionDefinition),
    sourceLayer: optional(Type.String()),
    maxSourceZoom: optional(Type.Number()),
    tileGrid: optional(tileGrid),
    wrapX: optional(Type.Boolean()),
    style: optional(thematicStyle),
    mapboxStyle: optional(strict({ url: string, source: optional(Type.String()) })),
  }),
  strict({
    ...commonLayer,
    kind: Type.Literal('xyz'),
    urlTemplate: string,
    sourceProjection: string,
    crossOrigin: optional(Type.Union([Type.Literal('anonymous'), Type.Literal('use-credentials')])),
    maxSourceZoom: optional(Type.Number()),
  }),
  strict({
    ...commonLayer,
    kind: Type.Literal('wms'),
    url: string,
    params: Type.Intersect([
      Type.Record(Type.String(), Type.Union([Type.String(), Type.Number(), Type.Boolean()])),
      Type.Object({ LAYERS: string }),
    ]),
    sourceProjection: string,
    crossOrigin: optional(Type.Union([Type.Literal('anonymous'), Type.Literal('use-credentials')])),
    tiled: optional(Type.Boolean()),
  }),
  strict({
    ...commonLayer,
    kind: Type.Literal('wmts'),
    url: string,
    layer: string,
    matrixSet: string,
    format: string,
    sourceProjection: string,
    styleName: optional(Type.String()),
    tileGrid: strict({
      extent: bounds,
      origin: Type.Tuple([Type.Number(), Type.Number()]),
      resolutions: Type.Array(Type.Number({ exclusiveMinimum: 0 }), { minItems: 1 }),
      tileSize: optional(Type.Union([Type.Number(), Type.Tuple([Type.Number(), Type.Number()])])),
      matrixIds: Type.Array(Type.String(), { minItems: 1 }),
    }),
    crossOrigin: optional(Type.Union([Type.Literal('anonymous'), Type.Literal('use-credentials')])),
  }),
])
const basemap = strict({
  id: string,
  title: string,
  supportedProjections: Type.Array(projection, { minItems: 1, uniqueItems: true }),
  layers: Type.Array(mapLayer),
  backgroundColor: string,
  attribution: Type.Array(attribution),
  exportable: Type.Boolean(),
  fallbackFor: optional(Type.Array(projection, { uniqueItems: true })),
  network: optional(Type.Boolean()),
})
const viewState = strict({
  center: lonLat,
  zoom: Type.Number(),
  projection,
  rotation: optional(Type.Number()),
  minZoom: optional(Type.Number()),
  maxZoom: optional(Type.Number()),
})
const selection = strict({
  layerId: string,
  featureId: string,
  boundarySetId: optional(Type.String()),
  geographyLevel: optional(Type.String()),
})
const layerState = strict({
  visible: Type.Boolean(),
  opacity: unit,
  order: Type.Integer({ minimum: 0 }),
  style: optional(thematicStyle),
})
const mapState = strict({
  view: viewState,
  activeBasemapId: optional(Type.String()),
  layers: Type.Record(Type.String(), layerState),
  selection: Type.Union([selection, Type.Null()]),
  time: Type.Union([Type.String(), Type.Null()]),
})
const fitOptions = strict({
  padding: optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()])),
  duration: optional(Type.Number({ minimum: 0 })),
  maxZoom: optional(Type.Number()),
})
const controlId = Type.Union([
  Type.Literal('zoom-in'),
  Type.Literal('zoom-out'),
  Type.Literal('reset-zoom'),
  Type.Literal('locate'),
  Type.Literal('layers'),
  Type.Literal('fit'),
  Type.Literal('settings'),
  Type.Literal('fullscreen'),
  Type.String({ pattern: '^custom:.+' }),
])
const ui = strict({
  profile: optional(
    Type.Union([
      Type.Literal('full'),
      Type.Literal('compact'),
      Type.Literal('embedded'),
      Type.Literal('grid'),
    ]),
  ),
  controlRail: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      groups: optional(
        Type.Array(strict({ id: string, controls: Type.Array(controlId, { uniqueItems: true }) })),
      ),
      zoomStep: optional(Type.Number({ exclusiveMinimum: 0 })),
      locate: optional(
        strict({
          enableHighAccuracy: optional(Type.Boolean()),
          timeoutMs: optional(Type.Integer({ minimum: 0 })),
          maximumAgeMs: optional(Type.Integer({ minimum: 0 })),
          zoom: optional(Type.Number()),
        }),
      ),
      fitTarget: optional(
        Type.Union([
          Type.Literal('selection'),
          Type.Literal('data'),
          Type.Literal('selection-or-data'),
        ]),
      ),
      fullscreenTarget: optional(Type.Union([Type.Literal('map'), Type.Literal('container')])),
    }),
  ),
  settings: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      defaultOpen: optional(Type.Boolean()),
      fields: optional(
        Type.Array(
          Type.Union([
            Type.Literal('projection'),
            Type.Literal('basemap'),
            Type.Literal('zoom-target'),
            Type.Literal('export'),
          ]),
          { uniqueItems: true },
        ),
      ),
    }),
  ),
  layers: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      defaultOpen: optional(Type.Boolean()),
      allowVisibility: optional(Type.Boolean()),
      allowOpacity: optional(Type.Boolean()),
      allowReorder: optional(Type.Boolean()),
      showMetadata: optional(Type.Boolean()),
      groupBy: optional(
        Type.Union([Type.Literal('group'), Type.Literal('role'), Type.Literal('none')]),
      ),
      itemDetails: optional(Type.Union([Type.Literal('disclosure'), Type.Literal('always')])),
      defaultExpandedLayerIds: optional(Type.Array(string, { uniqueItems: true })),
      showSymbolPreview: optional(Type.Boolean()),
    }),
  ),
  legend: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      defaultOpen: optional(Type.Boolean()),
      layout: optional(Type.Union([Type.Literal('list'), Type.Literal('compact')])),
    }),
  ),
  popup: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      closeOnMapClick: optional(Type.Boolean()),
    }),
  ),
  attribution: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      compact: optional(Type.Boolean()),
    }),
  ),
  status: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      showLoading: optional(Type.Boolean()),
      showNoData: optional(Type.Boolean()),
      showScaleUnavailable: optional(Type.Boolean()),
    }),
  ),
  errors: optional(
    strict({
      enabled: optional(Type.Boolean()),
      placement: optional(placement),
      dismissible: optional(Type.Boolean()),
    }),
  ),
  hierarchy: optional(
    strict({ enabled: optional(Type.Boolean()), placement: optional(placement) }),
  ),
})
const theme = strict({
  fontFamily: string,
  textColor: string,
  mutedColor: string,
  borderColor: string,
  surfaceColor: string,
  softSurfaceColor: string,
  glassColor: string,
  accentColor: string,
  accentHoverColor: string,
  dangerColor: string,
  focusColor: string,
  radius: string,
  shadow: string,
  controlSize: string,
  density: Type.Union([Type.Literal('comfortable'), Type.Literal('compact')]),
})

const messageKeys: Array<keyof MapMessages> = [
  'mapLoading',
  'mapReady',
  'projectionChanged',
  'selectedFeature',
  'selectionCleared',
  'timeChanged',
  'timeCleared',
  'mapControls',
  'zoomIn',
  'zoomOut',
  'resetZoom',
  'findLocation',
  'locationUnavailable',
  'locationDenied',
  'layers',
  'fitSelection',
  'fitData',
  'mapSettings',
  'fullscreen',
  'mapOptions',
  'viewAndOutput',
  'closeSettings',
  'projection',
  'equalEarth',
  'equalEarthArcgis',
  'mercator',
  'basemap',
  'network',
  'goToArea',
  'zoomToArea',
  'chooseArea',
  'download',
  'exportMap',
  'exportReportImage',
  'mapContent',
  'mapLayers',
  'closeLayers',
  'layersVisible',
  'layerOptions',
  'showLayerOptions',
  'hideLayerOptions',
  'otherLayers',
  'oneLayerAtATime',
  'opacity',
  'chooseOne',
  'unavailableAtScale',
  'noDataForTime',
  'sourceError',
  'moveLayerUp',
  'moveLayerDown',
  'legend',
  'units',
  'selectedFeatureDetails',
  'closeFeatureDetails',
  'timeControls',
  'playTime',
  'pauseTime',
  'replayTime',
  'previousTime',
  'nextTime',
  'selectedTime',
  'playbackSpeed',
  'time',
  'loadingFrame',
  'frameUnavailable',
  'loading',
  'dismiss',
  'attribution',
  'invalidConfiguration',
  'returnToGrid',
  'focusMap',
]
const messages = Type.Partial(
  strict(Object.fromEntries(messageKeys.map((key) => [key, Type.String()]))),
)

/** TypeBox source of truth distributed as `@org/geospatial-map/schema.json`. */
const mapConfigSchemaSource = strict(
  {
    version: Type.Literal(1),
    id: optional(Type.String()),
    accessibility: Type.Unsafe<AccessibilityConfig>(
      strict({
        ariaLabel: string,
        keyboard: optional(Type.Boolean()),
        reducedMotion: optional(Type.Union([Type.Literal('respect'), Type.Literal('ignore')])),
      }),
    ),
    initialState: Type.Unsafe<MapState>(mapState),
    view: Type.Unsafe<ViewConfig>(
      strict({
        projectionBehavior: optional(
          strict({
            mode: optional(Type.Union([Type.Literal('manual'), Type.Literal('automatic')])),
            equalEarthBelowZoom: optional(Type.Number()),
            mercatorAtOrAboveZoom: optional(Type.Number()),
          }),
        ),
        interactions: optional(
          strict({
            dragPan: optional(Type.Boolean()),
            wheelZoom: optional(Type.Boolean()),
            doubleClickZoom: optional(Type.Boolean()),
            pinchZoom: optional(Type.Boolean()),
            keyboard: optional(Type.Boolean()),
            rotate: optional(Type.Boolean()),
            hover: optional(Type.Boolean()),
            select: optional(Type.Boolean()),
            selectHitTolerance: optional(Type.Number({ minimum: 0 })),
            hoverHitTolerance: optional(Type.Number({ minimum: 0 })),
          }),
        ),
        fit: optional(fitOptions),
      }),
    ),
    data: Type.Unsafe<DataConfig>(
      strict({
        layers: Type.Array(mapLayer),
        basemaps: Type.Array(basemap, { minItems: 1 }),
        zoomTargets: optional(
          Type.Array(
            strict({
              id: string,
              label: string,
              bounds,
              parentId: optional(Type.String()),
              geographyLevel: optional(Type.String()),
              maxZoom: optional(Type.Number()),
            }),
          ),
        ),
        hierarchy: optional(
          Type.Array(
            strict({
              id: string,
              label: string,
              geographyLevel: string,
              targetId: optional(Type.String()),
            }),
          ),
        ),
      }),
    ),
    ui: Type.Unsafe<MapUiConfig>(ui),
    time: optional(
      Type.Unsafe<TimeConfig>(
        strict({
          enabled: optional(Type.Boolean()),
          placement: optional(placement),
          speedsMs: optional(Type.Array(Type.Number({ exclusiveMinimum: 0 }), { minItems: 1 })),
          defaultSpeedMs: optional(Type.Number({ exclusiveMinimum: 0 })),
          autoplay: optional(Type.Boolean()),
          loop: optional(Type.Boolean()),
          frameFailurePolicy: optional(
            Type.Union([Type.Literal('pause'), Type.Literal('retain-last'), Type.Literal('skip')]),
          ),
          reducedMotion: optional(Type.Union([Type.Literal('respect'), Type.Literal('ignore')])),
        }),
      ),
    ),
    export: optional(
      Type.Unsafe<ExportConfig>(
        strict({
          enabled: optional(Type.Boolean()),
          formats: optional(
            Type.Array(
              Type.Union([
                Type.Literal('image/png'),
                Type.Literal('image/jpeg'),
                Type.Literal('image/svg+xml'),
              ]),
              { minItems: 1, uniqueItems: true },
            ),
          ),
          defaultFormat: optional(
            Type.Union([
              Type.Literal('image/png'),
              Type.Literal('image/jpeg'),
              Type.Literal('image/svg+xml'),
            ]),
          ),
          width: optional(Type.Number({ minimum: 1 })),
          height: optional(Type.Number({ minimum: 1 })),
          pixelRatio: optional(Type.Number({ minimum: 1 })),
          quality: optional(unit),
          title: optional(Type.String()),
          subtitle: optional(Type.String()),
          selectedAreaLabel: optional(Type.String()),
          includeLegend: optional(Type.Boolean()),
          includeAttribution: optional(Type.Boolean()),
          timeoutMs: optional(Type.Number({ minimum: 1 })),
        }),
      ),
    ),
    theme: optional(Type.Unsafe<Partial<MapThemeTokens>>(Type.Partial(theme))),
    messages: optional(Type.Unsafe<Partial<MapMessages>>(messages)),
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:org:geospatial-map:config:v1',
    title: 'Geospatial map configuration v1',
  },
)

/** TypeScript configuration inferred directly from the canonical TypeBox source. */
export type GeospatialMapConfigV1 = Static<typeof mapConfigSchemaSource>

/** TypeBox source of truth distributed as `@org/geospatial-map/schema.json`. */
export const mapConfigSchema: TSchema = mapConfigSchemaSource

/** Fully resolved default theme; Inter is the package font. */
export const defaultMapTheme: MapThemeTokens = {
  fontFamily: "'Inter Variable', Inter, sans-serif",
  textColor: '#18181b',
  mutedColor: '#71717a',
  borderColor: 'rgba(24, 24, 27, 0.14)',
  surfaceColor: '#ffffff',
  softSurfaceColor: '#f4f4f5',
  glassColor: 'rgba(255, 255, 255, 0.94)',
  accentColor: '#0f766e',
  accentHoverColor: '#115e59',
  dangerColor: '#a61b1b',
  focusColor: 'rgba(20, 108, 117, 0.35)',
  radius: '12px',
  shadow: '0 12px 32px rgba(24, 24, 27, 0.12), 0 2px 5px rgba(24, 24, 27, 0.08)',
  controlSize: '42px',
  density: 'comfortable',
}

/** Fully resolved English message catalog. */
export const defaultMapMessages: MapMessages = {
  mapLoading: 'Map loading',
  mapReady: 'Map ready',
  projectionChanged: 'Projection changed to {projection}',
  selectedFeature: 'Selected {feature}',
  selectionCleared: 'Selection cleared',
  timeChanged: 'Time changed to {time}',
  timeCleared: 'Time cleared',
  mapControls: 'Map controls',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  findLocation: 'Find my location',
  locationUnavailable: 'Location is not available in this browser.',
  locationDenied: 'Your location could not be retrieved. Check browser permissions.',
  layers: 'Layers',
  fitSelection: 'Fit selection',
  fitData: 'Fit data',
  mapSettings: 'Map settings',
  fullscreen: 'Toggle fullscreen',
  mapOptions: 'Map options',
  viewAndOutput: 'View & output',
  closeSettings: 'Close map settings',
  projection: 'Projection',
  equalEarth: 'Equal Earth',
  equalEarthArcgis: 'Equal Earth · ArcGIS',
  mercator: 'Mercator',
  basemap: 'Basemap',
  network: 'network',
  goToArea: 'Go to area',
  zoomToArea: 'Zoom to area',
  chooseArea: 'Choose area',
  download: 'Download',
  exportMap: 'Export map',
  exportReportImage: 'Export report image',
  mapContent: 'Map content',
  mapLayers: 'Map layers',
  closeLayers: 'Close layer panel',
  layersVisible: '{visible} of {total} visible',
  layerOptions: 'Options for {layer}',
  showLayerOptions: 'Show options for {layer}',
  hideLayerOptions: 'Hide options for {layer}',
  otherLayers: 'Other layers',
  oneLayerAtATime: 'Show one layer at a time',
  opacity: 'Opacity {value}%',
  chooseOne: 'choose one',
  unavailableAtScale: 'unavailable at this scale',
  noDataForTime: 'No data for time',
  sourceError: 'source error',
  moveLayerUp: 'Move {layer} up',
  moveLayerDown: 'Move {layer} down',
  legend: 'Legend',
  units: 'Units: {units}',
  selectedFeatureDetails: 'Selected feature details',
  closeFeatureDetails: 'Close feature details',
  timeControls: 'Time controls',
  playTime: 'Play time animation',
  pauseTime: 'Pause time animation',
  replayTime: 'Replay time animation',
  previousTime: 'Previous time',
  nextTime: 'Next time',
  selectedTime: 'Selected time',
  playbackSpeed: 'Playback speed',
  time: 'Time {time}',
  loadingFrame: 'loading frame',
  frameUnavailable: 'frame unavailable; playback paused',
  loading: 'Loading',
  dismiss: 'Dismiss',
  attribution: 'Map attribution',
  invalidConfiguration: 'Map configuration is invalid',
  returnToGrid: 'Return to grid',
  focusMap: 'Focus {title}',
}

const fullUi: ResolvedMapUiConfig = {
  profile: 'full',
  controlRail: {
    enabled: true,
    placement: 'top-right',
    groups: [
      { id: 'zoom', controls: ['zoom-in', 'zoom-out', 'reset-zoom'] },
      { id: 'location', controls: ['locate'] },
      { id: 'content', controls: ['layers'] },
      { id: 'fit', controls: ['fit'] },
      { id: 'more', controls: ['settings', 'fullscreen'] },
    ],
    zoomStep: 1,
    locate: { enableHighAccuracy: false, timeoutMs: 10_000, maximumAgeMs: 60_000, zoom: 6 },
    fitTarget: 'selection-or-data',
    fullscreenTarget: 'map',
  },
  settings: {
    enabled: true,
    placement: 'top-right',
    defaultOpen: false,
    fields: ['projection', 'basemap', 'zoom-target', 'export'],
  },
  layers: {
    enabled: true,
    placement: 'top-right',
    defaultOpen: false,
    allowVisibility: true,
    allowOpacity: true,
    allowReorder: true,
    showMetadata: true,
    groupBy: 'group',
    itemDetails: 'disclosure',
    defaultExpandedLayerIds: [],
    showSymbolPreview: true,
  },
  legend: { enabled: true, placement: 'bottom-left', defaultOpen: true, layout: 'list' },
  popup: { enabled: true, placement: 'top-left', closeOnMapClick: true },
  attribution: { enabled: true, placement: 'bottom-right', compact: true },
  status: {
    enabled: true,
    placement: 'bottom-right',
    showLoading: true,
    showNoData: true,
    showScaleUnavailable: true,
  },
  errors: { enabled: true, placement: 'top-left', dismissible: true },
  hierarchy: { enabled: true, placement: 'top-left' },
}

/** Fully resolved package UI profiles used before consumer overrides. */
export const mapUiProfiles: Record<MapUiProfileId, ResolvedMapUiConfig> = {
  full: fullUi,
  compact: {
    ...fullUi,
    profile: 'compact',
    controlRail: {
      ...fullUi.controlRail,
      groups: [
        { id: 'zoom', controls: ['zoom-in', 'zoom-out', 'reset-zoom'] },
        { id: 'content', controls: ['fit', 'layers'] },
        { id: 'more', controls: ['settings', 'fullscreen'] },
      ],
    },
  },
  embedded: {
    ...fullUi,
    profile: 'embedded',
    controlRail: {
      ...fullUi.controlRail,
      groups: [
        { id: 'zoom', controls: ['zoom-in', 'zoom-out', 'reset-zoom'] },
        { id: 'more', controls: ['fullscreen'] },
      ],
    },
    settings: { ...fullUi.settings, enabled: false },
    layers: { ...fullUi.layers, allowOpacity: false, allowReorder: false },
  },
  grid: {
    ...fullUi,
    profile: 'grid',
    controlRail: {
      ...fullUi.controlRail,
      groups: [{ id: 'zoom', controls: ['zoom-in', 'zoom-out', 'reset-zoom'] }],
    },
    settings: { ...fullUi.settings, enabled: false },
    layers: { ...fullUi.layers, enabled: false },
    legend: { ...fullUi.legend, enabled: false },
    popup: { ...fullUi.popup, enabled: false },
    status: { ...fullUi.status, enabled: false },
    errors: { ...fullUi.errors, enabled: false },
    hierarchy: { ...fullUi.hierarchy, enabled: false },
  },
}

function merge<T>(base: T, override: Partial<T> | undefined): T {
  if (!override) return structuredClone(base)
  const result = structuredClone(base) as Record<string, unknown>
  for (const [key, value] of Object.entries(override)) {
    const current = result[key]
    result[key] =
      value &&
      current &&
      typeof value === 'object' &&
      typeof current === 'object' &&
      !Array.isArray(value) &&
      !Array.isArray(current)
        ? merge(current, value as Record<string, unknown>)
        : structuredClone(value)
  }
  return result as T
}

/** Recursively resolves package defaults, the selected profile, and consumer overrides. */
export function resolveMapUi(config: MapUiConfig): ResolvedMapUiConfig {
  return merge(mapUiProfiles[config.profile ?? 'full'], config as Partial<ResolvedMapUiConfig>)
}

/** Provides contextual TypeScript checking while preserving a JSON-safe configuration object. */
export function defineMapConfig(config: GeospatialMapConfigV1): GeospatialMapConfigV1 {
  return config
}

function semanticIssues(config: GeospatialMapConfigV1): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  const duplicate = (values: string[], path: string) => {
    const seen = new Set<string>()
    values.forEach((value, index) => {
      if (seen.has(value))
        issues.push({
          path: `${path}/${index}/id`,
          code: 'duplicate',
          message: `Duplicate ID: ${value}`,
        })
      seen.add(value)
    })
  }
  duplicate(
    config.data.layers.map((item) => item.id),
    '/data/layers',
  )
  duplicate(
    config.data.basemaps.map((item) => item.id),
    '/data/basemaps',
  )
  config.data.basemaps.forEach((basemap, index) =>
    duplicate(
      basemap.layers.map((item) => item.id),
      `/data/basemaps/${index}/layers`,
    ),
  )
  duplicate(
    (config.data.zoomTargets ?? []).map((item) => item.id),
    '/data/zoomTargets',
  )
  duplicate(config.ui.controlRail?.groups?.map((item) => item.id) ?? [], '/ui/controlRail/groups')
  const targetIds = new Set((config.data.zoomTargets ?? []).map((item) => item.id))
  config.data.zoomTargets?.forEach((target, index) => {
    if (target.parentId && !targetIds.has(target.parentId))
      issues.push({
        path: `/data/zoomTargets/${index}/parentId`,
        code: 'unknown',
        message: 'Parent zoom target does not exist',
      })
  })
  config.data.hierarchy?.forEach((item, index) => {
    if (item.targetId && !targetIds.has(item.targetId))
      issues.push({
        path: `/data/hierarchy/${index}/targetId`,
        code: 'unknown',
        message: 'Hierarchy item references an unknown zoom target',
      })
  })
  const basemap = config.data.basemaps.find(
    (item) => item.id === config.initialState.activeBasemapId,
  )
  if (config.initialState.activeBasemapId && !basemap)
    issues.push({
      path: '/initialState/activeBasemapId',
      code: 'unknown',
      message: 'Active basemap does not exist',
    })
  if (basemap && !basemap.supportedProjections.includes(config.initialState.view.projection))
    issues.push({
      path: '/initialState/activeBasemapId',
      code: 'projection',
      message: 'Active basemap does not support the initial projection',
    })
  const layerIds = new Set(config.data.layers.map((item) => item.id))
  for (const [index, layer] of config.data.layers.entries()) {
    if (
      (layer.kind === 'geojson' || layer.kind === 'heatmap') &&
      'type' in layer.data &&
      !Array.isArray(layer.data.features)
    )
      issues.push({
        path: `/data/layers/${index}/data/features`,
        code: 'type',
        message: 'GeoJSON features must be an array',
      })
    if (layer.kind !== 'heatmap') continue
    if (layer.selectable)
      issues.push({
        path: `/data/layers/${index}/selectable`,
        code: 'unsupported',
        message: 'Heatmap layers are aggregate and cannot be selectable',
      })
    if (layer.time?.mode === 'wms-parameter')
      issues.push({
        path: `/data/layers/${index}/time/mode`,
        code: 'unsupported',
        message: 'Heatmap layers do not support WMS parameter time mode',
      })
    for (const key of ['radiusStops', 'blurStops'] as const) {
      const stops = layer[key] ?? []
      if (stops.some((stop, stopIndex) => stopIndex > 0 && stop.zoom <= stops[stopIndex - 1]!.zoom))
        issues.push({
          path: `/data/layers/${index}/${key}`,
          code: 'order',
          message: 'Heatmap zoom stops must be strictly ascending',
        })
    }
  }
  for (const [index, id] of (config.ui.layers?.defaultExpandedLayerIds ?? []).entries())
    if (!layerIds.has(id))
      issues.push({
        path: `/ui/layers/defaultExpandedLayerIds/${index}`,
        code: 'unknown',
        message: 'Expanded layer does not exist',
      })
  for (const id of Object.keys(config.initialState.layers))
    if (!layerIds.has(id))
      issues.push({
        path: `/initialState/layers/${id}`,
        code: 'unknown',
        message: 'Layer state references an unknown layer',
      })
  const times = new Set(config.data.layers.flatMap((item) => item.time?.available ?? []))
  if (config.initialState.time && !times.has(config.initialState.time))
    issues.push({
      path: '/initialState/time',
      code: 'unknown',
      message: 'Initial time is not available in any layer',
    })
  if (
    config.time?.defaultSpeedMs &&
    config.time.speedsMs &&
    !config.time.speedsMs.includes(config.time.defaultSpeedMs)
  )
    issues.push({
      path: '/time/defaultSpeedMs',
      code: 'reference',
      message: 'Default playback speed must be included in speedsMs',
    })
  if (
    config.export?.defaultFormat &&
    config.export.formats &&
    !config.export.formats.includes(config.export.defaultFormat)
  )
    issues.push({
      path: '/export/defaultFormat',
      code: 'reference',
      message: 'Default export format must be included in formats',
    })
  return issues
}

/** Validates structural and cross-field semantics without partially initializing a map. */
export function validateMapConfig(input: unknown): ConfigValidationResult {
  const errors = [...Value.Errors(mapConfigSchema, input)]
  if (errors.length)
    return {
      success: false,
      issues: errors.map((error) => ({
        path: error.instancePath || '/',
        code: error.keyword,
        message: error.message,
      })),
    }
  const config = input as GeospatialMapConfigV1
  const issues = semanticIssues(config)
  return issues.length ? { success: false, issues } : { success: true, config }
}

/** Builds a complete initial state from a view and ordered layer definitions. */
export function initialMapState(
  view: MapState['view'],
  layers: GeospatialMapConfigV1['data']['layers'],
  activeBasemapId?: string,
  time: string | null = null,
): MapState {
  return {
    view,
    ...(activeBasemapId ? { activeBasemapId } : {}),
    layers: Object.fromEntries(
      layers.map((layer, order) => [
        layer.id,
        { visible: layer.visible ?? true, opacity: layer.opacity ?? 1, order },
      ]),
    ),
    selection: null,
    time,
  }
}

/** Replaces `{name}` placeholders in a localized message template. */
export function formatMapMessage(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

/** Maps resolved theme tokens to the stable package CSS custom properties. */
export function mapThemeStyle(tokens: MapThemeTokens): Record<string, string> {
  return {
    '--geo-font-family': tokens.fontFamily,
    '--geo-ink': tokens.textColor,
    '--geo-muted': tokens.mutedColor,
    '--geo-border': tokens.borderColor,
    '--geo-surface': tokens.surfaceColor,
    '--geo-surface-soft': tokens.softSurfaceColor,
    '--geo-glass': tokens.glassColor,
    '--geo-accent': tokens.accentColor,
    '--geo-accent-hover': tokens.accentHoverColor,
    '--geo-danger': tokens.dangerColor,
    '--geo-focus': tokens.focusColor,
    '--geo-radius': tokens.radius,
    '--geo-shadow': tokens.shadow,
    '--geo-control-size': tokens.controlSize,
  }
}

/** Resolves partial consumer theme overrides against package defaults. */
export function resolveMapTheme(theme: Partial<MapThemeTokens> | undefined): MapThemeTokens {
  return { ...defaultMapTheme, ...theme }
}

/** Resolves partial localized messages against the English catalog. */
export function resolveMapMessages(messages: Partial<MapMessages> | undefined): MapMessages {
  return { ...defaultMapMessages, ...messages }
}
