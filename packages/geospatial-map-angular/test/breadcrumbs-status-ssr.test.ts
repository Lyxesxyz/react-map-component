// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MapBreadcrumbs,
  MapRoot,
  MapStatusChips,
  defineMapConfig,
} from '../src/index'
import type { MapUiConfig } from '../src/types'
import { createMapController } from '../src/core/map-controller'

// The breadcrumbs' and status chips' server render: the navigation landmark with its buttons,
// the chips' empty container (nothing loads on the server), and the hidden breadcrumbs host.
vi.mock('../src/core/map-controller', () => ({ createMapController: vi.fn() }))

const config = (ui: MapUiConfig = {}) =>
  defineMapConfig({
    accessibility: { ariaLabel: 'SSR crumbs map' },
    initialState: { view: { center: [0, 0], zoom: 1 } },
    data: {
      layers: [],
      zoomTargets: [
        { id: 'world', label: 'World', bounds: [-180, -85, 180, 85] },
        { id: 'europe', label: 'Europe', bounds: [-25, 34, 45, 72] },
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
    ui,
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

/** The opening tag of an element. */
const tagOf = (html: string, name: string) => html.match(new RegExp(`<${name}[^>]*>`))?.[0] ?? ''
/** The markup without Angular's `<!--container-->` anchors, to compare with React's. */
const withoutAnchors = (html: string) => html.replace(/<!--[a-z-]*-->/g, '')

afterEach(() => vi.restoreAllMocks())

describe('the breadcrumbs and status chips on the server', () => {
  it('render in the preset: a navigation landmark of buttons, and the chips container', async () => {
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Shell {
      protected readonly config = config({ breadcrumbs: { targets: ['world', 'europe'] } })
    }
    const html = withoutAnchors(await renderOnServer(Shell))
    const nav = tagOf(html, 'geo-map-breadcrumbs')
    expect(nav).toContain('class="geo-breadcrumbs"')
    expect(nav).toContain('role="navigation"')
    expect(nav).toContain('data-slot="map-breadcrumbs"')
    expect(nav).toContain('data-placement="top-left"')
    expect(nav).toContain('aria-label="Geographic hierarchy"')
    expect(nav).not.toContain('display')
    // React: <span class="geo-breadcrumb">[separator]<button type="button" data-slot="button"
    // class="geo-shape-button geo-breadcrumb-button">Label</button></span>
    const world = html.match(/<span class="geo-breadcrumb"><button[^>]*>World<\/button><\/span>/)
    expect(world?.[0]).toContain('class="geo-shape-button geo-breadcrumb-button"')
    expect(world?.[0]).toContain('type="button"')
    expect(world?.[0]).toContain('data-slot="button"')
    const europe = html.match(
      /<span class="geo-breadcrumb">(<span[^>]*>)›<\/span><button[^>]*>Europe<\/button><\/span>/,
    )
    expect(europe?.[1]).toContain('class="geo-breadcrumb-separator"')
    expect(europe?.[1]).toContain('aria-hidden="true"')
    const chips = tagOf(html, 'geo-map-status-chips')
    expect(chips).toContain('class="geo-status-chips"')
    expect(chips).toContain('data-slot="map-status-chips"')
    expect(chips).toContain('data-placement="bottom-right"')
    expect(html).toMatch(/<geo-map-status-chips[^>]*><\/geo-map-status-chips>/)
    expect(createMapController).not.toHaveBeenCalled()
  })

  it('render hidden breadcrumbs without classes or ARIA, and the [geoMapEmpty] content', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapBreadcrumbs, MapStatusChips],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-breadcrumbs class="brand" />
          <geo-map-status-chips placement="top-left">
            <p class="empty" geoMapEmpty>Choose a dataset</p>
          </geo-map-status-chips>
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = config()
    }
    const html = withoutAnchors(await renderOnServer(Shell))
    const nav = tagOf(html, 'geo-map-breadcrumbs')
    expect(nav).toContain('class="brand"')
    expect(nav).toContain('style="display: none;"')
    expect(nav).not.toMatch(/\s(role|data-[a-z-]+|aria-[a-z]+)=/)
    expect(html).not.toContain('geo-breadcrumb')
    expect(tagOf(html, 'geo-map-status-chips')).toContain('data-placement="top-left"')
    expect(html).toMatch(/<p[^>]*class="empty"[^>]*>Choose a dataset<\/p><\/geo-map-status-chips>/)
  })
})
