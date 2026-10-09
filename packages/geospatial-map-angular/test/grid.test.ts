import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { ComponentFixture } from '@angular/core/testing'
import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MapControlTemplate,
  MapGrid,
  MapPopupTemplate,
  MapTooltipTemplate,
  type FeatureEvent,
  type MapConfigInput,
  type MapGridConfig,
  type MapGridEvent,
  type MapGridState,
  type MapGridStateChangeEvent,
  type MapIcons,
  type MapLayerInput,
} from '../src/index'
import { controllers, fakeData, resetControllers } from './fake-controller'
import type { FakeController } from './fake-controller'

// <geo-map-grid>, the port of React's MapGrid: each cell is a real <geo-map> (its engine runs, the
// OpenLayers controller is the fake one). The server render is in grid-ssr.test.ts.
vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

const regions: MapLayerInput = {
  id: 'regions',
  title: 'Regions',
  data: { type: 'FeatureCollection', features: [] },
  featureIdField: 'iso',
}

const shared: MapConfigInput = {
  accessibility: { ariaLabel: 'Grid map' },
  initialState: { view: { center: [10, 20], zoom: 1 } },
  data: {
    layers: [regions],
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

/** Two maps, Left and Right (which starts at zoom 3), sharing `shared`. */
const twoMaps = (extra: Partial<MapGridConfig> = {}): MapGridConfig => ({
  shared,
  maps: [
    { id: 'left', title: 'Left' },
    { id: 'right', title: 'Right', initialState: { view: { zoom: 3 } } },
  ],
  ...extra,
})

const france: FeatureEvent = {
  mapId: 'left',
  layerId: 'regions',
  featureId: 'FR',
  coordinate: [2, 46],
  properties: { name: 'France', population: 68 },
}

@Component({
  imports: [MapGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map-grid
      [config]="config()"
      [cellClassName]="cellClassName()"
      [icons]="icons()"
      (stateChange)="states.push($event)"
      (stateChangeDetails)="details.push($event)"
      (ready)="record('ready', $event)"
      (viewChange)="record('viewChange', $event)"
      (featureHover)="record('featureHover', $event)"
      (featureSelect)="record('featureSelect', $event)"
      (layerStateChange)="record('layerStateChange', $event)"
      (timeChange)="record('timeChange', $event)"
      (mapError)="record('mapError', $event)"
      (statusChange)="record('statusChange', $event)"
      (metric)="record('metric', $event)"
    />
  `,
})
class GridHost {
  readonly config = signal<MapGridConfig>(twoMaps({ sync: { view: true } }))
  readonly cellClassName = signal<string | undefined>(undefined)
  readonly icons = signal<Partial<MapIcons> | undefined>(undefined)
  readonly states: MapGridState[] = []
  readonly details: MapGridStateChangeEvent[] = []
  readonly events: [string, MapGridEvent<unknown>][] = []

  record(name: string, event: MapGridEvent<unknown>): void {
    this.events.push([name, event])
  }
}

async function render<T>(component: new () => T): Promise<ComponentFixture<T>> {
  const fixture = TestBed.createComponent(component)
  await fixture.whenStable()
  return fixture
}

const gridOf = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('geo-map-grid') as HTMLElement
const cellsOf = (fixture: ComponentFixture<unknown>) => [
  ...gridOf(fixture).querySelectorAll<HTMLElement>(':scope > article'),
]
/** The cell of the map titled `title`. */
const cellOf = (fixture: ComponentFixture<unknown>, title: string) =>
  cellsOf(fixture).find((cell) => cell.querySelector('h2')?.textContent === title)!
/** A button by its text or its accessible name. */
const buttonOf = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find(
    (button) => button.textContent === name || button.getAttribute('aria-label') === name,
  )
/** The controller of the map `id`: the latest one (a cell shown again creates a new one). */
const controllerOf = (id: string): FakeController =>
  controllers.filter((controller) => controller.options().id === id).at(-1)!
const zoomOf = (state: MapGridState | undefined, id: string) => state?.maps[id]?.view.zoom

async function click(fixture: ComponentFixture<unknown>, button: HTMLButtonElement | undefined) {
  expect(button).toBeDefined()
  button!.click()
  await fixture.whenStable()
}

beforeEach(() => resetControllers())

describe('MapGrid', () => {
  it("renders React's grid: a cell per map with its heading, focus button and map", async () => {
    const fixture = await render(GridHost)
    const grid = gridOf(fixture)
    expect(grid.getAttribute('data-slot')).toBe('map-grid')
    expect(grid.getAttribute('class')).toBe('geo-map-grid')
    expect(grid.hasAttribute('data-focused')).toBe(false)
    expect(grid.hasAttribute('role')).toBe(false)
    // The layout defaults, as React's style.
    expect(grid.style.getPropertyValue('--geo-grid-columns')).toBe('3')
    expect(grid.style.getPropertyValue('--geo-grid-tablet-columns')).toBe('2')
    expect(grid.style.getPropertyValue('--geo-grid-mobile-columns')).toBe('1')
    expect(grid.style.getPropertyValue('--geo-grid-gap')).toBe('12px')
    expect(grid.style.getPropertyValue('--geo-grid-cell-height')).toBe('340px')

    const cells = cellsOf(fixture)
    expect(cells).toHaveLength(2)
    for (const [index, title] of ['Left', 'Right'].entries()) {
      const cell = cells[index]!
      expect(cell.getAttribute('data-slot')).toBe('map-grid-cell')
      expect(cell.getAttribute('class')).toBe('geo-map-grid-cell')
      expect([...cell.children].map((child) => child.tagName.toLowerCase())).toEqual([
        'header',
        'geo-map',
      ])
      const header = cell.querySelector(':scope > header')!
      expect(header.getAttribute('class')).toBe('geo-map-grid-cell-header')
      expect([...header.children].map((child) => child.outerHTML)).toEqual([
        `<h2 class="geo-map-grid-cell-title">${title}</h2>`,
        expect.stringMatching(/^<button [^>]*>Focus \w+<\/button>$/),
      ])
      const focus = header.querySelector('button')!
      expect(focus.textContent).toBe(`Focus ${title}`)
      expect(focus.getAttribute('type')).toBe('button')
      expect(focus.getAttribute('data-slot')).toBe('button')
      expect(focus.getAttribute('class')).toBe('geo-shape-button')
      const map = cell.querySelector('geo-map')!
      expect(map.getAttribute('data-slot')).toBe('map')
      expect(map.classList.contains('geo-map-root')).toBe(true)
      expect(map.getAttribute('data-map-id')).toBe(title.toLowerCase())
    }

    // Each map: the shared config, with the cell's id, title and starting state.
    expect(controllers).toHaveLength(2)
    expect(controllerOf('left').options().ariaLabel).toBe('Grid map: Left')
    expect(controllerOf('right').options().ariaLabel).toBe('Grid map: Right')
    expect(controllerOf('left').options().view).toMatchObject({ center: [10, 20], zoom: 1 })
    expect(controllerOf('right').options().view).toMatchObject({ center: [10, 20], zoom: 3 })
    // Unfocused cells use the grid profile: zoom buttons, no layer panel button.
    for (const cell of cells) {
      expect(buttonOf(cell, 'Zoom in')).toBeDefined()
      expect(buttonOf(cell, 'Layers')).toBeUndefined()
    }
  })

  it('takes the layout, focus and cell class from the config and cellClassName', async () => {
    const fixture = TestBed.createComponent(GridHost)
    fixture.componentInstance.config.set(
      twoMaps({
        layout: { columns: 2, tabletColumns: 1, mobileColumns: 3, gapPx: 4, cellHeightPx: 200 },
        focus: { enabled: false },
      }),
    )
    fixture.componentInstance.cellClassName.set('cell brand-cell')
    await fixture.whenStable()
    const grid = gridOf(fixture)
    expect(grid.style.getPropertyValue('--geo-grid-columns')).toBe('2')
    expect(grid.style.getPropertyValue('--geo-grid-tablet-columns')).toBe('1')
    expect(grid.style.getPropertyValue('--geo-grid-mobile-columns')).toBe('3')
    expect(grid.style.getPropertyValue('--geo-grid-gap')).toBe('4px')
    expect(grid.style.getPropertyValue('--geo-grid-cell-height')).toBe('200px')
    for (const cell of cellsOf(fixture)) {
      expect([...cell.classList].sort()).toEqual(['brand-cell', 'cell', 'geo-map-grid-cell'])
      // No focus button: the header has the title only.
      expect(cell.querySelector('header')!.children).toHaveLength(1)
    }
  })

  it('focuses one map with its full UI, reports it, and returns to the grid', async () => {
    const fixture = await render(GridHost)
    const host = fixture.componentInstance
    controllerOf('right').move({ zoom: 4 })
    await fixture.whenStable()

    await click(fixture, buttonOf(gridOf(fixture), 'Focus Right'))
    const grid = gridOf(fixture)
    expect(cellsOf(fixture)).toHaveLength(1)
    expect(grid.getAttribute('class')).toBe('geo-map-grid geo-map-grid-focused')
    expect(grid.getAttribute('data-focused')).toBe('')
    const cell = cellOf(fixture, 'Right')
    expect(buttonOf(cell, 'Return to grid')).toBeDefined()
    // The focused map uses shared.ui as written (the full profile), and keeps its state.
    expect(buttonOf(cell, 'Layers')).toBeDefined()
    expect(controllerOf('right').options().view.zoom).toBe(4)
    // Focus is part of the grid state; the report has no map id and no change.
    expect(host.states.at(-1)?.focusedMapId).toBe('right')
    expect(host.details.at(-1)).toEqual({ state: host.states.at(-1), mapId: null })
    expect('change' in host.details.at(-1)!).toBe(false)

    await click(fixture, buttonOf(cell, 'Return to grid'))
    expect(cellsOf(fixture)).toHaveLength(2)
    expect(grid.getAttribute('class')).toBe('geo-map-grid')
    expect(grid.hasAttribute('data-focused')).toBe(false)
    expect(host.states.at(-1)?.focusedMapId).toBeNull()
    expect(zoomOf(host.states.at(-1), 'right')).toBe(4)
    expect(buttonOf(cellOf(fixture, 'Left'), 'Focus Left')).toBeDefined()
  })

  it('takes its text from shared.messages', async () => {
    const fixture = TestBed.createComponent(GridHost)
    fixture.componentInstance.config.set(
      twoMaps({
        shared: { ...shared, messages: { focusMap: 'Fokus: {title}', returnToGrid: 'Zurück' } },
      }),
    )
    await fixture.whenStable()
    await click(fixture, buttonOf(gridOf(fixture), 'Fokus: Left'))
    expect(buttonOf(gridOf(fixture), 'Zurück')).toBeDefined()
  })

  it('moves the other maps with a view change, and a map following the grid is not echoed', async () => {
    const fixture = await render(GridHost)
    const host = fixture.componentInstance
    const right = controllerOf('right')

    controllerOf('left').move({ zoom: 5 })
    await fixture.whenStable()
    expect(host.states).toHaveLength(1)
    expect(zoomOf(host.states[0], 'left')).toBe(5)
    expect(zoomOf(host.states[0], 'right')).toBe(5)
    expect(host.details[0]).toEqual({
      state: host.states[0],
      mapId: 'left',
      change: { domain: 'view', origin: 'user' },
    })
    // The right map is given its new state.
    expect(right.update.mock.lastCall?.[0].view.zoom).toBe(5)

    // The right map reports where it now is: nothing new, nothing to report.
    right.setView({ zoom: 5 }, 'state')
    await fixture.whenStable()
    expect(host.states).toHaveLength(1)
    // A change the right map made to follow the grid is kept, and not passed on.
    right.setView({ zoom: 5.5 }, 'state')
    await fixture.whenStable()
    expect(host.states).toHaveLength(2)
    expect(host.details[1]?.mapId).toBe('right')
    expect(zoomOf(host.states[1], 'right')).toBe(5.5)
    expect(zoomOf(host.states[1], 'left')).toBe(5)

    // An API change is passed on, like a user's.
    right.setView({ zoom: 2 }, 'api')
    await fixture.whenStable()
    expect(zoomOf(host.states.at(-1), 'left')).toBe(2)
  })

  it('synchronises only the domains config.sync names', async () => {
    const play = {
      view: (controller: FakeController) => controller.move({ zoom: 6 }),
      layers: (controller: FakeController) => {
        vi.spyOn(controller, 'getLayerStates').mockReturnValue({
          regions: { visible: false, opacity: 0.5, order: 0 },
        })
        controller.options().onLayerStateChange?.({
          layerId: 'regions',
          visible: false,
          opacity: 0.5,
          order: 0,
          origin: 'user',
        })
      },
      time: (controller: FakeController) =>
        controller.options().onTimeChange?.({ time: '2021', origin: 'user' }),
      selection: (controller: FakeController) => controller.click(france),
    }
    const read = {
      view: (state: MapGridState, id: string) => state.maps[id]?.view.zoom,
      layers: (state: MapGridState, id: string) => state.maps[id]?.layers['regions'],
      time: (state: MapGridState, id: string) => state.maps[id]?.time,
      selection: (state: MapGridState, id: string) => state.maps[id]?.selection,
    }
    for (const domain of ['view', 'layers', 'time', 'selection'] as const) {
      for (const synchronised of [true, false]) {
        resetControllers()
        const fixture = TestBed.createComponent(GridHost)
        fixture.componentInstance.config.set(twoMaps({ sync: { [domain]: synchronised } }))
        await fixture.whenStable()
        const before = fixture.componentInstance.states.at(-1)
        play[domain](controllerOf('left'))
        await fixture.whenStable()
        const after = fixture.componentInstance.states.at(-1)!
        expect(after, domain).not.toBe(before)
        expect(fixture.componentInstance.details.at(-1)?.change?.domain).toBe(domain)
        const left = read[domain](after, 'left')
        const right = read[domain](after, 'right')
        expect(left, domain).toBeDefined()
        if (synchronised) expect(right, domain).toEqual(left)
        else expect(right, `${domain} not synchronised`).not.toEqual(left)
        fixture.destroy()
      }
    }
  })

  it('keeps the maps for a config rebuilt with the same content, and starts them over for new content', async () => {
    const fixture = await render(GridHost)
    const host = fixture.componentInstance
    controllerOf('left').move({ zoom: 5 })
    await fixture.whenStable()
    expect(controllers).toHaveLength(2)

    host.config.set(twoMaps({ sync: { view: true } }))
    await fixture.whenStable()
    expect(controllers).toHaveLength(2)
    expect(controllerOf('left').getView().zoom).toBe(5)
    expect(controllerOf('right').options().view.zoom).toBe(5)

    // A new map: the cells follow the list, and each map starts over from its config.
    host.config.set({
      ...twoMaps({ sync: { view: true } }),
      maps: [...twoMaps().maps, { id: 'third', title: 'Third' }],
    })
    await fixture.whenStable()
    expect(cellsOf(fixture).map((cell) => cell.querySelector('h2')?.textContent)).toEqual([
      'Left',
      'Right',
      'Third',
    ])
    expect(controllerOf('left').options().view.zoom).toBe(1)
    expect(controllerOf('third').options().ariaLabel).toBe('Grid map: Third')

    host.config.set(twoMaps({ sync: { view: true } }))
    await fixture.whenStable()
    expect(cellsOf(fixture)).toHaveLength(2)
    expect(controllerOf('third').destroy).toHaveBeenCalled()
  })

  it('follows a host that controls [(state)], and stays as the host says when it refuses', async () => {
    @Component({
      imports: [MapGrid],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-grid [config]="config" [state]="state()" (stateChange)="propose($event)" />
      `,
    })
    class ControlledHost {
      protected readonly config = twoMaps({ sync: { view: true } })
      // No map states yet: each map starts from its config.
      readonly state = signal<MapGridState>({ maps: {}, focusedMapId: null })
      accept = false
      readonly proposed: MapGridState[] = []
      propose(next: MapGridState) {
        this.proposed.push(next)
        if (this.accept) this.state.set(next)
      }
    }
    const fixture = await render(ControlledHost)
    const host = fixture.componentInstance
    expect(controllerOf('right').options().view.zoom).toBe(3)

    await click(fixture, buttonOf(gridOf(fixture), 'Focus Left'))
    expect(host.proposed.at(-1)?.focusedMapId).toBe('left')
    expect(cellsOf(fixture)).toHaveLength(2)

    // A refused view change: the map goes back to the host's state.
    controllerOf('left').move({ zoom: 6 })
    await fixture.whenStable()
    expect(zoomOf(host.proposed.at(-1), 'right')).toBe(6)
    expect(controllerOf('left').update.mock.lastCall?.[1]).toBe(true)
    expect(controllerOf('left').getView().zoom).toBe(1)

    host.accept = true
    controllerOf('left').move({ zoom: 7 })
    await fixture.whenStable()
    expect(host.state().maps['left']?.view.zoom).toBe(7)
    expect(controllerOf('right').options().view.zoom).toBe(7)
    await click(fixture, buttonOf(gridOf(fixture), 'Focus Left'))
    expect(cellsOf(fixture)).toHaveLength(1)

    // The host sets the state itself: the grid follows.
    host.state.set({ ...host.state(), focusedMapId: null })
    await fixture.whenStable()
    expect(cellsOf(fixture)).toHaveLength(2)
  })

  it("gives each map's events with its id", async () => {
    const fixture = await render(GridHost)
    const host = fixture.componentInstance
    const left = controllerOf('left')
    const right = controllerOf('right')
    const error = { code: 'SOURCE_LOAD_FAILED', message: 'Failed', recoverable: true } as const
    const status = { id: 'regions', loading: false }
    const metric = { name: 'ready', durationMs: 12 } as const

    right.ready()
    left.move({ zoom: 2 })
    right.hover(france)
    left.click(france)
    vi.spyOn(right, 'getLayerStates').mockReturnValue({
      regions: { visible: false, opacity: 1, order: 0 },
    })
    const layerEvent = { layerId: 'regions', visible: false, opacity: 1, order: 0 } as const
    right.options().onLayerStateChange?.({ ...layerEvent, origin: 'user' })
    left.options().onTimeChange?.({ time: '2020', origin: 'user' })
    right.options().onError?.(error)
    left.options().onStatusChange?.([status])
    right.options().onMetric?.(metric)
    await fixture.whenStable()

    expect(host.events).toEqual([
      ['ready', { mapId: 'right', event: right.getView() }],
      ['viewChange', { mapId: 'left', event: { view: left.getView(), origin: 'user' } }],
      ['featureHover', { mapId: 'right', event: france }],
      ['featureSelect', { mapId: 'left', event: france }],
      ['layerStateChange', { mapId: 'right', event: { ...layerEvent, origin: 'user' } }],
      ['timeChange', { mapId: 'left', event: { time: '2020', origin: 'user' } }],
      ['mapError', { mapId: 'right', event: error }],
      ['statusChange', { mapId: 'left', event: [status] }],
      ['metric', { mapId: 'right', event: metric }],
    ])
  })

  it("gives every map the grid's popup, tooltip and custom-control templates", async () => {
    @Component({
      imports: [MapGrid, MapPopupTemplate, MapTooltipTemplate, MapControlTemplate],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-grid [config]="config">
          <ng-template geoMapPopup let-feature let-close="close" let-state="state">
            <strong class="popup-name"
              >{{ feature.properties['name'] }} {{ state.view.zoom }}</strong
            >
            <button type="button" class="popup-done" (click)="close()">Done</button>
          </ng-template>
          <ng-template geoMapTooltip let-feature>
            <em class="tip">{{ feature.featureId }}</em>
          </ng-template>
          <ng-template geoMapControl="custom:share" let-state let-actions="actions">
            <button type="button" class="share" (click)="actions.fit([0, 0, 1, 1])">
              Share {{ state.view.zoom }}
            </button>
          </ng-template>
        </geo-map-grid>
      `,
    })
    class TemplatesHost {
      protected readonly config = twoMaps({
        shared: {
          ...shared,
          ui: {
            controls: { groups: [{ id: 'zoom', controls: ['zoom-in', 'custom:share'] }] },
            popup: { enabled: true },
          },
        },
      })
    }
    fakeData.features = { FR: france }
    const fixture = await render(TemplatesHost)
    const left = cellOf(fixture, 'Left')
    const right = cellOf(fixture, 'Right')

    // The custom control, in each map, with that map's state and actions.
    expect(left.querySelector('.share')?.textContent?.trim()).toBe('Share 1')
    expect(right.querySelector('.share')?.textContent?.trim()).toBe('Share 3')
    ;(right.querySelector('.share') as HTMLButtonElement).click()
    expect(controllerOf('right').fit).toHaveBeenCalled()
    expect(controllerOf('left').fit).not.toHaveBeenCalled()

    // The tooltip of the hovered map.
    controllerOf('right').hover(france)
    await fixture.whenStable()
    expect(right.querySelector('geo-map-tooltip .tip')?.textContent).toBe('FR')
    expect(left.querySelector('.tip')).toBeNull()

    // The popup of the selected feature, which can close itself.
    controllerOf('left').click(france)
    await fixture.whenStable()
    const popup = left.querySelector('geo-map-popup') as HTMLElement
    expect(popup.getAttribute('role')).toBe('dialog')
    expect(popup.querySelector('.popup-name')?.textContent).toBe('France 1')
    expect(popup.querySelector('.geo-popup-fields')).toBeNull()
    ;(popup.querySelector('.popup-done') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(popup.style.display).toBe('none')
    expect(popup.querySelector('.popup-name')).toBeNull()
  })

  it('shows the default popup and tooltip without templates', async () => {
    fakeData.features = { FR: france }
    const fixture = TestBed.createComponent(GridHost)
    fixture.componentInstance.config.set(
      twoMaps({ shared: { ...shared, ui: { popup: { enabled: true } } } }),
    )
    await fixture.whenStable()
    controllerOf('left').click(france)
    controllerOf('left').hover({ ...france, featureId: 'DE', properties: { name: 'Germany' } })
    await fixture.whenStable()
    const left = cellOf(fixture, 'Left')
    expect(left.querySelector('geo-map-popup .geo-popup-title')?.textContent).toBe('France')
    expect(left.querySelector('geo-map-popup .geo-popup-fields')).not.toBeNull()
    expect(left.querySelector('geo-map-tooltip')?.textContent).toBe('Germany')
  })

  it("gives every map the grid's icons", async () => {
    const fixture = TestBed.createComponent(GridHost)
    fixture.componentInstance.icons.set({ ZoomIn: [['circle', { cx: '12', cy: '12', r: '4' }]] })
    await fixture.whenStable()
    for (const cell of cellsOf(fixture)) {
      const zoomIn = buttonOf(cell, 'Zoom in')!
      expect(zoomIn.querySelector('svg circle')?.getAttribute('r')).toBe('4')
      expect(buttonOf(cell, 'Zoom out')!.querySelector('svg circle')).toBeNull()
    }
  })

  it('shows an alert instead of the maps with more than six', async () => {
    const seven = twoMaps({
      maps: Array.from({ length: 7 }, (_, index) => ({ id: `m${index}`, title: `M${index}` })),
    })
    const fixture = TestBed.createComponent(GridHost)
    fixture.componentInstance.config.set(seven)
    await fixture.whenStable()
    const grid = gridOf(fixture)
    expect(grid.getAttribute('class')).toBe('geo-config-error')
    expect(grid.getAttribute('data-slot')).toBe('map-grid-error')
    expect(grid.getAttribute('role')).toBe('alert')
    expect(grid.hasAttribute('data-focused')).toBe(false)
    expect(grid.textContent).toBe('MapGrid supports at most six maps.')
    // A block like React's <div>, without the grid's variables.
    expect(grid.style.display).toBe('block')
    expect(grid.style.getPropertyValue('--geo-grid-columns')).toBe('')
    expect(grid.querySelector('article, geo-map')).toBeNull()
    expect(controllers).toHaveLength(0)

    fixture.componentInstance.config.set({
      ...seven,
      shared: { ...shared, messages: { tooManyGridMaps: 'Six maps at most.' } },
    })
    await fixture.whenStable()
    expect(grid.textContent).toBe('Six maps at most.')

    // Six maps: the grid again.
    fixture.componentInstance.config.set({ ...seven, maps: seven.maps.slice(0, 6) })
    await fixture.whenStable()
    expect(grid.getAttribute('class')).toBe('geo-map-grid')
    expect(grid.getAttribute('data-slot')).toBe('map-grid')
    expect(grid.hasAttribute('role')).toBe(false)
    expect(grid.style.display).toBe('')
    expect(cellsOf(fixture)).toHaveLength(6)
  })

  it("keeps the consumer's class, id, data-*, role and style; a static style wins", async () => {
    @Component({
      imports: [MapGrid],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-grid
          [config]="config()"
          class="brand-grid"
          id="regions-grid"
          data-test="grid"
          role="region"
          aria-label="Regions"
          style="--geo-grid-gap: 2px; margin: 4px"
        />
      `,
    })
    class ConsumerHost {
      readonly config = signal(twoMaps())
    }
    const fixture = await render(ConsumerHost)
    const grid = gridOf(fixture)
    expect(grid.classList.contains('brand-grid')).toBe(true)
    expect(grid.classList.contains('geo-map-grid')).toBe(true)
    expect(grid.id).toBe('regions-grid')
    expect(grid.getAttribute('data-test')).toBe('grid')
    expect(grid.getAttribute('role')).toBe('region')
    expect(grid.getAttribute('aria-label')).toBe('Regions')
    expect(grid.style.getPropertyValue('--geo-grid-gap')).toBe('2px')
    expect(grid.style.getPropertyValue('--geo-grid-columns')).toBe('3')
    expect(grid.style.margin).toBe('4px')

    // Focused, and as the error: the consumer's class stays, but the error is always an alert,
    // as React's error <div> (otherwise screen readers would not announce it).
    await click(fixture, buttonOf(grid, 'Focus Left'))
    expect(grid.classList.contains('brand-grid')).toBe(true)
    expect(grid.classList.contains('geo-map-grid-focused')).toBe(true)
    const seven = twoMaps({
      maps: Array.from({ length: 7 }, (_, index) => ({ id: `m${index}`, title: 'M' })),
    })
    fixture.componentInstance.config.set(seven)
    await fixture.whenStable()
    expect(grid.classList.contains('brand-grid')).toBe(true)
    expect(grid.classList.contains('geo-config-error')).toBe(true)
    expect(grid.getAttribute('role')).toBe('alert')
    expect(grid.style.margin).toBe('4px')

    // Back to the grid: the consumer's role again.
    fixture.componentInstance.config.set({ ...seven, maps: seven.maps.slice(0, 6) })
    await fixture.whenStable()
    expect(grid.getAttribute('role')).toBe('region')
  })
})
