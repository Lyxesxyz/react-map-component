import type {
  BasemapConfig,
  HierarchyItem,
  MapLayerConfig,
  MapViewState,
  ZoomTarget,
} from '@org/geospatial-map'
import { cityPoints, routeLines, timedCountries, worldBorders, worldCountries } from './world.js'

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

const referenceLayers = (): MapLayerConfig[] => [
  {
    id: 'reference-land',
    title: 'Reference land',
    role: 'basemap',
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
    role: 'basemap',
    kind: 'geojson',
    data: worldBorders,
    style: { type: 'constant', symbol: { kind: 'line', color: '#839383', width: 0.7 } },
    attribution: [naturalEarth],
    exportable: true,
  },
]

export const basemaps: BasemapConfig[] = [
  {
    id: 'reference-equal-earth',
    title: 'Reference · Equal Earth',
    supportedProjections: ['EPSG:8857'],
    layers: referenceLayers(),
    backgroundColor: '#cfe4f2',
    attribution: [naturalEarth],
    exportable: true,
    fallbackFor: ['EPSG:8857'],
  },
  {
    id: 'reference-mercator',
    title: 'Reference · Mercator',
    supportedProjections: ['EPSG:3857'],
    layers: referenceLayers(),
    backgroundColor: '#cfe4f2',
    attribution: [naturalEarth],
    exportable: true,
    fallbackFor: ['EPSG:3857'],
  },
  {
    id: 'osm-mercator',
    title: 'OpenStreetMap',
    supportedProjections: ['EPSG:3857'],
    layers: [
      {
        id: 'osm-tiles',
        title: 'OpenStreetMap',
        role: 'basemap',
        kind: 'xyz',
        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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
    network: true,
  },
]

export const indicatorLayer: MapLayerConfig = {
  id: 'development-index',
  title: 'Development index',
  role: 'indicator',
  kind: 'geojson',
  data: worldCountries,
  opacity: 0.88,
  reorderable: true,
  group: 'Indicators',
  selectable: true,
  featureIdField: 'geoId',
  propertyAllowlist: ['name', 'value', 'category'],
  boundarySetId: 'natural-earth-demo-110m',
  geographyLevel: 'admin0',
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
  time: {
    available: ['2021', '2022', '2023', '2024'],
    mode: 'property',
    fieldOrParameter: 'year',
    missingPolicy: 'unavailable',
  },
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
  role: 'reference',
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

export const routeLayer: MapLayerConfig = {
  id: 'routes',
  title: 'Demonstration routes',
  role: 'reference',
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

export const rasterLayer: MapLayerConfig = {
  id: 'raster-demo',
  title: 'Raster surface',
  role: 'indicator',
  kind: 'xyz',
  urlTemplate: '/data/raster.svg',
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
  urlTemplate: '/data/raster-secondary.svg',
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
  urlTemplate: '/data/raster-{time}.svg',
  required: true,
  time: {
    available: ['2021', '2022', '2023', '2024'],
    mode: 'url-template',
    missingPolicy: 'unavailable',
    prefetchFrames: 2,
  },
  legend: {
    ...rasterLayer.legend,
    title: 'Raster surface over time',
  },
}

export const brokenLayer: MapLayerConfig = {
  id: 'broken-source',
  title: 'Unavailable optional source',
  role: 'reference',
  kind: 'geojson',
  data: { url: '/data/does-not-exist.geojson' },
  style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#ef4444' } },
  required: false,
}

export const zoomTargets: ZoomTarget[] = [
  { id: 'world', label: 'World', bounds: [-180, -75, 180, 85], maxZoom: 1.4 },
  {
    id: 'europe',
    label: 'Europe',
    bounds: [-12, 34, 42, 72],
    parentId: 'world',
    geographyLevel: 'region',
    maxZoom: 4,
  },
  {
    id: 'bulgaria',
    label: 'Bulgaria',
    bounds: [22.3, 41.2, 28.7, 44.3],
    parentId: 'europe',
    geographyLevel: 'admin0',
    maxZoom: 7,
  },
  {
    id: 'japan',
    label: 'Japan',
    bounds: [128, 30, 146, 46],
    parentId: 'world',
    geographyLevel: 'admin0',
    maxZoom: 5,
  },
  {
    id: 'brazil',
    label: 'Brazil',
    bounds: [-74, -34, -34, 6],
    parentId: 'world',
    geographyLevel: 'admin0',
    maxZoom: 4,
  },
]

export const hierarchy: HierarchyItem[] = [
  { id: 'admin0-world', label: 'World', geographyLevel: 'global', targetId: 'world' },
  { id: 'admin1-europe', label: 'Europe', geographyLevel: 'region', targetId: 'europe' },
  { id: 'admin2-bulgaria', label: 'Bulgaria', geographyLevel: 'admin0', targetId: 'bulgaria' },
]

export const initialView: MapViewState = {
  center: [10, 18],
  zoom: 1.2,
  projection: 'EPSG:8857',
  minZoom: 0,
  maxZoom: 12,
}
