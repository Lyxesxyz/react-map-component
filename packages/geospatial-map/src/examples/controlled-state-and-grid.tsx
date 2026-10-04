'use client'

// Example: controlled state (the host owns the complete map state) and a synchronised grid of
// six maps. See docs/state-events-slots.md and docs/export-grid-integration.md.

import { useState } from 'react'
import { GeospatialMap, MapGrid, defineMapConfig, type MapLayerInput, type MapState } from '..'

const layers: MapLayerInput[] = [
  {
    id: 'places',
    title: 'Places',
    data: { type: 'FeatureCollection', features: [] },
    style: { type: 'constant', symbol: { kind: 'point', fillColor: '#0f766e' } },
  },
]

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Places map' },
  initialState: { view: { center: [0, 15], zoom: 1.2 } },
  data: {
    layers,
    basemaps: [
      {
        id: 'equal-earth',
        title: 'Equal Earth',
        supportedProjections: ['EPSG:8857'],
        layers: [],
        backgroundColor: '#eef4f2',
      },
    ],
  },
  ui: { profile: 'compact' },
})

/** The host keeps the map state in React state (for URLs, undo, or syncing other UI). */
export function ControlledMapExample() {
  const [state, setState] = useState<MapState>(config.initialState)
  return (
    <GeospatialMap
      config={config}
      state={state}
      onStateChange={setState}
      slots={{ popup: ({ feature }) => <strong>{feature.featureId}</strong> }}
    />
  )
}

/** Six maps in a grid, with layers and time kept in sync. */
export function GridExample() {
  return (
    <MapGrid
      config={{
        shared: config,
        maps: Array.from({ length: 6 }, (_, index) => ({
          id: `map-${index + 1}`,
          title: `Region ${index + 1}`,
        })),
        layout: { columns: 3, tabletColumns: 2, mobileColumns: 1 },
        sync: { layers: true, time: true },
        focus: { enabled: true },
      }}
    />
  )
}
