import { useState } from 'react'
import { GeospatialMap } from '@/components/geospatial-map'
import { createQuickStartConfig, featureTitle } from '@demo-shared/src/fixtures'
import { worldCountries } from '@demo-shared/src/world'

// The shortest useful integration, written the way a team would first write it: the config is
// built again on every render (createQuickStartConfig() returns a new one each call), the map
// fills its container, and GeoJSON comes through a custom loader (where an app would add auth
// headers).
export function QuickStartScenario() {
  const [renders, setRenders] = useState(0)
  const [loads, setLoads] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  const config = createQuickStartConfig()

  return (
    <>
      <div className="demo-composed-toolbar" role="group" aria-label="Quick start controls">
        <button onClick={() => setRenders((count) => count + 1)}>
          Re-render parent ({renders})
        </button>
        <output aria-label="Custom loader calls">Custom loader calls: {loads}</output>
        <output aria-label="Selected area">Selected: {selected ?? 'none'}</output>
      </div>
      <div className="demo-fill-frame">
        <GeospatialMap
          fill
          config={config}
          loadGeoJson={async () => {
            setLoads((count) => count + 1)
            return worldCountries
          }}
          onFeatureSelect={(event) => setSelected(event ? featureTitle(event) : null)}
        />
      </div>
    </>
  )
}
