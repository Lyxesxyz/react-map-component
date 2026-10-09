// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { describe, expect, it, vi } from 'vitest'
import { MapControlTemplate, MapGrid } from '../src/index'
import type { MapConfigInput, MapGridConfig } from '../src/types'
import { createMapController } from '../src/core/map-controller'

// The grid on the server: React's markup (grid, cells, headings, focus buttons) with a map shell
// per cell, and no OpenLayers. The behaviour is tested in grid.test.ts.
vi.mock('../src/core/map-controller', () => ({ createMapController: vi.fn() }))

const shared: MapConfigInput = {
  accessibility: { ariaLabel: 'Grid map' },
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
}
const maps = [
  { id: 'left', title: 'Left' },
  { id: 'right', title: 'Right', initialState: { view: { zoom: 3 } } },
]

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

/** The markup without Angular's comment anchors, to compare with React's. */
const withoutAnchors = (html: string) => html.replace(/<!--[a-z-]*-->/g, '')

describe('the grid on the server', () => {
  it("renders React's grid: cells with headings, focus buttons and map shells", async () => {
    @Component({
      selector: 'app-root',
      imports: [MapGrid],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-grid [config]="config" cellClassName="cell" />`,
    })
    class Shell {
      protected readonly config: MapGridConfig = { shared, maps, sync: { view: true } }
    }
    const html = withoutAnchors(await renderOnServer(Shell))
    const grid = html.match(/<geo-map-grid [^>]*>/)?.[0] ?? ''
    expect(grid).toContain('data-slot="map-grid"')
    expect(grid).toContain('class="geo-map-grid"')
    expect(grid).not.toContain('data-focused')
    expect(grid).not.toContain('role=')
    for (const declaration of [
      '--geo-grid-columns: 3',
      '--geo-grid-tablet-columns: 2',
      '--geo-grid-mobile-columns: 1',
      '--geo-grid-gap: 12px',
      '--geo-grid-cell-height: 340px',
    ])
      expect(grid).toContain(declaration)

    const cells = html.match(/<article [^>]*>/g) ?? []
    expect(cells).toHaveLength(2)
    for (const cell of cells) {
      expect(cell).toContain('data-slot="map-grid-cell"')
      expect(cell).toMatch(/class="(cell geo-map-grid-cell|geo-map-grid-cell cell)"/)
    }
    for (const title of ['Left', 'Right']) {
      expect(html).toMatch(
        new RegExp(
          `<header class="geo-map-grid-cell-header"><h2 class="geo-map-grid-cell-title">${title}</h2><button [^>]*>Focus ${title}</button></header><geo-map `,
        ),
      )
      expect(html).toMatch(new RegExp(`<geo-map [^>]*data-map-id="${title.toLowerCase()}"`))
    }
    const focus = html.match(/<button [^>]*>Focus Left<\/button>/)?.[0] ?? ''
    expect(focus).toContain('type="button"')
    expect(focus).toContain('data-slot="button"')
    expect(focus).toContain('class="geo-shape-button"')
    // Each cell is a map shell (loading, with its accessible live region), without OpenLayers.
    expect(html.match(/data-status="loading"/g)).toHaveLength(2)
    expect(html.match(/<span [^>]*aria-live="polite"[^>]*>Map loading<\/span>/g)).toHaveLength(2)
    expect(createMapController).not.toHaveBeenCalled()
  })

  it('renders the focused map alone, with its full UI and custom-control templates', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapGrid, MapControlTemplate],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-grid [config]="config" [state]="{ maps: {}, focusedMapId: 'right' }">
          <ng-template geoMapControl="custom:share" let-state>
            <button type="button" class="share">Share {{ state.view.zoom }}</button>
          </ng-template>
        </geo-map-grid>
      `,
    })
    class Shell {
      protected readonly config: MapGridConfig = {
        shared: {
          ...shared,
          ui: { controls: { groups: [{ id: 'zoom', controls: ['zoom-in', 'custom:share'] }] } },
        },
        maps,
      }
    }
    const html = withoutAnchors(await renderOnServer(Shell))
    const grid = html.match(/<geo-map-grid [^>]*>/)?.[0] ?? ''
    expect(grid).toContain('data-focused=""')
    expect(grid).toContain('class="geo-map-grid geo-map-grid-focused"')
    expect(html.match(/<article /g)).toHaveLength(1)
    expect(html).toMatch(
      /<h2 class="geo-map-grid-cell-title">Right<\/h2><button [^>]*>Return to grid</,
    )
    expect(html).not.toContain('>Left<')
    // The right map starts at its own zoom; the grid's control template has its state.
    expect(html).toContain('<button type="button" class="share">Share 3</button>')
  })

  it('renders the alert instead of the maps with more than six', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapGrid],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-grid [config]="config" />`,
    })
    class Shell {
      protected readonly config: MapGridConfig = {
        shared,
        maps: Array.from({ length: 7 }, (_, index) => ({ id: `m${index}`, title: `M${index}` })),
      }
    }
    const html = withoutAnchors(await renderOnServer(Shell))
    const grid = html.match(/<geo-map-grid [^>]*>[^<]*<\/geo-map-grid>/)?.[0] ?? ''
    expect(grid).toContain('data-slot="map-grid-error"')
    expect(grid).toContain('role="alert"')
    expect(grid).toContain('class="geo-config-error"')
    expect(grid).toContain('>MapGrid supports at most six maps.</geo-map-grid>')
    expect(html).not.toContain('<geo-map ')
  })
})
