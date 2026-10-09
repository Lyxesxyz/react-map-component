import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { Provider, Type, WritableSignal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MAP_CONTEXT,
  MapTimeControls,
  defineMapConfig,
  type MapActions,
  type MapConfigInput,
  type MapContext,
  type MapIcons,
  type MapRuntime,
  type MapStaticValue,
  type MapUiConfig,
  type TimeChangeEvent,
} from '../src/index'
import { resolveMapUi } from '../src/config/ui-profiles'
import { mapError } from '../src/core/errors'
import { defaultMapIcons } from '../src/icons'
import { emptyDerived } from '../src/map-bridges'
import { defaultMapMessages } from '../src/messages'
import type { LayerStatus } from '../src/types'
import { controllers, resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

const empty = { type: 'FeatureCollection' as const, features: [] }
const years = ['2021', '2022', '2023', '2024']

/** A required time layer, an optional one, and a layer without time. */
const configInput = (
  ui: MapUiConfig = {},
  reducedMotion?: 'respect' | 'ignore',
): MapConfigInput => ({
  accessibility: { ariaLabel: 'Time map', ...(reducedMotion ? { reducedMotion } : {}) },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  data: {
    layers: [
      { id: 'index', title: 'Index', data: empty, required: true, time: { values: years } },
      { id: 'raster', title: 'Raster', data: empty, time: { values: years } },
      { id: 'borders', title: 'Borders', data: empty },
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

/** Icons with recognisable paths, to tell play and pause apart. */
const icons: MapIcons = {
  ...defaultMapIcons,
  Play: [['path', { d: 'M-play' }]],
  Pause: [['path', { d: 'M-pause' }]],
}

type FakeMap = {
  provider: Provider
  runtime: WritableSignal<MapRuntime>
  setTime: ReturnType<typeof vi.fn<MapActions['setTime']>>
  statuses(statuses: LayerStatus[]): void
}

/** A fake MAP_CONTEXT whose `setTime` moves the map to that time, as the engine does. */
function fakeMap(
  options: {
    ui?: MapUiConfig
    times?: string[]
    time?: string | null
    reducedMotion?: 'respect' | 'ignore'
  } = {},
): FakeMap {
  const config = defineMapConfig(configInput(options.ui, options.reducedMotion))
  const runtime = signal<MapRuntime>({
    state: { ...config.initialState, time: options.time ?? null },
    layers: config.data.layers,
    ...emptyDerived,
    times: options.times ?? years,
    error: null,
    openPanel: null,
    mapStatus: 'ready',
  })
  const setTime = vi.fn<MapActions['setTime']>((time) =>
    runtime.update((map) => ({ ...map, state: { ...map.state, time } })),
  )
  const actions = { setTime } as unknown as MapActions
  const staticValue = signal<MapStaticValue>({
    mapId: 'fake',
    config,
    ui: resolveMapUi(options.ui),
    messages: defaultMapMessages,
    actions,
    icons,
  })
  const context: MapContext = { staticValue, runtime, actions }
  return {
    provider: { provide: MAP_CONTEXT, useValue: context },
    runtime,
    setTime,
    statuses: (statuses) => runtime.update((map) => ({ ...map, statuses })),
  }
}

/** Renders `host` inside `map` and returns its time controls. */
async function render(host: Type<unknown>, map: FakeMap) {
  TestBed.configureTestingModule({ providers: [map.provider] })
  const fixture = TestBed.createComponent(host)
  await fixture.whenStable()
  const part = (fixture.nativeElement as HTMLElement).querySelector(
    'geo-map-time-controls',
  ) as HTMLElement
  const button = (name: string) =>
    [...part.querySelectorAll('button')].find(
      (item) => item.getAttribute('aria-label') === name,
    ) as HTMLButtonElement
  return {
    fixture,
    part,
    button,
    slider: () => part.querySelector('input[type="range"]') as HTMLInputElement,
    select: () => part.querySelector('select') as HTMLSelectElement,
    value: () => part.querySelector('output')?.textContent,
    stable: () => fixture.whenStable(),
  }
}

@Component({
  imports: [MapTimeControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map-time-controls />`,
})
class Plain {}

@Component({
  imports: [MapTimeControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map-time-controls [loop]="false" />`,
})
class NoLoop {}

/** Makes `prefers-reduced-motion: reduce` match (or not). */
function preferReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: matches && query.includes('reduce'), media: query })),
  )
}

beforeEach(() => {
  resetControllers()
  // Playback timers are fake; change detection keeps its real timers.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  preferReducedMotion(false)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MapTimeControls', () => {
  it('is hidden, with no classes or ARIA, while no layer has time values', async () => {
    @Component({
      imports: [MapTimeControls],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-time-controls class="brand-time" style="color: red" />`,
    })
    class Host {}
    const map = fakeMap({ times: [] })
    const { part, stable } = await render(Host, map)
    expect(part.className).toBe('brand-time')
    expect(part.style.display).toBe('none')
    expect(part.style.color).toBe('red')
    for (const name of ['role', 'data-slot', 'data-placement', 'data-state', 'aria-label'])
      expect(part.hasAttribute(name)).toBe(false)
    expect(part.children).toHaveLength(0)

    map.runtime.update((runtime) => ({ ...runtime, times: years }))
    await stable()
    expect([...part.classList].sort()).toEqual(['brand-time', 'geo-time-controls'])
    expect(part.style.display).toBe('')
    expect(part.style.color).toBe('red')
    expect(part.getAttribute('data-slot')).toBe('map-time-controls')
  })

  it("renders React's markup: a labelled group of buttons, slider, speed select and value", async () => {
    const { part, slider, select, value } = await render(Plain, fakeMap())
    expect(part.className).toBe('geo-time-controls')
    expect(part.getAttribute('role')).toBe('group')
    expect(part.getAttribute('data-slot')).toBe('map-time-controls')
    expect(part.getAttribute('data-placement')).toBe('bottom-left')
    expect(part.getAttribute('data-state')).toBe('paused')
    expect(part.getAttribute('aria-label')).toBe('Time controls')
    expect(part.getAttribute('style')).toBeNull()

    // The grid's items, in React's order (the select's wrapper element has `display: contents`).
    expect([...part.children].map((child) => child.localName)).toEqual([
      'button',
      'button',
      'button',
      'input',
      'button',
      'geo-shape-select',
      'output',
    ])
    const buttons = [...part.querySelectorAll('button')]
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Play time animation',
      'Replay time animation',
      'Previous time',
      'Next time',
    ])
    for (const button of buttons) {
      expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'))
      expect(button.getAttribute('type')).toBe('button')
      expect(button.getAttribute('data-slot')).toBe('icon-button')
      expect([...button.classList].sort()).toEqual(['geo-shape-button', 'geo-shape-icon-button'])
      expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
      expect(button.disabled).toBe(false) // looping by default: no end is disabled
    }
    expect(buttons[0]!.querySelector('path')?.getAttribute('d')).toBe('M-play')

    const range = slider()
    expect(range.getAttribute('aria-label')).toBe('Selected time')
    expect(range.getAttribute('data-slot')).toBe('slider')
    expect(range.className).toBe('geo-shape-slider')
    expect(range.getAttribute('min')).toBe('0')
    expect(range.getAttribute('max')).toBe('3')
    expect(range.getAttribute('step')).toBe('1')
    expect(range.value).toBe('0')
    expect(range.style.getPropertyValue('--geo-slider-fill')).toBe('0%')

    const speed = select()
    expect(speed.parentElement?.className).toBe('geo-shape-select-wrap')
    expect(speed.className).toBe('geo-shape-select')
    expect(speed.getAttribute('data-slot')).toBe('select')
    expect(speed.getAttribute('aria-label')).toBe('Playback speed')
    // `ui.time.speedsMs` (500, 900, 1500) as frames per second, `defaultSpeedMs` selected.
    expect([...speed.options].map((option) => [option.value, option.textContent])).toEqual([
      ['500', '2.0×'],
      ['900', '1.1×'],
      ['1500', '0.7×'],
    ])
    expect(speed.value).toBe('900')

    const output = part.querySelector('output')!
    expect(output.className).toBe('geo-time-value')
    expect(output.getAttribute('aria-live')).toBe('off')
    expect(value()).toBe('Time 2021')
  })

  it('shows the time of the map state, or the first frame for a time it lacks', async () => {
    const map = fakeMap({ time: '2023' })
    const { slider, value, stable } = await render(Plain, map)
    expect(slider().value).toBe('2')
    expect(slider().style.getPropertyValue('--geo-slider-fill')).toBe(`${(2 / 3) * 100}%`)
    expect(value()).toBe('Time 2023')
    map.runtime.update((runtime) => ({ ...runtime, state: { ...runtime.state, time: '1999' } }))
    await stable()
    expect(slider().value).toBe('0')
    expect(value()).toBe('Time 2021')
  })

  it('steps through the frames, wrapping around when looping, and selects one with the slider', async () => {
    const map = fakeMap()
    const { button, slider, value, stable } = await render(Plain, map)
    button('Previous time').click()
    expect(map.setTime).toHaveBeenLastCalledWith('2024')
    await stable()
    button('Next time').click()
    expect(map.setTime).toHaveBeenLastCalledWith('2021')
    await stable()
    button('Next time').click()
    expect(map.setTime).toHaveBeenLastCalledWith('2022')
    await stable()
    const range = slider()
    range.value = '2'
    range.dispatchEvent(new Event('input'))
    expect(map.setTime).toHaveBeenLastCalledWith('2023')
    await stable()
    expect(value()).toBe('Time 2023')
  })

  it('disables previous on the first frame and next on the last without looping', async () => {
    const map = fakeMap()
    const { button, stable } = await render(NoLoop, map)
    expect(button('Previous time').disabled).toBe(true)
    expect(button('Next time').disabled).toBe(false)
    map.runtime.update((runtime) => ({ ...runtime, state: { ...runtime.state, time: '2024' } }))
    await stable()
    expect(button('Previous time').disabled).toBe(false)
    expect(button('Next time').disabled).toBe(true)
  })

  it('plays one frame every speedMs, at the speed chosen, until paused', async () => {
    const map = fakeMap()
    const { part, button, select, stable } = await render(Plain, map)
    button('Play time animation').click()
    await stable()
    expect(part.getAttribute('data-state')).toBe('playing')
    const pause = button('Pause time animation')
    expect(pause.getAttribute('title')).toBe('Pause time animation')
    expect(pause.querySelector('path')?.getAttribute('d')).toBe('M-pause')

    vi.advanceTimersByTime(899)
    expect(map.setTime).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(map.setTime).toHaveBeenLastCalledWith('2022')
    await stable()

    const speed = select()
    speed.value = '500'
    speed.dispatchEvent(new Event('change'))
    await stable()
    expect(speed.value).toBe('500')
    vi.advanceTimersByTime(500)
    expect(map.setTime).toHaveBeenLastCalledWith('2023')
    await stable()

    button('Pause time animation').click()
    await stable()
    expect(part.getAttribute('data-state')).toBe('paused')
    vi.advanceTimersByTime(5000)
    expect(map.setTime).toHaveBeenCalledTimes(2)
  })

  it('goes on from the first frame when looping, and stops on the last one otherwise', async () => {
    const looping = fakeMap({ time: '2024', ui: { time: { autoplay: true } } })
    const first = await render(Plain, looping)
    expect(first.part.getAttribute('data-state')).toBe('playing')
    vi.advanceTimersByTime(900)
    expect(looping.setTime).toHaveBeenLastCalledWith('2021')
    first.fixture.destroy()
    TestBed.resetTestingModule()

    const once = fakeMap({ time: '2023', ui: { time: { autoplay: true, loop: false } } })
    const { part, button, stable } = await render(Plain, once)
    expect(part.getAttribute('data-state')).toBe('playing')
    vi.advanceTimersByTime(900)
    expect(once.setTime).toHaveBeenLastCalledWith('2024')
    await stable()
    expect(part.getAttribute('data-state')).toBe('paused')
    vi.advanceTimersByTime(5000)
    expect(once.setTime).toHaveBeenCalledTimes(1)
    // Play on the last frame without looping stays paused (React's render-time check).
    button('Play time animation').click()
    await stable()
    expect(part.getAttribute('data-state')).toBe('paused')
  })

  it('replays from the first frame', async () => {
    const map = fakeMap({ time: '2024', ui: { time: { loop: false } } })
    const { part, button, stable } = await render(Plain, map)
    button('Replay time animation').click()
    expect(map.setTime).toHaveBeenLastCalledWith('2021')
    await stable()
    expect(part.getAttribute('data-state')).toBe('playing')
    vi.advanceTimersByTime(900)
    expect(map.setTime).toHaveBeenLastCalledWith('2022')
  })

  it('autoplays, unless the user prefers reduced motion and the map respects it', async () => {
    preferReducedMotion(true)
    const map = fakeMap({ ui: { time: { autoplay: true } } })
    const { part, button, stable } = await render(Plain, map)
    expect(part.getAttribute('data-state')).toBe('paused')
    vi.advanceTimersByTime(5000)
    expect(map.setTime).not.toHaveBeenCalled()
    // Play and replay don't start playback either.
    button('Play time animation').click()
    await stable()
    expect(part.getAttribute('data-state')).toBe('paused')
    button('Replay time animation').click()
    await stable()
    expect(map.setTime).toHaveBeenCalledExactlyOnceWith('2021')
    expect(part.getAttribute('data-state')).toBe('paused')
  })

  it("plays with reduced motion when the map ignores it (accessibility.reducedMotion: 'ignore')", async () => {
    preferReducedMotion(true)
    const map = fakeMap({ ui: { time: { autoplay: true } }, reducedMotion: 'ignore' })
    const { part } = await render(Plain, map)
    expect(part.getAttribute('data-state')).toBe('playing')
    vi.advanceTimersByTime(900)
    expect(map.setTime).toHaveBeenLastCalledWith('2022')
  })

  it('waits while a time layer loads a frame', async () => {
    const map = fakeMap({ ui: { time: { autoplay: true } } })
    map.statuses([{ id: 'raster', loading: true }])
    const { part, value, stable } = await render(Plain, map)
    expect(part.getAttribute('data-state')).toBe('playing')
    expect(value()).toBe('Time 2021 · loading frame')
    vi.advanceTimersByTime(5000)
    expect(map.setTime).not.toHaveBeenCalled()

    // A layer without time doesn't hold playback up.
    map.statuses([{ id: 'borders', loading: true }])
    await stable()
    expect(value()).toBe('Time 2021')
    vi.advanceTimersByTime(900)
    expect(map.setTime).toHaveBeenLastCalledWith('2022')
  })

  it('pauses when a required time layer fails to load a frame', async () => {
    const map = fakeMap({ ui: { time: { autoplay: true } } })
    const { part, button, value, stable } = await render(Plain, map)
    const failed = mapError('SOURCE_LOAD_FAILED', 'Frame failed', true, 'index')

    // An optional layer that fails doesn't stop playback.
    map.statuses([{ id: 'raster', loading: false, error: failed }])
    await stable()
    expect(part.getAttribute('data-state')).toBe('playing')
    expect(value()).toBe('Time 2021')

    map.statuses([{ id: 'index', loading: false, error: failed }])
    await stable()
    expect(part.getAttribute('data-state')).toBe('paused')
    expect(button('Play time animation').disabled).toBe(true)
    expect(value()).toBe('Time 2021 · frame unavailable; playback paused')
    vi.advanceTimersByTime(5000)
    expect(map.setTime).not.toHaveBeenCalled()

    // Once the frame loads, playback stays paused until the user plays again.
    map.statuses([])
    await stable()
    expect(part.getAttribute('data-state')).toBe('paused')
    expect(button('Play time animation').disabled).toBe(false)
  })

  it("goes on past a failed frame with frameFailurePolicy: 'skip'", async () => {
    const map = fakeMap({ ui: { time: { autoplay: true, frameFailurePolicy: 'skip' } } })
    map.statuses([
      { id: 'index', loading: false, error: mapError('SOURCE_LOAD_FAILED', 'x', true, 'index') },
    ])
    const { part, button, value } = await render(Plain, map)
    expect(part.getAttribute('data-state')).toBe('playing')
    expect(button('Pause time animation').disabled).toBe(false)
    expect(value()).toBe('Time 2021 · frame unavailable; playback paused')
    vi.advanceTimersByTime(900)
    expect(map.setTime).toHaveBeenLastCalledWith('2022')
  })

  it('takes every default from config.ui.time', async () => {
    const map = fakeMap({
      time: '2024',
      ui: {
        time: {
          placement: 'top-right',
          speedsMs: [250, 1000],
          defaultSpeedMs: 1000,
          autoplay: false,
          loop: false,
          frameFailurePolicy: 'skip',
        },
      },
    })
    map.statuses([
      { id: 'index', loading: false, error: mapError('SOURCE_LOAD_FAILED', 'x', true, 'index') },
    ])
    const { part, button, select } = await render(Plain, map)
    expect(part.getAttribute('data-placement')).toBe('top-right')
    expect(part.getAttribute('data-state')).toBe('paused')
    expect([...select().options].map((option) => option.textContent)).toEqual(['4.0×', '1.0×'])
    expect(select().value).toBe('1000')
    expect(button('Next time').disabled).toBe(true) // no looping
    expect(button('Play time animation').disabled).toBe(false) // skip
  })

  it('lets its inputs replace the config defaults', async () => {
    @Component({
      imports: [MapTimeControls],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-time-controls
          placement="top-left"
          [speedsMs]="[400, 800]"
          [defaultSpeedMs]="625"
          [loop]="false"
          autoplay
          frameFailurePolicy="pause"
        />
      `,
    })
    class Host {}
    const map = fakeMap({
      ui: {
        time: {
          placement: 'bottom-right',
          speedsMs: [500, 900],
          defaultSpeedMs: 900,
          autoplay: false,
          loop: true,
          frameFailurePolicy: 'skip',
        },
      },
    })
    const { part, button, select, stable } = await render(Host, map)
    expect(part.getAttribute('data-placement')).toBe('top-left')
    expect(part.getAttribute('data-state')).toBe('playing')
    // `defaultSpeedMs` joins the speeds when it isn't one of them.
    expect([...select().options].map((option) => [option.value, option.textContent])).toEqual([
      ['400', '2.5×'],
      ['625', '1.6×'],
      ['800', '1.3×'],
    ])
    expect(select().value).toBe('625')
    expect(button('Previous time').disabled).toBe(true)
    vi.advanceTimersByTime(625)
    expect(map.setTime).toHaveBeenLastCalledWith('2022')

    map.statuses([
      { id: 'index', loading: false, error: mapError('SOURCE_LOAD_FAILED', 'x', true, 'index') },
    ])
    await stable()
    expect(part.getAttribute('data-state')).toBe('paused')
    expect(button('Play time animation').disabled).toBe(true)
  })

  it("lets the consumer's static role, aria-label, class, style and attributes win", async () => {
    @Component({
      imports: [MapTimeControls],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-time-controls
          role="toolbar"
          aria-label="Years"
          class="brand-time"
          id="years"
          data-testid="time"
          style="bottom: 4px"
        />
      `,
    })
    class Host {}
    const { part } = await render(Host, fakeMap())
    expect(part.getAttribute('role')).toBe('toolbar')
    expect(part.getAttribute('aria-label')).toBe('Years')
    expect([...part.classList].sort()).toEqual(['brand-time', 'geo-time-controls'])
    expect(part.id).toBe('years')
    expect(part.getAttribute('data-testid')).toBe('time')
    expect(part.style.bottom).toBe('4px')
  })

  it('explains when it is used outside a map', () => {
    expect(() => TestBed.createComponent(Plain)).toThrow(/inside <geo-map-root> or <geo-map>/)
  })
})

describe('MapTimeControls in <geo-map>', () => {
  @Component({
    imports: [GeospatialMap],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<geo-map [config]="config()" (timeChange)="changes.push($event)" />`,
  })
  class PresetHost {
    readonly config = signal(configInput())
    readonly changes: TimeChangeEvent[] = []
  }

  async function renderPreset(config: MapConfigInput) {
    const fixture = TestBed.createComponent(PresetHost)
    fixture.componentInstance.config.set(config)
    await fixture.whenStable()
    const root = fixture.nativeElement as HTMLElement
    // The fake controller moves to the time it is given, like OpenLayers.
    const controller = controllers[0]
    controller?.setTime.mockImplementation((time, origin = 'user') =>
      controller.options().onTimeChange?.({ time, origin }),
    )
    return { fixture, root, controller }
  }

  it("renders after the tooltip and before the attribution, as in React's layout", async () => {
    const { fixture, root, controller } = await renderPreset(configInput())
    const stage = root.querySelector('.geo-map-stage')!
    const parts = [...stage.children].map((child) => child.localName)
    const at = parts.indexOf('geo-map-time-controls')
    expect(at).toBeGreaterThan(parts.indexOf('geo-map-tooltip'))
    expect(at).toBeLessThan(parts.indexOf('geo-map-attribution'))
    const part = stage.querySelector(':scope > geo-map-time-controls') as HTMLElement
    expect(part.className).toBe('geo-time-controls')
    expect(part.querySelector('output')?.textContent).toBe('Time 2021')

    // Its commands go through the engine to the map, and back as the map's time.
    controller!.ready()
    await fixture.whenStable()
    ;(part.querySelector('button[aria-label="Next time"]') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(controller!.setTime).toHaveBeenLastCalledWith('2022', 'api')
    expect(fixture.componentInstance.changes.at(-1)).toEqual({ time: '2022', origin: 'api' })
    expect(part.querySelector('output')?.textContent).toBe('Time 2022')
    expect((part.querySelector('input[type="range"]') as HTMLInputElement).value).toBe('1')
  })

  it('autoplays through the engine with ui.time.autoplay', async () => {
    const { fixture, root, controller } = await renderPreset(
      configInput({ time: { autoplay: true, speedsMs: [300], defaultSpeedMs: 300 } }),
    )
    controller!.ready()
    await fixture.whenStable()
    const part = root.querySelector('geo-map-time-controls')!
    expect(part.getAttribute('data-state')).toBe('playing')
    vi.advanceTimersByTime(300)
    await fixture.whenStable()
    expect(controller!.setTime).toHaveBeenLastCalledWith('2022', 'api')
    vi.advanceTimersByTime(300)
    await fixture.whenStable()
    expect(controller!.setTime).toHaveBeenLastCalledWith('2023', 'api')
    // Destroying the map stops playback.
    fixture.destroy()
    vi.advanceTimersByTime(3000)
    expect(controller!.setTime).toHaveBeenCalledTimes(2)
  })

  it('is left out when ui.time.enabled is false, or by the embedded and grid profiles', async () => {
    for (const ui of [
      { time: { enabled: false } },
      { profile: 'embedded' },
      { profile: 'grid' },
    ] satisfies MapUiConfig[]) {
      const { root, fixture } = await renderPreset(configInput(ui))
      expect(root.querySelector('.geo-map-stage')).not.toBeNull()
      expect(root.querySelector('geo-map-time-controls')).toBeNull()
      fixture.destroy()
    }
  })

  it('is hidden in the preset while no layer has time values', async () => {
    const config = configInput()
    const { root } = await renderPreset({
      ...config,
      data: { ...config.data, layers: [{ id: 'borders', title: 'Borders', data: empty }] },
    })
    const part = root.querySelector('geo-map-time-controls') as HTMLElement
    expect(part.className).toBe('')
    expect(part.style.display).toBe('none')
    expect(part.children).toHaveLength(0)
  })
})
