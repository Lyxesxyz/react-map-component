import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core'
import type { Type } from '@angular/core'
import {
  bootstrapApplication,
  provideClientHydration,
  withIncrementalHydration,
} from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { Plus } from 'lucide'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GeospatialMap, SvgIcon, defineMapConfig } from '../src/index'
import type { MapIcons, MapSvgIcon } from '../src/index'
import { controllers, resetControllers } from './fake-controller'

// The server renders the page, then the browser hydrates it (`provideClientHydration()`): the
// browser takes over the server's DOM and must not draw again what the server drew. The server
// half runs platform-server in this jsdom file (it parses its own document); the browser half
// bootstraps over the server's HTML in jsdom's document, with the fake OpenLayers controller.
vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

const empty = { type: 'FeatureCollection' as const, features: [] }
const config = defineMapConfig({
  accessibility: { ariaLabel: 'Hydrated map' },
  data: {
    layers: [
      { id: 'cities', title: 'Cities', data: empty, visible: false },
      { id: 'regions', title: 'Regions', data: empty, opacity: 0.5 },
    ],
  },
  ui: {
    layerPanel: { defaultOpen: true, defaultExpandedLayerIds: ['regions'] },
    disclaimer: { text: 'Borders are not official.' },
  },
})

/** Carbon's "add" icon, with the svg's own attributes first. */
const carbonAdd: MapSvgIcon = [
  ['svg', { viewBox: '0 0 32 32', fill: 'currentColor', width: 20, height: 20 }],
  ['path', { d: 'M17 15 17 8 15 8 15 15 8 15 8 17 15 17 15 24 17 24 17 17 24 17 24 15z' }],
]

/** Renders `root` (selector `app-root`) on the server, with hydration data. */
async function renderOnServer(root: Type<unknown>): Promise<Document> {
  const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(
      root,
      {
        providers: [
          provideZonelessChangeDetection(),
          provideServerRendering(),
          provideClientHydration(),
        ],
      },
      context,
    )
  const html = await renderApplication(bootstrap, {
    document: '<!doctype html><html><head></head><body><app-root></app-root></body></html>',
    url: 'http://localhost/',
    allowedHosts: ['localhost'],
  })
  expect(html).toContain(' ngh="')
  return new DOMParser().parseFromString(html, 'text/html')
}

let app: ApplicationRef | undefined
let errors: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errors = vi.spyOn(console, 'error')
  vi.spyOn(console, 'warn').mockImplementation(() => undefined) // jsdom loads no stylesheet
  vi.spyOn(console, 'log').mockImplementation(() => undefined) // "Angular hydrated …"
})
afterEach(() => {
  app?.destroy()
  app = undefined
  document.head.replaceChildren()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

/** Puts the server's page into jsdom's document and hydrates `root` over it. */
async function hydrate<T>(server: Document, root: Type<T>): Promise<T> {
  const copy = (parent: Node) =>
    [...parent.childNodes].map((node) => document.importNode(node, true))
  document.head.replaceChildren(...copy(server.head))
  document.body.replaceChildren(...copy(server.body))
  app = await bootstrapApplication(root, {
    providers: [provideZonelessChangeDetection(), provideClientHydration()],
  })
  await app.whenStable()
  expect(errors).not.toHaveBeenCalled() // no hydration mismatch
  return app.components[0]!.instance as T
}

/** An element's markup without hydration's `ngh` markers and Angular's comment anchors. */
function markup(element: Element): string {
  return element.outerHTML.replace(/ ngh="\d+"/g, '').replace(/<!--[^]*?-->/g, '')
}

/** The `d` of each node an svg draws. */
function paths(svg: Element): (string | null)[] {
  return [...svg.children].map((node) => node.getAttribute('d'))
}

describe('hydration', () => {
  it("takes over the server's map without drawing anything twice", async () => {
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" [icons]="icons()" />`,
    })
    class Shell {
      protected readonly config = config
      readonly icons = signal<Partial<MapIcons>>({})
    }
    const server = await renderOnServer(Shell)
    const shell = await hydrate(server, Shell)
    const map = document.querySelector('[data-slot="map"]')!
    const serverMap = server.querySelector('[data-slot="map"]')!
    expect(serverMap.querySelectorAll('svg path').length).toBeGreaterThan(10)
    expect(serverMap.querySelector('[data-slot="map-layer-panel"]')).not.toBeNull()
    expect(markup(map)).toBe(markup(serverMap))
    const zoomIn = map.querySelector('button[aria-label="Zoom in"] svg')!
    expect(paths(zoomIn)).toEqual(['M5 12h14', 'M12 5v14'])

    // The server's copy of the icon's svg attributes is the icon's: a new icon replaces them.
    shell.icons.set({ ZoomIn: carbonAdd })
    await app!.whenStable()
    expect(paths(zoomIn)).toEqual([carbonAdd[1]![1]['d']])
    expect(zoomIn.getAttribute('viewBox')).toBe('0 0 32 32')
    expect(zoomIn.getAttribute('fill')).toBe('currentColor')
    expect(zoomIn.getAttribute('width')).toBe('20')
    expect(zoomIn.hasAttribute('stroke')).toBe(false)

    shell.icons.set({ ZoomIn: Plus })
    await app!.whenStable()
    expect(paths(zoomIn)).toEqual(['M5 12h14', 'M12 5v14'])
    expect(zoomIn.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(zoomIn.getAttribute('stroke')).toBe('currentColor')
  })

  it('keeps the attributes a consumer writes on svg[geoIcon]', async () => {
    @Component({
      selector: 'app-root',
      imports: [SvgIcon],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<svg [geoIcon]="icon()" width="16" [attr.stroke-width]="1.5"></svg>`,
    })
    class Shell {
      readonly icon = signal<MapSvgIcon>(Plus)
    }
    const shell = await hydrate(await renderOnServer(Shell), Shell)
    const svg = document.querySelector('svg')!
    expect(paths(svg)).toEqual(['M5 12h14', 'M12 5v14'])
    expect(svg.getAttribute('width')).toBe('16')
    expect(svg.getAttribute('stroke-width')).toBe('1.5')

    shell.icon.set(carbonAdd)
    await app!.whenStable()
    expect(paths(svg)).toHaveLength(1)
    expect(svg.getAttribute('width')).toBe('16') // the consumer's, not the icon's 20
    expect(svg.getAttribute('height')).toBe('20') // lucide's 24 was the server's copy
    expect(svg.getAttribute('stroke-width')).toBe('1.5')
    expect(svg.hasAttribute('stroke')).toBe(false)
  })
})

// The README's server-rendering path: `@defer (hydrate on viewport)` renders the map's shell on
// the server and hydrates it when its trigger fires (`hydrate on immediate` here: jsdom has no
// IntersectionObserver). The browser takes over the server's map, then starts OpenLayers.
describe('incremental hydration', () => {
  it('hydrates a deferred map over the server render', async () => {
    @Component({
      selector: 'app-regions-map',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class RegionsMap {
      protected readonly config = config
    }
    @Component({
      selector: 'app-root',
      imports: [RegionsMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        @defer (hydrate on immediate) {
          <app-regions-map />
        } @placeholder {
          <p>Loading map…</p>
        }
      `,
    })
    class Page {}

    resetControllers()
    // Built for each side: some hydration providers depend on where they are created.
    const providers = () => [
      provideZonelessChangeDetection(),
      provideClientHydration(withIncrementalHydration()),
    ]
    const html = await renderApplication(
      (context: BootstrapContext) =>
        bootstrapApplication(
          Page,
          { providers: [...providers(), provideServerRendering()] },
          context,
        ),
      {
        document: '<!doctype html><html><head></head><body><app-root></app-root></body></html>',
        url: 'http://localhost/',
        allowedHosts: ['localhost'],
      },
    )
    const server = new DOMParser().parseFromString(html, 'text/html')
    const serverMap = server.querySelector('[data-slot="map"]')!
    expect(serverMap).not.toBeNull() // the shell, not the placeholder
    expect(html).not.toContain('Loading map')

    document.body.replaceChildren(
      ...[...server.body.childNodes].map((node) => document.importNode(node, true)),
    )
    const before = document.querySelector('[data-slot="map"]')
    app = await bootstrapApplication(Page, { providers: providers() })
    for (let attempt = 0; attempt < 20 && controllers.length === 0; attempt++) {
      await app.whenStable()
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    expect(controllers).toHaveLength(1)
    expect(document.querySelectorAll('[data-slot="map"]')).toHaveLength(1)
    expect(document.querySelector('[data-slot="map"]')).toBe(before)
    expect(document.querySelectorAll('[data-slot="map"] svg path')).toHaveLength(
      serverMap.querySelectorAll('svg path').length,
    )
    expect(errors).not.toHaveBeenCalled()
  })
})
