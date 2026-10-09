import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import type { Provider, Type, WritableSignal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MAP_CONTEXT,
  MapDisclaimer,
  MapErrorAlert,
  MapErrorTemplate,
  MapRoot,
  defineMapConfig,
  type MapActions,
  type MapContext,
  type MapError,
  type MapRuntime,
  type MapStaticValue,
  type MapUiConfig,
} from '../src/index'
import { defaultMapIcons } from '../src/icons'
import { resolveMapUi } from '../src/config/ui-profiles'
import { emptyDerived } from '../src/map-bridges'
import { defaultMapMessages } from '../src/messages'
import { resetControllers } from './fake-controller'

// The error alert and the disclaimer: alone with a fake MAP_CONTEXT, then in the preset with the
// real engine (the OpenLayers controller is the fake one). The server render is in
// error-disclaimer-ssr.test.ts.
vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Alert map' },
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

const layerError: MapError = {
  code: 'SOURCE_LOAD_FAILED',
  message: 'Rivers could not be loaded.',
  recoverable: true,
  layerId: 'rivers',
}
const fatalError: MapError = { code: 'HOOK_FAILED', message: 'Drawing failed.', recoverable: false }

type FakeMap = {
  provider: Provider
  ui: WritableSignal<MapUiConfig>
  error: WritableSignal<MapError | null>
  actions: { dismissError: ReturnType<typeof vi.fn> }
}

/** A fake MAP_CONTEXT whose `ui` config and error a test can change. */
function fakeMap(ui: MapUiConfig = {}, error: MapError | null = null): FakeMap {
  const uiConfig = signal(ui)
  const errorSignal = signal(error)
  const actions = { dismissError: vi.fn(() => errorSignal.set(null)) }
  const context: MapContext = {
    staticValue: computed<MapStaticValue>(() => ({
      mapId: 'fake',
      config,
      ui: resolveMapUi(uiConfig()),
      messages: defaultMapMessages,
      actions: actions as unknown as MapActions,
      icons: defaultMapIcons,
    })),
    runtime: computed<MapRuntime>(() => ({
      state: config.initialState,
      layers: [],
      ...emptyDerived,
      times: [],
      error: errorSignal(),
      openPanel: null,
      mapStatus: 'ready',
    })),
    actions: actions as unknown as MapActions,
  }
  return {
    provider: { provide: MAP_CONTEXT, useValue: context },
    ui: uiConfig,
    error: errorSignal,
    actions,
  }
}

async function render<T>(component: Type<T>, providers: Provider[] = []) {
  TestBed.configureTestingModule({ providers })
  const fixture = TestBed.createComponent(component)
  await fixture.whenStable()
  return { fixture, element: fixture.nativeElement as HTMLElement }
}

/**
 * Every attribute of an element, except Angular's own and the attribute selectors of the shapes
 * (`geoShapeButton`), which stay on the element.
 */
function attributes(element: Element): Record<string, string> {
  return Object.fromEntries(
    [...element.attributes]
      .filter((attribute) => !/^(_ng|ng-|geoshape|geomap)/.test(attribute.name))
      .map((attribute) => [attribute.name, attribute.value]),
  )
}

beforeEach(() => resetControllers())
afterEach(() => vi.restoreAllMocks())

describe('MapErrorAlert', () => {
  @Component({
    imports: [MapErrorAlert],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<geo-map-error-alert class="brand-alert" style="color: red" data-testid="alert" />`,
  })
  class PlainHost {}

  it('stays hidden, without classes, role or data attributes, while there is no error', async () => {
    const map = fakeMap()
    const { element } = await render(PlainHost, [map.provider])
    const alert = element.querySelector('geo-map-error-alert') as HTMLElement
    expect(alert.className).toBe('brand-alert')
    expect(alert.style.display).toBe('none')
    expect(alert.style.color).toBe('red')
    expect(alert.getAttribute('role')).toBeNull()
    expect(alert.getAttribute('data-slot')).toBeNull()
    expect(alert.getAttribute('data-placement')).toBeNull()
    expect(alert.getAttribute('data-code')).toBeNull()
    expect(alert.getAttribute('data-testid')).toBe('alert')
    expect(alert.children).toHaveLength(0)
  })

  it('shows the error as React does, with the config placement and a dismiss button', async () => {
    const map = fakeMap({}, layerError)
    const { fixture, element } = await render(PlainHost, [map.provider])
    const alert = element.querySelector('geo-map-error-alert') as HTMLElement
    // React: <div role="alert" data-slot="map-error-alert" data-placement data-code
    //   class="geo-shape-alert geo-error-alert …">
    expect([...alert.classList].sort()).toEqual([
      'brand-alert',
      'geo-error-alert',
      'geo-shape-alert',
    ])
    expect(attributes(alert)).toEqual({
      class: alert.className,
      style: 'color: red;',
      'data-testid': 'alert',
      role: 'alert',
      'data-slot': 'map-error-alert',
      'data-placement': 'top-left',
      'data-code': 'SOURCE_LOAD_FAILED',
    })
    const message = alert.querySelector(':scope > span.geo-alert-message')!
    expect(message.textContent).toBe('Rivers could not be loaded.')
    const dismiss = alert.querySelector(':scope > button') as HTMLButtonElement
    expect(dismiss.className).toBe('geo-shape-button geo-alert-dismiss')
    expect(attributes(dismiss)).toEqual({
      class: dismiss.className,
      type: 'button',
      'data-slot': 'button',
    })
    expect(dismiss.textContent).toBe('Dismiss')
    expect(alert.textContent).toBe('Rivers could not be loaded.Dismiss')
    // The message comes before the button, as in React.
    expect([...alert.children].map((child) => child.tagName)).toEqual(['SPAN', 'BUTTON'])

    dismiss.click()
    await fixture.whenStable()
    expect(map.actions.dismissError).toHaveBeenCalledTimes(1)
    expect(alert.style.display).toBe('none')
    expect(alert.className).toBe('brand-alert')
    expect(alert.getAttribute('role')).toBeNull()
    expect(alert.children).toHaveLength(0)
  })

  it('takes placement and dismissible from inputs, else from ui.errorAlert', async () => {
    @Component({
      imports: [MapErrorAlert],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-error-alert class="default" />
        <geo-map-error-alert class="input" placement="bottom-left" [dismissible]="dismissible()" />
        <geo-map-error-alert class="attribute" dismissible />
      `,
    })
    class Host {
      readonly dismissible = signal<boolean | undefined>(false)
    }
    const map = fakeMap(
      { errorAlert: { placement: 'bottom-right', dismissible: false } },
      layerError,
    )
    const { fixture, element } = await render(Host, [map.provider])
    const alert = (name: string) => element.querySelector(`.${name}`) as HTMLElement
    expect(alert('default').getAttribute('data-placement')).toBe('bottom-right')
    expect(alert('default').querySelector('button')).toBeNull()
    expect(alert('input').getAttribute('data-placement')).toBe('bottom-left')
    expect(alert('input').querySelector('button')).toBeNull()
    expect(alert('attribute').querySelector('button.geo-alert-dismiss')).not.toBeNull()

    fixture.componentInstance.dismissible.set(true)
    await fixture.whenStable()
    expect(alert('input').querySelector('button.geo-alert-dismiss')).not.toBeNull()
    // `undefined` falls back to the config again.
    fixture.componentInstance.dismissible.set(undefined)
    await fixture.whenStable()
    expect(alert('input').querySelector('button')).toBeNull()

    // The config's own default: dismissible, top-left.
    map.ui.set({})
    await fixture.whenStable()
    expect(alert('default').getAttribute('data-placement')).toBe('top-left')
    expect(alert('default').querySelector('button.geo-alert-dismiss')).not.toBeNull()
  })

  it('has no dismiss button for an error the map cannot recover from', async () => {
    @Component({
      imports: [MapErrorAlert],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-error-alert dismissible />`,
    })
    class Host {}
    const map = fakeMap({}, fatalError)
    const { element } = await render(Host, [map.provider])
    const alert = element.querySelector('geo-map-error-alert')!
    expect(alert.getAttribute('data-code')).toBe('HOOK_FAILED')
    expect(alert.textContent).toBe('Drawing failed.')
    expect(alert.querySelector('button')).toBeNull()
  })

  it('replaces the message with a geoMapError template, which can dismiss', async () => {
    @Component({
      imports: [MapErrorAlert, MapErrorTemplate],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-error-alert>
          <ng-template geoMapError let-error let-dismiss="dismiss">
            <strong class="custom">{{ error.code }}: {{ error.layerId }}</strong>
            <button type="button" class="retry" (click)="dismiss()">Retry</button>
          </ng-template>
        </geo-map-error-alert>
      `,
    })
    class Host {}
    const map = fakeMap({}, layerError)
    const { fixture, element } = await render(Host, [map.provider])
    const alert = element.querySelector('geo-map-error-alert') as HTMLElement
    expect(alert.querySelector('.custom')?.textContent).toBe('SOURCE_LOAD_FAILED: rivers')
    expect(alert.querySelector('.geo-alert-message')).toBeNull()
    // The built-in dismiss button stays, after the content (as in React).
    expect(alert.querySelector('.retry + button.geo-alert-dismiss')).not.toBeNull()
    ;(alert.querySelector('.retry') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(map.actions.dismissError).toHaveBeenCalledTimes(1)
    expect(alert.style.display).toBe('none')
    expect(alert.querySelector('.custom')).toBeNull()
  })

  it('takes a template through the template input, and static content as the message', async () => {
    @Component({
      imports: [MapErrorAlert],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <ng-template #message let-error>
          <em class="from-input">{{ error.message }}</em>
        </ng-template>
        <geo-map-error-alert class="templated" [template]="message" />
        <geo-map-error-alert class="static"
          ><b class="text">Something failed.</b></geo-map-error-alert
        >
      `,
    })
    class Host {}
    const map = fakeMap({}, layerError)
    const { fixture, element } = await render(Host, [map.provider])
    const templated = element.querySelector('.templated')!
    expect(templated.querySelector('.from-input')?.textContent).toBe('Rivers could not be loaded.')
    expect(templated.querySelector('.geo-alert-message')).toBeNull()
    const staticAlert = element.querySelector('.static') as HTMLElement
    expect(staticAlert.textContent).toBe('Something failed.Dismiss')
    expect(staticAlert.querySelector('.geo-alert-message')).toBeNull()

    // Static content comes back with the next error.
    map.error.set(null)
    await fixture.whenStable()
    expect(staticAlert.querySelector('.text')).toBeNull()
    map.error.set(fatalError)
    await fixture.whenStable()
    expect(staticAlert.textContent).toBe('Something failed.')
    expect(staticAlert.getAttribute('data-code')).toBe('HOOK_FAILED')
  })

  it("keeps the consumer's role, as React's props spread does", async () => {
    @Component({
      imports: [MapErrorAlert],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-error-alert role="status" style="display: grid" />`,
    })
    class Host {}
    const map = fakeMap()
    const { fixture, element } = await render(Host, [map.provider])
    const alert = element.querySelector('geo-map-error-alert') as HTMLElement
    expect(alert.getAttribute('role')).toBeNull()
    expect(alert.style.display).toBe('none')
    map.error.set(layerError)
    await fixture.whenStable()
    expect(alert.getAttribute('role')).toBe('status')
    expect(alert.style.display).toBe('grid')
  })
})

describe('MapDisclaimer', () => {
  it('renders nothing (a hidden host) without projected content or ui.disclaimer.text', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-disclaimer class="brand" style="color: red" title="Notice" />`,
    })
    class Host {}
    const map = fakeMap()
    const { fixture, element } = await render(Host, [map.provider])
    const disclaimer = element.querySelector('geo-map-disclaimer') as HTMLElement
    expect(disclaimer.className).toBe('brand')
    expect(disclaimer.style.display).toBe('none')
    expect(disclaimer.getAttribute('data-slot')).toBeNull()
    expect(disclaimer.getAttribute('data-placement')).toBeNull()
    expect(disclaimer.getAttribute('data-open')).toBeNull()
    expect(disclaimer.getAttribute('title')).toBeNull()
    expect(disclaimer.querySelector('button')).toBeNull()
    expect(disclaimer.querySelector('[class], [id], [hidden]')).toBeNull()
    expect(disclaimer.textContent).toBe('')
    expect(disclaimer.outerHTML).not.toContain('geo-disclaimer')

    // Text in the config shows it.
    map.ui.set({ disclaimer: { text: 'Borders are not official.' } })
    await fixture.whenStable()
    expect(disclaimer.style.display).toBe('')
    expect(disclaimer.style.color).toBe('red')
    expect([...disclaimer.classList].sort()).toEqual(['brand', 'geo-disclaimer'])
    expect(disclaimer.querySelector('button')?.textContent).toBe('Notice')
  })

  it('renders the config text collapsed, with the DOM of the React part', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-disclaimer data-testid="disclaimer" />`,
    })
    class Host {}
    const map = fakeMap({ disclaimer: { text: 'Borders are not official.' } })
    const { element } = await render(Host, [map.provider])
    const disclaimer = element.querySelector('geo-map-disclaimer') as HTMLElement
    // React: <div data-slot="map-disclaimer" data-placement="bottom-left" class="geo-disclaimer">
    expect(attributes(disclaimer)).toEqual({
      'data-testid': 'disclaimer',
      class: 'geo-disclaimer',
      'data-slot': 'map-disclaimer',
      'data-placement': 'bottom-left',
    })
    expect([...disclaimer.children].map((child) => child.tagName)).toEqual(['BUTTON', 'SPAN'])
    const [button, text] = [...disclaimer.children] as [HTMLButtonElement, HTMLSpanElement]
    expect(button.className).toBe('geo-shape-button geo-disclaimer-toggle')
    expect(attributes(button)).toEqual({
      class: button.className,
      type: 'button',
      'data-slot': 'button',
      'aria-expanded': 'false',
      'aria-controls': text.id,
    })
    expect(button.textContent).toBe('Disclaimer')
    expect(text.id).toMatch(/^geo-disclaimer-\d+-text$/)
    expect(attributes(text)).toEqual({ id: text.id, class: 'geo-disclaimer-text', hidden: '' })
    expect(text.textContent).toBe('Borders are not official.')
  })

  it('opens on click, closes on a second click or Escape, and keeps the button focused', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <div (keydown)="parentKeys.push($event.key)">
          <geo-map-disclaimer (openChange)="changes.push($event)" />
        </div>
      `,
    })
    class Host {
      readonly changes: boolean[] = []
      readonly parentKeys: string[] = []
    }
    const map = fakeMap({ disclaimer: { text: 'Borders are not official.' } })
    const { fixture, element } = await render(Host, [map.provider])
    const disclaimer = element.querySelector('geo-map-disclaimer') as HTMLElement
    const button = disclaimer.querySelector('button')!
    const text = disclaimer.querySelector('span')!
    const press = async (key: string) => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await fixture.whenStable()
    }
    button.focus()
    button.click()
    await fixture.whenStable()
    expect(disclaimer.getAttribute('data-open')).toBe('')
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(text.hasAttribute('hidden')).toBe(false)
    expect(document.activeElement).toBe(button)
    expect(disclaimer.querySelector('button')).toBe(button) // one button in both states

    await press('Enter')
    expect(disclaimer.getAttribute('data-open')).toBe('')
    await press('Escape')
    expect(disclaimer.getAttribute('data-open')).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(text.getAttribute('hidden')).toBe('')
    // Escape that closed the text stops there; while closed, it reaches the page.
    expect(fixture.componentInstance.parentKeys).toEqual(['Enter'])
    await press('Escape')
    expect(fixture.componentInstance.parentKeys).toEqual(['Enter', 'Escape'])

    button.click()
    await fixture.whenStable()
    button.click()
    await fixture.whenStable()
    expect(disclaimer.getAttribute('data-open')).toBeNull()
    expect(fixture.componentInstance.changes).toEqual([true, false, true, false])
  })

  it('takes title, placement and defaultOpen from inputs, else from ui.disclaimer', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-disclaimer class="config" />
        <geo-map-disclaimer
          class="inputs"
          title="Terms"
          placement="bottom-left"
          [defaultOpen]="false"
        />
        <geo-map-disclaimer class="attribute" defaultOpen />
      `,
    })
    class Host {}
    const map = fakeMap({
      disclaimer: {
        text: 'Borders are not official.',
        title: 'Note',
        placement: 'bottom-right',
        defaultOpen: true,
      },
    })
    const { element } = await render(Host, [map.provider])
    const config = element.querySelector('.config') as HTMLElement
    expect(config.getAttribute('data-placement')).toBe('bottom-right')
    expect(config.getAttribute('data-open')).toBe('')
    expect(config.querySelector('button')?.textContent).toBe('Note')
    expect(config.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
    const inputs = element.querySelector('.inputs') as HTMLElement
    expect(inputs.getAttribute('data-placement')).toBe('bottom-left')
    expect(inputs.getAttribute('data-open')).toBeNull()
    expect(inputs.querySelector('button')?.textContent).toBe('Terms')
    expect(inputs.getAttribute('title')).toBeNull() // the heading, not a tooltip
    expect(element.querySelector('.attribute')?.getAttribute('data-open')).toBe('')
  })

  it('starts collapsed and titled "Disclaimer" with the default ui, even when the title is empty', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-disclaimer />`,
    })
    class Host {}
    const map = fakeMap({ disclaimer: { text: 'Text', title: '' } })
    const { element } = await render(Host, [map.provider])
    const disclaimer = element.querySelector('geo-map-disclaimer')!
    expect(disclaimer.getAttribute('data-open')).toBeNull()
    expect(disclaimer.querySelector('button')?.textContent).toBe('Disclaimer')
  })

  it('shows projected content (with links) instead of the config text, or without one', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-disclaimer placement="bottom-right"
          >Boundaries are not official. <a href="/terms">Terms of use</a></geo-map-disclaimer
        >
      `,
    })
    class Host {}
    for (const ui of [{}, { disclaimer: { text: 'Config text.' } }]) {
      TestBed.resetTestingModule()
      const map = fakeMap(ui)
      const { element } = await render(Host, [map.provider])
      const disclaimer = element.querySelector('geo-map-disclaimer') as HTMLElement
      expect(disclaimer.style.display).toBe('')
      expect(disclaimer.className).toBe('geo-disclaimer')
      expect(disclaimer.getAttribute('data-placement')).toBe('bottom-right')
      const text = disclaimer.querySelector('span.geo-disclaimer-text')!
      expect(text.textContent).toBe('Boundaries are not official. Terms of use')
      expect(text.querySelector('a')?.getAttribute('href')).toBe('/terms')
      expect(disclaimer.textContent).not.toContain('Config text.')
    }
  })

  it('follows [(open)] when controlled, and stays as the parent says', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-disclaimer class="two-way" [(open)]="open" />
        <geo-map-disclaimer class="fixed" [open]="true" (openChange)="asked.push($event)" />
      `,
    })
    class Host {
      readonly open = signal(true)
      readonly asked: boolean[] = []
    }
    const map = fakeMap({ disclaimer: { text: 'Borders are not official.' } })
    const { fixture, element } = await render(Host, [map.provider])
    const twoWay = element.querySelector('.two-way') as HTMLElement
    expect(twoWay.getAttribute('data-open')).toBe('')
    twoWay.querySelector('button')!.click()
    await fixture.whenStable()
    expect(fixture.componentInstance.open()).toBe(false)
    expect(twoWay.getAttribute('data-open')).toBeNull()
    fixture.componentInstance.open.set(true)
    await fixture.whenStable()
    expect(twoWay.getAttribute('data-open')).toBe('')
    twoWay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await fixture.whenStable()
    expect(fixture.componentInstance.open()).toBe(false)

    // A parent that doesn't take the change keeps it open.
    const fixed = element.querySelector('.fixed') as HTMLElement
    fixed.querySelector('button')!.click()
    await fixture.whenStable()
    expect(fixture.componentInstance.asked).toEqual([false])
    expect(fixed.getAttribute('data-open')).toBe('')
    expect(fixed.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
  })

  it('gives each disclaimer its own text id', async () => {
    @Component({
      imports: [MapDisclaimer],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-disclaimer /><geo-map-disclaimer id="own" />`,
    })
    class Host {}
    const map = fakeMap({ disclaimer: { text: 'Text' } })
    const { element } = await render(Host, [map.provider])
    const [first, second] = [...element.querySelectorAll('geo-map-disclaimer')]
    const firstId = first!.querySelector('span')!.id
    const secondId = second!.querySelector('span')!.id
    expect(firstId).not.toBe(secondId)
    expect(first!.querySelector('button')?.getAttribute('aria-controls')).toBe(firstId)
    expect(second!.id).toBe('own')
  })
})

describe('in the preset', () => {
  const presetConfig = (ui: MapUiConfig) => defineMapConfig({ ...config, ui })

  it('lays the disclaimer out after the tooltip and the error alert after the time controls', async () => {
    @Component({
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" #map="geoMap" (mapError)="errors.push($event)" />`,
    })
    class Host {
      protected readonly config = presetConfig({
        disclaimer: { text: 'Borders are not official.', placement: 'bottom-right' },
      })
      readonly errors: MapError[] = []
    }
    const { fixture, element } = await render(Host)
    const stage = element.querySelector('.geo-map-stage')!
    const order = [...stage.children].map((child) => child.tagName.toLowerCase())
    const position = (name: string) => order.indexOf(name)
    for (const [before, after] of [
      ['geo-map-tooltip', 'geo-map-disclaimer'],
      ['geo-map-disclaimer', 'geo-map-error-alert'],
      ['geo-map-error-alert', 'geo-map-attribution'],
    ] as const) {
      expect(position(before)).toBeGreaterThanOrEqual(0)
      expect(position(before)).toBeLessThan(position(after))
    }
    if (position('geo-map-status-chips') >= 0) {
      expect(position('geo-map-disclaimer')).toBeLessThan(position('geo-map-status-chips'))
    }
    if (position('geo-map-time-controls') >= 0) {
      expect(position('geo-map-time-controls')).toBeLessThan(position('geo-map-error-alert'))
    }

    const disclaimer = stage.querySelector('geo-map-disclaimer')!
    expect(disclaimer.getAttribute('data-placement')).toBe('bottom-right')
    expect(disclaimer.querySelector('button')?.getAttribute('aria-expanded')).toBe('false')
    expect(disclaimer.querySelector('span[hidden]')?.textContent).toBe('Borders are not official.')

    // A runtime error shows in the alert; dismissing it hides the alert again.
    const alert = stage.querySelector('geo-map-error-alert') as HTMLElement
    expect(alert.style.display).toBe('none')
    const map = fixture.debugElement.children[0]!.componentInstance as GeospatialMap
    map.actions.reportError(layerError)
    await fixture.whenStable()
    expect(fixture.componentInstance.errors).toEqual([layerError])
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.getAttribute('data-code')).toBe('SOURCE_LOAD_FAILED')
    expect(alert.getAttribute('data-placement')).toBe('top-left')
    expect(alert.textContent).toBe('Rivers could not be loaded.Dismiss')
    ;(alert.querySelector('button.geo-alert-dismiss') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(alert.style.display).toBe('none')
    expect(alert.getAttribute('role')).toBeNull()
  })

  it('leaves out what ui.*.enabled turns off, and hides the disclaimer without text', async () => {
    @Component({
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map class="off" [config]="off" />
        <geo-map class="empty" [config]="empty" />
      `,
    })
    class Host {
      protected readonly off = presetConfig({
        disclaimer: { enabled: false, text: 'Borders are not official.' },
        errorAlert: { enabled: false },
      })
      protected readonly empty = presetConfig({})
    }
    const { element } = await render(Host)
    const off = element.querySelector('.off')!
    expect(off.querySelector('geo-map-disclaimer')).toBeNull()
    expect(off.querySelector('geo-map-error-alert')).toBeNull()
    const empty = element.querySelector('.empty')!
    const disclaimer = empty.querySelector('geo-map-disclaimer') as HTMLElement
    expect(disclaimer.style.display).toBe('none')
    expect(empty.querySelector('.geo-disclaimer, .geo-disclaimer-toggle')).toBeNull()
    expect(empty.querySelector('geo-map-error-alert')).not.toBeNull()
  })

  it('shows the disclaimer of the ArcGIS scenario (default ui) bottom-left and collapsed', async () => {
    // apps/demo-shared createArcgisConfig's `ui.disclaimer`; that scenario isn't in the Angular
    // harness yet.
    const text =
      'Country borders or names do not necessarily reflect an official position. This map ' +
      'is for illustrative purposes and does not imply any opinion on the legal status of ' +
      'any country or territory or on the delimitation of frontiers or boundaries.'
    @Component({
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Host {
      protected readonly config = presetConfig({ disclaimer: { text } })
    }
    const { fixture, element } = await render(Host)
    const disclaimer = element.querySelector('.geo-map-stage > geo-map-disclaimer') as HTMLElement
    expect(disclaimer.className).toBe('geo-disclaimer')
    expect(disclaimer.getAttribute('data-placement')).toBe('bottom-left')
    expect(disclaimer.hasAttribute('data-open')).toBe(false)
    const button = disclaimer.querySelector('button')!
    expect(button.textContent).toBe('Disclaimer')
    const span = disclaimer.querySelector('span.geo-disclaimer-text')!
    expect(span.textContent).toBe(text)
    expect(span.getAttribute('hidden')).toBe('')
    button.click()
    await fixture.whenStable()
    expect(disclaimer.getAttribute('data-open')).toBe('')
    expect(span.hasAttribute('hidden')).toBe(false)
  })

  it('works inside geo-map-root with the real engine', async () => {
    @Component({
      imports: [MapRoot, MapDisclaimer, MapErrorAlert],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config">
          <geo-map-disclaimer>Custom text.</geo-map-disclaimer>
          <geo-map-error-alert placement="bottom-left" />
        </geo-map-root>
      `,
    })
    class Host {
      protected readonly config = config
    }
    const { element } = await render(Host)
    const disclaimer = element.querySelector('geo-map-disclaimer')!
    expect(disclaimer.className).toBe('geo-disclaimer')
    expect(disclaimer.querySelector('.geo-disclaimer-text')?.textContent).toBe('Custom text.')
    expect((element.querySelector('geo-map-error-alert') as HTMLElement).style.display).toBe('none')
  })
})
