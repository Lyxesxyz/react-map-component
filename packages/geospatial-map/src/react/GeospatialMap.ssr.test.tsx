import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GeospatialMap } from './GeospatialMap.js'

describe('GeospatialMap server rendering', () => {
  it('renders its accessible shell without initializing OpenLayers', () => {
    const html = renderToString(
      <GeospatialMap
        ariaLabel="SSR map"
        layers={[]}
        basemaps={[
          {
            id: 'empty',
            title: 'Empty',
            supportedProjections: ['EPSG:8857'],
            layers: [],
            backgroundColor: '#ffffff',
            attribution: [],
            exportable: true,
          },
        ]}
      />,
    )
    expect(html).toContain('geo-map-root')
    expect(html).toContain('Map loading')
  })
})
