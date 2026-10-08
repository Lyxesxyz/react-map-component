import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core'
import type { Provider, Type } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MAP_CONTEXT,
  MapAttribution,
  MapControlGroup,
  MapControlTemplate,
  MapControls,
  MapLegend,
  MapPopup,
  MapRoot,
  MapTooltip,
  MapZoomInButton,
  ShapeIconButton,
  ShapeSelect,
  ShapeSlider,
  defineMapConfig,
  injectMap,
  type MapActionEvent,
  type MapActions,
  type MapContext,
  type MapRuntime,
  type MapStaticValue,
} from '../src/index'
import { defaultMapIcons } from '../src/icons'
import { resolveMapUi } from '../src/config/ui-profiles'
import { emptyDerived } from '../src/map-bridges'
import { defaultMapMessages } from '../src/messages'
import { controllers, fakeData, resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Parts map' },
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

async function render<T>(component: Type<T>) {
  const fixture = TestBed.createComponent(component)
  await fixture.whenStable()
  return { fixture, element: fixture.nativeElement as HTMLElement }
}

beforeEach(() => resetControllers())
afterEach(() => vi.restoreAllMocks())

@Component({
  selector: 'test-map-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 class="host-title">{{ map().config.accessibility.ariaLabel }}</h2>`,
})
class MapTitle {
  protected readonly map = injectMap()
}

describe('composable parts', () => {
  it('renders only the parts a host composes inside geo-map-root, with host classes', async () => {
    @Component({
      imports: [MapRoot, MapControls, MapControlGroup, MapZoomInButton, MapLegend, MapTitle],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" class="brand-map" data-testid="map" id="regions">
          <geo-map-controls placement="bottom-left" class="host-rail">
            <geo-map-control-group>
              <button geoMapZoomIn label="Closer"></button>
            </geo-map-control-group>
          </geo-map-controls>
          <geo-map-legend class="brand-legend" style="color: red" />
          <test-map-title />
        </geo-map-root>
      `,
    })
    class Host {
      protected readonly config = config
    }
    const { element } = await render(Host)
    const root = element.querySelector('geo-map-root')!
    expect([...root.classList].sort()).toEqual(['brand-map', 'geo-map-root'])
    expect(root.getAttribute('data-testid')).toBe('map')
    expect(root.id).toBe('regions')
    expect(root.getAttribute('data-slot')).toBe('map')
    expect(root.getAttribute('data-status')).toBe('loading')
    const rail = root.querySelector('geo-map-controls')!
    expect([...rail.classList].sort()).toEqual(['geo-map-controls', 'host-rail'])
    expect(rail.getAttribute('data-placement')).toBe('bottom-left')
    expect(rail.getAttribute('role')).toBe('group')
    expect(rail.getAttribute('aria-label')).toBe('Map controls')
    const button = rail.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('Closer')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('data-slot')).toBe('map-control-button')
    expect(root.querySelectorAll('button')).toHaveLength(1)
    expect(root.querySelector('.host-title')?.textContent).toBe('Parts map')
    // Parts live in the stage, after the viewport, like React's children.
    expect(root.querySelector('.geo-map-stage > .geo-map-viewport + geo-map-controls')).not.toBe(
      null,
    )
    // A part with nothing to show (no legends yet) stays, hidden, without its classes or ARIA.
    const legend = root.querySelector('geo-map-legend') as HTMLElement
    expect(legend.className).toBe('brand-legend')
    expect(legend.style.display).toBe('none')
    expect(legend.getAttribute('role')).toBeNull()
    expect(legend.getAttribute('data-slot')).toBeNull()
    expect(root.querySelector('.geo-attribution')).toBeNull()
  })

  it('shows a hidden part again with the consumer style once it has content', async () => {
    @Component({
      imports: [MapRoot, MapLegend],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-legend class="brand-legend" style="display: grid; color: red" />
        </geo-map-root>
      `,
    })
    class Host {
      protected readonly config = config
    }
    fakeData.legends = [
      {
        layerId: 'areas',
        title: 'Areas',
        visible: true,
        entries: [{ id: 'a', label: 'Low', symbol: { kind: 'polygon', fillColor: '#eee' } }],
      },
    ]
    const { fixture, element } = await render(Host)
    controllers[0]!.ready()
    await fixture.whenStable()
    const legend = element.querySelector('geo-map-legend') as HTMLElement
    expect([...legend.classList].sort()).toEqual([
      'brand-legend',
      'geo-legend',
      'geo-legend-list',
      'geo-shape-card',
    ])
    expect(legend.getAttribute('data-slot')).toBe('map-legend')
    expect(legend.getAttribute('role')).toBe('region')
    expect(legend.style.display).toBe('grid')
    expect(legend.style.color).toBe('red')
    expect(legend.querySelector('h2.geo-legend-heading')?.textContent).toBe('Legend')
    const symbol = legend.querySelector('svg.geo-legend-symbol')!
    expect(symbol.getAttribute('viewBox')).toBe('0 0 28 18')
    expect(symbol.querySelector('rect')?.getAttribute('fill')).toBe('#eee')
  })

  it('writes only explicitly configured theme keys inline, after the consumer style', async () => {
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="themed" style="--geo-ring: blue; --geo-primary: red" />`,
    })
    class Host {
      protected readonly themed = {
        ...config,
        theme: { primary: '#6d28d9', border: '#cccccc', density: 'compact' as const },
      }
    }
    const { element } = await render(Host)
    const root = element.querySelector('geo-map-root') as HTMLElement
    expect(root.getAttribute('data-density')).toBe('compact')
    expect(root.style.getPropertyValue('--geo-border')).toBe('#cccccc')
    expect(root.style.getPropertyValue('--geo-ring')).toBe('blue')
    // The consumer's static style wins over config.theme, as in React.
    expect(root.style.getPropertyValue('--geo-primary')).toBe('red')
    expect(root.getAttribute('style')).not.toContain('#18181b')
  })

  it("lets a consumer's static aria-label and role win over a part's own, as React's props do", async () => {
    @Component({
      imports: [
        MapRoot,
        MapControls,
        MapControlGroup,
        MapZoomInButton,
        MapLegend,
        MapAttribution,
        MapPopup,
      ],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-controls aria-label="Zoom tools">
            <geo-map-control-group id="zoom">
              <button geoMapZoomIn aria-label="Zoom closer"></button>
            </geo-map-control-group>
          </geo-map-controls>
          <geo-map-legend aria-label="Key" role="complementary" />
          <geo-map-attribution aria-label="Sources" />
          <geo-map-popup aria-label="Area details" />
        </geo-map-root>
      `,
    })
    class Host {
      protected readonly config = config
    }
    const { fixture, element } = await render(Host)
    const legend = element.querySelector('geo-map-legend') as HTMLElement
    // Hidden parts still carry no ARIA, the consumer's included.
    expect(legend.hasAttribute('aria-label')).toBe(false)
    expect(legend.hasAttribute('role')).toBe(false)

    fakeData.legends = [
      {
        layerId: 'areas',
        title: 'Areas',
        visible: true,
        entries: [{ id: 'a', label: 'Low', symbol: { kind: 'polygon', fillColor: '#eee' } }],
      },
    ]
    fakeData.attributions = [{ label: 'Natural Earth' }]
    fakeData.features = {
      a1: { mapId: 'fake', layerId: 'areas', featureId: 'a1', properties: {}, coordinate: [1, 2] },
    }
    const controller = controllers[0]!
    controller.ready()
    controller.click(fakeData.features['a1']!)
    await fixture.whenStable()
    const rail = element.querySelector('geo-map-controls')!
    expect(rail.getAttribute('aria-label')).toBe('Zoom tools')
    // A group's `id` names it for styling, as in React; it is not a DOM id.
    const group = rail.querySelector('geo-map-control-group')!
    expect(group.getAttribute('data-control-group')).toBe('zoom')
    expect(group.hasAttribute('id')).toBe(false)
    const zoomIn = rail.querySelector('button')!
    expect(zoomIn.getAttribute('aria-label')).toBe('Zoom closer')
    expect(zoomIn.getAttribute('title')).toBe('Zoom in')
    expect(legend.getAttribute('aria-label')).toBe('Key')
    expect(legend.getAttribute('role')).toBe('complementary')
    const attribution = element.querySelector('geo-map-attribution')!
    expect(attribution.getAttribute('aria-label')).toBe('Sources')
    expect(attribution.getAttribute('role')).toBe('group')
    const popup = element.querySelector('geo-map-popup')!
    expect(popup.getAttribute('aria-label')).toBe('Area details')
    expect(popup.getAttribute('role')).toBe('dialog')
  })

  it('explains when a part is used outside a map', () => {
    expect(() => TestBed.createComponent(MapLegend)).toThrow(
      /injectMapStatic\(\) must be used inside <geo-map-root> or <geo-map>/,
    )
  })

  it('renders the attribution with links and the popup for the selected feature', async () => {
    @Component({
      imports: [MapRoot, MapAttribution, MapPopup],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-popup />
          <geo-map-attribution compact />
        </geo-map-root>
      `,
    })
    class Host {
      protected readonly config = config
    }
    fakeData.attributions = [
      { label: 'Natural Earth', url: 'https://example.org', version: '5.1' },
      { label: 'Agency', official: false },
    ]
    fakeData.features = {
      a1: {
        mapId: 'fake',
        layerId: 'areas',
        featureId: 'a1',
        properties: { name: 'Area one', value: 3, tags: ['x'] },
        coordinate: [1, 2],
      },
    }
    const { fixture, element } = await render(Host)
    const controller = controllers[0]!
    controller.ready()
    await fixture.whenStable()
    const attribution = element.querySelector('geo-map-attribution') as HTMLElement
    expect([...attribution.classList].sort()).toEqual([
      'geo-attribution',
      'geo-attribution-compact',
    ])
    expect(attribution.hasAttribute('data-compact')).toBe(true)
    expect(attribution.textContent).toBe('Natural Earth 5.1 · Agency (non-official)')
    expect(attribution.querySelector('a.geo-attribution-link')?.getAttribute('href')).toBe(
      'https://example.org',
    )

    const popup = element.querySelector('geo-map-popup') as HTMLElement
    expect(popup.style.display).toBe('none')
    controller.click(fakeData.features['a1']!)
    await fixture.whenStable()
    expect(popup.style.display).toBe('')
    expect(popup.getAttribute('role')).toBe('dialog')
    expect(popup.getAttribute('aria-label')).toBe('Selected feature details')
    expect(popup.getAttribute('data-anchor')).toBe('corner')
    expect([...popup.classList].sort()).toEqual(['geo-popup', 'geo-shape-card'])
    expect(popup.querySelector('.geo-popup-title')?.textContent).toBe('Area one')
    expect([...popup.querySelectorAll('.geo-popup-field-value')].map((n) => n.textContent)).toEqual(
      ['Area one', '3', '["x"]'],
    )
    const close = popup.querySelector('button.geo-popup-close') as HTMLButtonElement
    expect(close.getAttribute('data-slot')).toBe('icon-button')
    expect(close.getAttribute('aria-label')).toBe('Close feature details')
    expect([...close.classList].sort()).toEqual([
      'geo-popup-close',
      'geo-shape-button',
      'geo-shape-icon-button',
    ])
    close.click()
    await fixture.whenStable()
    expect(popup.style.display).toBe('none')
    expect(popup.getAttribute('role')).toBeNull()
  })
})

describe('the tooltip', () => {
  it('follows the hovered feature, except the selected one', async () => {
    @Component({
      imports: [MapRoot, MapTooltip],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config"><geo-map-tooltip class="tip" /></geo-map-root>`,
    })
    class Host {
      protected readonly config = config
    }
    const feature = {
      mapId: 'fake',
      layerId: 'areas',
      featureId: 'b2',
      properties: { title: 'Area two' },
      coordinate: [3, 4] as const,
    }
    fakeData.features = { b2: feature }
    const { fixture, element } = await render(Host)
    const controller = controllers[0]!
    controller.ready()
    const tooltip = element.querySelector('geo-map-tooltip') as HTMLElement
    expect(tooltip.style.display).toBe('none')
    expect(tooltip.className).toBe('tip')
    controller.hover(feature)
    await fixture.whenStable()
    expect(tooltip.textContent).toBe('Area two')
    expect([...tooltip.classList].sort()).toEqual(['geo-tooltip', 'tip'])
    expect(tooltip.getAttribute('data-slot')).toBe('map-tooltip')
    expect(tooltip.getAttribute('aria-hidden')).toBe('true')
    expect(tooltip.style.display).toBe('')
    expect(tooltip.dataset['side']).toBe('top')
    expect(tooltip.style.getPropertyValue('--geo-anchor-x')).toMatch(/px$/)
    // The selected feature shows its details in the popup instead.
    controller.click(feature)
    await fixture.whenStable()
    expect(tooltip.style.display).toBe('none')
    expect(tooltip.hasAttribute('aria-hidden')).toBe(false)
  })
})

describe('the preset and its icons', () => {
  it('lays out the parts from config.ui and overrides only the icons it is given', async () => {
    @Component({
      selector: 'test-marker',
      changeDetection: ChangeDetectionStrategy.OnPush,
      host: { '[attr.data-class]': 'class()', 'data-icon': 'custom-zoom-in' },
      template: '<svg viewBox="0 0 24 24"></svg>',
    })
    class Marker {
      readonly class = input('')
    }
    @Component({
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" [icons]="{ ZoomIn: marker }" />`,
    })
    class Host {
      protected readonly config = config
      protected readonly marker = Marker
    }
    const { element } = await render(Host)
    const zoomIn = element.querySelector('button[aria-label="Zoom in"]')!
    expect(zoomIn.querySelector('[data-icon="custom-zoom-in"]')).not.toBeNull()
    const zoomOut = element.querySelector('button[aria-label="Zoom out"]')!
    expect(zoomOut.querySelector('geo-map-icon.geo-icon > svg path')?.getAttribute('d')).toBe(
      'M5 12h14',
    )
    const svg = zoomOut.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('fill')).toBe('none')
    // The default `full` profile: zoom in, zoom out and reset zoom in the first group.
    expect(element.querySelector('geo-map-controls')?.getAttribute('data-placement')).toBe(
      'top-right',
    )
    expect(element.querySelector('.geo-map-stage > geo-map-legend')).not.toBeNull()
    expect(element.querySelector('.geo-map-stage > geo-map-popup')).not.toBeNull()
    expect(element.querySelector('.geo-map-stage > geo-map-tooltip')).not.toBeNull()
  })

  it('skips a custom control without a template, with a hint, and renders one with a template', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const withCustom = {
      ...config,
      ui: {
        controls: {
          groups: [
            { id: 'custom', controls: ['zoom-in' as const, 'custom:missing' as const] },
            { id: 'share', controls: ['custom:share' as const] },
          ],
        },
      },
    }
    @Component({
      imports: [GeospatialMap, MapControlTemplate],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map [config]="config">
          <ng-template geoMapControl="custom:share" let-state let-actions="actions">
            <button type="button" class="share" (click)="shared.set(state.view.zoom)">Share</button>
          </ng-template>
        </geo-map>
      `,
    })
    class Host {
      protected readonly config = withCustom
      readonly shared = signal<number | null>(null)
    }
    const { fixture, element } = await render(Host)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('custom:missing'))
    expect(element.querySelector('button[aria-label="Zoom in"]')).not.toBeNull()
    const groups = element.querySelectorAll('geo-map-control-group')
    expect([...groups].map((group) => group.getAttribute('data-control-group'))).toEqual([
      'custom',
      'share',
    ])
    const custom = element.querySelector('[data-control-group="share"] > .geo-custom-control')!
    expect(custom.getAttribute('data-slot')).toBe('map-custom-control')
    ;(custom.querySelector('button.share') as HTMLButtonElement).click()
    expect(fixture.componentInstance.shared()).toBe(1)
  })
})

/** A fake MAP_CONTEXT: parts inject the token, so they render without a map. */
function fakeContext(actions: Partial<MapActions>): Provider {
  const staticValue = signal<MapStaticValue>({
    mapId: 'fake',
    config,
    ui: resolveMapUi(),
    messages: defaultMapMessages,
    actions: actions as MapActions,
    icons: defaultMapIcons,
  })
  const runtime = signal<MapRuntime>({
    state: config.initialState,
    layers: [],
    ...emptyDerived,
    times: [],
    error: null,
    openPanel: null,
    mapStatus: 'ready',
  })
  const context: MapContext = { staticValue, runtime, actions: actions as MapActions }
  return { provide: MAP_CONTEXT, useValue: context }
}

describe('built-in buttons', () => {
  it('cancel their action when beforeAction calls preventDefault', async () => {
    const zoom = vi.fn()
    TestBed.configureTestingModule({ providers: [fakeContext({ zoom })] })
    @Component({
      imports: [MapZoomInButton],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <button geoMapZoomIn class="cancel" (beforeAction)="cancel($event)"></button>
        <button geoMapZoomIn class="plain" label="More" [step]="2"><b class="custom">+</b></button>
      `,
    })
    class Host {
      readonly seen: string[] = []
      cancel(event: MapActionEvent<'zoomIn'>) {
        this.seen.push(event.action)
        event.preventDefault()
      }
    }
    const { fixture, element } = await render(Host)
    ;(element.querySelector('.cancel') as HTMLButtonElement).click()
    expect(fixture.componentInstance.seen).toEqual(['zoomIn'])
    expect(zoom).not.toHaveBeenCalled()
    const plain = element.querySelector('.plain') as HTMLButtonElement
    plain.click()
    expect(zoom).toHaveBeenCalledWith(2)
    expect(plain.getAttribute('aria-label')).toBe('More')
    expect(plain.getAttribute('title')).toBe('More')
    // Projected content replaces the icon.
    expect(plain.querySelector('.custom')).not.toBeNull()
    expect(plain.querySelector('svg')).toBeNull()
    expect(element.querySelector('.cancel svg path')).not.toBeNull()
  })
})

describe('shape primitives', () => {
  it('wraps the select so its chevron can be styled', async () => {
    @Component({
      imports: [ShapeSelect],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-shape-select
          ariaLabel="Speed"
          [options]="options"
          [value]="value()"
          (valueChange)="value.set($event)"
        />
      `,
    })
    class Host {
      protected readonly options = [
        { value: '1', label: '1×' },
        { value: '2', label: '2×' },
      ]
      readonly value = signal('2')
    }
    const { fixture, element } = await render(Host)
    const wrap = element.querySelector('geo-shape-select > span.geo-shape-select-wrap')!
    const select = wrap.querySelector('select.geo-shape-select') as HTMLSelectElement
    expect(select.getAttribute('data-slot')).toBe('select')
    expect(select.getAttribute('aria-label')).toBe('Speed')
    expect(select.value).toBe('2')
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    await fixture.whenStable()
    expect(fixture.componentInstance.value()).toBe('1')
    expect(select.value).toBe('1')
  })

  it('exposes the filled share of the slider as --geo-slider-fill', async () => {
    @Component({
      imports: [ShapeSlider],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <input
          type="range"
          geoShapeSlider
          aria-label="Opacity"
          min="0"
          max="1"
          step="0.05"
          [value]="value()"
          (valueChange)="value.set($event)"
        />
      `,
    })
    class Host {
      readonly value = signal(0.5)
    }
    const { fixture, element } = await render(Host)
    const slider = element.querySelector('input') as HTMLInputElement
    expect(slider.className).toBe('geo-shape-slider')
    expect(slider.getAttribute('data-slot')).toBe('slider')
    expect(slider.style.getPropertyValue('--geo-slider-fill')).toBe('50%')
    slider.value = '0.25'
    slider.dispatchEvent(new Event('input'))
    await fixture.whenStable()
    expect(fixture.componentInstance.value()).toBe(0.25)
    expect(slider.style.getPropertyValue('--geo-slider-fill')).toBe('25%')
  })

  it('gives icon buttons their name, tooltip and type', async () => {
    @Component({
      imports: [ShapeIconButton],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<button geoShapeIconButton label="Close">x</button>`,
    })
    class Host {}
    const { element } = await render(Host)
    const button = element.querySelector('button')!
    expect(button.className).toBe('geo-shape-button geo-shape-icon-button')
    expect(button.getAttribute('data-slot')).toBe('icon-button')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('title')).toBe('Close')
  })
})
