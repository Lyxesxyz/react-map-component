// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { describe, expect, it, vi } from 'vitest'
import { GeospatialMap, MapDisclaimer, MapErrorAlert, MapRoot, defineMapConfig } from '../src/index'
import type { MapConfigInput } from '../src/types'
import { createMapController } from '../src/core/map-controller'

// The disclaimer and the error alert on the server (the React assertions of ssr.test.tsx): the
// disclaimer renders collapsed, and nothing without text; there is no error to show yet.
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

/** The HTML without Angular's comment anchors, so it reads like React's. */
const withoutComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

describe('the disclaimer and error alert on the server', () => {
  it('renders the disclaimer collapsed, and nothing when it has no text', async () => {
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Shell {
      protected readonly config: MapConfigInput = {
        accessibility: { ariaLabel: 'Disclaimer map' },
        ui: { disclaimer: { text: 'Borders are not official.', placement: 'bottom-right' } },
        data: { layers: [] },
      }
    }
    const html = withoutComments(await renderOnServer(Shell))
    expect(html).toContain('data-placement="bottom-right"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toMatch(/<span[^>]*hidden=""[^>]*>Borders are not official.<\/span>/)
    expect(html).toMatch(
      /<button[^>]*class="geo-shape-button geo-disclaimer-toggle"[^>]*>Disclaimer<\/button>/,
    )
    // No error yet: the alert is an empty, hidden host.
    expect(html).toMatch(
      /<geo-map-error-alert (class="" )?style="display: none;"( class="")?><\/geo-map-error-alert>/,
    )
    expect(createMapController).not.toHaveBeenCalled()

    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapDisclaimer, MapErrorAlert],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-disclaimer />
          <geo-map-error-alert />
        </geo-map-root>
      `,
    })
    class Empty {
      protected readonly config = config
    }
    const empty = await renderOnServer(Empty)
    expect(empty).not.toContain('geo-disclaimer')
    expect(empty).not.toContain('geo-error-alert')
    expect(empty).not.toContain('role="alert"')
  })

  it('renders projected disclaimer content, with its links', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-disclaimer defaultOpen
            >Boundaries are not official. <a href="/terms">Terms of use</a></geo-map-disclaimer
          >
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = config
    }
    const html = withoutComments(await renderOnServer(Shell))
    expect(html).toMatch(/<geo-map-disclaimer [^>]*data-open=""/)
    expect(html).toContain('aria-expanded="true"')
    expect(html).toMatch(
      /<span[^>]*class="geo-disclaimer-text"[^>]*>Boundaries are not official. <a href="\/terms">Terms of use<\/a><\/span>/,
    )
    expect(html).not.toMatch(/<span[^>]*class="geo-disclaimer-text"[^>]*hidden/)
  })
})
