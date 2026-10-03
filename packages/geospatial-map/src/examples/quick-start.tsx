'use client'

// Example: the smallest useful map. One indicator layer from a GeoJSON URL, coloured by a
// numeric property; everything else (basemap, starting view, UI) uses the defaults.
// Task: "add a map with our indicator". See README.md → Quick start.

import { GeospatialMap, defineMapConfig } from '..'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Literacy rate by country' },
  data: {
    layers: [
      {
        id: 'literacy',
        title: 'Literacy rate',
        data: { url: '/data/literacy.geojson' },
        featureIdField: 'iso3', // stable id: selection, events and the popup use it
        style: {
          type: 'continuous',
          field: 'rate',
          domain: [40, 100],
          stops: [
            { value: 40, color: '#fef3c7' },
            { value: 100, color: '#065f46' },
          ],
        },
        legend: { units: '%, adults 15+', sourceNote: 'Source: national surveys' },
      },
    ],
  },
})

export function LiteracyMap({ onCountry }: { onCountry?: (iso3: string | null) => void }) {
  return (
    <GeospatialMap
      config={config}
      onFeatureSelect={(event) => onCountry?.(event ? event.featureId : null)}
    />
  )
}
