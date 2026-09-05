import { useState } from 'react'
import {
  GeospatialMap,
  MapGrid,
  defineMapConfig,
  initialMapState,
  type MapState,
} from '@org/geospatial-map'

const layers = [
  {
    id: 'places',
    title: 'Places',
    role: 'indicator' as const,
    kind: 'geojson' as const,
    data: { type: 'FeatureCollection' as const, features: [] },
    style: {
      type: 'constant' as const,
      symbol: { kind: 'point' as const, fillColor: '#0f766e' },
    },
  },
]

const config = defineMapConfig({
  version: 1,
  accessibility: { ariaLabel: 'Places map' },
  initialState: initialMapState(
    { center: [0, 15], zoom: 1.2, projection: 'EPSG:8857' },
    layers,
    'equal-earth',
  ),
  view: { projectionBehavior: { mode: 'manual' } },
  data: {
    layers,
    basemaps: [
      {
        id: 'equal-earth',
        title: 'Equal Earth',
        supportedProjections: ['EPSG:8857'],
        layers: [],
        backgroundColor: '#eef4f2',
        attribution: [],
        exportable: true,
      },
    ],
  },
  ui: { profile: 'compact' },
})

/** Typechecked Vite/client-boundary and controlled-state example used by the documentation. */
export function ControlledMapExample() {
  const [state, setState] = useState<MapState>(config.initialState)
  return (
    <GeospatialMap
      config={config}
      state={state}
      onStateChange={setState}
      slots={{ popup: ({ selection }) => <strong>{selection.featureId}</strong> }}
    />
  )
}

/** Typechecked six-cell grid example used by the documentation. */
export function GridExample() {
  return (
    <MapGrid
      config={{
        version: 1,
        shared: config,
        maps: Array.from({ length: 6 }, (_, index) => ({
          id: `map-${index + 1}`,
          title: `Region ${index + 1}`,
          initialState: config.initialState,
        })),
        layout: { columns: 3, tabletColumns: 2, mobileColumns: 1 },
        sync: { layers: true, time: true },
        focus: { enabled: true },
      }}
    />
  )
}
