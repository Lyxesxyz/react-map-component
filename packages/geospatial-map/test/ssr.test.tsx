import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GeospatialMap } from '../src/geospatial-map'
import { defineMapConfig, initialMapState } from '../src/config'
import {
  MapControlGroup,
  MapControls,
  MapDisclaimer,
  MapLegend,
  MapRoot,
  MapZoomInButton,
  useMap,
} from '../src/index'
import type { GeospatialMapConfigV1 } from '../src/types'

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

describe('composable parts', () => {
  it('renders only the parts a host composes inside MapRoot, with host classes', () => {
    function MapTitle() {
      const { config } = useMap()
      return <h2 className="host-title">{config.accessibility.ariaLabel}</h2>
    }
    const html = renderToString(
      <MapRoot config={config} className="brand-map" data-testid="map">
        <MapControls placement="bottom-left" className="host-rail">
          <MapControlGroup>
            <MapZoomInButton label="Closer" />
          </MapControlGroup>
        </MapControls>
        <MapLegend />
        <MapTitle />
      </MapRoot>,
    )
    expect(html).toMatch(/class="geo-map-root[^"]* brand-map"/)
    expect(html).toContain('data-testid="map"')
    expect(html).toContain('geo-map-controls host-rail')
    expect(html).toContain('data-placement="bottom-left"')
    expect(html).toContain('aria-label="Closer"')
    expect(html).toContain('<h2 class="host-title">SSR map</h2>')
    expect(html).not.toContain('Zoom out')
    expect(html).not.toContain('geo-attribution')
  })

  it('does not forward map callbacks to the DOM', () => {
    const html = renderToString(<MapRoot config={config} onReady={() => undefined} />)
    expect(html).not.toContain('onReady')
    expect(html).not.toContain('onready')
  })

  it('writes only explicitly configured theme keys inline', () => {
    const html = renderToString(
      <MapRoot config={{ ...config, theme: { accentColor: '#6d28d9', density: 'compact' } }} />,
    )
    expect(html).toMatch(/style="[^"]*#6d28d9/)
    expect(html).toContain('data-density="compact"')
    expect(html).not.toContain('#18181b')
  })

  it('explains when a part is used outside a map', () => {
    expect(() => renderToString(<MapLegend />)).toThrow(/inside <MapRoot>/)
  })

  it('renders a short config and the fill option, without leaking props to the DOM', () => {
    const html = renderToString(
      <MapRoot
        config={{ accessibility: { ariaLabel: 'Short map' }, data: { layers: [] } }}
        fill
        loadGeoJson={async () => ({ type: 'FeatureCollection', features: [] })}
      />,
    )
    expect(html).toContain('data-fill=""')
    expect(html).toContain('geo-map-viewport')
    expect(html).not.toMatch(/loadgeojson|\sfill="/i)
  })

  it('renders the tooltip, anchored popup, and OpenLayers hook without a browser', () => {
    const html = renderToString(
      <GeospatialMap
        config={{
          accessibility: { ariaLabel: 'Overlay map' },
          ui: { popup: { anchor: 'feature' } },
          data: { layers: [] },
        }}
        onOpenLayersMap={() => undefined}
      />,
    )
    expect(html).toContain('geo-map-viewport')
    expect(html).not.toMatch(/onopenlayersmap|geo-tooltip/i)
  })

  it('renders the disclaimer collapsed, and nothing when it has no text', () => {
    const html = renderToString(
      <GeospatialMap
        config={{
          accessibility: { ariaLabel: 'Disclaimer map' },
          ui: { disclaimer: { text: 'Borders are not official.', placement: 'bottom-right' } },
          data: { layers: [] },
        }}
      />,
    )
    expect(html).toContain('data-placement="bottom-right"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toMatch(/<span[^>]*hidden=""[^>]*>Borders are not official.<\/span>/)
    expect(
      renderToString(
        <MapRoot config={config}>
          <MapDisclaimer />
        </MapRoot>,
      ),
    ).not.toContain('geo-disclaimer')
  })
})
