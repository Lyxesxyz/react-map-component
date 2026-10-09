// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { describe, expect, it, vi } from 'vitest'
import { GeospatialMap, MapLayerPanel, MapRoot, defineMapConfig } from '../src/index'
import { createMapController } from '../src/core/map-controller'

// The layer panel's server render: open at the start (`ui.layerPanel.defaultOpen`), it is part
// of the accessible shell; closed, it renders nothing. OpenLayers never starts on the server.
vi.mock('../src/core/map-controller', () => ({ createMapController: vi.fn() }))

const empty = { type: 'FeatureCollection' as const, features: [] }
const config = defineMapConfig({
  accessibility: { ariaLabel: 'SSR layer map' },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  data: {
    layers: [
      { id: 'cities', title: 'Cities', data: empty, group: 'Reference features', visible: false },
      { id: 'regions', title: 'Development index', data: empty, group: 'Indicators', opacity: 0.5 },
    ],
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
  ui: { layerPanel: { defaultOpen: true, defaultExpandedLayerIds: ['regions'] } },
})

function renderOnServer(root: Type<unknown>): Promise<string> {
  const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(
      root,
      { providers: [provideZonelessChangeDetection(), provideServerRendering()] },
      context,
    )
  return renderApplication(bootstrap, {
    document: '<!doctype html><html><head></head><body><app-root></app-root></body></html>',
    url: 'http://localhost/',
    allowedHosts: ['localhost'],
  })
}

describe('the layer panel on the server', () => {
  it('renders the open panel of the preset, with its rows, switches and slider', async () => {
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Shell {
      protected readonly config = config
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/<geo-map-layer-panel [^>]*class="geo-shape-card geo-layer-panel"/)
    expect(html).toMatch(/<geo-map-layer-panel [^>]*data-slot="map-layer-panel"/)
    expect(html).toMatch(/<geo-map-layer-panel [^>]*role="region"/)
    expect(html).toMatch(/<geo-map-layer-panel [^>]*aria-label="Map layers"/)
    expect(html).toContain('<span class="geo-layer-count">1 of 2 visible</span>')
    expect(html).toContain('<h3 class="geo-layer-group-title">Indicators</h3>')
    expect(html).toMatch(/<input type="checkbox" class="geo-shape-switch-input"/)
    expect(html).toMatch(/aria-label="Development index opacity"/)
    expect(html).toContain('--geo-slider-fill: 50%')
    expect(html).toContain('<span class="geo-opacity-value">Opacity 50%</span>')
    expect(createMapController).not.toHaveBeenCalled()
  })

  it('renders nothing of a closed panel', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-layer-panel class="brand-panel" />
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = { ...config, ui: {} }
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/<geo-map-layer-panel class="brand-panel" style="display: none;?">/)
    expect(html).not.toContain('geo-layer-panel')
    expect(html).not.toContain('Map layers')
  })
})
