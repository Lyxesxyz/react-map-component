import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GeospatialMap } from './GeospatialMap.js'
import { defineMapConfig, initialMapState } from '../config.js'
import type { GeospatialMapConfigV1 } from '../types.js'

const config = defineMapConfig({
  version: 1,
  accessibility: { ariaLabel: 'SSR map' },
  initialState: initialMapState({ center: [0, 0], zoom: 1, projection: 'EPSG:8857' }, [], 'empty'),
  view: {},
  data: {
    layers: [],
    basemaps: [
      {
        id: 'empty',
        title: 'Empty',
        supportedProjections: ['EPSG:8857'],
        layers: [],
        backgroundColor: '#ffffff',
        attribution: [],
        exportable: true,
      },
    ],
  },
  ui: { profile: 'full' },
})

describe('GeospatialMap server rendering', () => {
  it('renders its accessible shell without initializing OpenLayers', () => {
    const html = renderToString(<GeospatialMap config={config} />)
    expect(html).toContain('geo-map-root')
    expect(html).toContain('Map loading')
  })

  it('renders a safe failure panel for invalid external configuration', () => {
    const invalid = { ...config, unsupported: true } as unknown as GeospatialMapConfigV1
    const html = renderToString(<GeospatialMap config={invalid} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Map configuration is invalid')
    expect(html).not.toContain('geo-map-viewport')
  })

  it('rejects registered custom controls without a React renderer', () => {
    const invalid = {
      ...config,
      ui: {
        controlRail: {
          groups: [{ id: 'custom', controls: ['custom:missing' as const] }],
        },
      },
    }
    const html = renderToString(<GeospatialMap config={invalid} />)
    expect(html).toContain('custom:missing')
    expect(html).not.toContain('geo-map-viewport')
  })
})
