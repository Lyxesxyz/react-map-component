import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../src/index'
import { GEO_MAP_PARTS, defineMapConfig } from '../src/index'
import { resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

// The folder's public API: what `index.ts` exports, how it maps to the React folder's
// `index.ts`, and `GEO_MAP_PARTS`. A part added to one folder only fails here, by name.

/** Every name a module exports, values and types, as TypeScript resolves them. */
function exportedNames(file: string): string[] {
  const program = ts.createProgram([file], {
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  })
  const checker = program.getTypeChecker()
  const module = checker.getSymbolAtLocation(program.getSourceFile(file)!)!
  return checker
    .getExportsOfModule(module)
    .map((symbol) => symbol.name)
    .sort()
}

// (jsdom's `URL` replaces Node's here, so resolve from the file path.)
const folder = path.dirname(fileURLToPath(import.meta.url))
const angularIndex = path.join(folder, '../src/index.ts')
const reactIndex = path.join(folder, '../../geospatial-map/src/index.ts')

/** The runtime exports (classes, functions, constants, tokens), grouped as in `index.ts`. */
const pinnedValues = [
  // Layouts, root and parts
  'GeospatialMap',
  'MapGrid',
  'MapRoot',
  'MapRootBase',
  'MapAttribution',
  'MapBreadcrumbs',
  'MapTargetClickEvent',
  'MapBuiltInButton',
  'MapControlButton',
  'MapControlGroup',
  'MapControls',
  'MapFitButton',
  'MapFullscreenButton',
  'MapLayersButton',
  'MapLocateButton',
  'MapResetZoomButton',
  'MapSettingsButton',
  'MapZoomInButton',
  'MapZoomOutButton',
  'MapDisclaimer',
  'MapErrorAlert',
  'MapLayerPanel',
  'MapLegend',
  'MapLegendSymbol',
  'MapPopup',
  'MapBasemapField',
  'MapExportField',
  'MapSettings',
  'MapZoomTargetField',
  'MapStatusChips',
  'MapTimeControls',
  'MapTooltip',
  'MapActionEvent',
  // Templates
  'MapConfigErrorTemplate',
  'MapControlTemplate',
  'MapErrorTemplate',
  'MapPopupTemplate',
  'MapTooltipTemplate',
  // Injection functions, icons
  'MAP_CONTEXT',
  'injectHoveredFeature',
  'injectMap',
  'injectMapActions',
  'injectMapIcons',
  'injectMapPixel',
  'injectMapRuntime',
  'injectMapStatic',
  'injectSlotContext',
  'anchoredPosition',
  'MAP_ICONS',
  'defaultMapIcons',
  'provideMapIcons',
  'MapIconView',
  'SvgIcon',
  'isSvgIcon',
  // Shapes, the parts list, helpers
  'ShapeAlert',
  'ShapeBadge',
  'ShapeButton',
  'ShapeCard',
  'ShapeIconButton',
  'ShapeLabel',
  'ShapeSelect',
  'ShapeSlider',
  'ShapeSwitch',
  'GEO_MAP_PARTS',
  'cn',
  'GEOSPATIAL_MAP_VERSION',
  // Configuration, theming, localization
  'defineMapConfig',
  'validateMapConfig',
  'mapConfigSchema',
  'mapInputSchema',
  'arcgisBasemap',
  'esriWorldBasemap',
  'plainBasemap',
  'tileBasemap',
  'worldBasemap',
  'defaultMapMessages',
  'formatMapMessage',
  'mapThemeTokenNames',
  'accessiblePalettes',
  'createClassifiedPolygonStyle',
  'fetchGeoJson',
]

/** React exports with no Angular counterpart, besides `*Props` types and `use*` hooks. */
const reactOnly: Record<string, string> = {
  GeospatialMapHandle:
    'the ref handle; Angular uses `#map="geoMap"` or `viewChild(GeospatialMap)`, whose `actions` are `MapActions`',
  MapSlots:
    'the slots prop; Angular declares geoMapPopup, geoMapTooltip and geoMapControl templates',
}

/** Angular exports with no React counterpart, besides `inject*` for React's `use*`. */
const angularOnly: Record<string, string> = {
  GEO_MAP_PARTS: 'every standalone part, for `imports`',
  MapRootBase: "the inputs and outputs <geo-map> and <geo-map-root> share (React's MapRootProps)",
  MapBuiltInButton: 'the base class of the built-in buttons',
  MapActionEvent: "the cancellable `(beforeAction)` event (React's onClick + preventDefault)",
  MapButtonAction: 'the actions a `MapActionEvent` names',
  MapTargetClickEvent: "the breadcrumbs' cancellable `(targetClick)` event",
  MapPopupTemplate: "React's popup render prop",
  MapTooltipTemplate: "React's tooltip render prop",
  MapControlTemplate: "React's slots.controls / customControls",
  MapErrorTemplate: "React's MapErrorAlert function children",
  MapConfigErrorTemplate: "React's renderConfigError",
  MapPopupContext: 'the geoMapPopup template context',
  MapTooltipContext: 'the geoMapTooltip template context',
  MapControlContext: 'the geoMapControl template context',
  MapErrorContext: 'the geoMapError template context',
  MapConfigErrorContext: 'the geoMapConfigError template context',
  MAP_CONTEXT: 'the injection token the parts read (tests provide a fake one)',
  MapContext: "the MAP_CONTEXT value's type",
  injectSlotContext:
    "the `{ state, actions }` of a template's context, for its components (React's useSlotContext is internal)",
  anchoredPosition: "places a custom overlay part (React's useAnchoredPosition is internal)",
  MAP_ICONS: 'the icons token',
  provideMapIcons: 'icons for an app or a route',
  MapIconView: '<geo-map-icon>, which renders an icon node list or component',
  SvgIcon: '`svg[geoIcon]`, which renders an icon node list',
  isSvgIcon: 'tells an icon node list from an icon component',
  MapSvgIcon: "lucide's icon node list",
  ShapeSelectOption: 'the `options` input of <geo-shape-select> (React takes <option> children)',
  MapStateChangeEvent: 'the `(stateChangeDetails)` payload: React passes (state, change)',
  MapGridEvent: 'a grid output payload, `{ mapId, event }`: React passes the map id last',
  MapGridStateChangeEvent: "the grid's `(stateChangeDetails)` payload",
  MapConfigValidator: 'the `[validate]` input type',
  MapOpenLayersHook: 'the `[onOpenLayersMap]` input type',
}

/** The Angular name for a React export, or `null` when React-only by rule. */
function angularName(reactName: string): string | null {
  if (reactName.endsWith('Props')) return null
  if (/^use[A-Z]/.test(reactName)) return `inject${reactName.slice(3)}`
  return reactName
}

const angularNames = exportedNames(angularIndex)
const reactNames = exportedNames(reactIndex)

describe('index.ts', () => {
  it('exports the pinned runtime API', () => {
    expect(Object.keys(api).sort()).toEqual([...pinnedValues].sort())
    // TypeScript sees the same values, plus the types (matched against React below).
    expect(pinnedValues.filter((name) => !angularNames.includes(name))).toEqual([])
  })

  it('exports every React name in its Angular form, and only names the lists explain', () => {
    const counterparts = new Set(reactNames.map(angularName))
    const missing = reactNames.filter((name) => {
      const angular = angularName(name)
      return angular !== null && !(name in reactOnly) && !angularNames.includes(angular)
    })
    expect(missing).toEqual([])
    const unexplained = angularNames.filter(
      (name) => !counterparts.has(name) && !(name in angularOnly),
    )
    expect(unexplained).toEqual([])
    // The lists stay true: no React-only name exists in Angular, and the reverse.
    expect(Object.keys(reactOnly).filter((name) => !reactNames.includes(name))).toEqual([])
    expect(Object.keys(reactOnly).filter((name) => angularNames.includes(name))).toEqual([])
    expect(Object.keys(angularOnly).filter((name) => !angularNames.includes(name))).toEqual([])
    expect(Object.keys(angularOnly).filter((name) => counterparts.has(name))).toEqual([])
  })
})

type Definition = { selectors: unknown[]; standalone: boolean }

/** The component or directive definition a class declares itself (not one it inherits). */
function definition(value: unknown): Definition | undefined {
  if (typeof value !== 'function') return undefined
  const own = (key: string) =>
    Object.prototype.hasOwnProperty.call(value, key)
      ? (value as unknown as Record<string, Definition>)[key]
      : undefined
  return own('ɵcmp') ?? own('ɵdir')
}

describe('GEO_MAP_PARTS', () => {
  beforeEach(() => resetControllers())

  it('holds every exported standalone component and directive with a selector, once', () => {
    const usable = Object.entries(api)
      .filter(([, value]) => (definition(value)?.selectors.length ?? 0) > 0)
      .map(([name]) => name)
      .sort()
    const listed = GEO_MAP_PARTS.map(
      (part) => Object.entries(api).find(([, value]) => value === part)?.[0] ?? '(not exported)',
    ).sort()
    expect(listed).toEqual(usable)
    expect(new Set(GEO_MAP_PARTS).size).toBe(GEO_MAP_PARTS.length)
    expect(GEO_MAP_PARTS.filter((part) => !definition(part)?.standalone)).toEqual([])
    // The abstract bases are not parts.
    expect(GEO_MAP_PARTS).not.toContain(api.MapRootBase as never)
    expect(GEO_MAP_PARTS).not.toContain(api.MapBuiltInButton as never)
  })

  it('is all a custom layout needs in `imports`', async () => {
    @Component({
      selector: 'test-every-part',
      imports: [GEO_MAP_PARTS],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <geo-map-root [config]="config" data-testid="custom">
          <ng-template geoMapConfigError let-error>{{ error.message }}</ng-template>
          <geo-map-controls placement="top-left">
            <geo-map-control-group>
              <button geoMapZoomIn></button>
              <button geoMapZoomOut></button>
              <button geoMapResetZoom></button>
              <button geoMapLocate></button>
              <button geoMapFit></button>
              <button geoMapFullscreen></button>
            </geo-map-control-group>
            <geo-map-control-group>
              <button geoMapLayers></button>
              <button geoMapSettings></button>
            </geo-map-control-group>
          </geo-map-controls>
          <geo-map-settings>
            <label geoMapBasemapField></label>
            <label geoMapZoomTargetField></label>
            <label geoMapExportField></label>
          </geo-map-settings>
          <geo-map-breadcrumbs />
          <geo-map-layer-panel />
          <geo-map-legend />
          <geo-map-popup>
            <ng-template geoMapPopup let-feature>{{ feature.featureId }}</ng-template>
          </geo-map-popup>
          <geo-map-tooltip>
            <ng-template geoMapTooltip let-feature>{{ feature.featureId }}</ng-template>
          </geo-map-tooltip>
          <geo-map-disclaimer>Not official.</geo-map-disclaimer>
          <geo-map-status-chips />
          <geo-map-time-controls />
          <geo-map-error-alert>
            <ng-template geoMapError let-error>{{ error.message }}</ng-template>
          </geo-map-error-alert>
          <geo-map-attribution compact />
          <section geoShapeCard class="host-card">
            <span geoShapeLabel>Area</span>
            <span geoShapeBadge>New</span>
            <geo-shape-select ariaLabel="Year" [options]="years" value="2024" />
            <input
              type="range"
              geoShapeSlider
              aria-label="Share"
              min="0"
              max="1"
              step="0.1"
              value="0.5"
            />
            <label geoShapeSwitch label="Labels" [checked]="true"></label>
            <button geoShapeButton>Apply</button>
            <button geoShapeIconButton label="Close"><geo-map-icon [icon]="close" /></button>
            <svg [geoIcon]="close"></svg>
            <svg geoMapLegendSymbol [entry]="entry"></svg>
            <p geoShapeAlert>Check the data.</p>
          </section>
        </geo-map-root>
        <geo-map [config]="withHome" data-testid="preset">
          <ng-template geoMapControl="custom:home" let-actions="actions">
            <button geoMapControl label="Home" (click)="actions.fit([-180, -90, 180, 90])"></button>
          </ng-template>
        </geo-map>
        <geo-map-grid [config]="grid" />
      `,
    })
    class EveryPart {
      protected readonly config = defineMapConfig({
        accessibility: { ariaLabel: 'Every part' },
        data: { layers: [] },
      })
      protected readonly withHome = defineMapConfig({
        ...this.config,
        ui: { controls: { groups: [{ id: 'home', controls: ['custom:home'] }] } },
      })
      protected readonly grid = { shared: this.config, maps: [{ id: 'one', title: 'One' }] }
      protected readonly years = [
        { value: '2023', label: '2023' },
        { value: '2024', label: '2024' },
      ]
      protected readonly close = api.defaultMapIcons.Close as api.MapSvgIcon
      protected readonly entry: api.LegendEntry = {
        id: 'area',
        label: 'Area',
        symbol: { kind: 'polygon', fillColor: '#2563eb' },
      }
    }
    // errorOnUnknownElements and errorOnUnknownProperties (test/setup.ts) fail on a part
    // the list misses.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fixture = TestBed.createComponent(EveryPart)
    await fixture.whenStable()
    const element = fixture.nativeElement as HTMLElement
    expect(element.querySelectorAll('[data-slot="map"]')).toHaveLength(3)
    const custom = element.querySelector('[data-testid="custom"]')!
    expect(custom.querySelector('button[aria-label="Zoom in"]')).not.toBeNull()
    expect(custom.querySelector('.geo-disclaimer')).not.toBeNull()
    expect(custom.querySelector('.host-card .geo-shape-select-wrap select')).not.toBeNull()
    expect(custom.querySelector('.host-card input.geo-shape-slider')).not.toBeNull()
    expect(custom.querySelector('.host-card svg.geo-legend-symbol')).not.toBeNull()
    const preset = element.querySelector('[data-testid="preset"]')!
    expect(preset.querySelector('button[aria-label="Home"]')).not.toBeNull()
    expect(element.querySelector('geo-map-grid.geo-map-grid')).not.toBeNull()
    // No hint but the stylesheet one (jsdom loads no CSS).
    const hints = warn.mock.calls.map((call) => String(call[0]))
    expect(hints.filter((hint) => !hint.includes('geospatial-map.css'))).toEqual([])
    warn.mockRestore()
  })
})
