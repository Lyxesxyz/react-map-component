// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { describe, expect, it, vi } from 'vitest'
import { GeospatialMap, MapRoot, MapSettings, defineMapConfig } from '../src/index'
import { createMapController } from '../src/core/map-controller'

// The settings panel's server render: open at the start (`ui.settings.defaultOpen`), it is part
// of the accessible shell; closed, it renders nothing. OpenLayers never starts on the server.
vi.mock('../src/core/map-controller', () => ({ createMapController: vi.fn() }))

const basemap = (id: string, title: string) => ({
  id,
  title,
  supportedProjections: ['EPSG:8857'],
  layers: [],
  backgroundColor: '#ffffff',
})
const config = defineMapConfig({
  accessibility: { ariaLabel: 'SSR settings map' },
  initialState: {
    view: { center: [0, 0], zoom: 1, projection: 'EPSG:8857' },
    activeBasemapId: 'dark',
  },
  data: {
    layers: [],
    basemaps: [basemap('light', 'Light'), basemap('dark', 'Dark')],
    zoomTargets: [{ id: 'africa', label: 'Africa', bounds: [-20, -36, 52, 38] }],
  },
  export: { formats: ['image/png', 'image/svg+xml'] },
  ui: { settings: { defaultOpen: true } },
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

describe('the settings panel on the server', () => {
  it('renders the open panel of the preset, with its header and fields', async () => {
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
    expect(html).toMatch(/<geo-map-settings [^>]*class="geo-shape-card geo-map-settings"/)
    expect(html).toMatch(/<geo-map-settings [^>]*data-slot="map-settings"/)
    expect(html).toMatch(/<geo-map-settings [^>]*role="region"/)
    expect(html).toMatch(/<geo-map-settings [^>]*aria-label="Map settings"/)
    expect(html).toMatch(/<geo-map-settings [^>]*data-placement="top-right"/)
    expect(html).toContain('<span class="geo-panel-kicker">Map options</span>')
    expect(html).toContain('<h2 class="geo-panel-title">View &amp; output</h2>')
    expect(html).toMatch(/aria-label="Close map settings"/)
    expect(html).toMatch(/<label [^>]*class="geo-shape-label geo-settings-field"/)
    expect(html).toContain('<span class="geo-settings-field-label">Go to area</span>')
    // React's "wraps the select so its chevron can be styled".
    expect(html).toMatch(/<span class="geo-shape-select-wrap"><select[^>]*class="geo-shape-select"/)
    expect(html).toMatch(/<select[^>]*aria-label="Basemap"/)
    expect(html).toMatch(/<option[^>]*value="africa"[^>]*>Africa<\/option>/)
    expect(html).toMatch(/<option[^>]*value="image\/svg\+xml"[^>]*>SVG<\/option>/)
    // The chosen option is marked in the HTML, as React's server render does, so the page shows
    // the active basemap and the placeholders before the app starts in the browser.
    expect(html).toContain('<option value="light">Light</option>')
    expect(html).toContain('<option value="dark" selected="">Dark</option>')
    expect(html).toContain('<option value="" disabled="" selected="">Choose area</option>')
    expect(html).toContain('<option value="" disabled="" selected="">Export report image</option>')
    expect(html).not.toContain('JPEG')
    expect(createMapController).not.toHaveBeenCalled()
  })

  it('renders nothing of a closed panel', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapSettings],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-settings class="brand-settings" />
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = { ...config, ui: {} }
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/<geo-map-settings class="brand-settings" style="display: none;?">/)
    expect(html).not.toContain('geo-map-settings"')
    expect(html).not.toContain('Map settings')
    expect(html).not.toContain('geo-settings-field')
  })
})
