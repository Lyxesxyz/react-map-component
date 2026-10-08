// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { describe, expect, it, vi } from 'vitest'
import { GeospatialMap, MapControls, MapLegend, MapRoot, defineMapConfig } from '../src/index'
import type { MapConfig } from '../src/types'
import { createMapController } from '../src/core/map-controller'

// The server renders the accessible shell; OpenLayers is created only in the browser (after
// render), so the controller factory must never run here.
vi.mock('../src/core/map-controller', () => ({ createMapController: vi.fn() }))

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

/** Renders `root` (selector `app-root`) on the server, zoneless, and returns the HTML. */
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
    allowedHosts: ['localhost'], // Angular 21.2 checks the request host (NG05706)
  })
}

describe('server rendering', () => {
  it('renders the accessible shell of the preset without OpenLayers', async () => {
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" class="brand-map" fill />`,
    })
    class Shell {
      protected readonly config = config
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/<geo-map [^>]*class="[^"]*geo-map-root/)
    expect(html).toContain('data-slot="map"')
    expect(html).toContain('data-status="loading"')
    expect(html).toContain('data-fill=""')
    expect(html).toContain('Map loading')
    expect(html).toContain('geo-map-viewport')
    expect(html).toMatch(/<button[^>]*aria-label="Zoom in"/)
    expect(html).toContain('<path d="M5 12h14"></path>') // icon nodes render on the server
    expect(html).not.toContain('<canvas')
    expect(createMapController).not.toHaveBeenCalled()
  })

  it('renders the composed parts only', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapControls, MapLegend],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" data-testid="map">
          <geo-map-controls
            placement="bottom-left"
            [groups]="[{ id: 'zoom', controls: ['zoom-in'] }]"
          />
          <geo-map-legend />
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = config
    }
    const html = await renderOnServer(Shell)
    expect(html).toContain('data-testid="map"')
    expect(html).toContain('data-placement="bottom-left"')
    expect(html).toContain('aria-label="Zoom in"')
    expect(html).not.toContain('Zoom out')
    expect(html).not.toContain('geo-attribution')
    expect(html).not.toContain('class="geo-legend')
  })

  it('renders a safe failure panel for invalid external configuration', async () => {
    const invalid = JSON.parse(JSON.stringify({ ...config, unsupported: true })) as MapConfig
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Shell {
      protected readonly config = invalid
    }
    const html = await renderOnServer(Shell)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Map configuration is invalid')
    expect(html).toContain('data-status="error"')
    expect(html).not.toContain('geo-map-viewport')
  })
})
