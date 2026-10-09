import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { Provider, Type, WritableSignal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MAP_CONTEXT,
  MapLayerPanel,
  MapRoot,
  ShapeSwitch,
  defineMapConfig,
  type MapActions,
  type MapContext,
  type MapIcons,
  type MapLayerConfig,
  type MapRuntime,
  type MapStaticValue,
  type MapState,
  type MapUiConfig,
  type NormalizedLegend,
} from '../src/index'
import { defaultMapIcons } from '../src/icons'
import { resolveMapUi } from '../src/config/ui-profiles'
import { emptyDerived } from '../src/map-bridges'
import { defaultMapMessages } from '../src/messages'
import { controllers, resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

const empty = { type: 'FeatureCollection' as const, features: [] }

/** The layers in drawing order (bottom first); the panel lists them top first. */
const config = defineMapConfig({
  accessibility: { ariaLabel: 'Layer map' },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  data: {
    layers: [
      { id: 'helper', title: 'Helper', data: empty, showInLayerControl: false },
      {
        id: 'relief/shaded',
        kind: 'xyz',
        title: 'Relief',
        url: 'https://tiles.example.org/{z}/{x}/{y}.png',
        sourceProjection: 'EPSG:3857',
        reorderable: false,
      },
      { id: 'cities', title: 'Cities', data: empty, group: 'Reference features', visible: false },
      { id: 'rivers', title: 'Rivers', data: empty, group: 'Reference features', required: true },
      {
        id: 'regions',
        title: 'Development index',
        data: empty,
        group: 'Indicators',
        opacity: 0.8,
        exclusiveGroup: 'indicator',
      },
      {
        id: 'poverty',
        title: 'Poverty rate',
        data: empty,
        group: 'Indicators',
        exclusiveGroup: 'indicator',
        visible: false,
      },
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
})
const layers: MapLayerConfig[] = config.data.layers

const legends: NormalizedLegend[] = [
  {
    layerId: 'regions',
    title: 'Development index',
    visible: true,
    entries: [{ id: 'low', label: 'Low', symbol: { kind: 'polygon', fillColor: '#eeeeee' } }],
  },
  { layerId: 'cities', title: 'Cities', visible: false, entries: [] },
]

/** Icons with recognisable paths, to tell the disclosure states apart. */
const icons: MapIcons = {
  ...defaultMapIcons,
  Expand: [['path', { d: 'M-expand' }]],
  Collapse: [['path', { d: 'M-collapse' }]],
}

type FakeMap = {
  provider: Provider
  runtime: WritableSignal<MapRuntime>
  actions: Pick<
    MapActions,
    'setOpenPanel' | 'setLayerVisibility' | 'setLayerOpacity' | 'reorderLayer'
  >
  open(panel: MapRuntime['openPanel']): void
}

/** A fake MAP_CONTEXT (parts inject the token), with the layer panel open by default. */
function fakeMap(ui: MapUiConfig = {}, runtime: Partial<MapRuntime> = {}): FakeMap {
  const state = signal<MapRuntime>({
    state: config.initialState,
    layers,
    ...emptyDerived,
    legends,
    times: [],
    error: null,
    openPanel: 'layers',
    mapStatus: 'ready',
    ...runtime,
  })
  const open = (panel: MapRuntime['openPanel']) =>
    state.update((map) => ({ ...map, openPanel: panel }))
  const actions = {
    setOpenPanel: vi.fn(open),
    setLayerVisibility: vi.fn(),
    setLayerOpacity: vi.fn(),
    reorderLayer: vi.fn(),
  }
  const staticValue = signal<MapStaticValue>({
    mapId: 'fake',
    config,
    ui: resolveMapUi(ui),
    messages: defaultMapMessages,
    actions: actions as unknown as MapActions,
    icons,
  })
  const context: MapContext = {
    staticValue,
    runtime: state,
    actions: actions as unknown as MapActions,
  }
  return { provider: { provide: MAP_CONTEXT, useValue: context }, runtime: state, actions, open }
}

async function render<T>(component: Type<T>, map?: FakeMap) {
  if (map) TestBed.configureTestingModule({ providers: [map.provider] })
  const fixture = TestBed.createComponent(component)
  await fixture.whenStable()
  const element = fixture.nativeElement as HTMLElement
  const panel = element.querySelector('geo-map-layer-panel') as HTMLElement
  return { fixture, element, panel }
}

const texts = (root: ParentNode, selector: string) =>
  [...root.querySelectorAll(selector)].map((node) => node.textContent)
const item = (panel: HTMLElement, title: string) =>
  [...panel.querySelectorAll('li.geo-layer-item')].find(
    (node) => node.querySelector('.geo-layer-title')?.textContent === title,
  ) as HTMLElement
const button = (root: ParentNode, label: string) =>
  root.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null
const expandedTitles = (panel: HTMLElement) =>
  [...panel.querySelectorAll('li.geo-layer-item')]
    .filter((node) => node.querySelector('.geo-layer-details'))
    .map((node) => node.querySelector('.geo-layer-title')?.textContent)

beforeEach(() => resetControllers())
afterEach(() => vi.restoreAllMocks())

@Component({
  imports: [MapLayerPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map-layer-panel />`,
})
class Plain {}

describe('the layer panel', () => {
  it('is hidden, without classes, ARIA or content, while its panel is not the open one', async () => {
    @Component({
      imports: [MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-layer-panel class="brand-panel" id="layers" style="color: red" />`,
    })
    class Host {}
    const map = fakeMap({}, { openPanel: 'settings' })
    const { fixture, panel } = await render(Host, map)
    expect(panel.className).toBe('brand-panel')
    expect(panel.id).toBe('layers')
    expect(panel.style.display).toBe('none')
    expect(panel.style.color).toBe('red')
    for (const name of ['role', 'aria-label', 'data-slot', 'data-placement'])
      expect(panel.hasAttribute(name)).toBe(false)
    expect(panel.childElementCount).toBe(0)

    map.open('layers')
    await fixture.whenStable()
    expect([...panel.classList].sort()).toEqual([
      'brand-panel',
      'geo-layer-panel',
      'geo-shape-card',
    ])
    expect(panel.getAttribute('role')).toBe('region')
    expect(panel.getAttribute('aria-label')).toBe('Map layers')
    expect(panel.getAttribute('data-slot')).toBe('map-layer-panel')
    expect(panel.getAttribute('data-placement')).toBe('top-right')
    expect(panel.style.display).toBe('')
    expect(panel.style.color).toBe('red')
    expect(panel.id).toBe('layers')

    map.open(null)
    await fixture.whenStable()
    expect(panel.className).toBe('brand-panel')
    expect(panel.style.display).toBe('none')
    expect(panel.childElementCount).toBe(0)
  })

  it("lets the consumer's static role, aria-label and display win while shown", async () => {
    @Component({
      imports: [MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-layer-panel
          role="complementary"
          aria-label="Layer list"
          placement="bottom-left"
          style="display: grid"
        />
      `,
    })
    class Host {}
    const map = fakeMap({}, { openPanel: null })
    const { fixture, panel } = await render(Host, map)
    expect(panel.hasAttribute('role')).toBe(false)
    expect(panel.hasAttribute('aria-label')).toBe(false)
    expect(panel.style.display).toBe('none')
    map.open('layers')
    await fixture.whenStable()
    expect(panel.getAttribute('role')).toBe('complementary')
    expect(panel.getAttribute('aria-label')).toBe('Layer list')
    expect(panel.getAttribute('data-placement')).toBe('bottom-left')
    expect(panel.style.display).toBe('grid')
  })

  it('renders the default header with the visible count and a close button', async () => {
    const map = fakeMap()
    const { fixture, panel } = await render(Plain, map)
    const header = panel.firstElementChild as HTMLElement
    expect(header.tagName).toBe('HEADER')
    expect(header.className).toBe('geo-panel-header geo-layer-panel-header')
    expect(header.querySelector('.geo-panel-heading > span.geo-panel-kicker')?.textContent).toBe(
      'Map content',
    )
    expect(header.querySelector('.geo-panel-heading > h2.geo-panel-title')?.textContent).toBe(
      'Layers',
    )
    // `showInLayerControl: false` layers are neither listed nor counted.
    expect(header.querySelector('.geo-panel-heading > span.geo-layer-count')?.textContent).toBe(
      '3 of 5 visible',
    )
    const close = header.querySelector(':scope > button') as HTMLButtonElement
    expect([...close.classList].sort()).toEqual(['geo-shape-button', 'geo-shape-icon-button'])
    expect(close.getAttribute('data-slot')).toBe('icon-button')
    expect(close.getAttribute('type')).toBe('button')
    expect(close.getAttribute('aria-label')).toBe('Close layer panel')
    expect(close.getAttribute('title')).toBe('Close layer panel')
    expect(close.querySelector('geo-map-icon.geo-icon > svg[aria-hidden="true"]')).not.toBeNull()
    close.click()
    expect(map.actions.setOpenPanel).toHaveBeenCalledWith(null)
    await fixture.whenStable()
    expect(panel.style.display).toBe('none')
  })

  it('lists the top layer first, under group headings, with the exclusive-group note', async () => {
    const { panel } = await render(Plain, fakeMap())
    const groups = panel.querySelectorAll('.geo-layer-groups > section.geo-layer-group')
    expect(texts(panel, '.geo-layer-group-heading > h3.geo-layer-group-title')).toEqual([
      'Indicators',
      'Reference features',
      'Other layers',
    ])
    expect(groups).toHaveLength(3)
    expect(texts(groups[0]!, '.geo-layer-group-note')).toEqual(['Show one layer at a time'])
    expect(groups[1]!.querySelector('.geo-layer-group-note')).toBeNull()
    expect(
      [...groups].map((group) => texts(group, 'ul.geo-layer-list > li .geo-layer-title')),
    ).toEqual([['Poverty rate', 'Development index'], ['Rivers', 'Cities'], ['Relief']])
    expect(texts(panel, '.geo-layer-title')).not.toContain('Helper')
  })

  it('starts a new group each time the group changes, as React does', async () => {
    const mixed = [
      { ...layers[2]!, group: 'A' },
      { ...layers[3]!, group: 'B' },
      { ...layers[4]!, group: 'A' },
    ] as MapLayerConfig[]
    const { panel } = await render(Plain, fakeMap({}, { layers: mixed }))
    expect(texts(panel, '.geo-layer-group-title')).toEqual(['A', 'B', 'A'])
  })

  it('renders each row: symbol preview, title, kind and status, switch and disclosure', async () => {
    const map = fakeMap(
      {},
      {
        statuses: [
          { id: 'cities', loading: false, scaleUnavailable: true },
          { id: 'rivers', loading: false, noData: true },
        ],
      },
    )
    const { panel } = await render(Plain, map)
    const regions = item(panel, 'Development index')
    expect(regions.getAttribute('data-visible')).toBe('true')
    const row = regions.querySelector(':scope > div.geo-layer-row') as HTMLElement
    expect([...row.children].map((node) => node.className)).toEqual([
      'geo-layer-preview',
      'geo-layer-copy',
      'geo-layer-visibility',
      expect.stringContaining('geo-layer-disclosure'),
    ])
    const symbol = row.querySelector('.geo-layer-preview > svg.geo-legend-symbol')!
    expect(symbol.getAttribute('aria-hidden')).toBe('true')
    expect(symbol.querySelector('rect')?.getAttribute('fill')).toBe('#eeeeee')
    expect(row.querySelector('.geo-layer-copy > strong.geo-layer-title')?.textContent).toBe(
      'Development index',
    )
    expect(row.querySelector('.geo-layer-copy > span.geo-layer-meta')?.textContent).toBe('GEOJSON')
    // A legend without entries has no preview.
    const cities = item(panel, 'Cities')
    expect(cities.getAttribute('data-visible')).toBe('false')
    expect(cities.querySelector('.geo-layer-preview')).toBeNull()
    expect(cities.querySelector('.geo-layer-meta')?.textContent).toBe(
      'GEOJSON · unavailable at this scale',
    )
    expect(item(panel, 'Rivers').querySelector('.geo-layer-meta')?.textContent).toBe(
      'GEOJSON · No data for time',
    )
    expect(item(panel, 'Relief').querySelector('.geo-layer-meta')?.textContent).toBe('XYZ')
    // The kind and the status are separate text nodes, as React renders them: one node lays the
    // glyphs out a subpixel apart, so the text would not look exactly the same.
    const textNodes = (title: string) =>
      [...item(panel, title).querySelector('.geo-layer-meta')!.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
    expect(textNodes('Cities')).toEqual(['GEOJSON', ' · unavailable at this scale'])
    expect(textNodes('Relief')).toEqual(['XYZ'])
  })

  it('shows and hides layers with the switch; required layers cannot be hidden', async () => {
    const map = fakeMap()
    const { panel } = await render(Plain, map)
    const switches = panel.querySelectorAll('.geo-layer-visibility > label.geo-shape-switch')
    expect(switches).toHaveLength(5)
    const regions = item(panel, 'Development index').querySelector('label.geo-shape-switch')!
    expect(regions.getAttribute('data-slot')).toBe('switch')
    expect(regions.querySelector('.geo-shape-switch-label')?.textContent).toBe('Development index')
    const checkbox = regions.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    checkbox.click()
    expect(map.actions.setLayerVisibility).toHaveBeenCalledWith('regions', false)
    const cities = item(panel, 'Cities').querySelector('input') as HTMLInputElement
    expect(cities.checked).toBe(false)
    cities.click()
    expect(map.actions.setLayerVisibility).toHaveBeenLastCalledWith('cities', true)
    const rivers = item(panel, 'Rivers').querySelector('input') as HTMLInputElement
    expect(rivers.disabled).toBe(true)
    expect(cities.disabled).toBe(false)
  })

  it('shows the map’s visibility again when a change is not taken, as React’s controlled switch', async () => {
    const map = fakeMap()
    const { fixture, panel } = await render(Plain, map)
    const checkbox = item(panel, 'Development index').querySelector('input') as HTMLInputElement
    checkbox.click()
    await fixture.whenStable()
    expect(map.actions.setLayerVisibility).toHaveBeenCalledWith('regions', false)
    expect(checkbox.checked).toBe(true)
    // Taken: the new layers arrive with the layer hidden.
    vi.mocked(map.actions.setLayerVisibility).mockImplementation((id, visible) =>
      map.runtime.update((runtime) => ({
        ...runtime,
        layers: runtime.layers.map((layer) => (layer.id === id ? { ...layer, visible } : layer)),
      })),
    )
    checkbox.click()
    await fixture.whenStable()
    expect(checkbox.checked).toBe(false)
    expect(item(panel, 'Development index').getAttribute('data-visible')).toBe('false')
  })

  it('shows the map’s opacity again when a change is not taken, as React’s controlled slider', async () => {
    const map = fakeMap({ layerPanel: { defaultExpandedLayerIds: ['regions'] } })
    const { fixture, panel } = await render(Plain, map)
    const slider = item(panel, 'Development index').querySelector(
      'input[type="range"]',
    ) as HTMLInputElement
    slider.value = '0.45'
    slider.dispatchEvent(new Event('input'))
    await fixture.whenStable()
    expect(map.actions.setLayerOpacity).toHaveBeenCalledWith('regions', 0.45)
    expect(slider.value).toBe('0.8')
    expect(slider.style.getPropertyValue('--geo-slider-fill')).toBe('80%')
    // Taken: the new layers arrive with the new opacity.
    vi.mocked(map.actions.setLayerOpacity).mockImplementation((id, opacity) =>
      map.runtime.update((runtime) => ({
        ...runtime,
        layers: runtime.layers.map((layer) => (layer.id === id ? { ...layer, opacity } : layer)),
      })),
    )
    slider.value = '0.45'
    slider.dispatchEvent(new Event('input'))
    await fixture.whenStable()
    expect(slider.value).toBe('0.45')
    expect(slider.style.getPropertyValue('--geo-slider-fill')).toBe('45%')
    expect(item(panel, 'Development index').querySelector('.geo-opacity-value')?.textContent).toBe(
      'Opacity 45%',
    )
  })

  it('opens a layer’s details from its disclosure button', async () => {
    const map = fakeMap()
    const { fixture, panel } = await render(Plain, map)
    const regions = item(panel, 'Development index')
    const toggle = regions.querySelector('button.geo-layer-disclosure') as HTMLButtonElement
    expect([...toggle.classList].sort()).toEqual([
      'geo-layer-disclosure',
      'geo-shape-button',
      'geo-shape-icon-button',
    ])
    expect(toggle.getAttribute('aria-label')).toBe('Show options for Development index')
    expect(toggle.getAttribute('title')).toBe('Show options for Development index')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.querySelector('path')?.getAttribute('d')).toBe('M-expand')
    expect(regions.querySelector('.geo-layer-details')).toBeNull()
    const detailsId = toggle.getAttribute('aria-controls')!
    expect(detailsId).toMatch(/^geo-layer-panel-\d+-layer-options-regions$/)

    toggle.click()
    await fixture.whenStable()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-label')).toBe('Hide options for Development index')
    expect(toggle.querySelector('path')?.getAttribute('d')).toBe('M-collapse')
    const details = regions.querySelector(':scope > div.geo-layer-details') as HTMLElement
    expect(details.id).toBe(detailsId)
    expect(details.getAttribute('role')).toBe('group')
    expect(details.getAttribute('aria-label')).toBe('Options for Development index')
    // Ids are DOM-safe.
    const relief = item(panel, 'Relief').querySelector('button.geo-layer-disclosure')!
    expect(relief.getAttribute('aria-controls')).toMatch(/-layer-options-relief-shaded$/)

    toggle.click()
    await fixture.whenStable()
    expect(regions.querySelector('.geo-layer-details')).toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps focus on a move button whose row moves, as React does', async () => {
    const map = fakeMap({
      layerPanel: { groupBy: 'none', itemDetails: 'always', allowOpacity: false },
    })
    vi.mocked(map.actions.reorderLayer).mockImplementation((id, direction) =>
      map.runtime.update((runtime) => {
        const next = [...runtime.layers]
        const index = next.findIndex((layer) => layer.id === id)
        const [layer] = next.splice(index, 1)
        next.splice(index + direction, 0, layer!)
        return { ...runtime, layers: next }
      }),
    )
    const { fixture, panel } = await render(Plain, map)
    const titles = () => texts(panel, '.geo-layer-title')
    expect(titles()).toEqual(['Poverty rate', 'Development index', 'Rivers', 'Cities', 'Relief'])
    // Moving a row up moves its own element, which the browser blurs; React focuses it again.
    const up = button(panel, 'Move Cities up')!
    up.focus()
    up.click()
    await fixture.whenStable()
    expect(titles()).toEqual(['Poverty rate', 'Development index', 'Cities', 'Rivers', 'Relief'])
    expect(document.activeElement).toBe(up)
    const down = button(panel, 'Move Cities down')!
    down.focus()
    down.click()
    await fixture.whenStable()
    expect(titles()).toEqual(['Poverty rate', 'Development index', 'Rivers', 'Cities', 'Relief'])
    expect(document.activeElement).toBe(down)
    // Whatever had the focus in the moved row keeps it (a click doesn't focus a button in
    // Safari), and a button that was not focused doesn't take it.
    const toggle = item(panel, 'Cities').querySelector('input') as HTMLInputElement
    toggle.focus()
    ;(button(panel, 'Move Cities up') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(titles()).toEqual(['Poverty rate', 'Development index', 'Cities', 'Rivers', 'Relief'])
    expect(document.activeElement).toBe(toggle)
  })

  it('shows badges, the opacity slider and the move buttons in the details', async () => {
    const map = fakeMap(
      {
        layerPanel: { defaultExpandedLayerIds: ['regions', 'poverty', 'cities', 'relief/shaded'] },
      },
      { statuses: [{ id: 'cities', loading: false, error: { code: 'X' } as never }] },
    )
    const { panel } = await render(Plain, map)
    const regions = item(panel, 'Development index').querySelector('.geo-layer-details')!
    expect([...regions.children].map((node) => node.className)).toEqual([
      'geo-layer-metadata',
      'geo-opacity-label',
      'geo-order-buttons',
    ])
    const badges = regions.querySelectorAll('.geo-layer-metadata > span.geo-shape-badge')
    expect([...badges].map((node) => node.textContent)).toEqual(['GEOJSON', 'choose one'])
    expect(badges[0]!.getAttribute('data-slot')).toBe('badge')
    const cities = item(panel, 'Cities').querySelector('.geo-layer-details')!
    expect(texts(cities, '.geo-shape-badge')).toEqual(['GEOJSON', 'source error'])

    const label = regions.querySelector('label.geo-opacity-label')!
    expect(label.querySelector(':scope > span.geo-opacity-value')?.textContent).toBe('Opacity 80%')
    const slider = label.querySelector(':scope > input[type="range"]') as HTMLInputElement
    expect(slider.className).toBe('geo-shape-slider')
    expect(slider.getAttribute('data-slot')).toBe('slider')
    expect(slider.getAttribute('aria-label')).toBe('Development index opacity')
    expect([slider.min, slider.max, slider.step]).toEqual(['0', '1', '0.05'])
    expect(slider.value).toBe('0.8')
    expect(slider.style.getPropertyValue('--geo-slider-fill')).toBe('80%')
    slider.value = '0.45'
    slider.dispatchEvent(new Event('input'))
    expect(map.actions.setLayerOpacity).toHaveBeenCalledWith('regions', 0.45)
    const poverty = item(panel, 'Poverty rate').querySelector('.geo-layer-details')!
    expect(poverty.querySelector('.geo-opacity-value')?.textContent).toBe('Opacity 100%')
    expect(poverty.querySelector('input')?.style.getPropertyValue('--geo-slider-fill')).toBe('100%')

    const up = button(regions, 'Move Development index up')!
    const down = button(regions, 'Move Development index down')!
    expect(up.parentElement?.className).toBe('geo-order-buttons')
    expect(up.getAttribute('title')).toBe('Move Development index up')
    expect([up.disabled, down.disabled]).toEqual([false, false])
    up.click()
    expect(map.actions.reorderLayer).toHaveBeenCalledWith('regions', 1)
    down.click()
    expect(map.actions.reorderLayer).toHaveBeenLastCalledWith('regions', -1)
    // The top layer can't move up; a layer above one that is not reorderable can't move down.
    expect(button(poverty, 'Move Poverty rate up')?.disabled).toBe(true)
    expect(button(poverty, 'Move Poverty rate down')?.disabled).toBe(false)
    expect(button(cities, 'Move Cities up')?.disabled).toBe(false)
    expect(button(cities, 'Move Cities down')?.disabled).toBe(true)
    // `reorderable: false` layers have no move buttons.
    const relief = item(panel, 'Relief').querySelector('.geo-layer-details')!
    expect(relief.querySelector('.geo-order-buttons')).toBeNull()
    expect(texts(relief, '.geo-shape-badge')).toEqual(['XYZ'])
  })

  it('takes every behaviour default from config.ui.layerPanel', async () => {
    const map = fakeMap({
      layerPanel: {
        placement: 'bottom-left',
        allowVisibility: false,
        allowOpacity: false,
        allowReorder: false,
        showMetadata: false,
        groupBy: 'none',
        itemDetails: 'always',
        showSymbolPreview: false,
      },
    })
    const { panel } = await render(Plain, map)
    expect(panel.getAttribute('data-placement')).toBe('bottom-left')
    expect(panel.querySelectorAll('section.geo-layer-group')).toHaveLength(1)
    expect(panel.querySelector('.geo-layer-group-heading')).toBeNull()
    expect(panel.querySelector('.geo-layer-preview')).toBeNull()
    expect(panel.querySelector('.geo-layer-visibility')).toBeNull()
    expect(panel.querySelector('.geo-layer-disclosure')).toBeNull()
    // `itemDetails: 'always'`: every layer's details, here with nothing to show in them.
    const details = panel.querySelectorAll('.geo-layer-details')
    expect(details).toHaveLength(5)
    expect([...details].every((node) => node.childElementCount === 0)).toBe(true)
  })

  it('lets each input override its config.ui default', async () => {
    @Component({
      imports: [MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-layer-panel
          placement="top-left"
          allowVisibility
          allowOpacity
          allowReorder
          showMetadata
          showSymbolPreview
          groupBy="group"
          itemDetails="disclosure"
          [defaultExpandedLayerIds]="['regions']"
        />
      `,
    })
    class On {}
    const off = {
      layerPanel: {
        allowVisibility: false,
        allowOpacity: false,
        allowReorder: false,
        showMetadata: false,
        groupBy: 'none' as const,
        itemDetails: 'always' as const,
        showSymbolPreview: false,
      },
    }
    const { panel } = await render(On, fakeMap(off))
    expect(panel.getAttribute('data-placement')).toBe('top-left')
    expect(panel.querySelectorAll('.geo-layer-group-heading')).toHaveLength(3)
    expect(panel.querySelectorAll('.geo-layer-preview')).toHaveLength(1)
    expect(panel.querySelectorAll('.geo-layer-visibility')).toHaveLength(5)
    expect(panel.querySelectorAll('.geo-layer-disclosure')).toHaveLength(5)
    expect(expandedTitles(panel)).toEqual(['Development index'])
    const details = item(panel, 'Development index').querySelector('.geo-layer-details')!
    expect(details.querySelector('.geo-layer-metadata')).not.toBeNull()
    expect(details.querySelector('.geo-opacity-label')).not.toBeNull()
    expect(details.querySelector('.geo-order-buttons')).not.toBeNull()
  })

  it('lets false inputs turn off what config.ui turns on', async () => {
    @Component({
      imports: [MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-layer-panel
          [allowVisibility]="false"
          [allowOpacity]="false"
          [allowReorder]="false"
          [showMetadata]="false"
          [showSymbolPreview]="false"
          groupBy="none"
          itemDetails="always"
        />
      `,
    })
    class Off {}
    const { panel } = await render(Off, fakeMap())
    expect(panel.getAttribute('data-placement')).toBe('top-right')
    expect(panel.querySelector('.geo-layer-group-heading')).toBeNull()
    expect(panel.querySelector('.geo-layer-preview')).toBeNull()
    expect(panel.querySelector('.geo-layer-visibility')).toBeNull()
    expect(panel.querySelector('.geo-layer-disclosure')).toBeNull()
    expect(panel.querySelectorAll('.geo-layer-details')).toHaveLength(5)
    expect(panel.querySelector('.geo-layer-details *')).toBeNull()
  })

  it('keeps expanded rows until the panel reopens or the default expanded ids change', async () => {
    @Component({
      imports: [MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-layer-panel
          [allowOpacity]="allowOpacity()"
          [defaultExpandedLayerIds]="expandedIds()"
        />
      `,
    })
    class Host {
      readonly allowOpacity = signal<boolean | undefined>(undefined)
      readonly expandedIds = signal<string[] | undefined>(undefined)
    }
    const map = fakeMap({ layerPanel: { defaultExpandedLayerIds: ['regions'] } })
    const { fixture, panel } = await render(Host, map)
    const toggle = async (title: string) => {
      ;(item(panel, title).querySelector('.geo-layer-disclosure') as HTMLButtonElement).click()
      await fixture.whenStable()
    }
    expect(expandedTitles(panel)).toEqual(['Development index'])
    await toggle('Cities')
    await toggle('Development index')
    expect(expandedTitles(panel)).toEqual(['Cities'])

    // Another input changing keeps them.
    fixture.componentInstance.allowOpacity.set(false)
    await fixture.whenStable()
    expect(expandedTitles(panel)).toEqual(['Cities'])

    // Closing and reopening the panel starts over (React mounts its content again).
    map.open(null)
    await fixture.whenStable()
    map.open('layers')
    await fixture.whenStable()
    expect(expandedTitles(panel)).toEqual(['Development index'])

    // New default ids start over; the same ids in a new array don't.
    await toggle('Cities')
    fixture.componentInstance.expandedIds.set(['poverty'])
    await fixture.whenStable()
    expect(expandedTitles(panel)).toEqual(['Poverty rate'])
    await toggle('Rivers')
    fixture.componentInstance.expandedIds.set(['poverty'])
    await fixture.whenStable()
    expect(expandedTitles(panel)).toEqual(['Poverty rate', 'Rivers'])
  })

  it('replaces the header with [geoMapPanelHeader] and adds [geoMapPanelFooter] content', async () => {
    @Component({
      imports: [MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-layer-panel>
          <p geoMapPanelFooter class="brand-footer">Sources: national statistics</p>
          <h2 geoMapPanelHeader class="brand-header">Our layers</h2>
        </geo-map-layer-panel>
      `,
    })
    class Host {}
    const map = fakeMap()
    const { fixture, panel } = await render(Host, map)
    expect([...panel.children].map((node) => node.className)).toEqual([
      'brand-header',
      'geo-layer-groups',
      'brand-footer',
    ])
    expect(panel.querySelector('.geo-layer-panel-header')).toBeNull()
    // Hidden, the projected content goes too, and comes back with the panel.
    map.open(null)
    await fixture.whenStable()
    expect(panel.childElementCount).toBe(0)
    map.open('layers')
    await fixture.whenStable()
    expect(panel.querySelector(':scope > .brand-header')?.textContent).toBe('Our layers')
  })

  it('gives two panels different ids for their details', async () => {
    @Component({
      imports: [MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-layer-panel itemDetails="always" /><geo-map-layer-panel
          itemDetails="always"
        />`,
    })
    class Host {}
    const { element } = await render(Host, fakeMap())
    const ids = [...element.querySelectorAll('.geo-layer-details')].map((node) => node.id)
    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
  })

  it('explains when it is used outside a map', () => {
    expect(() => TestBed.createComponent(MapLayerPanel)).toThrow(
      /must be used inside <geo-map-root> or <geo-map>/,
    )
  })
})

describe('the layer panel in a map', () => {
  const mapConfig = { ...config, ui: { layerPanel: { defaultOpen: true } } }

  it('is laid out by <geo-map> after the controls and before the legend', async () => {
    @Component({
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Host {
      protected readonly config = mapConfig
    }
    const { fixture, element, panel } = await render(Host)
    expect(
      element.querySelector(
        '.geo-map-stage > geo-map-controls ~ geo-map-layer-panel + geo-map-legend',
      ),
    ).not.toBeNull()
    expect(panel.getAttribute('data-slot')).toBe('map-layer-panel')
    expect(texts(panel, '.geo-layer-title')).toEqual([
      'Poverty rate',
      'Development index',
      'Rivers',
      'Cities',
      'Relief',
    ])
    const rail = element.querySelector('button[aria-label="Layers"]') as HTMLButtonElement
    expect(rail.getAttribute('aria-expanded')).toBe('true')
    ;(button(panel, 'Close layer panel') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(panel.style.display).toBe('none')
    expect(rail.getAttribute('aria-expanded')).toBe('false')
    rail.click()
    await fixture.whenStable()
    expect(panel.getAttribute('role')).toBe('region')
  })

  it('is left out when ui.layerPanel.enabled is false', async () => {
    @Component({
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Host {
      protected readonly config = { ...config, ui: { profile: 'embedded' as const } }
    }
    const { element } = await render(Host)
    expect(element.querySelector('geo-map-layer-panel')).toBeNull()
    expect(element.querySelector('button[aria-label="Layers"]')).toBeNull()
  })

  it('sends its changes to the map and shows the state and statuses it gets back', async () => {
    @Component({
      imports: [MapRoot, MapLayerPanel],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" [state]="state()" openPanel="layers">
          <geo-map-layer-panel itemDetails="always" />
        </geo-map-root>
      `,
    })
    class Host {
      protected readonly config = config
      readonly state = signal<MapState>(config.initialState)
    }
    const { fixture, panel } = await render(Host)
    const controller = controllers[0]!
    controller.ready()
    await fixture.whenStable()
    const regions = item(panel, 'Development index')
    ;(regions.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
    expect(controller.setLayerVisibility).toHaveBeenCalledWith('regions', false, 'api')
    const slider = regions.querySelector('input[type="range"]') as HTMLInputElement
    slider.value = '0.5'
    slider.dispatchEvent(new Event('input'))
    expect(controller.setLayerOpacity).toHaveBeenCalledWith('regions', 0.5, 'api')
    ;(button(regions, 'Move Development index down') as HTMLButtonElement).click()
    expect(controller.reorderOverlay).toHaveBeenCalledWith('regions', -1, 'api')

    // The host's state (here, after the map's proposal) is what the panel shows.
    fixture.componentInstance.state.set({
      ...config.initialState,
      layers: {
        ...config.initialState.layers,
        regions: { ...config.initialState.layers['regions']!, visible: false, opacity: 0.5 },
      },
    })
    controller
      .options()
      .onStatusChange?.([{ id: 'cities', loading: false, scaleUnavailable: true }])
    await fixture.whenStable()
    expect(regions.getAttribute('data-visible')).toBe('false')
    expect((regions.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(
      false,
    )
    expect(regions.querySelector('.geo-opacity-value')?.textContent).toBe('Opacity 50%')
    expect(panel.querySelector('.geo-layer-count')?.textContent).toBe('2 of 5 visible')
    expect(item(panel, 'Cities').querySelector('.geo-layer-meta')?.textContent).toBe(
      'GEOJSON · unavailable at this scale',
    )
  })
})

describe('the switch shape', () => {
  it('keeps the user’s choice without checked, and follows [(checked)]', async () => {
    @Component({
      imports: [ShapeSwitch],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <label geoShapeSwitch class="own" label="Own" (checkedChange)="seen.push($event)"></label>
        <label geoShapeSwitch class="bound" label="Bound" [(checked)]="on"></label>
        <label geoShapeSwitch class="preset" label="Preset" checked></label>
      `,
    })
    class Host {
      readonly seen: boolean[] = []
      readonly on = signal(false)
    }
    const { fixture, element } = await render(Host)
    const own = element.querySelector('.own input') as HTMLInputElement
    expect(own.checked).toBe(false)
    own.click()
    await fixture.whenStable()
    expect(own.checked).toBe(true)
    expect(fixture.componentInstance.seen).toEqual([true])
    const bound = element.querySelector('.bound input') as HTMLInputElement
    bound.click()
    await fixture.whenStable()
    expect(fixture.componentInstance.on()).toBe(true)
    expect(bound.checked).toBe(true)
    fixture.componentInstance.on.set(false)
    await fixture.whenStable()
    expect(bound.checked).toBe(false)
    expect((element.querySelector('.preset input') as HTMLInputElement).checked).toBe(true)
    expect(element.querySelector('.own')?.textContent?.trim()).toBe('Own')
  })
})
