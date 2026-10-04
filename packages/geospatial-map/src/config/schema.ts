// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import Type, { type TObjectOptions, type TProperties, type TSchema } from 'typebox'
import type { BBox, Feature } from 'geojson'
import type { JsonValue, MapMessages } from '../types'
import { defaultMapMessages } from '../messages'

// The JSON Schema of `MapConfig`, used by `validateMapConfig` and published as
// `map-config.schema.json` (`pnpm schema`). The TypeScript types in `types.ts` are written by
// hand for their documentation; `test/schema-types.test-d.ts` checks that each schema below and
// its type describe the same values.

const strict = <const T extends TProperties>(properties: T, options: TObjectOptions = {}) =>
  Type.Object(properties, { ...options, additionalProperties: false })
const optional = Type.Optional
const string = Type.String({ minLength: 1 })
const unit = Type.Number({ minimum: 0, maximum: 1 })
const projection = Type.String({ minLength: 1 })
const placement = Type.Union([
  Type.Literal('top-left'),
  Type.Literal('top-right'),
  Type.Literal('bottom-left'),
  Type.Literal('bottom-right'),
])
const lonLat = Type.Tuple([Type.Number(), Type.Number()])
const bounds = Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()])
const zoomStop = strict({ zoom: Type.Number(), value: Type.Number() })
const crossOrigin = Type.Union([Type.Literal('anonymous'), Type.Literal('use-credentials')])
const json = Type.Unsafe<JsonValue>(Type.Unknown())
const jsonRecord = Type.Record(Type.String(), json)

export const pointSymbolSchema = strict({
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
export const lineSymbolSchema = strict({
  kind: Type.Literal('line'),
  color: Type.String(),
  width: optional(Type.Number({ minimum: 0 })),
  widthStops: optional(Type.Array(zoomStop)),
  dash: optional(Type.Array(Type.Number({ minimum: 0 }))),
  opacity: optional(unit),
  labelField: optional(Type.String()),
})
export const polygonSymbolSchema = strict({
  kind: Type.Literal('polygon'),
  fillColor: optional(Type.String()),
  strokeColor: optional(Type.String()),
  strokeWidth: optional(Type.Number({ minimum: 0 })),
  dash: optional(Type.Array(Type.Number({ minimum: 0 }))),
  opacity: optional(unit),
  labelField: optional(Type.String()),
  labelColor: optional(Type.String()),
})
export const symbolSchema = Type.Union([pointSymbolSchema, lineSymbolSchema, polygonSymbolSchema])
const legendClass = { id: optional(Type.String()), label: string, symbol: symbolSchema }
const catchAll = strict(legendClass)
const specialValues = Type.Array(
  strict({
    ...legendClass,
    value: Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]),
  }),
)
export const thematicStyleSchema = Type.Union([
  strict({ type: Type.Literal('constant'), symbol: symbolSchema }),
  strict({
    type: Type.Literal('categorical'),
    field: string,
    categories: Type.Array(
      strict({ ...legendClass, value: Type.Union([Type.String(), Type.Number(), Type.Boolean()]) }),
    ),
    fallback: optional(catchAll),
    specialValues: optional(specialValues),
  }),
  strict({
    type: Type.Literal('graduated'),
    field: string,
    classes: Type.Array(
      strict({ ...legendClass, min: optional(Type.Number()), max: optional(Type.Number()) }),
    ),
    missing: optional(catchAll),
    specialValues: optional(specialValues),
    outOfRange: optional(catchAll),
  }),
  strict({
    type: Type.Literal('continuous'),
    field: string,
    domain: Type.Tuple([Type.Number(), Type.Number()]),
    stops: Type.Array(
      strict({ value: Type.Number(), color: Type.String(), label: optional(Type.String()) }),
      { minItems: 2 },
    ),
    symbol: optional(symbolSchema),
    clamp: optional(Type.Boolean()),
    missing: optional(catchAll),
    specialValues: optional(specialValues),
    outOfRange: optional(catchAll),
  }),
])

export const attributionSchema = strict({
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
    symbolSchema,
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
const legendText = {
  title: optional(Type.String()),
  subtitle: optional(Type.String()),
  units: optional(Type.String()),
  description: optional(Type.String()),
  sourceNote: optional(Type.String()),
  entries: optional(Type.Array(legendEntry)),
}
export const legendSchema = strict({
  ...legendText,
  byTime: optional(Type.Record(Type.String(), strict(legendText))),
})
const layerTime = strict({
  values: Type.Array(string, { minItems: 1, uniqueItems: true }),
  field: optional(string),
})
const commonLayer = {
  id: string,
  title: string,
  visible: optional(Type.Boolean()),
  opacity: optional(unit),
  minZoom: optional(Type.Number()),
  maxZoom: optional(Type.Number()),
  reorderable: optional(Type.Boolean()),
  required: optional(Type.Boolean()),
  showInLayerControl: optional(Type.Boolean()),
  group: optional(Type.String()),
  exclusiveGroup: optional(Type.String()),
  attribution: optional(Type.Array(attributionSchema)),
  legend: optional(legendSchema),
  exportable: optional(Type.Boolean()),
}
const selectableLayer = {
  selectable: optional(Type.Boolean()),
  featureIdField: optional(Type.String()),
  propertyAllowlist: optional(Type.Array(Type.String())),
}
const timedLayer = { time: optional(layerTime) }
const styleLayerSelection = Type.Union([
  Type.Literal('reference'),
  Type.Literal('base'),
  Type.Array(string, { minItems: 1 }),
])
const styleOverride = strict({
  layers: string,
  visible: optional(Type.Boolean()),
  color: optional(Type.String()),
  width: optional(Type.Number({ minimum: 0 })),
  opacity: optional(unit),
  paint: optional(jsonRecord),
  layout: optional(jsonRecord),
})
const mapboxStyle = {
  source: optional(Type.String()),
  layers: optional(styleLayerSelection),
  overrides: optional(Type.Array(styleOverride)),
}
const projectionDefinition = strict({
  code: string,
  definition: string,
  extent: optional(bounds),
  worldExtent: optional(bounds),
})
const tileGrid = {
  extent: bounds,
  origin: Type.Tuple([Type.Number(), Type.Number()]),
  resolutions: Type.Array(Type.Number({ exclusiveMinimum: 0 }), { minItems: 1 }),
  tileSize: optional(
    Type.Union([Type.Number({ exclusiveMinimum: 0 }), Type.Tuple([Type.Number(), Type.Number()])]),
  ),
}
const rowColumns = { longitude: optional(string), latitude: optional(string) }
export const featureDataSchema = Type.Union([
  strict({
    url: string,
    format: optional(
      Type.Union([
        Type.Literal('geojson'),
        Type.Literal('csv'),
        Type.Literal('json'),
        Type.Literal('arcgis'),
      ]),
    ),
    ...rowColumns,
  }),
  strict({ rows: Type.Array(jsonRecord), ...rowColumns }),
  strict({ builtin: Type.Literal('world') }),
  // GeoJSON allows other members (`bbox`, `name`, `crs`); features are checked when loaded.
  Type.Object({
    type: Type.Literal('FeatureCollection'),
    features: Type.Array(Type.Unsafe<Feature>(Type.Unknown())),
    bbox: optional(Type.Unsafe<BBox | undefined>(Type.Array(Type.Number()))),
  }),
])
const vectorSource = {
  data: featureDataSchema,
  sourceProjection: optional(Type.String()),
  sourceProjectionDefinition: optional(projectionDefinition),
}
const geoJsonFields = {
  renderer: optional(
    Type.Union([Type.Literal('auto'), Type.Literal('canvas'), Type.Literal('webgl')]),
  ),
  cluster: optional(
    strict({
      distance: optional(Type.Number({ minimum: 0 })),
      minDistance: optional(Type.Number({ minimum: 0 })),
    }),
  ),
}

/** Every layer kind, each with the `extra` fields (a basemap layer's `aboveOverlays`). */
function layerKinds<const Extra extends TProperties>(extra: Extra) {
  return Type.Union([
    strict({
      ...commonLayer,
      ...selectableLayer,
      ...timedLayer,
      ...vectorSource,
      ...geoJsonFields,
      ...extra,
      kind: Type.Literal('geojson'),
      style: thematicStyleSchema,
    }),
    strict({
      ...commonLayer,
      ...timedLayer,
      ...vectorSource,
      ...extra,
      kind: Type.Literal('heatmap'),
      weightField: optional(string),
      radius: optional(Type.Number({ minimum: 0 })),
      blur: optional(Type.Number({ minimum: 0 })),
      radiusStops: optional(Type.Array(zoomStop, { minItems: 1 })),
      blurStops: optional(Type.Array(zoomStop, { minItems: 1 })),
      gradient: optional(Type.Array(Type.String(), { minItems: 2 })),
    }),
    strict({
      ...commonLayer,
      ...selectableLayer,
      ...timedLayer,
      ...extra,
      kind: Type.Literal('mvt'),
      url: string,
      sourceProjection: string,
      sourceProjectionDefinition: optional(projectionDefinition),
      maxSourceZoom: optional(Type.Number()),
      tileGrid: optional(strict(tileGrid)),
      wrapX: optional(Type.Boolean()),
      style: optional(thematicStyleSchema),
      mapboxStyle: optional(strict({ url: string, ...mapboxStyle })),
    }),
    strict({
      ...commonLayer,
      ...extra,
      kind: Type.Literal('arcgis-vector-tiles'),
      url: string,
      mapboxStyle: optional(strict({ url: optional(string), ...mapboxStyle })),
      sourceProjectionDefinition: optional(projectionDefinition),
    }),
    strict({
      ...commonLayer,
      ...timedLayer,
      ...extra,
      kind: Type.Literal('xyz'),
      url: string,
      sourceProjection: string,
      crossOrigin: optional(crossOrigin),
      maxSourceZoom: optional(Type.Number()),
    }),
    strict({
      ...commonLayer,
      ...timedLayer,
      ...extra,
      kind: Type.Literal('wms'),
      url: string,
      params: Type.Intersect([
        Type.Record(Type.String(), Type.Union([Type.String(), Type.Number(), Type.Boolean()])),
        Type.Object({ LAYERS: string }),
      ]),
      sourceProjection: string,
      crossOrigin: optional(crossOrigin),
    }),
    strict({
      ...commonLayer,
      ...extra,
      kind: Type.Literal('wmts'),
      url: string,
      layer: string,
      matrixSet: string,
      format: string,
      sourceProjection: string,
      styleName: optional(Type.String()),
      tileGrid: strict({ ...tileGrid, matrixIds: Type.Array(Type.String(), { minItems: 1 }) }),
      crossOrigin: optional(crossOrigin),
    }),
  ])
}
export const layerSchema = layerKinds({})
export const basemapLayerSchema = layerKinds({ aboveOverlays: optional(Type.Boolean()) })
export const basemapSchema = strict({
  id: string,
  title: string,
  // Empty only for a basemap of ArcGIS layers, whose projection is read from the service.
  supportedProjections: Type.Array(projection, { uniqueItems: true }),
  layers: Type.Array(basemapLayerSchema),
  backgroundColor: optional(string),
  attribution: optional(Type.Array(attributionSchema)),
  exportable: optional(Type.Boolean()),
})
const selection = strict({ layerId: string, featureId: string })
const viewState = {
  center: lonLat,
  zoom: Type.Number(),
  projection,
  rotation: optional(Type.Number()),
}
const layerStates = Type.Record(
  Type.String(),
  strict({
    visible: Type.Boolean(),
    opacity: unit,
    order: Type.Integer({ minimum: 0 }),
    style: optional(thematicStyleSchema),
  }),
)
const stateFields = {
  activeBasemapId: optional(Type.String()),
  selection: Type.Union([selection, Type.Null()]),
  time: Type.Union([Type.String(), Type.Null()]),
}
export const stateSchema = strict({ view: strict(viewState), layers: layerStates, ...stateFields })
const fitOptions = strict({
  padding: optional(Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()])),
  duration: optional(Type.Number({ minimum: 0 })),
  maxZoom: optional(Type.Number()),
})
export const viewSchema = strict({
  minZoom: optional(Type.Number()),
  maxZoom: optional(Type.Number()),
  fitWorld: optional(Type.Boolean()),
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
})
const zoomTargets = optional(
  Type.Array(strict({ id: string, label: string, bounds, maxZoom: optional(Type.Number()) })),
)
export const dataSchema = strict({
  layers: Type.Array(layerSchema),
  basemaps: Type.Array(basemapSchema, { minItems: 1 }),
  zoomTargets,
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
  Type.TemplateLiteral('custom:${string}'),
])
const panel = { enabled: optional(Type.Boolean()), placement: optional(placement) }
export const uiSchema = strict({
  profile: optional(
    Type.Union([
      Type.Literal('full'),
      Type.Literal('compact'),
      Type.Literal('embedded'),
      Type.Literal('grid'),
    ]),
  ),
  controls: optional(
    strict({
      ...panel,
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
      ...panel,
      defaultOpen: optional(Type.Boolean()),
      fields: optional(
        Type.Array(
          Type.Union([
            Type.Literal('basemap'),
            Type.Literal('zoom-target'),
            Type.Literal('export'),
          ]),
          { uniqueItems: true },
        ),
      ),
    }),
  ),
  layerPanel: optional(
    strict({
      ...panel,
      defaultOpen: optional(Type.Boolean()),
      allowVisibility: optional(Type.Boolean()),
      allowOpacity: optional(Type.Boolean()),
      allowReorder: optional(Type.Boolean()),
      showMetadata: optional(Type.Boolean()),
      groupBy: optional(Type.Union([Type.Literal('group'), Type.Literal('none')])),
      itemDetails: optional(Type.Union([Type.Literal('disclosure'), Type.Literal('always')])),
      defaultExpandedLayerIds: optional(Type.Array(string, { uniqueItems: true })),
      showSymbolPreview: optional(Type.Boolean()),
    }),
  ),
  legend: optional(
    strict({
      ...panel,
      expanded: optional(Type.Boolean()),
      layout: optional(Type.Union([Type.Literal('list'), Type.Literal('compact')])),
    }),
  ),
  popup: optional(
    strict({
      ...panel,
      closeOnMapClick: optional(Type.Boolean()),
      anchor: optional(Type.Union([Type.Literal('corner'), Type.Literal('feature')])),
    }),
  ),
  tooltip: optional(
    strict({ enabled: optional(Type.Boolean()), fields: optional(Type.Array(string)) }),
  ),
  disclaimer: optional(
    strict({
      enabled: optional(Type.Boolean()),
      text: optional(Type.String()),
      title: optional(Type.String()),
      placement: optional(Type.Union([Type.Literal('bottom-left'), Type.Literal('bottom-right')])),
      defaultOpen: optional(Type.Boolean()),
    }),
  ),
  attribution: optional(strict({ ...panel, compact: optional(Type.Boolean()) })),
  statusChips: optional(
    strict({
      ...panel,
      showLoading: optional(Type.Boolean()),
      showNoData: optional(Type.Boolean()),
      showScaleUnavailable: optional(Type.Boolean()),
    }),
  ),
  errorAlert: optional(strict({ ...panel, dismissible: optional(Type.Boolean()) })),
  breadcrumbs: optional(strict({ ...panel, targets: optional(Type.Array(string)) })),
  time: optional(
    strict({
      ...panel,
      speedsMs: optional(Type.Array(Type.Number({ exclusiveMinimum: 0 }), { minItems: 1 })),
      defaultSpeedMs: optional(Type.Number({ exclusiveMinimum: 0 })),
      autoplay: optional(Type.Boolean()),
      loop: optional(Type.Boolean()),
      frameFailurePolicy: optional(Type.Union([Type.Literal('pause'), Type.Literal('skip')])),
    }),
  ),
})
const exportFormat = Type.Union([
  Type.Literal('image/png'),
  Type.Literal('image/jpeg'),
  Type.Literal('image/svg+xml'),
])
/** The fields of `ExportOptions` other than `format`. */
const exportOptions = {
  width: optional(Type.Number({ minimum: 1 })),
  height: optional(Type.Number({ minimum: 1 })),
  pixelRatio: optional(Type.Number({ minimum: 1 })),
  quality: optional(unit),
  title: optional(Type.String()),
  subtitle: optional(Type.String()),
  selectedAreaLabel: optional(Type.String()),
  disclaimer: optional(Type.String()),
  includeLegend: optional(Type.Boolean()),
  includeAttribution: optional(Type.Boolean()),
  timeoutMs: optional(Type.Number({ minimum: 1 })),
}
export const exportOptionsSchema = strict({ format: exportFormat, ...exportOptions })
export const exportSchema = strict({
  ...exportOptions,
  enabled: optional(Type.Boolean()),
  formats: optional(Type.Array(exportFormat, { minItems: 1, uniqueItems: true })),
  defaultFormat: optional(exportFormat),
})
export const themeSchema = strict({
  fontFamily: optional(string),
  foreground: optional(string),
  background: optional(string),
  muted: optional(string),
  mutedForeground: optional(string),
  border: optional(string),
  overlay: optional(string),
  primary: optional(string),
  primaryForeground: optional(string),
  primaryHover: optional(string),
  destructive: optional(string),
  ring: optional(string),
  stage: optional(string),
  radius: optional(string),
  shadow: optional(string),
  controlSize: optional(string),
  density: optional(Type.Union([Type.Literal('comfortable'), Type.Literal('compact')])),
})
export const accessibilitySchema = strict({
  ariaLabel: string,
  reducedMotion: optional(Type.Union([Type.Literal('respect'), Type.Literal('ignore')])),
})
const messageKeys = Object.keys(defaultMapMessages) as Array<keyof MapMessages>
export const messagesSchema = strict(
  Object.fromEntries(messageKeys.map((key) => [key, optional(Type.String())])),
)

const configFields = {
  version: optional(Type.Literal(1)),
  id: optional(Type.String()),
  accessibility: accessibilitySchema,
  export: optional(exportSchema),
  theme: optional(themeSchema),
  messages: optional(messagesSchema),
}

/** The JSON Schema of a complete `MapConfig`. */
export const mapConfigSchema: TSchema = strict(
  {
    ...configFields,
    initialState: stateSchema,
    view: viewSchema,
    data: dataSchema,
    ui: uiSchema,
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:org:geospatial-map:config:v1',
    title: 'Geospatial map configuration',
  },
)

/** A GeoJSON layer in the short form: `{ id, data }` is enough (`MapLayerInput`). */
const geoJsonLayerInput = strict({
  ...commonLayer,
  ...selectableLayer,
  ...timedLayer,
  ...vectorSource,
  ...geoJsonFields,
  title: optional(string),
  kind: optional(Type.Literal('geojson')),
  style: optional(thematicStyleSchema),
})

/**
 * The JSON Schema of the short form (`MapConfigInput`), for editors that write configurations
 * (a CMS field, a JSON file with `$schema`). `validateMapConfig` accepts both forms.
 */
export const configInputSchema = strict(
  {
    ...configFields,
    initialState: optional(
      strict({
        view: optional(Type.Partial(strict(viewState))),
        layers: optional(layerStates),
        ...Type.Partial(strict(stateFields)).properties,
      }),
    ),
    view: optional(viewSchema),
    data: strict({
      layers: Type.Array(Type.Union([layerSchema, geoJsonLayerInput])),
      basemaps: optional(Type.Array(basemapSchema)),
      zoomTargets,
    }),
    ui: optional(uiSchema),
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:org:geospatial-map:config-input:v1',
    title: 'Geospatial map configuration (short form)',
  },
)

export const mapInputSchema: TSchema = configInputSchema
