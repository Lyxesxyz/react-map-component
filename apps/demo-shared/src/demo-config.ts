import { esriWorldBasemap } from '@/components/geospatial-map'
import type {
  BasemapConfig,
  GeoJsonLayerConfig,
  MapLayerConfig,
  MapViewState,
  XyzLayerConfig,
  ZoomTarget,
} from '@/components/geospatial-map'
import {
  cityPoints,
  pointObservations,
  routeLines,
  timedCountries,
  worldBorders,
  worldCountries,
} from './world.js'

const naturalEarth = {
  label: 'Natural Earth demo boundaries',
  url: 'https://www.naturalearthdata.com/',
  license: 'Public domain',
  version: '1:110m',
  authority: 'Natural Earth',
  publishedAt: '2022',
  usageRestrictions: 'Demonstration only',
  official: false,
} as const

const arcgisEqualEarthService =
  'https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/EqualEarthBasemap/VectorTileServer'

const arcgisEqualEarthAttribution = {
  label: 'Equal Earth Global Vector Basemap',
  url: 'https://www.arcgis.com/home/item.html?id=3d7c931639254408ab677b21f9f48604',
  license: 'Please use freely',
  authority: 'Esri, Living Atlas and Natural Earth',
  official: false,
} as const

const arcgisEqualEarthResolutions = [
  67359.21313364996, 33679.60656682498, 16839.80328341249, 8419.901641706245, 4209.950820853122,
  2104.975410426561, 1052.4877052132806, 526.2438526066403, 263.12192630332015, 131.56096315166008,
  65.78048157583004, 32.89024078791502, 16.44512039395751, 8.222560196978755, 4.111280098489377,
  2.0556400492446887, 1.0278200246223443, 0.5139100123111722, 0.2569550061555861,
  0.12847750307779304,
]

const referenceLayers = (): MapLayerConfig[] => [
  {
    id: 'reference-land',
    title: 'Reference land',
    kind: 'geojson',
    data: worldCountries,
    style: {
      type: 'constant',
      symbol: { kind: 'polygon', fillColor: '#e8eee7', strokeColor: '#a4b2a2', strokeWidth: 0.35 },
    },
    attribution: [naturalEarth],
    exportable: true,
  },
  {
    id: 'reference-borders',
    title: 'Reference borders',
    kind: 'geojson',
    data: worldBorders,
    style: { type: 'constant', symbol: { kind: 'line', color: '#839383', width: 0.7 } },
    attribution: [naturalEarth],
    exportable: true,
  },
]

/**
 * The harness's basemaps. The Esri World Basemap (the component's default) opens the Equal Earth
 * map; when it can't be loaded the map switches to the Equal Earth reference basemap.
 */
export const basemaps: BasemapConfig[] = [
  { ...esriWorldBasemap, fallbackBasemapId: 'reference-equal-earth' },
  {
    id: 'arcgis-equal-earth',
    title: 'Esri · Equal Earth',
    supportedProjections: ['ESRI:EQUAL-EARTH-CM11'],
    layers: [
      {
        id: 'arcgis-equal-earth-tiles',
        title: 'Equal Earth Global Vector Basemap',
        kind: 'mvt',
        url: `${arcgisEqualEarthService}/tile/{z}/{y}/{x}.pbf`,
        sourceProjection: 'ESRI:EQUAL-EARTH-CM11',
        sourceProjectionDefinition: {
          code: 'ESRI:EQUAL-EARTH-CM11',
          definition:
            '+proj=eqearth +lon_0=11 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs',
          extent: [-17243958.56221439, -8392927.098466456, 17243958.56221439, 8392927.098466456],
          worldExtent: [-169, -90, 191, 90],
        },
        tileGrid: {
          extent: [-17243958.56221439, -8392927.098466456, 17243958.56221439, 8392927.098466456],
          origin: [-17243958.56221439, 17243958.56221439],
          resolutions: arcgisEqualEarthResolutions,
          tileSize: 512,
        },
        wrapX: false,
        mapboxStyle: {
          url: `${arcgisEqualEarthService}/resources/styles/root.json`,
          source: 'esri',
        },
        attribution: [arcgisEqualEarthAttribution],
        exportable: true,
      },
    ],
    backgroundColor: '#f3f3f3',
    attribution: [arcgisEqualEarthAttribution],
    exportable: true,
  },
  {
    id: 'reference-equal-earth',
    title: 'Reference · Equal Earth',
    supportedProjections: ['EPSG:8857'],
    layers: referenceLayers(),
    backgroundColor: '#cfe4f2',
    attribution: [naturalEarth],
    exportable: true,
  },
  {
    id: 'reference-mercator',
    title: 'Reference · Mercator',
    supportedProjections: ['EPSG:3857'],
    layers: referenceLayers(),
    backgroundColor: '#cfe4f2',
    attribution: [naturalEarth],
    exportable: true,
  },
  {
    id: 'osm-mercator',
    title: 'OpenStreetMap',
    supportedProjections: ['EPSG:3857'],
    layers: [
      {
        id: 'osm-tiles',
        title: 'OpenStreetMap',
        kind: 'xyz',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        sourceProjection: 'EPSG:3857',
        attribution: [
          {
            label: '© OpenStreetMap contributors',
            url: 'https://www.openstreetmap.org/copyright',
            license: 'ODbL',
            official: false,
          },
        ],
        exportable: false,
      },
    ],
    backgroundColor: '#dfe9ef',
    attribution: [
      {
        label: '© OpenStreetMap contributors',
        url: 'https://www.openstreetmap.org/copyright',
        license: 'ODbL',
        official: false,
      },
    ],
    exportable: false,
  },
]

export const indicatorLayer: GeoJsonLayerConfig = {
  id: 'development-index',
  title: 'Development index',
  kind: 'geojson',
  data: worldCountries,
  opacity: 0.88,
  reorderable: true,
  group: 'Indicators',
  selectable: true,
  featureIdField: 'geoId',
  propertyAllowlist: ['name', 'value', 'category'],
  style: {
    type: 'continuous',
    field: 'value',
    domain: [0, 100],
    stops: [
      { value: 0, color: '#fff7bc' },
      { value: 50, color: '#7fcdbb' },
      { value: 100, color: '#225ea8' },
    ],
    symbol: { kind: 'polygon', strokeColor: '#ffffff', strokeWidth: 0.6, opacity: 0.9 },
    missing: { label: 'No data', symbol: { kind: 'polygon', fillColor: '#d1d5db' } },
  },
  legend: {
    title: 'Development index',
    subtitle: 'Demonstration values',
    units: 'index, 0–100',
    sourceNote: 'Synthetic values; not for publication.',
  },
  attribution: [naturalEarth],
  exportable: true,
}

export const timedLayer: MapLayerConfig = {
  ...indicatorLayer,
  id: 'development-index-time',
  title: 'Development index over time',
  data: timedCountries,
  featureIdField: 'geoId',
  propertyAllowlist: ['name', 'value', 'year', 'baseGeoId'],
  time: { values: ['2021', '2022', '2023', '2024'], field: 'year' },
  legend: {
    title: 'Development index over time',
    units: 'index, 0–100',
    sourceNote: 'Synthetic annual values.',
    byTime: {
      '2021': { subtitle: 'Baseline frame · 2021' },
      '2022': { subtitle: 'Observed frame · 2022' },
      '2023': { subtitle: 'Observed frame · 2023' },
      '2024': { subtitle: 'Latest frame · 2024' },
    },
  },
}

export const cityLayer: MapLayerConfig = {
  id: 'cities',
  title: 'Cities',
  kind: 'geojson',
  data: cityPoints,
  reorderable: true,
  group: 'Reference features',
  selectable: true,
  featureIdField: 'geoId',
  propertyAllowlist: ['name', 'size', 'kind'],
  minZoom: 1,
  style: {
    type: 'constant',
    symbol: {
      kind: 'point',
      shape: 'circle',
      radius: 5,
      radiusStops: [
        { zoom: 1, value: 4 },
        { zoom: 6, value: 10 },
      ],
      fillColor: '#e43d30',
      strokeColor: '#ffffff',
      strokeWidth: 2,
      labelField: 'name',
    },
  },
  legend: {
    entries: [
      { id: 'city', label: 'Selected cities', symbol: { kind: 'point', fillColor: '#e43d30' } },
    ],
  },
  exportable: true,
}

const pointExampleBase = {
  data: pointObservations,
  reorderable: true,
  group: 'Point visualizations',
  exclusiveGroup: 'point-visualization',
  exportable: true,
}

export const bubbleLayer: MapLayerConfig = {
  ...pointExampleBase,
  id: 'population-bubbles',
  title: 'Graduated bubbles',
  kind: 'geojson',
  selectable: true,
  featureIdField: 'geoId',
  propertyAllowlist: ['name', 'magnitude', 'category'],
  style: {
    type: 'graduated',
    field: 'magnitude',
    classes: [
      {
        label: '0–39',
        min: 0,
        max: 39,
        symbol: {
          kind: 'point',
          radius: 5,
          fillColor: '#99f6e4',
          strokeColor: '#115e59',
          strokeWidth: 1.5,
          opacity: 0.82,
        },
      },
      {
        label: '40–69',
        min: 40,
        max: 69,
        symbol: {
          kind: 'point',
          radius: 8,
          fillColor: '#2dd4bf',
          strokeColor: '#115e59',
          strokeWidth: 1.5,
          opacity: 0.82,
        },
      },
      {
        label: '70–89',
        min: 70,
        max: 89,
        symbol: {
          kind: 'point',
          radius: 12,
          fillColor: '#0f766e',
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
          opacity: 0.84,
        },
      },
      {
        label: '90–100',
        min: 90,
        max: 100,
        symbol: {
          kind: 'point',
          radius: 16,
          fillColor: '#134e4a',
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
          opacity: 0.86,
        },
      },
    ],
  },
  legend: {
    title: 'Graduated bubbles',
    units: 'synthetic magnitude',
    sourceNote: 'Synthetic values; demonstration only.',
  },
}

export const categoricalPointLayer: MapLayerConfig = {
  ...pointExampleBase,
  id: 'categorical-points',
  title: 'Categorical point symbols',
  kind: 'geojson',
  visible: false,
  selectable: true,
  featureIdField: 'geoId',
  propertyAllowlist: ['name', 'magnitude', 'category'],
  style: {
    type: 'categorical',
    field: 'category',
    categories: [
      {
        label: 'Health',
        value: 'health',
        symbol: {
          kind: 'point',
          shape: 'circle',
          radius: 8,
          fillColor: '#f43f5e',
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
        },
      },
      {
        label: 'Education',
        value: 'education',
        symbol: {
          kind: 'point',
          shape: 'diamond',
          radius: 8,
          fillColor: '#8b5cf6',
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
        },
      },
      {
        label: 'Infrastructure',
        value: 'infrastructure',
        symbol: {
          kind: 'point',
          shape: 'square',
          radius: 8,
          fillColor: '#f59e0b',
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
        },
      },
    ],
  },
  legend: {
    title: 'Categorical point symbols',
    sourceNote: 'Synthetic categories; demonstration only.',
  },
}

export const heatmapLayer: MapLayerConfig = {
  ...pointExampleBase,
  id: 'weighted-heatmap',
  title: 'Weighted density heatmap',
  kind: 'heatmap',
  visible: false,
  weightField: 'weight',
  radius: 10,
  blur: 18,
  radiusStops: [
    { zoom: 1, value: 9 },
    { zoom: 6, value: 24 },
  ],
  blurStops: [
    { zoom: 1, value: 16 },
    { zoom: 6, value: 30 },
  ],
  gradient: ['#312e81', '#2563eb', '#22d3ee', '#fde047', '#ef4444'],
  legend: {
    title: 'Weighted density heatmap',
    units: 'normalized density, 0–1',
    sourceNote: 'Synthetic weighted observations; demonstration only.',
  },
}

export const routeLayer: MapLayerConfig = {
  id: 'routes',
  title: 'Demonstration routes',
  kind: 'geojson',
  data: routeLines,
  reorderable: true,
  group: 'Reference features',
  selectable: true,
  featureIdField: 'geoId',
  propertyAllowlist: ['name', 'flow'],
  style: {
    type: 'constant',
    symbol: {
      kind: 'line',
      color: '#7c3aed',
      width: 2,
      widthStops: [
        { zoom: 1, value: 2 },
        { zoom: 6, value: 6 },
      ],
      dash: [8, 5],
    },
  },
  legend: {
    entries: [
      { id: 'route', label: 'Flow route', symbol: { kind: 'line', color: '#7c3aed', width: 3 } },
    ],
  },
  exportable: true,
}

/**
 * The raster layers and the broken layer load apps/demo-shared/public/data/… by a URL relative
 * to the page (`data/…`, not `/data/…`), so the demos also work below a base path.
 */
export const rasterLayer: XyzLayerConfig = {
  id: 'raster-demo',
  title: 'Raster surface',
  kind: 'xyz',
  url: 'data/raster.svg',
  sourceProjection: 'EPSG:3857',
  opacity: 0.4,
  reorderable: true,
  group: 'Raster indicators',
  legend: {
    title: 'Raster surface',
    units: 'illustrative intensity',
    entries: [
      {
        id: 'raster-ramp',
        label: 'Low to high',
        symbol: {
          kind: 'gradient',
          stops: [
            { value: 0, color: '#2c7bb6' },
            { value: 50, color: '#ffffbf' },
            { value: 100, color: '#d7191c' },
          ],
        },
      },
    ],
  },
  exportable: true,
}

export const rasterLayerSecondary: MapLayerConfig = {
  ...rasterLayer,
  id: 'raster-demo-secondary',
  title: 'Raster uncertainty',
  url: 'data/raster-secondary.svg',
  opacity: 0.28,
  legend: {
    title: 'Raster uncertainty',
    units: 'illustrative range',
    entries: [
      {
        id: 'uncertainty-ramp',
        label: 'Lower to higher uncertainty',
        symbol: {
          kind: 'gradient',
          stops: [
            { value: 0, color: '#f7fcf0' },
            { value: 50, color: '#74c476' },
            { value: 100, color: '#00441b' },
          ],
        },
      },
    ],
  },
}

export const timedRasterLayer: MapLayerConfig = {
  ...rasterLayer,
  id: 'raster-demo-time',
  title: 'Raster surface over time',
  url: 'data/raster-{time}.svg',
  required: true,
  time: { values: ['2021', '2022', '2023', '2024'] },
  legend: {
    ...rasterLayer.legend,
    title: 'Raster surface over time',
  },
}

export const brokenLayer: MapLayerConfig = {
  id: 'broken-source',
  title: 'Unavailable optional source',
  kind: 'geojson',
  data: { url: 'data/does-not-exist.geojson' },
  style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#ef4444' } },
  required: false,
}

export const zoomTargets: ZoomTarget[] = [
  { id: 'world', label: 'World', bounds: [-180, -75, 180, 85], maxZoom: 2.4 },
  {
    id: 'europe',
    label: 'Europe',
    bounds: [-12, 34, 42, 72],
    maxZoom: 4,
  },
  {
    id: 'bulgaria',
    label: 'Bulgaria',
    bounds: [22.3, 41.2, 28.7, 44.3],
    maxZoom: 7,
  },
  {
    id: 'japan',
    label: 'Japan',
    bounds: [128, 30, 146, 46],
    maxZoom: 5,
  },
  {
    id: 'brazil',
    label: 'Brazil',
    bounds: [-74, -34, -34, 6],
    maxZoom: 4,
  },
]

/** The breadcrumb path: zoom target ids, widest first. */
export const breadcrumbTargets = ['world', 'europe', 'bulgaria']

export const initialView: MapViewState = {
  center: [10, 5],
  zoom: 2.35,
  projection: 'EPSG:8857',
}
