import { useState } from 'react'
import { GeospatialMap } from '@/components/geospatial-map'
import {
  borderWidthRange,
  createArcgisConfig,
  defaultArcgisOptions,
} from '@demo-shared/src/fixtures'

// The receiving team's main use case: an Equal Earth basemap they already have in ArcGIS
// Online, configured with nothing but its URL, with indicator layers on top. The border
// controls show basemap style overrides; the map projection comes from the service.
// The configuration is `createArcgisConfig()` in apps/demo-shared/src/fixtures.ts.

export function ArcgisScenario() {
  const [borderColor, setBorderColor] = useState(defaultArcgisOptions.borderColor)
  const [borderWidth, setBorderWidth] = useState(defaultArcgisOptions.borderWidth)
  const [labelsAboveData, setLabelsAboveData] = useState(defaultArcgisOptions.labelsAboveData)

  const config = createArcgisConfig({ borderColor, borderWidth, labelsAboveData })

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
            min={borderWidthRange.min}
            max={borderWidthRange.max}
            step={borderWidthRange.step}
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
