import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GeospatialMap } from '../src/geospatial-map'
import { ShapeSelect, ShapeSlider } from '../src/shapes'
import { sliderFill } from '../src/utils'
import { defineMapConfig } from '../src/config/normalize'
import {
  MapControlGroup,
  MapControls,
  MapDisclaimer,
  MapLegend,
  MapRoot,
  MapZoomInButton,
  useMap,
} from '../src/index'
import type { MapConfig } from '../src/types'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'SSR map' },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  data: {
    layers: [],
    basemaps: [
      {
        id: 'empty',
        title: 'Empty',
        supportedProjections: ['EPSG:8857'],
        layers: [],
        backgroundColor: '#ffffff',
      },
    ],
  },
})

describe('GeospatialMap server rendering', () => {
  it('renders its accessible shell without initializing OpenLayers', () => {
    const html = renderToString(<GeospatialMap config={config} />)
    expect(html).toContain('geo-map-root')
    expect(html).toContain('Map loading')
    expect(html).toContain('data-status="loading"')
  })

  it('renders a safe failure panel for invalid external configuration', () => {
    const invalid = { ...config, unsupported: true } as unknown as MapConfig
    const html = renderToString(<GeospatialMap config={invalid} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Map configuration is invalid')
    expect(html).toContain('data-status="error"')
    expect(html).not.toContain('geo-map-viewport')
  })

  it('skips a custom control without a renderer, with a console hint', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const withCustom = {
      ...config,
      ui: {
        controls: {
          groups: [{ id: 'custom', controls: ['zoom-in' as const, 'custom:missing' as const] }],
        },
      },
    }
    const html = renderToString(<GeospatialMap config={withCustom} />)
    expect(html).toContain('geo-map-viewport')
    expect(html).toContain('Zoom in')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('custom:missing'))
    warn.mockRestore()
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
      <MapRoot config={{ ...config, theme: { primary: '#6d28d9', density: 'compact' } }} />,
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

  it('renders icons from the icons prop and the defaults for the rest', () => {
    const Marker = () => <svg data-icon="custom-zoom-in" />
    const html = renderToString(
      <GeospatialMap
        config={{ accessibility: { ariaLabel: 'Icon map' }, data: { layers: [] } }}
        icons={{ ZoomIn: Marker }}
      />,
    )
    expect(html).toContain('data-icon="custom-zoom-in"')
    expect(html).toContain('lucide-minus')
    expect(html).not.toMatch(/\sicons=/)
  })
})

describe('shape primitives', () => {
  it('wraps the select so its chevron can be styled', () => {
    const html = renderToString(
      <ShapeSelect aria-label="Speed" defaultValue="1">
        <option value="1">1×</option>
      </ShapeSelect>,
    )
    expect(html).toMatch(
      /^<span class="geo-shape-select-wrap"><select[^>]*class="geo-shape-select"/,
    )
  })

  it('exposes the filled share of the slider as --geo-slider-fill', () => {
    expect(sliderFill(0.25, 0, 1)).toBe('25%')
    expect(sliderFill(2, 0, 3)).toBe(`${(2 / 3) * 100}%`)
    expect(sliderFill(5, 0, 0)).toBe('0%')
    expect(sliderFill(undefined)).toBeUndefined()
    const html = renderToString(
      <ShapeSlider aria-label="Opacity" min="0" max="1" step="0.05" value={0.5} readOnly />,
    )
    expect(html).toContain('--geo-slider-fill:50%')
  })
})
