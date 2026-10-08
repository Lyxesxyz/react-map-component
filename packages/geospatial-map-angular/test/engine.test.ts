import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MapConfigErrorTemplate,
  MapLayersButton,
  MapRoot,
  arcgisBasemap,
  defineMapConfig,
  type MapConfig,
  type MapConfigInput,
  type MapError,
  type MapPanelId,
  type MapState,
} from '../src/index'
import * as arcgis from '../src/core/arcgis'
import * as validation from '../src/config/validate'
import type { LayerStatus } from '../src/types'
import { controllers, resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)
vi.mock('../src/config/validate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/validate')>()
  return { ...actual, validateMapConfig: vi.fn(actual.validateMapConfig) }
})
vi.mock('../src/core/arcgis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/arcgis')>()
  return { ...actual, loadArcgisService: vi.fn(actual.loadArcgisService) }
})

/** A config written inline: a new object with the same content every time. */
const inlineConfig = (): MapConfigInput => ({
  accessibility: { ariaLabel: 'Engine map' },
  initialState: { view: { center: [10, 20], zoom: 2 } },
  data: { layers: [] },
})

const element = (fixture: { nativeElement: unknown }) =>
  (fixture.nativeElement as HTMLElement).querySelector('geo-map-root') as HTMLElement

beforeEach(() => {
  resetControllers()
  vi.mocked(validation.validateMapConfig).mockClear()
})
afterEach(() => vi.restoreAllMocks())

@Component({
  imports: [MapRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map-root [config]="config()" (stateChange)="proposed.push($event)" />`,
})
class OwnedHost {
  readonly config = signal(inlineConfig())
  readonly proposed: MapState[] = []
}

describe('the engine', () => {
  it('keeps an inline config rebuilt with the same content: no new validation, same view', async () => {
    const fixture = TestBed.createComponent(OwnedHost)
    await fixture.whenStable()
    expect(validation.validateMapConfig).toHaveBeenCalledTimes(1)
    expect(controllers).toHaveLength(1)
    const controller = controllers[0]!
    controller.ready()
    controller.move({ zoom: 5 })
    await fixture.whenStable()
    expect(fixture.componentInstance.proposed.at(-1)?.view.zoom).toBe(5)
    const updates = controller.update.mock.calls.length

    for (let count = 0; count < 3; count++) {
      fixture.componentInstance.config.set(inlineConfig())
      await fixture.whenStable()
    }
    expect(validation.validateMapConfig).toHaveBeenCalledTimes(1)
    expect(controllers).toHaveLength(1)
    expect(controller.update.mock.calls.length).toBe(updates)
    expect(controller.options().view.zoom).toBe(5)

    // New content is validated and committed, and the owned state starts over from it.
    fixture.componentInstance.config.set({
      ...inlineConfig(),
      initialState: { view: { center: [10, 20], zoom: 3 } },
    })
    await fixture.whenStable()
    expect(validation.validateMapConfig).toHaveBeenCalledTimes(2)
    expect(controller.update.mock.lastCall?.[0].view.zoom).toBe(3)
  })

  it('exposes loading, then ready, and the map id on the map element', async () => {
    const fixture = TestBed.createComponent(OwnedHost)
    fixture.componentInstance.config.set({ ...inlineConfig(), id: 'main map' })
    await fixture.whenStable()
    const root = element(fixture)
    expect(root.getAttribute('data-map-id')).toBe('main-map')
    expect(root.getAttribute('data-status')).toBe('loading')
    expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe('Map loading')
    controllers[0]!.ready()
    await fixture.whenStable()
    expect(root.getAttribute('data-status')).toBe('ready')
    expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe('Map ready')
    expect(root.hasAttribute('data-layer-errors')).toBe(false)
  })

  it('sets the map back when a host controlling state refuses a proposal', async () => {
    const config = defineMapConfig(inlineConfig())
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root
          [config]="config"
          [state]="state()"
          (stateChangeDetails)="propose($event.state, $event.change.domain)"
        />
      `,
    })
    class ControlledHost {
      protected readonly config = config
      readonly state = signal<MapState>(config.initialState)
      accept = false
      readonly domains: string[] = []
      propose(next: MapState, domain: string) {
        this.domains.push(domain)
        if (this.accept) this.state.set(next)
      }
    }
    const fixture = TestBed.createComponent(ControlledHost)
    await fixture.whenStable()
    const controller = controllers[0]!
    const host = fixture.componentInstance

    controller.move({ zoom: 6 })
    await fixture.whenStable()
    expect(host.domains).toEqual(['view'])
    const refused = controller.update.mock.lastCall!
    expect(refused[1]).toBe(true)
    expect(refused[0].view.zoom).toBe(2)
    expect(controller.getView().zoom).toBe(2)

    host.accept = true
    controller.move({ zoom: 4 })
    await fixture.whenStable()
    const accepted = controller.update.mock.lastCall!
    expect(accepted[1]).toBe(false)
    expect(accepted[0].view.zoom).toBe(4)
    expect(host.state().view.zoom).toBe(4)
  })

  it('keeps the open panel itself, or follows the host that controls it', async () => {
    const config = defineMapConfig(inlineConfig())
    @Component({
      imports: [MapRoot, MapLayersButton],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" (openPanelChange)="requests.push($event)">
          <button geoMapLayers class="owned"></button>
        </geo-map-root>
        <geo-map-root
          [config]="config"
          [openPanel]="panel()"
          (openPanelChange)="requests.push($event)"
        >
          <button geoMapLayers class="controlled"></button>
        </geo-map-root>
      `,
    })
    class PanelHost {
      protected readonly config = config
      readonly panel = signal<MapPanelId | null>(null)
      readonly requests: (MapPanelId | null)[] = []
    }
    const fixture = TestBed.createComponent(PanelHost)
    await fixture.whenStable()
    const root = fixture.nativeElement as HTMLElement
    const owned = root.querySelector('.owned') as HTMLButtonElement
    const controlled = root.querySelector('.controlled') as HTMLButtonElement
    expect(owned.getAttribute('aria-expanded')).toBe('false')

    owned.click()
    await fixture.whenStable()
    expect(owned.getAttribute('aria-expanded')).toBe('true')
    expect(owned.classList.contains('geo-control-active')).toBe(true)
    expect(owned.hasAttribute('data-active')).toBe(true)
    expect(fixture.componentInstance.requests).toEqual(['layers'])

    controlled.click()
    await fixture.whenStable()
    expect(fixture.componentInstance.requests).toEqual(['layers', 'layers'])
    expect(controlled.getAttribute('aria-expanded')).toBe('false')
    fixture.componentInstance.panel.set('layers')
    await fixture.whenStable()
    expect(controlled.getAttribute('aria-expanded')).toBe('true')
  })

  it('reports a configuration error once per distinct problem', async () => {
    const invalid = (view: Record<string, unknown>) =>
      ({ ...inlineConfig(), initialState: { view } }) as unknown as MapConfigInput
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config()" (mapError)="errors.push($event)" />`,
    })
    class ErrorHost {
      readonly config = signal(invalid({ zoom: 'near' }))
      readonly errors: MapError[] = []
    }
    const fixture = TestBed.createComponent(ErrorHost)
    await fixture.whenStable()
    const host = fixture.componentInstance
    expect(host.errors.map((error) => error.code)).toEqual(['CONFIG_INVALID'])
    host.config.set(invalid({ zoom: 'near' }))
    await fixture.whenStable()
    host.config.set(invalid({ zoom: 'near' }))
    await fixture.whenStable()
    expect(host.errors).toHaveLength(1)
    host.config.set(invalid({ center: 'here' }))
    await fixture.whenStable()
    expect(host.errors).toHaveLength(2)
    expect(controllers).toHaveLength(0)
  })

  it('renders the accessible error panel for an invalid config, or the custom template', async () => {
    const invalid = {
      ...defineMapConfig(inlineConfig()),
      unsupported: true,
    } as unknown as MapConfig
    @Component({
      imports: [MapRoot, MapConfigErrorTemplate],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" class="plain" />
        <geo-map-root [config]="config" class="custom">
          <ng-template geoMapConfigError let-error let-actions="actions">
            <p class="custom-error">{{ error.code }}: {{ actions ? 'actions' : 'none' }}</p>
          </ng-template>
        </geo-map-root>
      `,
    })
    class InvalidHost {
      protected readonly config = invalid
    }
    const fixture = TestBed.createComponent(InvalidHost)
    await fixture.whenStable()
    const root = fixture.nativeElement as HTMLElement
    const plain = root.querySelector('.plain') as HTMLElement
    expect(plain.getAttribute('data-status')).toBe('error')
    expect(plain.hasAttribute('data-density')).toBe(false)
    expect(plain.querySelector('.geo-map-viewport')).toBeNull()
    const alert = plain.querySelector('[role="alert"]')!
    expect(alert.getAttribute('data-slot')).toBe('map-config-error')
    expect(alert.querySelector('h2.geo-config-error-title')?.textContent).toBe(
      'Map configuration is invalid',
    )
    expect(alert.querySelector('.geo-config-error-message')?.textContent).toMatch(
      /^Map configuration is invalid: /,
    )
    const custom = root.querySelector('.custom [role="alert"]')!
    expect(custom.querySelector('.custom-error')?.textContent).toBe('CONFIG_INVALID: actions')
    expect(custom.querySelector('h2')).toBeNull()
  })

  it('gives its actions through exportAs', async () => {
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" #map="geoMap" />
        <button type="button" (click)="map.actions.zoom(2)">Closer</button>
      `,
    })
    class ActionsHost {
      protected readonly config = inlineConfig()
    }
    const fixture = TestBed.createComponent(ActionsHost)
    await fixture.whenStable()
    ;(fixture.nativeElement as HTMLElement).querySelector('button')!.click()
    expect(controllers[0]!.setView).toHaveBeenCalledWith({ zoom: 4 }, 'api')
  })

  it('runs the OpenLayers hook once per controller and undoes it on destroy', async () => {
    const undo = vi.fn()
    const hook = vi.fn(() => undo)
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config" [onOpenLayersMap]="hook" />`,
    })
    class HookHost {
      protected readonly config = inlineConfig()
      protected readonly hook = hook
    }
    const fixture = TestBed.createComponent(HookHost)
    await fixture.whenStable()
    expect(hook).toHaveBeenCalledWith({ fake: 'ol-map' })
    fixture.destroy()
    expect(undo).toHaveBeenCalledTimes(1)
    expect(controllers[0]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('recreates the controller only for interactions or projection, never for hooks or loaders', async () => {
    const firstHook = vi.fn()
    const secondHook = vi.fn()
    const loader = async () => ({ type: 'FeatureCollection' as const, features: [] })
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root
        [config]="config()"
        [onOpenLayersMap]="hook()"
        [loadGeoJson]="loader()"
      />`,
    })
    class RecreateHost {
      readonly config = signal<MapConfigInput>(inlineConfig())
      readonly hook = signal(firstHook)
      readonly loader = signal(loader)
    }
    const fixture = TestBed.createComponent(RecreateHost)
    await fixture.whenStable()
    const first = controllers[0]!
    // Created, then committed once.
    expect(first.update).toHaveBeenCalledTimes(1)
    const host = fixture.componentInstance
    host.hook.set(secondHook)
    host.loader.set(async () => loader())
    host.config.set({ ...inlineConfig(), messages: { mapReady: 'Ready' } })
    await fixture.whenStable()
    expect(controllers).toHaveLength(1)
    host.config.set({ ...inlineConfig(), view: { interactions: { doubleClickZoom: false } } })
    await fixture.whenStable()
    expect(controllers).toHaveLength(2)
    expect(first.destroy).toHaveBeenCalledTimes(1)
    expect(firstHook).toHaveBeenCalledTimes(1)
    expect(secondHook).toHaveBeenCalledTimes(1)
  })

  it('keeps the same layers array while the map pans', async () => {
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config" />`,
    })
    class PanHost {
      protected readonly config: MapConfigInput = {
        ...inlineConfig(),
        data: {
          layers: [
            {
              id: 'a',
              title: 'A',
              kind: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            },
          ],
        },
      }
    }
    const fixture = TestBed.createComponent(PanHost)
    await fixture.whenStable()
    const controller = controllers[0]!
    controller.ready()
    await fixture.whenStable()
    const before = controller.update.mock.lastCall![0].layers
    controller.move({ zoom: 5 })
    await fixture.whenStable()
    expect(controller.update.mock.lastCall![0].view.zoom).toBe(5)
    expect(controller.update.mock.lastCall![0].layers).toBe(before)
  })

  it('reports a failing OpenLayers hook as HOOK_FAILED and keeps the map', async () => {
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root
        [config]="config"
        [onOpenLayersMap]="hook"
        (mapError)="errors.push($event)"
      />`,
    })
    class FailingHookHost {
      protected readonly config = inlineConfig()
      protected readonly hook = () => {
        throw new Error('no drawing tools')
      }
      readonly errors: MapError[] = []
    }
    const fixture = TestBed.createComponent(FailingHookHost)
    await fixture.whenStable()
    expect(fixture.componentInstance.errors.map((error) => error.code)).toEqual(['HOOK_FAILED'])
    expect(controllers).toHaveLength(1)
  })

  it('waits for ArcGIS services, then starts without the layers that could not be read', async () => {
    let fail: (cause: Error) => void = () => undefined
    vi.mocked(arcgis.loadArcgisService).mockImplementationOnce(
      () => new Promise((_resolve, reject) => (fail = reject)),
    )
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config" (mapError)="errors.push($event)" />`,
    })
    class ArcgisHost {
      protected readonly config: MapConfigInput = {
        ...inlineConfig(),
        data: {
          layers: [],
          basemaps: [
            arcgisBasemap({ url: 'https://example.org/rest/services/x/VectorTileServer' }),
          ],
        },
      }
      readonly errors: MapError[] = []
    }
    const fixture = TestBed.createComponent(ArcgisHost)
    await fixture.whenStable()
    expect(element(fixture).getAttribute('data-status')).toBe('loading')
    expect(controllers).toHaveLength(0)
    fail(new Error('service down'))
    await new Promise((resolve) => setTimeout(resolve))
    await fixture.whenStable()
    expect(fixture.componentInstance.errors.map((error) => error.code)).toEqual([
      'SOURCE_LOAD_FAILED',
    ])
    expect(controllers).toHaveLength(1)
    expect(controllers[0]!.options().basemaps[0]?.layers).toEqual([])
  })

  it('fits the world before the controller starts when the config sets no zoom', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)
    @Component({
      imports: [MapRoot],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-root [config]="config" />`,
    })
    class FitHost {
      protected readonly config: MapConfigInput = {
        accessibility: { ariaLabel: 'Fitted map' },
        data: { layers: [] },
      }
    }
    const fixture = TestBed.createComponent(FitHost)
    await fixture.whenStable()
    expect(controllers).toHaveLength(1)
    const view = controllers[0]!.options().view
    expect(view.zoom).toBeGreaterThan(1)
    expect(controllers[0]!.update).toHaveBeenCalledTimes(1)
    expect(controllers[0]!.update.mock.lastCall![0].view).toEqual(view)
  })

  it('shows loading while a layer loads and counts layer errors on the map element', async () => {
    const fixture = TestBed.createComponent(OwnedHost)
    await fixture.whenStable()
    const controller = controllers[0]!
    controller.ready()
    const statuses = [
      { layerId: 'a', loading: true },
      { layerId: 'b', loading: false, error: { code: 'SOURCE_LOAD_FAILED' } },
    ] as unknown as LayerStatus[]
    controller.options().onStatusChange?.(statuses)
    await fixture.whenStable()
    const root = element(fixture)
    expect(root.getAttribute('data-status')).toBe('loading')
    expect(root.getAttribute('data-layer-errors')).toBe('1')
  })
})
