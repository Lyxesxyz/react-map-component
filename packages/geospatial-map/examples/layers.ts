import type { FeatureCollection } from 'geojson'
import type { MapLayerConfig } from '@org/geospatial-map'

const observations: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

export const bubbleLayerExample = {
  id: 'bubbles',
  title: 'Graduated bubbles',
  role: 'indicator',
  kind: 'geojson',
  data: observations,
  style: {
    type: 'graduated',
    field: 'value',
    classes: [
      { label: 'Low', max: 49, symbol: { kind: 'point', radius: 5, fillColor: '#99f6e4' } },
      { label: 'High', min: 50, symbol: { kind: 'point', radius: 12, fillColor: '#0f766e' } },
    ],
  },
  legend: { presentation: 'size-ramp', units: 'observations' },
} satisfies MapLayerConfig

export const categoricalPointLayerExample = {
  id: 'categories',
  title: 'Point categories',
  role: 'indicator',
  kind: 'geojson',
  data: observations,
  visible: false,
  style: {
    type: 'categorical',
    field: 'category',
    categories: [
      { label: 'A', value: 'a', symbol: { kind: 'point', shape: 'circle', fillColor: '#f43f5e' } },
      { label: 'B', value: 'b', symbol: { kind: 'point', shape: 'diamond', fillColor: '#8b5cf6' } },
    ],
  },
} satisfies MapLayerConfig

export const heatmapLayerExample = {
  id: 'density',
  title: 'Weighted density',
  role: 'indicator',
  kind: 'heatmap',
  data: observations,
  visible: false,
  weightField: 'weight',
  radiusStops: [
    { zoom: 1, value: 8 },
    { zoom: 6, value: 24 },
  ],
  blurStops: [
    { zoom: 1, value: 15 },
    { zoom: 6, value: 30 },
  ],
  gradient: ['#312e81', '#2563eb', '#22d3ee', '#fde047', '#ef4444'],
  legend: { units: 'normalized density, 0–1' },
} satisfies MapLayerConfig
