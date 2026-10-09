// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { describe, expect, it, vi } from 'vitest'
import { GeospatialMap, type MapConfigInput, type MapIcons } from '../src/index'

// A node icon with a leading ['svg', attributes] entry renders its own svg attributes on the
// server too (they are set in the same effect as the nodes). OpenLayers never starts here.
vi.mock('../src/core/map-controller', () => ({ createMapController: vi.fn() }))

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

describe('node icons on the server', () => {
  it("renders a leading svg entry's attributes instead of lucide's", async () => {
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" [icons]="icons" />`,
    })
    class Shell {
      protected readonly config: MapConfigInput = {
        accessibility: { ariaLabel: 'Icon map' },
        data: { layers: [] },
      }
      protected readonly icons: Partial<MapIcons> = {
        ZoomIn: [
          ['svg', { viewBox: '0 0 32 32', fill: 'currentColor', width: 16, height: 16 }],
          ['path', { d: 'M17 15 17 8 15 8 15 15 8 15 8 17 15 17 15 24 17 24 17 17 24 17 24 15z' }],
        ],
      }
    }
    const html = await renderOnServer(Shell)
    const zoomIn = /aria-label="Zoom in"[^>]*>[^]*?(<svg [^>]*>)([^]*?)<\/svg>/.exec(html)
    expect(zoomIn).not.toBeNull()
    const [, svg, content] = zoomIn!
    expect(svg).toContain('viewBox="0 0 32 32"')
    expect(svg).toContain('fill="currentColor"')
    expect(svg).toContain('width="16"')
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('stroke')
    expect(content).toBe(
      '<path d="M17 15 17 8 15 8 15 15 8 15 8 17 15 17 15 24 17 24 17 17 24 17 24 15z"></path>',
    )
    // The other icons keep lucide's attributes.
    expect(html).toMatch(
      /aria-label="Zoom out"[^>]*>[^]*?<svg [^>]*viewBox="0 0 24 24"[^>]*fill="none"[^>]*stroke="currentColor"[^>]*><path d="M5 12h14"><\/path><\/svg>/,
    )
  })
})
