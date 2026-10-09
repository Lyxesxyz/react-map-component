// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeospatialMap, MapRoot, MapTimeControls, defineMapConfig } from '../src/index'
import type { MapUiConfig } from '../src/types'
import { createMapController } from '../src/core/map-controller'

// The time controls' server render: shown when a layer has time values, with the state the
// browser starts from. Playback (a timer) and the reduced-motion check run in the browser only.
vi.mock('../src/core/map-controller', () => ({ createMapController: vi.fn() }))

const empty = { type: 'FeatureCollection' as const, features: [] }
const timeConfig = (ui: MapUiConfig = {}) =>
  defineMapConfig({
    accessibility: { ariaLabel: 'SSR time map' },
    initialState: { view: { center: [0, 0], zoom: 1 }, time: '2022' },
    data: {
      layers: [
        { id: 'index', title: 'Index', data: empty, time: { values: ['2021', '2022', '2023'] } },
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

/** The opening tag of the time controls. */
const hostTag = (html: string) => html.match(/<geo-map-time-controls[^>]*>/)?.[0] ?? ''

afterEach(() => vi.restoreAllMocks())

describe('the time controls on the server', () => {
  it('render in the preset with the map time, a wrapped select and the slider fill', async () => {
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Shell {
      protected readonly config = timeConfig()
    }
    const html = await renderOnServer(Shell)
    const tag = hostTag(html)
    expect(tag).toContain('class="geo-time-controls"')
    expect(tag).toContain('role="group"')
    expect(tag).toContain('data-slot="map-time-controls"')
    expect(tag).toContain('data-placement="bottom-left"')
    expect(tag).toContain('data-state="paused"')
    expect(tag).toContain('aria-label="Time controls"')
    expect(html).toMatch(/<button[^>]*aria-label="Play time animation"/)
    expect(html).toMatch(/<button[^>]*aria-label="Replay time animation"/)
    expect(html).toMatch(/<button[^>]*aria-label="Previous time"/)
    expect(html).toMatch(/<button[^>]*aria-label="Next time"/)
    // React's shape tests: the select is wrapped for its chevron; the slider exposes its fill.
    expect(html).toMatch(
      /<span class="geo-shape-select-wrap"><select[^>]*class="geo-shape-select"[^>]*aria-label="Playback speed"/,
    )
    expect(html).toMatch(/<input[^>]*aria-label="Selected time"[^>]*--geo-slider-fill: 50%/)
    const output = html.match(/<output[^>]*>([^<]*)<\/output>/)
    expect(output?.[0]).toContain('class="geo-time-value"')
    expect(output?.[0]).toContain('aria-live="off"')
    expect(output?.[1]).toBe('Time 2022')
    expect(createMapController).not.toHaveBeenCalled()
  })

  it('render the autoplay state without starting playback', async () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval')
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapTimeControls],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-time-controls autoplay placement="top-right" />
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = timeConfig()
    }
    const tag = hostTag(await renderOnServer(Shell))
    expect(tag).toContain('data-state="playing"')
    expect(tag).toContain('data-placement="top-right"')
    expect(setInterval).not.toHaveBeenCalled()
  })

  it('render a hidden host, without classes or ARIA, when no layer has time values', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapTimeControls],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-time-controls />
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = defineMapConfig({
        accessibility: { ariaLabel: 'SSR map' },
        data: { layers: [{ id: 'borders', title: 'Borders', data: empty }] },
      })
    }
    const html = await renderOnServer(Shell)
    const tag = hostTag(html)
    expect(tag).toContain('style="display: none;"')
    expect(tag).not.toMatch(/\s(role|data-[a-z-]+|aria-[a-z]+)=/)
    expect(html).not.toContain('geo-time-controls')
    expect(html).not.toContain('Play time animation')
  })
})
