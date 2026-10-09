// @vitest-environment node
import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MapControlGroup,
  MapControls,
  MapLegend,
  MapRoot,
  MapZoomInButton,
  ShapeSelect,
  ShapeSlider,
  defineMapConfig,
  injectMap,
} from '../src/index'
import type { MapIcons } from '../src/component-types'
import type { MapConfig, MapConfigInput } from '../src/types'
import { createMapController } from '../src/core/map-controller'
import { sliderFill } from '../src/utils'

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

// The rest of React's ssr.test.tsx, case by case.
describe('server rendering, as React', () => {
  it('skips a custom control without a template, with a console hint', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Shell {
      protected readonly config: MapConfigInput = {
        ...config,
        ui: {
          controls: { groups: [{ id: 'custom', controls: ['zoom-in', 'custom:missing'] }] },
        },
      }
    }
    const html = await renderOnServer(Shell)
    expect(html).toContain('geo-map-viewport')
    expect(html).toContain('Zoom in')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('custom:missing'))
    warn.mockRestore()
  })

  it('renders only the parts a host composes inside geo-map-root, with host classes', async () => {
    @Component({
      selector: 'app-map-title',
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<h2 class="host-title">{{ map().config.accessibility.ariaLabel }}</h2>`,
    })
    class MapTitle {
      protected readonly map = injectMap()
    }
    @Component({
      selector: 'app-root',
      imports: [MapRoot, MapControls, MapControlGroup, MapZoomInButton, MapLegend, MapTitle],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" class="brand-map" data-testid="map">
          <geo-map-controls placement="bottom-left" class="host-rail">
            <geo-map-control-group>
              <button geoMapZoomIn label="Closer"></button>
            </geo-map-control-group>
          </geo-map-controls>
          <geo-map-legend />
          <app-map-title />
        </geo-map-root>
      `,
    })
    class Shell {
      protected readonly config = config
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/<geo-map-root [^>]*class="geo-map-root[^"]* brand-map"/)
    expect(html).toContain('data-testid="map"')
    expect(html).toMatch(/<geo-map-controls [^>]*class="geo-map-controls host-rail"/)
    expect(html).toContain('data-placement="bottom-left"')
    expect(html).toContain('aria-label="Closer"')
    expect(html).toContain('<h2 class="host-title">SSR map</h2>')
    expect(html).not.toContain('Zoom out')
    expect(html).not.toContain('geo-attribution')
  })

  it('does not write map outputs to the DOM', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config" (ready)="ready()" (mapError)="ready()" />`,
    })
    class Shell {
      protected readonly config = config
      protected ready(): void {}
    }
    const html = await renderOnServer(Shell)
    expect(html).toContain('geo-map-viewport')
    expect(html).not.toMatch(/\s(on)?ready=|maperror/i)
  })

  it('writes only explicitly configured theme keys inline', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config" />`,
    })
    class Shell {
      protected readonly config: MapConfig = {
        ...config,
        theme: { primary: '#6d28d9', density: 'compact' },
      }
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/<geo-map-root [^>]*style="[^"]*#6d28d9/)
    expect(html).toContain('data-density="compact"')
    expect(html).not.toContain('#18181b')
  })

  it('explains when a part is used outside a map', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    @Component({
      selector: 'app-root',
      imports: [MapLegend],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-legend />`,
    })
    class Shell {}
    await expect(renderOnServer(Shell)).rejects.toThrow(/inside <geo-map-root> or <geo-map>/)
    error.mockRestore()
  })

  it('renders a short config and the fill input, without writing inputs to the DOM', async () => {
    @Component({
      selector: 'app-root',
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      // Bound inputs never reach the DOM; a static attribute (`<geo-map-root fill>`) would
      // stay on the element, as attributes do in Angular.
      template: `<geo-map-root [config]="config" [fill]="true" [loadGeoJson]="load" />`,
    })
    class Shell {
      protected readonly config: MapConfigInput = {
        accessibility: { ariaLabel: 'Short map' },
        data: { layers: [] },
      }
      protected readonly load = async () => ({
        type: 'FeatureCollection' as const,
        features: [],
      })
    }
    const html = await renderOnServer(Shell)
    expect(html).toContain('data-fill=""')
    expect(html).toContain('geo-map-viewport')
    expect(html).not.toMatch(/loadgeojson|\sfill="/i)
  })

  it('renders the tooltip, anchored popup, and OpenLayers hook without a browser', async () => {
    const hook = vi.fn()
    @Component({
      selector: 'app-root',
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" [onOpenLayersMap]="hook" />`,
    })
    class Shell {
      protected readonly config: MapConfigInput = {
        accessibility: { ariaLabel: 'Overlay map' },
        ui: { popup: { anchor: 'feature' } },
        data: { layers: [] },
      }
      protected readonly hook = hook
    }
    const html = await renderOnServer(Shell)
    expect(html).toContain('geo-map-viewport')
    expect(html).not.toMatch(/onopenlayersmap|class="geo-tooltip|class="geo-popup/i)
    expect(hook).not.toHaveBeenCalled()
    expect(createMapController).not.toHaveBeenCalled()
  })

  it('renders icons from the icons input and the defaults for the rest', async () => {
    @Component({
      selector: 'app-marker',
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<svg data-icon="custom-zoom-in"></svg>`,
    })
    class Marker {}
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
      protected readonly icons: Partial<MapIcons> = { ZoomIn: Marker }
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/aria-label="Zoom in"[^]*?data-icon="custom-zoom-in"/)
    // The default Minus icon (lucide's nodes; Angular renders them without lucide's classes).
    expect(html).toMatch(
      /aria-label="Zoom out"[^>]*>[^]*?<svg [^>]*><path d="M5 12h14"><\/path><\/svg>/,
    )
    expect(html).not.toMatch(/\sicons=/)
  })
})

describe('shape primitives on the server', () => {
  it('wraps the select so its chevron can be styled', async () => {
    @Component({
      selector: 'app-root',
      imports: [ShapeSelect],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-shape-select ariaLabel="Speed" [options]="options" value="1" />`,
    })
    class Shell {
      protected readonly options = [{ value: '1', label: '1×' }]
    }
    const html = await renderOnServer(Shell)
    expect(html).toMatch(
      /<geo-shape-select[^>]*><span class="geo-shape-select-wrap"><select[^>]*class="geo-shape-select"/,
    )
  })

  it('exposes the filled share of the slider as --geo-slider-fill', async () => {
    expect(sliderFill(0.25, 0, 1)).toBe('25%')
    expect(sliderFill(2, 0, 3)).toBe(`${(2 / 3) * 100}%`)
    expect(sliderFill(5, 0, 0)).toBe('0%')
    expect(sliderFill(undefined)).toBeUndefined()
    @Component({
      selector: 'app-root',
      imports: [ShapeSlider],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<input
        type="range"
        geoShapeSlider
        aria-label="Opacity"
        min="0"
        max="1"
        step="0.05"
        [value]="0.5"
        readonly
      />`,
    })
    class Shell {}
    const html = await renderOnServer(Shell)
    expect(html).toMatch(/<input[^>]*aria-label="Opacity"[^>]*--geo-slider-fill: 50%/)
  })
})
