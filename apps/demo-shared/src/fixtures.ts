// The framework-neutral half of the demo harness and its scenarios, shared by the React demo
// (apps/demo) and the Angular demo (apps/demo-angular): layer fixtures, map and grid
// configurations, the harness's option lists, its event log and the text it shows. Each demo
// renders these with its own parts, so both put the same maps on screen from the same data.
//
// Only the shared helpers and types of `@/components/geospatial-map` are used here (each demo
// maps that alias to its own folder). Never import a part, hook or icon from it in this file.
import type { FeatureCollection, Point } from 'geojson'
import {
  arcgisBasemap,
  createClassifiedPolygonStyle,
  defineMapConfig,
  plainBasemap,
  worldBasemap,
  type ClassificationMethod,
  type FeatureEvent,
  type GeoJsonLayerConfig,
  type LonLatBounds,
  type MapActions,
  type MapCallbacks,
  type MapConfig,
  type MapGridConfig,
  type MapLayerConfig,
  type MapLayerInput,
  type MapPlacement,
  type MapState,
  type MapUiConfig,
  type MapUiProfileId,
  type MapViewState,
  type PaletteId,
} from '@/components/geospatial-map'
import {
  basemaps,
  breadcrumbTargets,
  brokenLayer,
  bubbleLayer,
  categoricalPointLayer,
  cityLayer,
  heatmapLayer,
  indicatorLayer,
  initialView,
  rasterLayer,
  rasterLayerSecondary,
  routeLayer,
  timedLayer,
  timedRasterLayer,
  zoomTargets,
} from './demo-config'
import type { ScenarioId } from './scenarios'
import { pointObservations, worldCountries } from './world'

// ---------------------------------------------------------------------------------------------
// Main harness map (the scenarios without a component of their own)

/** `?points=`: synthetic points spread over the world, for the performance budget. */
export function createPointFixture(
  count: number,
  renderer: 'auto' | 'canvas' | 'webgl' = 'auto',
): MapLayerConfig {
  return {
    id: 'benchmark-points',
    title: `${count.toLocaleString()} benchmark points`,
    kind: 'geojson',
    renderer,
    data: {
      type: 'FeatureCollection',
      features: Array.from({ length: count }, (_, index) => {
        const longitude = ((index * 137.508) % 360) - 180
        const latitude = Math.sin(index * 0.73) * 70
        return {
          type: 'Feature',
          id: `point-${index}`,
          properties: { geoId: `point-${index}`, value: index % 100 },
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
        }
      }),
    },
    style: {
      type: 'continuous',
      field: 'value',
      domain: [0, 100],
      stops: [
        { value: 0, color: '#fbbf24' },
        { value: 100, color: '#dc2626' },
      ],
      symbol: { kind: 'point', radius: 2 },
    },
    legend: { title: 'Point benchmark', units: 'synthetic value' },
    featureIdField: 'geoId',
  }
}

/**
 * `?sources`: one layer per source kind. The browser tests answer their `/fixtures/…` requests
 * (no server serves them).
 */
export const sourceFixtureLayers: MapLayerConfig[] = [
  {
    id: 'fixture-geojson',
    title: 'GeoJSON fixture',
    kind: 'geojson',
    data: { url: '/fixtures/data.geojson' },
    style: { type: 'constant', symbol: { kind: 'point', fillColor: '#e11d48' } },
  },
  {
    id: 'fixture-xyz',
    title: 'XYZ fixture',
    kind: 'xyz',
    url: '/fixtures/xyz/{z}/{x}/{y}.png',
    sourceProjection: 'EPSG:3857',
  },
  {
    id: 'fixture-wms',
    title: 'WMS fixture',
    kind: 'wms',
    url: '/fixtures/wms',
    params: { LAYERS: 'fixture', TILED: true },
    sourceProjection: 'EPSG:3857',
  },
  {
    id: 'fixture-wmts',
    title: 'WMTS fixture',
    kind: 'wmts',
    url: '/fixtures/wmts/{TileMatrix}/{TileRow}/{TileCol}.png',
    layer: 'fixture',
    matrixSet: 'EPSG3857',
    format: 'image/png',
    sourceProjection: 'EPSG:3857',
    tileGrid: {
      extent: [-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244],
      origin: [-20037508.342789244, 20037508.342789244],
      resolutions: [156543.03392804097],
      matrixIds: ['0'],
    },
  },
  {
    id: 'fixture-mvt',
    title: 'MVT fixture',
    kind: 'mvt',
    url: '/fixtures/mvt/{z}/{x}/{y}.pbf',
    sourceProjection: 'EPSG:3857',
    style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#ddd6fe' } },
  },
]

/** The layers of each scenario that runs on the main map. */
export function scenarioLayers(
  scenario: ScenarioId,
  classifiedIndicator: MapLayerConfig,
): MapLayerConfig[] {
  if (scenario === 'geometry') return [classifiedIndicator, routeLayer, cityLayer]
  if (scenario === 'points') return [heatmapLayer, categoricalPointLayer, bubbleLayer]
  if (scenario === 'layers')
    return [classifiedIndicator, rasterLayer, rasterLayerSecondary, routeLayer, cityLayer]
  if (scenario === 'time') return [timedLayer, timedRasterLayer, cityLayer]
  if (scenario === 'raster') return [classifiedIndicator, rasterLayer, rasterLayerSecondary]
  if (scenario === 'errors') return [classifiedIndicator, brokenLayer]
  if (scenario === 'composed') return [classifiedIndicator, routeLayer, cityLayer]
  return [classifiedIndicator]
}

/** The main map's layers: the source fixtures, the benchmark points, or the scenario's layers. */
export function harnessLayers(
  scenario: ScenarioId,
  fixtures: { sources: boolean; points: number; renderer: 'canvas' | 'webgl' | undefined },
  classifiedIndicator: MapLayerConfig,
): MapLayerConfig[] {
  if (fixtures.sources) return sourceFixtureLayers
  if (fixtures.points > 0) return [createPointFixture(fixtures.points, fixtures.renderer)]
  return scenarioLayers(scenario, classifiedIndicator)
}

// The "Style map" controls: the approved symbology the indicator layer is classified with.

export type HarnessSymbology = {
  palette: PaletteId
  method: ClassificationMethod
  classCount: number
}

export const defaultSymbology: HarnessSymbology = {
  palette: 'blue',
  method: 'equal-interval',
  classCount: 5,
}

export const paletteOptions: ReadonlyArray<{ value: PaletteId; label: string }> = [
  { value: 'blue', label: 'Blue' },
  { value: 'blueOrange', label: 'Blue–orange' },
  { value: 'viridis', label: 'Viridis' },
]

export const classificationOptions: ReadonlyArray<{ value: ClassificationMethod; label: string }> =
  [
    { value: 'equal-interval', label: 'Equal interval' },
    { value: 'quantile', label: 'Quantile' },
  ]

export const classCountOptions: readonly number[] = [3, 4, 5]

/** The indicator values the classification breaks are computed from. */
export const indicatorValues: number[] = worldCountries.features
  .map((feature) => Number(feature.properties?.['value']))
  .filter(Number.isFinite)

/** The development index layer, classified with the chosen symbology. */
export function createClassifiedIndicator({
  palette,
  method,
  classCount,
}: HarnessSymbology): MapLayerConfig {
  return {
    ...indicatorLayer,
    style: createClassifiedPolygonStyle({
      field: 'value',
      values: indicatorValues,
      palette,
      method,
      classCount,
      range: [0, 100],
    }),
  }
}

// The configuration playground (`?scenario=configuration`).

export const profileOptions: ReadonlyArray<{ value: MapUiProfileId; label: string }> = [
  { value: 'full', label: 'Full' },
  { value: 'compact', label: 'Compact' },
  { value: 'embedded', label: 'Embedded' },
  { value: 'grid', label: 'Grid' },
]

export const placementOptions: ReadonlyArray<{ value: MapPlacement; label: string }> = [
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
]

/** The starting text of the "UI override JSON" field. */
export const defaultUiOverrideJson = '{\n  "legend": { "layout": "compact" }\n}'

/** Parses the "UI override JSON" field; the error text is what the status shows. */
export function parseUiOverride(json: string): { ui: MapUiConfig } | { error: string } {
  try {
    return { ui: JSON.parse(json) as MapUiConfig }
  } catch (error) {
    return { error: String(error) }
  }
}

/** What "Generated policy" shows: the UI, theme and messages the playground produced. */
export function generatedPolicyJson(config: MapConfig): string {
  return JSON.stringify(
    { version: 1, ui: config.ui, theme: config.theme, messages: config.messages },
    null,
    2,
  )
}

/** Everything the main map's configuration depends on. */
export type HarnessConfigOptions = {
  scenario: ScenarioId
  layers: MapLayerConfig[]
  /** From `parseHarnessParams()`. */
  projection: string
  /** From `parseHarnessParams()`. */
  activeBasemap: string
  /** The playground's settings (used only by `configuration`, except density and messages). */
  profile: MapUiProfileId
  railPlacement: MapPlacement
  showLegend: boolean
  showLayers: boolean
  compactTheme: boolean
  translated: boolean
  uiOverride: MapUiConfig
}

/** The playground's starting settings. */
export const defaultPlaygroundSettings = {
  profile: 'full',
  railPlacement: 'top-right',
  showLegend: true,
  showLayers: true,
  compactTheme: false,
  translated: false,
  uiOverride: {},
} as const satisfies Omit<
  HarnessConfigOptions,
  'scenario' | 'layers' | 'projection' | 'activeBasemap'
>

/** The main map's configuration (also the composed scenario's, and the grid's shared part). */
export function createHarnessConfig({
  scenario,
  layers,
  projection,
  activeBasemap,
  profile,
  railPlacement,
  showLegend,
  showLayers,
  compactTheme,
  translated,
  uiOverride,
}: HarnessConfigOptions): MapConfig {
  return defineMapConfig({
    accessibility: { ariaLabel: 'Indicator geospatial map' },
    initialState: {
      view: { ...initialView, projection },
      activeBasemapId: activeBasemap,
    },
    view: {
      minZoom: 0,
      maxZoom: 12,
      interactions: { dragPan: true, wheelZoom: true, keyboard: true, select: true },
      fit: { padding: [40, 40, 40, 40], duration: 300, maxZoom: 7 },
    },
    // A page that asks for another basemap (`?basemap=`, or the Web Mercator map) leaves the Esri
    // basemap out, so it doesn't wait for the Esri service before it starts.
    data: {
      layers,
      basemaps:
        activeBasemap === 'esri-world'
          ? basemaps
          : basemaps.filter((basemap) => basemap.id !== 'esri-world'),
      zoomTargets,
    },
    ui: {
      profile: scenario === 'configuration' ? profile : 'full',
      breadcrumbs: { targets: breadcrumbTargets },
      ...(scenario === 'points'
        ? {
            layerPanel: {
              defaultOpen: true,
              defaultExpandedLayerIds: ['population-bubbles'],
            },
          }
        : {}),
      ...(scenario === 'configuration'
        ? {
            controls: {
              placement: railPlacement,
              groups: [
                { id: 'zoom', controls: ['zoom-in', 'zoom-out'] },
                { id: 'content', controls: ['layers', 'fit', 'custom:home'] },
                { id: 'more', controls: ['settings', 'fullscreen'] },
              ],
            },
            layerPanel: { enabled: showLayers },
            legend: { enabled: showLegend },
            ...uiOverride,
          }
        : {}),
      time: { enabled: true, speedsMs: [400, 900, 1600], defaultSpeedMs: 900, loop: true },
    },
    export: {
      enabled: true,
      formats: ['image/png', 'image/jpeg', 'image/svg+xml'],
      title: 'Indicator geospatial map',
      subtitle: `Scenario: ${scenario}`,
      includeLegend: true,
      includeAttribution: true,
    },
    theme: {
      density: compactTheme ? 'compact' : 'comfortable',
      ...(scenario === 'configuration' ? { primary: '#6d28d9', primaryHover: '#5b21b6' } : {}),
    },
    messages: translated
      ? { mapSettings: 'Настройки на картата', layers: 'Слоеве', legend: 'Легенда' }
      : {},
  })
}

/** The bounds the "Fit world" custom control fits. */
export const worldBounds: LonLatBounds = [-180, -90, 180, 90]

/** The six regional maps of `?scenario=grid`. */
export const gridRegions: ReadonlyArray<{
  id: string
  title: string
  center: MapViewState['center']
}> = [
  { id: 'europe', title: 'Europe', center: [15, 52] },
  { id: 'africa', title: 'Africa', center: [22, 2] },
  { id: 'asia', title: 'Asia', center: [95, 38] },
  { id: 'north-america', title: 'North America', center: [-105, 42] },
  { id: 'south-america', title: 'South America', center: [-60, -18] },
  { id: 'oceania', title: 'Oceania', center: [135, -25] },
]

/** `?scenario=grid`: the 3 × 2 grid, sharing the main map's configuration. */
export function createHarnessGridConfig(
  config: MapConfig,
  classifiedIndicator: MapLayerConfig,
): MapGridConfig {
  const maps = gridRegions.map(({ id, title, center }) => ({
    id,
    title,
    initialState: {
      view: { ...initialView, center, zoom: 2.1 },
      activeBasemapId: 'reference-equal-earth',
    },
    layers: [classifiedIndicator],
  }))
  return {
    version: 1,
    shared: {
      ...config,
      initialState: maps[0]!.initialState,
      data: { ...config.data, layers: [classifiedIndicator] },
    },
    maps,
    layout: {
      columns: 3,
      tabletColumns: 2,
      mobileColumns: 1,
      gapPx: 12,
      cellHeightPx: 340,
    },
    sync: { layers: true, time: true },
    focus: { enabled: true },
  }
}

// The integration inspector: typed events, logged as one line each.

/** One line of the "Recent map events" list. */
export function eventSummary(name: string, detail: unknown): string {
  return `${new Date().toLocaleTimeString()} · ${name} · ${JSON.stringify(detail)}`
}

/** How many events the list keeps. */
export const maxLoggedEvents = 24

/** The event list with a new event first. */
export function logEvent(events: readonly string[], name: string, detail: unknown): string[] {
  return [eventSummary(name, detail), ...events].slice(0, maxLoggedEvents)
}

export type HarnessCallbacks = Required<
  Pick<
    MapCallbacks,
    | 'onFeatureSelect'
    | 'onViewChange'
    | 'onLayerStateChange'
    | 'onTimeChange'
    | 'onMetric'
    | 'onError'
  >
>

/** The main map's callbacks, each logging its event with `record`. */
export function createHarnessCallbacks(
  record: (name: string, detail: unknown) => void,
): HarnessCallbacks {
  return {
    onFeatureSelect: (event) => record('featureSelect', event?.featureId ?? null),
    onViewChange: (event) => record('viewChange', { zoom: Number(event.view.zoom.toFixed(2)) }),
    onLayerStateChange: (event) => record('layerStateChange', event),
    onTimeChange: (event) => record('timeChange', event.time),
    onMetric: (metric) =>
      record('metric', {
        name: metric.name,
        durationMs: Number(metric.durationMs.toFixed(1)),
        layerId: metric.layerId,
      }),
    onError: (error) => record('error', { code: error.code, layerId: error.layerId }),
  }
}

/** The performance mark the benchmark test reads when the main map is ready. */
export const stableRenderMark = 'geospatial-map-stable-render'

// Text the harness shows.

export function benchmarkNotice(points: number): string {
  return `Benchmark mode: ${points.toLocaleString()} points.`
}

export const sourceFixtureNotice = 'Source fixture mode: GeoJSON, XYZ, WMS, WMTS, and MVT.'

/** The feature's name, or its id. */
export function featureTitle(feature: FeatureEvent): string {
  return String(feature.properties['name'] ?? feature.featureId)
}

/** How long the main map's popup shows "Loading indicator statistics…" for a new feature. */
export const popupLoadingMs = 750

/** The main map's popup, once loaded. */
export function harnessPopupContent(feature: FeatureEvent): {
  title: string
  statistic: string
  note: string
} {
  return {
    title: featureTitle(feature),
    statistic:
      feature.properties['value'] === undefined
        ? 'No indicator value'
        : String(feature.properties['value']),
    note: String(feature.properties['category'] ?? 'Associated demonstration statistic'),
  }
}

/** The rows of the "Accessible indicator data table". */
export const indicatorTableRows: ReadonlyArray<{
  key: string
  area: string
  value: string
  category: string
}> = worldCountries.features.map((feature, index) => ({
  key: String(feature.properties?.['geoId'] ?? index),
  area: String(feature.properties?.['name'] ?? 'Unnamed area'),
  value: String(feature.properties?.['value'] ?? 'No data'),
  category: String(feature.properties?.['category'] ?? 'Not classified'),
}))

// ---------------------------------------------------------------------------------------------
// Composed scenario (`?scenario=composed`): the harness configuration, composed by hand

/** The composed popup's statistic. */
export function composedPopupValue(feature: FeatureEvent): string {
  return String(feature.properties['value'] ?? '—')
}

/** The custom selection badge's text. */
export function selectionBadgeText(feature: FeatureEvent | null): string {
  return feature ? `Selected: ${featureTitle(feature)}` : 'Click an area to select it'
}

// ---------------------------------------------------------------------------------------------
// Quick start (`?scenario=quickstart`)

/** The URL the quick-start layer names; the scenario's custom loader answers it. */
export const quickStartDataUrl = '/api/countries.geojson'

/**
 * The quick-start configuration. It is the shortest useful one, and the scenario builds it
 * again on every render, the way a team first writes it: call this in the render, not once.
 */
export function createQuickStartConfig(): MapConfig {
  return defineMapConfig({
    accessibility: { ariaLabel: 'Quick start map' },
    data: {
      layers: [
        {
          id: 'countries',
          title: 'Countries',
          kind: 'geojson',
          data: { url: quickStartDataUrl },
          featureIdField: 'geoId',
          style: {
            type: 'constant',
            symbol: {
              kind: 'polygon',
              fillColor: '#5b8fd6',
              strokeColor: '#ffffff',
              strokeWidth: 0.5,
            },
          },
        },
      ],
    },
  })
}

// ---------------------------------------------------------------------------------------------
// Features (`?scenario=features`): built-in world basemap (named, as the default is the Esri
// World Basemap since 0.11), clusters, WebGL, popup, graticule

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const random = seeded(7)
const statuses = ['normal', 'watch', 'alert'] as const

/** 60 monitoring stations around each observation city, at seeded random offsets. */
export const stations: FeatureCollection = {
  type: 'FeatureCollection',
  features: pointObservations.features.flatMap((city) => {
    const [longitude = 0, latitude = 0] = (city.geometry as Point).coordinates
    return Array.from({ length: 60 }, (_, index) => {
      const id = `${String(city.id)}-${index}`
      const reading = Math.round(random() * 100)
      return {
        type: 'Feature' as const,
        id,
        properties: {
          geoId: id,
          name: `${String(city.properties?.['name'])} station ${index + 1}`,
          reading,
          status: statuses[reading > 85 ? 2 : reading > 60 ? 1 : 0],
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude + (random() - 0.5) * 9, latitude + (random() - 0.5) * 6],
        },
      }
    })
  }),
}

export type FeaturesOptions = {
  cluster: boolean
  renderer: 'auto' | 'canvas' | 'webgl'
  anchor: 'feature' | 'corner'
}

export const defaultFeaturesOptions: FeaturesOptions = {
  cluster: true,
  renderer: 'auto',
  anchor: 'feature',
}

export const rendererOptions: ReadonlyArray<FeaturesOptions['renderer']> = [
  'auto',
  'canvas',
  'webgl',
]

export const popupAnchorOptions: ReadonlyArray<{
  value: FeaturesOptions['anchor']
  label: string
}> = [
  { value: 'feature', label: 'next to the feature' },
  { value: 'corner', label: 'in a corner' },
]

/** The OpenLayers graticule the scenario adds through `onOpenLayersMap` (`ol/layer/Graticule`). */
export const graticuleOptions = {
  strokeColor: 'rgba(15, 118, 110, 0.35)',
  strokeWidth: 1,
  showLabels: false,
  wrapX: false,
  zIndex: 100,
} as const

/** The features scenario's configuration; it is rebuilt on every render, like the quick start. */
export function createFeaturesConfig({ cluster, renderer, anchor }: FeaturesOptions): MapConfig {
  return defineMapConfig({
    accessibility: { ariaLabel: 'Monitoring stations' },
    ui: { popup: { anchor } },
    data: {
      basemaps: [worldBasemap],
      layers: [
        {
          id: 'stations',
          title: 'Monitoring stations',
          kind: 'geojson',
          data: stations,
          featureIdField: 'geoId',
          ...(cluster ? { cluster: { distance: 44, minDistance: 24 } } : { renderer }),
          style: {
            type: 'categorical',
            field: 'status',
            categories: [
              {
                value: 'normal',
                label: 'Normal',
                symbol: { kind: 'point', radius: 5, fillColor: '#16a34a', strokeColor: '#ffffff' },
              },
              {
                value: 'watch',
                label: 'Watch',
                symbol: { kind: 'point', radius: 6, fillColor: '#f59e0b', strokeColor: '#ffffff' },
              },
              {
                value: 'alert',
                label: 'Alert',
                symbol: {
                  kind: 'point',
                  shape: 'triangle',
                  radius: 8,
                  fillColor: '#dc2626',
                  strokeColor: '#ffffff',
                },
              },
            ],
          },
        },
      ],
    },
  })
}

// ---------------------------------------------------------------------------------------------
// ArcGIS (`?scenario=arcgis`): an Equal Earth basemap from ArcGIS Online, by URL only

export const ARCGIS_EQUAL_EARTH =
  'https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/EqualEarthBasemap/VectorTileServer'

export type ArcgisOptions = { borderColor: string; borderWidth: number; labelsAboveData: boolean }

export const defaultArcgisOptions: ArcgisOptions = {
  borderColor: '#5b4f3a',
  borderWidth: 1,
  labelsAboveData: true,
}

/** The "Border width" range input. */
export const borderWidthRange = { min: 0.5, max: 4, step: 0.5 } as const

/** The ArcGIS scenario's configuration; it is rebuilt on every render. */
export function createArcgisConfig({
  borderColor,
  borderWidth,
  labelsAboveData,
}: ArcgisOptions): MapConfig {
  return defineMapConfig({
    accessibility: { ariaLabel: 'Indicators on an ArcGIS basemap' },
    ui: {
      disclaimer: {
        text:
          'Country borders or names do not necessarily reflect an official position. This map ' +
          'is for illustrative purposes and does not imply any opinion on the legal status of ' +
          'any country or territory or on the delimitation of frontiers or boundaries.',
      },
    },
    data: {
      basemaps: [
        arcgisBasemap({
          url: ARCGIS_EQUAL_EARTH,
          labelsAboveData,
          styleOverrides: [{ layers: 'Boundary line/*', color: borderColor, width: borderWidth }],
        }),
      ],
      layers: [
        {
          id: 'index',
          title: 'Development index',
          kind: 'geojson',
          data: worldCountries,
          featureIdField: 'geoId',
          opacity: 0.85,
          style: {
            type: 'continuous',
            field: 'value',
            domain: [0, 100],
            stops: [
              { value: 0, color: '#fff7bc' },
              { value: 50, color: '#7fcdbb' },
              { value: 100, color: '#225ea8' },
            ],
          },
        },
      ],
    },
  })
}

// ---------------------------------------------------------------------------------------------
// Themes (`?scenario=themes`): one map, restyled by the stylesheets in styles/themes

// The same layers as the time scenario, with colours taken from the theme (`var(--demo-…)`).
const themedLayers: MapLayerInput[] = [
  {
    ...(timedLayer as GeoJsonLayerConfig),
    opacity: 1,
    style: {
      type: 'continuous',
      field: 'value',
      domain: [0, 100],
      stops: [
        { value: 0, color: 'var(--demo-seq-1)' },
        { value: 50, color: 'var(--demo-seq-3)' },
        { value: 100, color: 'var(--demo-seq-5)' },
      ],
      symbol: { kind: 'polygon', strokeColor: 'var(--demo-area-stroke)', strokeWidth: 0.6 },
      missing: { label: 'No data', symbol: { kind: 'polygon', fillColor: 'var(--demo-missing)' } },
    },
  },
  {
    ...(cityLayer as GeoJsonLayerConfig),
    style: {
      type: 'constant',
      symbol: {
        kind: 'point',
        shape: 'circle',
        radius: 5,
        fillColor: 'var(--demo-point)',
        strokeColor: 'var(--demo-point-stroke)',
        strokeWidth: 2,
        labelField: 'name',
      },
    },
    legend: {
      entries: [
        {
          id: 'city',
          label: 'Selected cities',
          symbol: {
            kind: 'point',
            fillColor: 'var(--demo-point)',
            strokeColor: 'var(--demo-point-stroke)',
          },
        },
      ],
    },
  },
  categoricalPointLayer,
]

export const themesConfig: MapConfig = defineMapConfig({
  accessibility: { ariaLabel: 'Design-system themes' },
  initialState: { time: '2021' },
  ui: {
    popup: { anchor: 'feature' },
    disclaimer: {
      text:
        'Boundaries and names shown do not imply official endorsement or acceptance. ' +
        'Values are synthetic and for demonstration only.',
    },
  },
  data: { layers: themedLayers },
})

// ---------------------------------------------------------------------------------------------
// Engine checks (`?scenario=checks`): behaviour the browser tests drive directly

declare global {
  interface Window {
    /** The checks map's actions, for the browser tests. */
    geoChecks?: MapActions | null
    /** The second checks map's actions. */
    geoMoreChecks?: MapActions | null
  }
}

/** The first checks map. Its state is held by the host. */
export const checksConfig: MapConfig = defineMapConfig({
  accessibility: { ariaLabel: 'Engine checks map' },
  initialState: { view: { center: [-50, -10], zoom: 2 } },
  view: { fitWorld: false },
  data: {
    layers: [
      {
        id: 'countries',
        title: 'Countries',
        data: worldCountries,
        featureIdField: 'geoId',
        // Blocks image export, so the export error can be checked without a server.
        exportable: false,
      },
    ],
  },
  ui: { popup: { anchor: 'feature' } },
})

/** The feature id "Select Brazil" selects. */
export const brazilFeatureId = '76'

/** The host state with the given country selected, or with no selection. */
export function selectCountry(state: MapState, featureId: string | null): MapState {
  return { ...state, selection: featureId ? { layerId: 'countries', featureId } : null }
}

/** The host state with the countries layer hidden and at half opacity ("Hide countries"). */
export function hideCountries(state: MapState): MapState {
  return {
    ...state,
    layers: {
      ...state.layers,
      countries: { ...state.layers['countries']!, visible: false, opacity: 0.5 },
    },
  }
}

/** The checks grid: two maps (three with "Add grid map") with synchronised view and selection. */
export function createChecksGridConfig(thirdMap: boolean): MapGridConfig {
  return {
    shared: { ...checksConfig, ui: { popup: { enabled: true } } },
    maps: [
      { id: 'left', title: 'Left' },
      { id: 'right', title: 'Right' },
      ...(thirdMap ? [{ id: 'third', title: 'Third' }] : []),
    ],
    layout: { columns: 2, cellHeightPx: 220 },
    sync: { view: true, selection: true },
  }
}

/** Points in Europe, each in one of two time frames. */
export const europeCities: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    [2.35, 48.86, 'Paris', 'a'],
    [13.4, 52.52, 'Berlin', 'a'],
    [23.32, 42.7, 'Sofia', 'b'],
    [12.5, 41.9, 'Rome', 'b'],
  ].map(([longitude, latitude, name, frame]) => ({
    type: 'Feature',
    properties: { name, frame },
    geometry: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
  })),
}

/** The CSS height of the second checks map. */
export const moreChecksHeight = '320px'

/**
 * The second checks map: cities and a timed heatmap. "Change basemaps" adds the plain basemap,
 * a configuration change that makes the map wait for its world fit without rebuilding it.
 */
export function createMoreChecksConfig(withPlain: boolean): MapConfig {
  return defineMapConfig({
    id: 'more-checks',
    accessibility: { ariaLabel: 'More checks map' },
    data: {
      basemaps: withPlain ? [worldBasemap, plainBasemap] : [worldBasemap],
      layers: [
        {
          id: 'cities',
          title: 'Cities',
          data: europeCities,
          featureIdField: 'name',
          style: {
            type: 'constant',
            symbol: { kind: 'point', radius: 9, fillColor: '#be123c' },
          },
        },
        {
          id: 'density',
          title: 'Density',
          kind: 'heatmap',
          data: europeCities,
          time: { values: ['a', 'b'], field: 'frame' },
        },
      ],
    },
    ui: { time: { enabled: false } },
  })
}
