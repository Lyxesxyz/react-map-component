import { useState } from 'react'
import { GeospatialMap, arcgisBasemap, defineMapConfig } from '@/components/geospatial-map'
import { worldCountries } from './world'

// The receiving team's main use case: an Equal Earth basemap they already have in ArcGIS
// Online, configured with nothing but its URL, with indicator layers on top. The border
// controls show basemap style overrides; the map projection comes from the service.
export const ARCGIS_EQUAL_EARTH =
  'https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/EqualEarthBasemap/VectorTileServer'

export function ArcgisScenario() {
  const [borderColor, setBorderColor] = useState('#5b4f3a')
  const [borderWidth, setBorderWidth] = useState(1)
  const [labelsAboveData, setLabelsAboveData] = useState(true)

  const config = defineMapConfig({
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
          role: 'indicator',
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

  return (
    <>
      <div className="demo-composed-toolbar" role="group" aria-label="ArcGIS basemap controls">
        <label>
          Border colour{' '}
          <input
            type="color"
            value={borderColor}
            onChange={(event) => setBorderColor(event.currentTarget.value)}
          />
        </label>
        <label>
          Border width{' '}
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.5}
            value={borderWidth}
            onChange={(event) => setBorderWidth(Number(event.currentTarget.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={labelsAboveData}
            onChange={(event) => setLabelsAboveData(event.currentTarget.checked)}
          />{' '}
          Labels and borders above data
        </label>
      </div>
      <GeospatialMap config={config} />
    </>
  )
}
