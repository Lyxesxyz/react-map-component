import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { Provider, Type, WritableSignal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MAP_CONTEXT,
  MapBasemapField,
  MapExportField,
  MapRoot,
  MapSettings,
  MapZoomTargetField,
  defineMapConfig,
  type ExportConfig,
  type MapActions,
  type MapConfig,
  type MapContext,
  type MapIcons,
  type MapRuntime,
  type MapState,
  type MapStaticValue,
  type MapUiConfig,
  type SettingsFieldId,
} from '../src/index'
import { defaultMapIcons } from '../src/icons'
import { resolveMapUi } from '../src/config/ui-profiles'
import { emptyDerived } from '../src/map-bridges'
import { defaultMapMessages } from '../src/messages'
import { controllers, resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

const basemap = (id: string, title: string, projections: string[]) => ({
  id,
  title,
  supportedProjections: projections,
  layers: [],
  backgroundColor: '#ffffff',
})

/** Three basemaps, two of them in the map's projection (Equal Earth), and two zoom targets. */
const config = defineMapConfig({
  accessibility: { ariaLabel: 'Settings map' },
  initialState: { view: { center: [0, 0], zoom: 1, projection: 'EPSG:8857' } },
  data: {
    layers: [],
    basemaps: [
      basemap('light', 'Light', ['EPSG:8857', 'EPSG:3857']),
      basemap('mercator-only', 'Streets', ['EPSG:3857']),
      basemap('dark', 'Dark', ['EPSG:8857']),
    ],
    zoomTargets: [
      { id: 'africa', label: 'Africa', bounds: [-20, -36, 52, 38] },
      { id: 'kenya', label: 'Kenya', bounds: [33.9, -4.7, 41.9, 5.0], maxZoom: 6 },
    ],
  },
})

/** Icons with a recognisable path, to find the close icon. */
const icons: MapIcons = { ...defaultMapIcons, Close: [['path', { d: 'M-close' }]] }

type FakeMap = {
  provider: Provider
  runtime: WritableSignal<MapRuntime>
  /** The static value (config, ui, messages, icons), to play a configuration change. */
  static: WritableSignal<MapStaticValue>
  actions: Pick<MapActions, 'setOpenPanel' | 'setBasemap' | 'fitZoomTarget' | 'downloadImage'>
  open(panel: MapRuntime['openPanel']): void
}

/** A fake MAP_CONTEXT (parts inject the token), with the settings panel open by default. */
function fakeMap(
  ui: MapUiConfig = {},
  options: { config?: Partial<MapConfig>; runtime?: Partial<MapRuntime> } = {},
): FakeMap {
  const mapConfig = { ...config, ...options.config } as MapConfig
  const state = signal<MapRuntime>({
    state: { ...config.initialState, activeBasemapId: 'dark' },
    layers: [],
    ...emptyDerived,
    times: [],
    error: null,
    openPanel: 'settings',
    mapStatus: 'ready',
    ...options.runtime,
  })
  const open = (panel: MapRuntime['openPanel']) =>
    state.update((map) => ({ ...map, openPanel: panel }))
  const actions = {
    setOpenPanel: vi.fn(open),
    setBasemap: vi.fn(),
    fitZoomTarget: vi.fn(),
    downloadImage: vi.fn(() => Promise.resolve()),
  }
  const staticValue = signal<MapStaticValue>({
    mapId: 'fake',
    config: mapConfig,
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
  return {
    provider: { provide: MAP_CONTEXT, useValue: context },
    runtime: state,
    static: staticValue,
    actions,
    open,
  }
}

async function render<T>(component: Type<T>, map?: FakeMap) {
  if (map) TestBed.configureTestingModule({ providers: [map.provider] })
  const fixture = TestBed.createComponent(component)
  await fixture.whenStable()
  const element = fixture.nativeElement as HTMLElement
  const panel = element.querySelector('geo-map-settings') as HTMLElement
  return { fixture, element, panel }
}

const texts = (root: ParentNode, selector: string) =>
  [...root.querySelectorAll(selector)].map((node) => node.textContent)
const sorted = (node: Element) => [...node.classList].sort()
/** The visible fields of a panel (hidden ones keep an empty, classless host). */
const fieldLabels = (root: ParentNode) => texts(root, 'label.geo-settings-field > span')
const select = (root: ParentNode, label: string) =>
  root.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement
const optionsOf = (element: HTMLSelectElement) =>
  [...element.options].map((option) => [option.value, option.textContent, option.disabled])
async function choose(
  fixture: { whenStable(): Promise<unknown> },
  element: HTMLSelectElement,
  value: string,
) {
  element.value = value
  element.dispatchEvent(new Event('change'))
  await fixture.whenStable()
}

beforeEach(() => resetControllers())
afterEach(() => vi.restoreAllMocks())

@Component({
  imports: [MapSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map-settings />`,
})
class Plain {}

describe('the settings panel', () => {
  it('is hidden, without classes, ARIA or content, while its panel is not the open one', async () => {
    @Component({
      imports: [MapSettings],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-settings class="brand-settings" id="settings" style="color: red" />`,
    })
    class Host {}
    const map = fakeMap({}, { runtime: { openPanel: 'layers' } })
    const { fixture, panel } = await render(Host, map)
    expect(panel.className).toBe('brand-settings')
    expect(panel.id).toBe('settings')
    expect(panel.style.display).toBe('none')
    expect(panel.style.color).toBe('red')
    for (const name of ['role', 'aria-label', 'data-slot', 'data-placement'])
      expect(panel.hasAttribute(name)).toBe(false)
    expect(panel.childElementCount).toBe(0)

    map.open('settings')
    await fixture.whenStable()
    expect(sorted(panel)).toEqual(['brand-settings', 'geo-map-settings', 'geo-shape-card'])
    expect(panel.getAttribute('role')).toBe('region')
    expect(panel.getAttribute('aria-label')).toBe('Map settings')
    expect(panel.getAttribute('data-slot')).toBe('map-settings')
    expect(panel.getAttribute('data-placement')).toBe('top-right')
    expect(panel.style.display).toBe('')
    expect(panel.style.color).toBe('red')
    expect([...panel.children].map((node) => node.className)).toEqual([
      'geo-panel-header',
      'geo-settings-fields',
    ])

    map.open(null)
    await fixture.whenStable()
    expect(panel.className).toBe('brand-settings')
    expect(panel.style.display).toBe('none')
    expect(panel.childElementCount).toBe(0)
  })

  it("lets the consumer's static role, aria-label and display win while shown", async () => {
    @Component({
      imports: [MapSettings],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-settings
          role="dialog"
          aria-label="Display options"
          placement="bottom-left"
          style="display: grid"
        />
      `,
    })
    class Host {}
    const map = fakeMap({}, { runtime: { openPanel: null } })
    const { fixture, panel } = await render(Host, map)
    expect(panel.hasAttribute('role')).toBe(false)
    expect(panel.hasAttribute('aria-label')).toBe(false)
    expect(panel.style.display).toBe('none')
    map.open('settings')
    await fixture.whenStable()
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-label')).toBe('Display options')
    expect(panel.getAttribute('data-placement')).toBe('bottom-left')
    expect(panel.style.display).toBe('grid')
  })

  it('renders the default header with its kicker, title and a close button', async () => {
    const map = fakeMap()
    const { fixture, panel } = await render(Plain, map)
    const header = panel.firstElementChild as HTMLElement
    expect(header.tagName).toBe('HEADER')
    expect(header.className).toBe('geo-panel-header')
    expect([...header.children].map((node) => node.tagName)).toEqual(['DIV', 'BUTTON'])
    expect(header.querySelector(':scope > div.geo-panel-heading')?.childElementCount).toBe(2)
    expect(header.querySelector('.geo-panel-heading > span.geo-panel-kicker')?.textContent).toBe(
      'Map options',
    )
    expect(header.querySelector('.geo-panel-heading > h2.geo-panel-title')?.textContent).toBe(
      'View & output',
    )
    const close = header.querySelector(':scope > button') as HTMLButtonElement
    expect(sorted(close)).toEqual(['geo-shape-button', 'geo-shape-icon-button'])
    expect(close.getAttribute('data-slot')).toBe('icon-button')
    expect(close.getAttribute('type')).toBe('button')
    expect(close.getAttribute('aria-label')).toBe('Close map settings')
    expect(close.getAttribute('title')).toBe('Close map settings')
    const icon = close.querySelector('geo-map-icon.geo-icon > svg[aria-hidden="true"]')!
    expect(icon.querySelector('path')?.getAttribute('d')).toBe('M-close')
    close.click()
    expect(map.actions.setOpenPanel).toHaveBeenCalledWith(null)
    await fixture.whenStable()
    expect(panel.style.display).toBe('none')
  })

  it('renders ui.settings.fields in order: basemap, area and export', async () => {
    const { panel } = await render(Plain, fakeMap())
    const fields = panel.querySelector(':scope > div.geo-settings-fields') as HTMLElement
    expect([...fields.children].map((node) => node.tagName)).toEqual(['LABEL', 'LABEL', 'LABEL'])
    expect(fieldLabels(fields)).toEqual(['Basemap', 'Go to area', 'Download'])
    for (const label of fields.children) {
      expect(sorted(label)).toEqual(['geo-settings-field', 'geo-shape-label'])
      expect(label.getAttribute('data-slot')).toBe('label')
      // React's label > span + span.geo-shape-select-wrap > select (the select element sits in
      // <geo-shape-select style="display: contents">).
      const first = label.firstElementChild!
      expect(first.tagName).toBe('SPAN')
      expect(first.className).toBe('geo-settings-field-label')
      const wrap = label.querySelector('span.geo-shape-select-wrap')!
      expect(wrap.childElementCount).toBe(1)
      const element = wrap.firstElementChild as HTMLSelectElement
      expect(element.tagName).toBe('SELECT')
      expect(element.className).toBe('geo-shape-select')
      expect(element.getAttribute('data-slot')).toBe('select')
    }
    expect(texts(fields, 'select').length).toBe(3)
    expect(select(fields, 'Basemap')).not.toBeNull()
    expect(select(fields, 'Zoom to area')).not.toBeNull()
    expect(select(fields, 'Export map')).not.toBeNull()
  })

  it('takes its placement and fields from config.ui.settings', async () => {
    const map = fakeMap({ settings: { placement: 'bottom-left', fields: ['export', 'basemap'] } })
    const { panel } = await render(Plain, map)
    expect(panel.getAttribute('data-placement')).toBe('bottom-left')
    expect(fieldLabels(panel)).toEqual(['Download', 'Basemap'])
  })

  it('lets placement and fields override their config.ui default', async () => {
    @Component({
      imports: [MapSettings],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map-settings placement="top-left" [fields]="fields()" />`,
    })
    class Host {
      readonly fields = signal<SettingsFieldId[] | undefined>(['zoom-target'])
    }
    const map = fakeMap({ settings: { placement: 'bottom-right', fields: ['basemap'] } })
    const { fixture, panel } = await render(Host, map)
    expect(panel.getAttribute('data-placement')).toBe('top-left')
    expect(fieldLabels(panel)).toEqual(['Go to area'])
    // Unknown ids render nothing, as in React; an empty list renders an empty field list.
    fixture.componentInstance.fields.set(['projection' as SettingsFieldId, 'export'])
    await fixture.whenStable()
    expect(fieldLabels(panel)).toEqual(['Download'])
    fixture.componentInstance.fields.set([])
    await fixture.whenStable()
    expect(panel.querySelector('.geo-settings-fields')?.childElementCount).toBe(0)
    fixture.componentInstance.fields.set(undefined)
    await fixture.whenStable()
    expect(fieldLabels(panel)).toEqual(['Basemap'])
  })

  it('closes after an area is chosen from its own zoom-target field', async () => {
    const map = fakeMap()
    const { fixture, panel } = await render(Plain, map)
    await choose(fixture, select(panel, 'Zoom to area'), 'kenya')
    expect(map.actions.fitZoomTarget).toHaveBeenCalledWith('kenya')
    expect(map.actions.setOpenPanel).toHaveBeenCalledWith(null)
    expect(vi.mocked(map.actions.fitZoomTarget).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(map.actions.setOpenPanel).mock.invocationCallOrder[0]!,
    )
    expect(panel.style.display).toBe('none')
    // Reopened, it starts again from the placeholder (React mounts the fields again).
    map.open('settings')
    await fixture.whenStable()
    expect(select(panel, 'Zoom to area').value).toBe('')
  })

  it('keeps an empty, classless host for a field with nothing to show', async () => {
    const map = fakeMap({}, { config: { export: { enabled: false } } })
    const { panel } = await render(Plain, map)
    const fields = panel.querySelector('.geo-settings-fields')!
    expect(fieldLabels(fields)).toEqual(['Basemap', 'Go to area'])
    const hidden = fields.lastElementChild as HTMLElement
    expect(hidden.tagName).toBe('LABEL')
    expect(hidden.className).toBe('')
    expect(hidden.hasAttribute('data-slot')).toBe(false)
    expect(hidden.style.display).toBe('none')
    expect(hidden.childElementCount).toBe(0)
  })

  it('replaces the header with [geoMapPanelHeader] and adds [geoMapPanelFooter] content', async () => {
    @Component({
      imports: [MapSettings],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-settings>
          <p geoMapPanelFooter class="brand-footer">Exports include the legend</p>
          <h2 geoMapPanelHeader class="brand-header">Our settings</h2>
        </geo-map-settings>
      `,
    })
    class Host {}
    const map = fakeMap()
    const { fixture, panel } = await render(Host, map)
    expect([...panel.children].map((node) => node.className)).toEqual([
      'brand-header',
      'geo-settings-fields',
      'brand-footer',
    ])
    expect(panel.querySelector('.geo-panel-header')).toBeNull()
    // A header or footer doesn't replace the fields.
    expect(fieldLabels(panel)).toEqual(['Basemap', 'Go to area', 'Download'])
    map.open(null)
    await fixture.whenStable()
    expect(panel.childElementCount).toBe(0)
    map.open('settings')
    await fixture.whenStable()
    expect(panel.querySelector(':scope > .brand-header')?.textContent).toBe('Our settings')
  })

  it('renders projected fields instead of its own, as React renders children', async () => {
    @Component({
      imports: [MapSettings, MapExportField, MapZoomTargetField],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-settings [fields]="['basemap']">
          <label geoMapExportField class="brand-export" [formats]="['image/svg+xml']"></label>
          <label geoMapZoomTargetField (targetSelect)="chosen.push($event)"></label>
          <p class="brand-note">Areas come from the census.</p>
        </geo-map-settings>
      `,
    })
    class Host {
      readonly chosen: string[] = []
    }
    const map = fakeMap()
    const { fixture, panel } = await render(Host, map)
    const fields = panel.querySelector('.geo-settings-fields')!
    expect([...fields.children].map(sorted)).toEqual([
      ['brand-export', 'geo-settings-field', 'geo-shape-label'],
      ['geo-settings-field', 'geo-shape-label'],
      ['brand-note'],
    ])
    expect(fieldLabels(fields)).toEqual(['Download', 'Go to area'])
    expect(optionsOf(select(fields, 'Export map'))).toEqual([
      ['', 'Export report image', true],
      ['image/svg+xml', 'SVG', false],
    ])
    // A projected zoom-target field doesn't close the panel; its (targetSelect) is the host's.
    await choose(fixture, select(fields, 'Zoom to area'), 'africa')
    expect(map.actions.fitZoomTarget).toHaveBeenCalledWith('africa')
    expect(fixture.componentInstance.chosen).toEqual(['africa'])
    expect(map.actions.setOpenPanel).not.toHaveBeenCalled()
  })

  it('explains when it is used outside a map', () => {
    const parts: Type<unknown>[] = [
      MapSettings,
      MapBasemapField,
      MapZoomTargetField,
      MapExportField,
    ]
    for (const part of parts)
      expect(() => TestBed.createComponent(part)).toThrow(
        /must be used inside <geo-map-root> or <geo-map>/,
      )
  })
})

describe('the basemap field', () => {
  @Component({
    imports: [MapBasemapField],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<label
      geoMapBasemapField
      class="brand-field"
      id="basemap"
      style="color: red"
    ></label>`,
  })
  class Field {}

  it('lists the basemaps of the map’s projection and shows the active one', async () => {
    const map = fakeMap()
    const { fixture, element } = await render(Field, map)
    const label = element.querySelector('label')!
    expect(sorted(label)).toEqual(['brand-field', 'geo-settings-field', 'geo-shape-label'])
    expect(label.id).toBe('basemap')
    expect(label.style.color).toBe('red')
    expect(label.querySelector('.geo-settings-field-label')?.textContent).toBe('Basemap')
    const element_ = select(label, 'Basemap')
    expect(optionsOf(element_)).toEqual([
      ['light', 'Light', false],
      ['dark', 'Dark', false],
    ])
    expect(element_.value).toBe('dark')
    // The active basemap comes from the map's state.
    map.runtime.update((runtime) => ({
      ...runtime,
      state: { ...runtime.state, activeBasemapId: 'light' },
    }))
    await fixture.whenStable()
    expect(element_.value).toBe('light')
  })

  it('asks the map for the chosen basemap, and shows the map’s again when it is not taken', async () => {
    const map = fakeMap()
    const { fixture, element } = await render(Field, map)
    const element_ = select(element, 'Basemap')
    await choose(fixture, element_, 'light')
    expect(map.actions.setBasemap).toHaveBeenCalledWith('light')
    expect(element_.value).toBe('dark')
    vi.mocked(map.actions.setBasemap).mockImplementation((id) =>
      map.runtime.update((runtime) => ({
        ...runtime,
        state: { ...runtime.state, activeBasemapId: id },
      })),
    )
    await choose(fixture, element_, 'light')
    expect(element_.value).toBe('light')
  })

  it('is hidden, without classes, with fewer than two basemaps in the projection', async () => {
    const map = fakeMap(
      {},
      {
        config: {
          initialState: {
            ...config.initialState,
            view: { ...config.initialState.view, projection: 'EPSG:3857' },
          },
        },
      },
    )
    const { element } = await render(Field, map)
    const label = element.querySelector('label')!
    // Light and Streets support Web Mercator: shown.
    expect(optionsOf(select(label, 'Basemap')).map(([value]) => value)).toEqual([
      'light',
      'mercator-only',
    ])

    TestBed.resetTestingModule()
    const single = fakeMap(
      {},
      { config: { data: { ...config.data, basemaps: [config.data.basemaps[0]!] } } },
    )
    const hidden = (await render(Field, single)).element.querySelector('label')!
    expect(hidden.className).toBe('brand-field')
    expect(hidden.id).toBe('basemap')
    expect(hidden.hasAttribute('data-slot')).toBe(false)
    expect(hidden.style.display).toBe('none')
    expect(hidden.style.color).toBe('red')
    expect(hidden.childElementCount).toBe(0)
  })
})

describe('the zoom-target field', () => {
  it('starts on the disabled placeholder, zooms to the chosen area and tells (targetSelect)', async () => {
    @Component({
      imports: [MapZoomTargetField],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<label geoMapZoomTargetField (targetSelect)="chosen.push($event)"></label>`,
    })
    class Field {
      readonly chosen: string[] = []
    }
    const map = fakeMap()
    const { fixture, element } = await render(Field, map)
    const label = element.querySelector('label')!
    expect(sorted(label)).toEqual(['geo-settings-field', 'geo-shape-label'])
    expect(label.querySelector('.geo-settings-field-label')?.textContent).toBe('Go to area')
    const element_ = select(label, 'Zoom to area')
    expect(optionsOf(element_)).toEqual([
      ['', 'Choose area', true],
      ['africa', 'Africa', false],
      ['kenya', 'Kenya', false],
    ])
    expect(element_.value).toBe('')
    expect(element_.selectedIndex).toBe(0)
    await choose(fixture, element_, 'kenya')
    expect(map.actions.fitZoomTarget).toHaveBeenCalledWith('kenya')
    expect(fixture.componentInstance.chosen).toEqual(['kenya'])
    // Uncontrolled, as React's `defaultValue=""`: it shows the chosen area.
    expect(element_.value).toBe('kenya')
  })

  it('keeps the chosen area when the map’s configuration changes, as React’s uncontrolled select', async () => {
    @Component({
      imports: [MapZoomTargetField],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<label geoMapZoomTargetField></label>`,
    })
    class Field {}
    const map = fakeMap()
    const { fixture, element } = await render(Field, map)
    const element_ = select(element, 'Zoom to area')
    await choose(fixture, element_, 'kenya')
    // New messages (or a new theme, layers…) rebuild the options; the choice stays.
    map.static.update((value) => ({
      ...value,
      messages: { ...value.messages, chooseArea: 'Pick an area' },
    }))
    await fixture.whenStable()
    expect(optionsOf(element_)[0]).toEqual(['', 'Pick an area', true])
    expect(element_.value).toBe('kenya')
    expect(element_.querySelector('option[selected]')?.getAttribute('value')).toBe('kenya')
    // An area that is no longer offered falls back to the placeholder.
    map.static.update((value) => ({
      ...value,
      config: {
        ...value.config,
        data: { ...value.config.data, zoomTargets: [config.data.zoomTargets![0]!] },
      },
    }))
    await fixture.whenStable()
    expect(element_.value).toBe('')
  })

  it('is hidden, without classes, without zoom targets', async () => {
    @Component({
      imports: [MapZoomTargetField],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<label geoMapZoomTargetField class="brand-field"></label>`,
    })
    class Field {}
    const map = fakeMap({}, { config: { data: { ...config.data, zoomTargets: [] } } })
    const label = (await render(Field, map)).element.querySelector('label')!
    expect(label.className).toBe('brand-field')
    expect(label.hasAttribute('data-slot')).toBe(false)
    expect(label.style.display).toBe('none')
    expect(label.childElementCount).toBe(0)
  })
})

describe('the export field', () => {
  @Component({
    imports: [MapExportField],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<label
      geoMapExportField
      [formats]="formats()"
      [defaultFormat]="defaultFormat()"
    ></label>`,
  })
  class Field {
    readonly formats = signal<ExportConfig['formats']>(undefined)
    readonly defaultFormat = signal<ExportConfig['defaultFormat']>(undefined)
  }

  const exporting = (exportConfig?: ExportConfig) =>
    fakeMap({}, exportConfig ? { config: { export: exportConfig } } : {})

  it('offers every format by default, downloads the chosen one and shows the placeholder again', async () => {
    const map = exporting()
    const { fixture, element } = await render(Field, map)
    const label = element.querySelector('label')!
    expect(sorted(label)).toEqual(['geo-settings-field', 'geo-shape-label'])
    expect(label.querySelector('.geo-settings-field-label')?.textContent).toBe('Download')
    const element_ = select(label, 'Export map')
    expect(optionsOf(element_)).toEqual([
      ['', 'Export report image', true],
      ['image/png', 'PNG', false],
      ['image/jpeg', 'JPEG', false],
      ['image/svg+xml', 'SVG', false],
    ])
    expect(element_.value).toBe('')
    await choose(fixture, element_, 'image/jpeg')
    expect(map.actions.downloadImage).toHaveBeenCalledWith('image/jpeg')
    expect(element_.value).toBe('')
    await choose(fixture, element_, 'image/jpeg')
    expect(map.actions.downloadImage).toHaveBeenCalledTimes(2)
  })

  it('takes the formats and the first one from config.export, and lets its inputs override them', async () => {
    const map = exporting({
      formats: ['image/png', 'image/svg+xml'],
      defaultFormat: 'image/svg+xml',
    })
    const { fixture, element } = await render(Field, map)
    const values = () => optionsOf(select(element, 'Export map')).map(([value]) => value)
    expect(values()).toEqual(['', 'image/svg+xml', 'image/png'])
    fixture.componentInstance.formats.set(['image/jpeg', 'image/png'])
    await fixture.whenStable()
    // The preferred format comes first even when it is not among the formats, as in React.
    expect(values()).toEqual(['', 'image/svg+xml', 'image/jpeg', 'image/png'])
    fixture.componentInstance.defaultFormat.set('image/png')
    await fixture.whenStable()
    expect(values()).toEqual(['', 'image/png', 'image/jpeg'])
  })

  it('is hidden, without classes, when config.export.enabled is false', async () => {
    const { element } = await render(Field, exporting({ enabled: false }))
    const label = element.querySelector('label')!
    expect(label.className).toBe('')
    expect(label.hasAttribute('data-slot')).toBe(false)
    expect(label.style.display).toBe('none')
    expect(label.childElementCount).toBe(0)
  })

  it('keeps a static data-slot of the consumer, as React’s props do', async () => {
    @Component({
      imports: [MapExportField],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<label geoMapExportField data-slot="report-export" data-testid="export"></label>`,
    })
    class Custom {}
    const label = (await render(Custom, exporting())).element.querySelector('label')!
    expect(label.getAttribute('data-slot')).toBe('report-export')
    expect(label.getAttribute('data-testid')).toBe('export')
  })
})

describe('the settings panel in a map', () => {
  const mapConfig = { ...config, ui: { settings: { defaultOpen: true } } }

  it('is laid out by <geo-map> after the controls and before the layer panel', async () => {
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
        '.geo-map-stage > geo-map-controls + geo-map-settings ~ geo-map-layer-panel',
      ),
    ).not.toBeNull()
    expect(panel.getAttribute('data-slot')).toBe('map-settings')
    expect(fieldLabels(panel)).toEqual(['Basemap', 'Go to area', 'Download'])
    const rail = element.querySelector('button[aria-label="Map settings"]') as HTMLButtonElement
    expect(rail.getAttribute('aria-expanded')).toBe('true')
    ;(panel.querySelector('button[aria-label="Close map settings"]') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(panel.style.display).toBe('none')
    expect(rail.getAttribute('aria-expanded')).toBe('false')
    rail.click()
    await fixture.whenStable()
    expect(panel.getAttribute('role')).toBe('region')
    // One panel at a time: opening the layers closes the settings.
    ;(element.querySelector('button[aria-label="Layers"]') as HTMLButtonElement).click()
    await fixture.whenStable()
    expect(panel.style.display).toBe('none')
    expect(element.querySelector('geo-map-layer-panel')?.getAttribute('role')).toBe('region')
  })

  it('is left out when ui.settings.enabled is false', async () => {
    @Component({
      imports: [GeospatialMap],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<geo-map [config]="config" />`,
    })
    class Host {
      protected readonly config = { ...config, ui: { profile: 'embedded' as const } }
    }
    const { element } = await render(Host)
    expect(element.querySelector('geo-map-settings')).toBeNull()
    expect(element.querySelector('button[aria-label="Map settings"]')).toBeNull()
  })

  it('drives the map: basemap, area and export, and closes after an area', async () => {
    @Component({
      imports: [MapRoot, MapSettings],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root
          [config]="config"
          [state]="state()"
          (stateChange)="state.set($event)"
          [(openPanel)]="panel"
        >
          <geo-map-settings />
        </geo-map-root>
      `,
    })
    class Host {
      protected readonly config = config
      readonly state = signal<MapState>({ ...config.initialState, activeBasemapId: 'light' })
      readonly panel = signal<'layers' | 'settings' | null>('settings')
    }
    const { fixture, panel } = await render(Host)
    const controller = controllers[0]!
    controller.ready()
    await fixture.whenStable()
    expect(select(panel, 'Basemap').value).toBe('light')

    // The basemap: the controller switches, the map proposes the state, the host takes it.
    vi.spyOn(controller, 'setBasemap').mockReturnValue(true)
    vi.spyOn(controller, 'getActiveBasemapId').mockReturnValue('dark')
    await choose(fixture, select(panel, 'Basemap'), 'dark')
    expect(controller.setBasemap).toHaveBeenCalledWith('dark')
    expect(fixture.componentInstance.state().activeBasemapId).toBe('dark')
    expect(select(panel, 'Basemap').value).toBe('dark')

    // The export.
    const createObjectURL = vi.fn(() => 'blob:map')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await choose(fixture, select(panel, 'Export map'), 'image/png')
    expect(controller.exportImage).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'image/png' }),
    )
    await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalled())

    // The area: the map fits its bounds, and the panel closes through [(openPanel)].
    await choose(fixture, select(panel, 'Zoom to area'), 'kenya')
    expect(controller.fit).toHaveBeenCalledWith(
      [33.9, -4.7, 41.9, 5.0],
      expect.objectContaining({ maxZoom: 6 }),
    )
    expect(fixture.componentInstance.panel()).toBeNull()
    expect(panel.style.display).toBe('none')
  })
})
