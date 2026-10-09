import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { Provider, Type, WritableSignal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MAP_CONTEXT,
  MapActionEvent,
  MapBreadcrumbs,
  MapStatusChips,
  MapTargetClickEvent,
  defineMapConfig,
  type MapActions,
  type MapConfigInput,
  type MapContext,
  type MapRuntime,
  type MapStaticValue,
  type MapUiConfig,
  type ZoomTarget,
} from '../src/index'
import { resolveMapUi } from '../src/config/ui-profiles'
import { defaultMapIcons } from '../src/icons'
import { emptyDerived } from '../src/map-bridges'
import { defaultMapMessages } from '../src/messages'
import type { LayerStatus } from '../src/types'
import { controllers, resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

// The breadcrumbs and status chips: the same DOM as React's map-breadcrumbs.tsx and
// map-status-chips.tsx (checked against a react-dom/server render of the same cases), their
// inputs and config.ui defaults, the hidden breadcrumbs, consumer attributes, and their place in
// the <geo-map> preset.

const empty = { type: 'FeatureCollection' as const, features: [] }
const zoomTargets: ZoomTarget[] = [
  { id: 'world', label: 'World', bounds: [-180, -85, 180, 85] },
  { id: 'europe', label: 'Europe', bounds: [-25, 34, 45, 72], maxZoom: 5 },
  { id: 'bulgaria', label: 'Bulgaria', bounds: [22, 41, 29, 44] },
]
const path = ['world', 'europe', 'bulgaria']

const configInput = (ui: MapUiConfig = {}, layers = true): MapConfigInput => ({
  accessibility: { ariaLabel: 'Status map' },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  data: {
    layers: layers ? [{ id: 'index', title: 'Index', data: empty }] : [],
    zoomTargets,
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

const statuses = {
  loading: { layerId: 'a', loading: true },
  noData: { layerId: 'b', noData: true },
  scaleUnavailable: { layerId: 'c', scaleUnavailable: true },
} as unknown as Record<'loading' | 'noData' | 'scaleUnavailable', LayerStatus>
const allStatuses = [statuses.loading, statuses.noData, statuses.scaleUnavailable]

type FakeMap = {
  provider: Provider
  runtime: WritableSignal<MapRuntime>
  fitZoomTarget: ReturnType<typeof vi.fn<MapActions['fitZoomTarget']>>
  statuses(statuses: LayerStatus[]): void
}

/** A fake MAP_CONTEXT (see `fakeContext` in parts.test.ts) with live statuses. */
function fakeMap(options: { ui?: MapUiConfig; layers?: boolean; statuses?: LayerStatus[] } = {}) {
  const config = defineMapConfig(configInput(options.ui, options.layers ?? true))
  const runtime = signal<MapRuntime>({
    state: config.initialState,
    layers: config.data.layers,
    ...emptyDerived,
    statuses: options.statuses ?? [],
    times: [],
    error: null,
    openPanel: null,
    mapStatus: 'ready',
  })
  const fitZoomTarget = vi.fn<MapActions['fitZoomTarget']>()
  const actions = { fitZoomTarget } as unknown as MapActions
  const staticValue = signal<MapStaticValue>({
    mapId: 'fake',
    config,
    ui: resolveMapUi(options.ui),
    messages: defaultMapMessages,
    actions,
    icons: defaultMapIcons,
  })
  const context: MapContext = { staticValue, runtime, actions }
  const map: FakeMap = {
    provider: { provide: MAP_CONTEXT, useValue: context },
    runtime,
    fitZoomTarget,
    statuses: (next) => runtime.update((value) => ({ ...value, statuses: next })),
  }
  return map
}

async function render<T>(host: Type<T>, map?: FakeMap) {
  if (map) TestBed.configureTestingModule({ providers: [map.provider] })
  const fixture = TestBed.createComponent(host)
  await fixture.whenStable()
  const element = fixture.nativeElement as HTMLElement
  return {
    fixture,
    element,
    crumbs: () => element.querySelector('geo-map-breadcrumbs') as HTMLElement,
    chips: () => element.querySelector('geo-map-status-chips') as HTMLElement,
    stable: () => fixture.whenStable(),
  }
}

/** Every attribute of an element, without Angular's own (`_ngcontent`, `ng-version`, …). */
function attributes(element: Element): Record<string, string> {
  const result: Record<string, string> = {}
  for (const { name, value } of element.attributes)
    if (!/^(_ng|ng-)/.test(name) && name !== 'geoshapebutton' && name !== 'geoshapebadge')
      result[name] = value
  return result
}

/** The visible text and attributes of the children, for a comparison with React's markup. */
function shape(element: Element): unknown[] {
  return [...element.children].map((child) => ({
    tag: child.tagName.toLowerCase(),
    attributes: attributes(child),
    ...(child.children.length ? { children: shape(child) } : { text: child.textContent }),
  }))
}

const crumbButton = (label: string) => ({
  tag: 'button',
  attributes: {
    class: 'geo-shape-button geo-breadcrumb-button',
    'data-slot': 'button',
    type: 'button',
  },
  text: label,
})
const separator = {
  tag: 'span',
  attributes: { class: 'geo-breadcrumb-separator', 'aria-hidden': 'true' },
  text: '›',
}
const badge = (text: string) => ({
  tag: 'span',
  attributes: { class: 'geo-shape-badge', 'data-slot': 'badge' },
  text,
})

/** Class lists compare as sets: React writes `geo-shape-button geo-breadcrumb-button`. */
function normalized(items: unknown[]): unknown[] {
  return items.map((item) => {
    const value = item as { attributes: Record<string, string>; children?: unknown[] }
    const classes = value.attributes['class']
    return {
      ...value,
      attributes: {
        ...value.attributes,
        ...(classes ? { class: classes.split(' ').sort().join(' ') } : {}),
      },
      ...(value.children ? { children: normalized(value.children) } : {}),
    }
  })
}

beforeEach(() => resetControllers())
afterEach(() => vi.restoreAllMocks())

describe('MapBreadcrumbs', () => {
  @Component({
    imports: [MapBreadcrumbs],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<geo-map-breadcrumbs />`,
  })
  class Plain {}

  it("renders ui.breadcrumbs.targets as React's <nav>: a navigation landmark of buttons", async () => {
    const { crumbs } = await render(Plain, fakeMap({ ui: { breadcrumbs: { targets: path } } }))
    const nav = crumbs()
    expect(attributes(nav)).toEqual({
      class: 'geo-breadcrumbs',
      role: 'navigation',
      'data-slot': 'map-breadcrumbs',
      'data-placement': 'top-left',
      'aria-label': 'Geographic hierarchy',
    })
    expect(nav.style.display).toBe('')
    // React: <span class="geo-breadcrumb">[<span separator>›</span>]<button>Label</button></span>
    expect(normalized(shape(nav))).toEqual(
      normalized([
        { tag: 'span', attributes: { class: 'geo-breadcrumb' }, children: [crumbButton('World')] },
        {
          tag: 'span',
          attributes: { class: 'geo-breadcrumb' },
          children: [separator, crumbButton('Europe')],
        },
        {
          tag: 'span',
          attributes: { class: 'geo-breadcrumb' },
          children: [separator, crumbButton('Bulgaria')],
        },
      ]),
    )
    expect(nav.textContent).toBe('World›Europe›Bulgaria')
  })

  it('takes targets and placement inputs over the config, skipping unknown ids', async () => {
    @Component({
      imports: [MapBreadcrumbs],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-breadcrumbs placement="bottom-right" [targets]="targets()" />`,
    })
    class Host {
      readonly targets = signal(['europe', 'nowhere', 'bulgaria'])
    }
    const { fixture, crumbs, stable } = await render(
      Host,
      fakeMap({ ui: { breadcrumbs: { targets: path, placement: 'top-right' } } }),
    )
    expect(crumbs().getAttribute('data-placement')).toBe('bottom-right')
    const labels = () => [...crumbs().querySelectorAll('button')].map((item) => item.textContent)
    expect(labels()).toEqual(['Europe', 'Bulgaria'])
    expect(crumbs().querySelectorAll('.geo-breadcrumb-separator')).toHaveLength(1)
    fixture.componentInstance.targets.set(['world'])
    await stable()
    expect(labels()).toEqual(['World'])
    expect(crumbs().querySelector('.geo-breadcrumb-separator')).toBeNull()
  })

  it('defaults placement to ui.breadcrumbs.placement', async () => {
    const { crumbs } = await render(
      Plain,
      fakeMap({ ui: { breadcrumbs: { targets: path, placement: 'bottom-left' } } }),
    )
    expect(crumbs().getAttribute('data-placement')).toBe('bottom-left')
  })

  it("keeps the consumer's class, id, data-*, role and aria-label, as React's {...props}", async () => {
    @Component({
      imports: [MapBreadcrumbs],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-breadcrumbs
          class="brand"
          id="crumbs"
          data-testid="crumbs"
          role="toolbar"
          aria-label="Path"
          style="color: red"
        />
      `,
    })
    class Host {}
    const { crumbs } = await render(Host, fakeMap({ ui: { breadcrumbs: { targets: path } } }))
    const nav = crumbs()
    expect([...nav.classList].sort()).toEqual(['brand', 'geo-breadcrumbs'])
    expect(nav.id).toBe('crumbs')
    expect(nav.getAttribute('data-testid')).toBe('crumbs')
    expect(nav.getAttribute('role')).toBe('toolbar')
    expect(nav.getAttribute('aria-label')).toBe('Path')
    expect(nav.style.color).toBe('red')
  })

  it('is hidden, without classes, role, ARIA or data-*, while no target is on the path', async () => {
    @Component({
      imports: [MapBreadcrumbs],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-breadcrumbs
          class="brand"
          aria-label="Path"
          style="display: flex; color: red"
          [targets]="targets()"
        />
      `,
    })
    class Host {
      readonly targets = signal<string[] | undefined>(['nowhere'])
    }
    // React renders nothing; the host stays, empty and hidden.
    const { fixture, crumbs, stable } = await render(Host, fakeMap())
    const nav = crumbs()
    expect(nav.className).toBe('brand')
    expect(nav.getAttribute('role')).toBeNull()
    expect(nav.getAttribute('aria-label')).toBeNull()
    expect(nav.getAttribute('data-slot')).toBeNull()
    expect(nav.getAttribute('data-placement')).toBeNull()
    expect(nav.style.display).toBe('none')
    expect(nav.style.color).toBe('red')
    expect(nav.childElementCount).toBe(0)
    // `targets` undefined falls back to ui.breadcrumbs.targets, which is empty by default.
    fixture.componentInstance.targets.set(undefined)
    await stable()
    expect(nav.style.display).toBe('none')
    // Once a target is on the path, it shows with the consumer's style back.
    fixture.componentInstance.targets.set(['world'])
    await stable()
    expect([...nav.classList].sort()).toEqual(['brand', 'geo-breadcrumbs'])
    expect(nav.getAttribute('role')).toBe('navigation')
    expect(nav.getAttribute('aria-label')).toBe('Path')
    expect(nav.style.display).toBe('flex')
    expect(nav.style.color).toBe('red')
  })

  it('zooms to the target on click, after a cancellable targetClick', async () => {
    @Component({
      imports: [MapBreadcrumbs],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-breadcrumbs (targetClick)="clicked($event)" />`,
    })
    class Host {
      readonly seen: MapTargetClickEvent[] = []
      cancel: 'none' | 'event' | 'source' = 'none'
      clicked(event: MapTargetClickEvent) {
        this.seen.push(event)
        if (this.cancel === 'event') event.preventDefault()
        if (this.cancel === 'source') event.source.preventDefault()
      }
    }
    const map = fakeMap({ ui: { breadcrumbs: { targets: path } } })
    const { fixture, crumbs } = await render(Host, map)
    const host = fixture.componentInstance
    const button = (label: string) =>
      [...crumbs().querySelectorAll('button')].find((item) => item.textContent === label)!

    button('Europe').click()
    expect(map.fitZoomTarget).toHaveBeenCalledTimes(1)
    expect(map.fitZoomTarget).toHaveBeenCalledWith('europe')
    const event = host.seen[0]!
    expect(event).toBeInstanceOf(MapTargetClickEvent)
    expect(event).toBeInstanceOf(MapActionEvent)
    expect(event.action).toBe('fitZoomTarget')
    expect(event.target).toEqual(zoomTargets[1])
    expect(event.source).toBeInstanceOf(MouseEvent)
    expect(event.source.target).toBe(button('Europe'))
    expect(event.defaultPrevented).toBe(false)

    // preventDefault() on the event, or on the DOM click (React's event), skips the zoom.
    host.cancel = 'event'
    button('World').click()
    host.cancel = 'source'
    button('Bulgaria').click()
    expect(host.seen.map((item) => item.target.id)).toEqual(['europe', 'world', 'bulgaria'])
    expect(host.seen[1]!.defaultPrevented).toBe(true)
    expect(map.fitZoomTarget).toHaveBeenCalledTimes(1)
  })

  it('zooms without a targetClick listener', async () => {
    const map = fakeMap({ ui: { breadcrumbs: { targets: path } } })
    const { crumbs } = await render(Plain, map)
    ;(crumbs().querySelector('button') as HTMLButtonElement).click()
    expect(map.fitZoomTarget).toHaveBeenCalledWith('world')
  })
})

describe('MapStatusChips', () => {
  @Component({
    imports: [MapStatusChips],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<geo-map-status-chips />`,
  })
  class Plain {}

  it("renders React's <div> with a chip per status, in React's order", async () => {
    const map = fakeMap()
    const { chips, stable } = await render(Plain, map)
    const host = chips()
    expect(attributes(host)).toEqual({
      class: 'geo-status-chips',
      'data-slot': 'map-status-chips',
      'data-placement': 'bottom-right',
    })
    // Never hidden: an empty <div> while nothing is loading, as in React.
    expect(host.childElementCount).toBe(0)
    expect(host.style.display).toBe('')

    map.statuses([...allStatuses].reverse())
    await stable()
    expect(shape(host)).toEqual([
      badge('Loading'),
      badge('No data for time'),
      badge('unavailable at this scale'),
    ])

    map.statuses([statuses.noData])
    await stable()
    expect(shape(host)).toEqual([badge('No data for time')])
    map.statuses([])
    await stable()
    expect(host.childElementCount).toBe(0)
  })

  it('takes show* and placement inputs over ui.statusChips, and keeps consumer attributes', async () => {
    @Component({
      imports: [MapStatusChips],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-status-chips
          placement="top-left"
          [showLoading]="false"
          [showNoData]="showNoData()"
          class="brand"
          data-testid="chips"
          style="gap: 9px"
        />
      `,
    })
    class Host {
      readonly showNoData = signal<boolean | undefined>(false)
    }
    const { fixture, chips, stable } = await render(Host, fakeMap({ statuses: allStatuses }))
    const host = chips()
    expect([...host.classList].sort()).toEqual(['brand', 'geo-status-chips'])
    expect(host.getAttribute('data-placement')).toBe('top-left')
    expect(host.getAttribute('data-testid')).toBe('chips')
    expect(host.style.gap).toBe('9px')
    expect(shape(host)).toEqual([badge('unavailable at this scale')])
    // Back to undefined: the config's default (true) again.
    fixture.componentInstance.showNoData.set(undefined)
    await stable()
    expect(shape(host)).toEqual([badge('No data for time'), badge('unavailable at this scale')])
  })

  it('defaults placement and each show* to ui.statusChips; a bare attribute is true', async () => {
    @Component({
      imports: [MapStatusChips],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-status-chips class="defaults" />
        <geo-map-status-chips class="loading" showLoading />
        <geo-map-status-chips class="scale" showScaleUnavailable="true" [showNoData]="false" />
      `,
    })
    class Host {}
    const ui: MapUiConfig = {
      statusChips: { placement: 'top-right', showLoading: false, showScaleUnavailable: false },
    }
    const { element } = await render(Host, fakeMap({ ui, statuses: allStatuses }))
    const chipsOf = (name: string) => element.querySelector(`.${name}`) as HTMLElement
    expect(chipsOf('defaults').getAttribute('data-placement')).toBe('top-right')
    expect(shape(chipsOf('defaults'))).toEqual([badge('No data for time')])
    expect(shape(chipsOf('loading'))).toEqual([badge('Loading'), badge('No data for time')])
    expect(shape(chipsOf('scale'))).toEqual([badge('unavailable at this scale')])
  })

  it('replaces the Loading chip with [geoMapLoading], and shows [geoMapEmpty] without layers', async () => {
    @Component({
      imports: [MapStatusChips],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-status-chips>
          <span class="geo-shape-badge custom" geoMapLoading>Fetching</span>
          <p class="empty" geoMapEmpty>No layers</p>
          <b class="ignored">React ignores children</b>
        </geo-map-status-chips>
      `,
    })
    class Host {}
    const map = fakeMap({ layers: false, statuses: [statuses.loading] })
    const { chips, stable } = await render(Host, map)
    const host = chips()
    // React: <span class="geo-shape-badge custom">Fetching</span><p class="empty">No layers</p>
    expect(shape(host)).toEqual([
      {
        tag: 'span',
        attributes: { class: 'geo-shape-badge custom', geomaploading: '' },
        text: 'Fetching',
      },
      { tag: 'p', attributes: { class: 'empty', geomapempty: '' }, text: 'No layers' },
    ])
    expect(host.querySelector('.ignored')).toBeNull()

    // Not loading: the projected loading content goes, the empty content stays.
    map.statuses([])
    await stable()
    expect(host.querySelector('.custom')).toBeNull()
    expect(host.querySelector('.empty')?.textContent).toBe('No layers')
    // Loading again: back in place.
    map.statuses([statuses.loading, statuses.noData])
    await stable()
    expect([...host.children].map((child) => child.textContent)).toEqual([
      'Fetching',
      'No data for time',
      'No layers',
    ])
    // With layers, the empty content goes.
    map.runtime.update((value) => ({
      ...value,
      layers: defineMapConfig(configInput()).data.layers,
    }))
    await stable()
    expect(host.querySelector('.empty')).toBeNull()
  })

  it('shows nothing for [geoMapEmpty] while there are layers, and no fallback for it', async () => {
    @Component({
      imports: [MapStatusChips],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-status-chips class="with"><p geoMapEmpty>No layers</p></geo-map-status-chips>
        <geo-map-status-chips class="without" />
      `,
    })
    class Host {}
    const { element } = await render(Host, fakeMap())
    expect(element.querySelector('.with')!.childElementCount).toBe(0)
    expect(element.querySelector('.without')!.childElementCount).toBe(0)
  })
})

describe('in the <geo-map> preset', () => {
  @Component({
    imports: [GeospatialMap],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<geo-map [config]="config()" />`,
  })
  class Preset {
    readonly config = signal(defineMapConfig(configInput({ breadcrumbs: { targets: path } })))
  }

  it("draws the breadcrumbs after the settings and the chips after the tooltip, as React's layout", async () => {
    const { fixture, element, stable } = await render(Preset)
    const stage = element.querySelector('.geo-map-stage')!
    const parts = [...stage.children].map((child) => child.tagName.toLowerCase())
    const at = (name: string) => parts.indexOf(name)
    expect(at('geo-map-breadcrumbs')).toBe(at('geo-map-settings') + 1)
    expect(at('geo-map-layer-panel')).toBe(at('geo-map-breadcrumbs') + 1)
    expect(at('geo-map-status-chips')).toBeGreaterThan(at('geo-map-tooltip'))
    expect(at('geo-map-status-chips')).toBeLessThan(at('geo-map-time-controls'))
    expect(at('geo-map-status-chips')).toBeLessThan(at('geo-map-attribution'))

    // The live statuses reach the chips; the breadcrumbs zoom the map.
    const controller = controllers[0]!
    controller.ready()
    controller.options().onStatusChange?.([statuses.loading])
    await stable()
    const chips = element.querySelector('geo-map-status-chips')!
    expect(chips.textContent).toBe('Loading')
    const europe = [...element.querySelectorAll('.geo-breadcrumb-button')].find(
      (item) => item.textContent === 'Europe',
    ) as HTMLButtonElement
    europe.click()
    expect(controller.fit).toHaveBeenCalledWith(
      [-25, 34, 45, 72],
      expect.objectContaining({ maxZoom: 5 }),
    )

    // ui.*.enabled false: not drawn.
    fixture.componentInstance.config.set(
      defineMapConfig(
        configInput({
          breadcrumbs: { enabled: false, targets: path },
          statusChips: { enabled: false },
        }),
      ),
    )
    await stable()
    expect(element.querySelector('geo-map-breadcrumbs')).toBeNull()
    expect(element.querySelector('geo-map-status-chips')).toBeNull()
  })

  it('leaves both out with the grid profile', async () => {
    const { fixture, element, stable } = await render(Preset)
    fixture.componentInstance.config.set(
      defineMapConfig(configInput({ profile: 'grid', breadcrumbs: { targets: path } })),
    )
    await stable()
    expect(element.querySelector('geo-map-breadcrumbs')).toBeNull()
    expect(element.querySelector('geo-map-status-chips')).toBeNull()
  })
})
