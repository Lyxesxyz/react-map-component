# Contributing to the Angular folder

This guide is for work on `packages/geospatial-map-angular` itself (it is not copied with `src/`). Read the root `AGENTS.md` and `angular-plan.md` first. The React folder, `packages/geospatial-map/src`, is the reference: every Angular part renders the same DOM as its React part.

## What exists

| File                                                                                       | What it is                                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `map-engine.ts`, `arcgis-config.ts`, `world-fit.ts`                                        | The engine (port of `use-map-engine.ts` and helpers). Drives the shared `map-bridges.ts`.                                |
| `map-root.ts`                                                                              | `MapRootBase` (shared inputs, outputs, host bindings, `actions`) and `<geo-map-root>`                                    |
| `geospatial-map.ts`                                                                        | `<geo-map>`, the preset: every part, in React's `GeospatialMapLayout` order, behind `@if (ui.<part>.enabled)`            |
| `map-context.ts`                                                                           | `MAP_CONTEXT` and the `inject*()` functions                                                                              |
| `signals.ts`                                                                               | `controllableSignal`, `partHostStyle`, `parseStyle`, `optionalBooleanAttribute`, `injectUniqueId`, `injectHostAttribute` |
| `map-anchor.ts`                                                                            | `anchoredPosition()`, the popup and tooltip placement                                                                    |
| `map-templates.ts`                                                                         | `geoMapPopup`, `geoMapTooltip`, `geoMapControl`, `geoMapError`, `geoMapConfigError` templates                            |
| `icons.ts`, `map-icon.ts`                                                                  | `defaultMapIcons`, `MAP_ICONS`, `provideMapIcons()`; `<geo-map-icon>` and `svg[geoIcon]`                                 |
| `shapes.ts`                                                                                | The design-system swap point                                                                                             |
| `map-controls.ts`, `map-legend.ts`, `map-attribution.ts`, `map-popup.ts`, `map-tooltip.ts` | The parts built so far                                                                                                   |

Built in phase 3: `map-layer-panel.ts`, `map-settings.ts` (with `label[geoMapBasemapField]`, `label[geoMapZoomTargetField]`, `label[geoMapExportField]`), `map-time-controls.ts`, `map-grid.ts`, `map-breadcrumbs.ts`, `map-status-chips.ts`, `map-error-alert.ts`, `map-disclaimer.ts`, and `GEO_MAP_PARTS` in `index.ts` (every standalone part, template and shape, for `imports: [GEO_MAP_PARTS]`). Still to build (phase 6): the folder's `README.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `docs/` and `examples/`.

## Rules

- **Shared files** (`core/`, `config/`, `types.ts`, `map-bridges.ts`, `map-state.ts`, `messages.ts`, `theme.ts`, `utils.ts`, `geospatial-map.css`, …) are edited only in `packages/geospatial-map-core/src`, then `pnpm sync-core`. They must compile under `ng new` defaults too (`noPropertyAccessFromIndexSignature`: write `record['key']`).
- **Parity.** Same elements inside the parts, same `geo-*` classes, `data-slot`, `data-*` states, roles, labels and text as the React part. Class names are the React export names (`MapLegend`), selectors carry `geo` (`geo-map-legend`, `button[geoMapZoomIn]`).
- **Angular 21 and 22 stable APIs only.** Standalone components with `changeDetection: ChangeDetectionStrategy.OnPush`; `input()`, `model()`, `output()`, `contentChild()`, `viewChild()`; host bindings in `host: {}`; `@if`/`@for`/`@switch`. No NgModule, no `@Input`/`@Output`/`@HostBinding`/`@HostListener`, no `ChangeDetectorRef`, no `NgZone.run`, no RxJS, no `innerHTML`, no `resource()`. No v22 template syntax: no arrow functions or spread in templates (call a method instead).
- **Signal queries and inputs** can't be ES-private (`#field`); use `protected`/`private`.
- **No browser APIs outside the browser.** OpenLayers, `ResizeObserver`, `matchMedia`, geolocation and fullscreen only in `afterNextRender`, `afterRenderEffect` or event handlers. Use `effect()` only for work the server may do too.
- **Engine header.** `map-engine.ts`, `arcgis-config.ts`, `world-fit.ts`, `map-context.ts` and `signals.ts` start with the three-line engine header (the React one with "the map-\* parts" instead of "the map-\*.tsx parts"). Parts don't.

## Building a part

Port the React part line by line. The skeleton below is `MapLegend` reduced to the pattern:

```ts
@Component({
  selector: 'geo-map-legend', // React root is a div/section/footer/nav: an element
  imports: [MapLegendSymbol],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeCard], // React wraps the part in <ShapeCard>
  host: {
    // The host is React's root element; while hidden it has no part classes, ARIA or data-*.
    '[class]': 'hostClasses()',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "region")',
    '[attr.data-slot]': 'hidden() ? null : "map-legend"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.legend.placement)',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? map().messages.legend)',
    '[style]': 'hostStyle()', // the one and only style binding
  },
  template: `@if (!hidden()) {
    …
  }`,
})
export class MapLegend {
  readonly placement = input<MapPlacement>() // undefined = the config's default
  readonly expanded = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  protected readonly map = injectMapStatic()
  protected readonly consumerRole = injectHostAttribute('role') // the consumer's static role wins
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #legends = injectMapRuntime((map) => map.legends)
  protected readonly hidden = computed(() => !this.#legends().some((legend) => legend.visible))
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeCard, { self: true }).hideWhen(() => this.hidden())
  }
}
```

- **Read the map** only through `injectMapStatic()` (config, `ui`, messages, actions, icons; never `null`), `injectMapRuntime(select)` (select the smallest slice), `injectMapActions()`, `injectMapIcons()`, `injectMapPixel(() => lonLat)`, `injectHoveredFeature()` and `injectSlotContext()`. Never inject `MapRoot` or `GeospatialMap`: tests provide a fake `MAP_CONTEXT`.
- **Defaults from `config.ui`.** A behaviour input is `undefined` by default and falls back to `map().ui.<part>.<field>` where it is read, exactly like React's `prop ?? ui.x`. Use `optionalBooleanAttribute` for booleans with a config default (`<geo-map-attribution compact>`), `booleanAttribute` for plain flags.
- **Hidden parts** (React returns `null`): keep the host, bind every class, role, ARIA and `data-*` attribute to `null`/`false` while hidden, put `display: none` in the style map through `partHostStyle(() => this.hidden())`, and call `hideWhen` on shapes applied through `hostDirectives`. Never bind `[style.display]`: a consumer's static `display` would beat it. `partHostStyle` re-emits the consumer's static `style`, so it wins over the part's own values as in React.
- **Consumer attributes.** A host binding beats a static attribute the consumer writes on the element, so a part that binds `[attr.role]` or `[attr.aria-*]` reads the consumer's with `injectHostAttribute('aria-label')` and binds `consumer ?? own`, as React's `{ ...props }` lets the consumer's win. Static host attributes (`role: 'group'` on `MapControls`) need nothing: the consumer's static attribute already wins over them.
- **Classes that depend on state** (`geo-legend-${layout}`): a `[class]` map from a `computed`; static consumer classes are kept.
- **Shapes.** `ShapeCard`/`ShapeAlert` on the host through `hostDirectives` (+ `hideWhen`); `button[geoShapeButton]`, `button[geoShapeIconButton] [label]`, `<geo-shape-select>`, `input[type=range][geoShapeSlider]`, `label[geoShapeSwitch]`, `[geoShapeLabel]`, `[geoShapeBadge]` in templates. Don't restyle in a part what a shape draws.
- **Icons.** `<geo-map-icon [icon]="map().icons.Close" />` as the button's content (`iconClass="geo-spin"` for a spinner). Never import from `lucide` in a part; icons come from the map.
- **Buttons on the host** (`button[geoMapX]`) extend `MapBuiltInButton<'action'>` (map-controls.ts): it sets the classes, label, `beforeAction` and the click. Add a new attribute to `geoButtonParts` in `eslint.config.js` (and a `label[geo…]` part that renders its own control, like `label[geoShapeSwitch]`, to `geoLabelParts`). Other cancellable clicks (the breadcrumbs' `targetClick`) emit a `MapActionEvent` synchronously and skip the action when `defaultPrevented`.
- **Content.** React render props become `ng-template` directives in `map-templates.ts`, each with `static ngTemplateContextGuard(_dir, ctx: unknown): ctx is Context { return typeof ctx === 'object' }`. The part reads its own with `contentChild(…)` and also takes a `template` input, which `<geo-map>` uses to forward the templates declared inside it. React `header`/`footer` props become `<ng-content select="[geoMapPanelHeader]">` with the default header as fallback content, and `[geoMapPanelFooter]`.
- **Projected content with a fallback**: `<ng-content>fallback</ng-content>`. An `<ng-template>` child counts as content, so sink templates first: `<ng-content select="ng-template" />` (see `MapControls`).
- **Text.** Angular keeps the spaces around `{{ }}` inside a text node. Keep text bindings on one line between tags (`<p>{{ x }}</p>`), or use `<ng-container>{{ x }}</ng-container>` or `[textContent]`, so `textContent` matches React exactly.
- **Ids** that link ARIA attributes: `injectUniqueId('geo-…')`.
- **Controlled values** (`[(open)]`): an input plus an output, with `controllableSignal({ value, initial, onChange, resetKey })`, or `model()` when React has no uncontrolled default.
- **Placement next to a feature**: `anchoredPosition(() => pixel, gap)`.
- **Register it**: export it from `index.ts` under the React name, add it to `GEO_MAP_PARTS` and to the pinned list in `test/exports.test.ts` (which also matches every export against React's `index.ts`), and add it to `<geo-map>` in the order of React's `GeospatialMapLayout`, behind `@if (ui.<part>.enabled)`.

## Known differences from React

- Outputs: `mapError` is React's `onError`; `stateChange` carries the state and `stateChangeDetails` the `{ state, change }`; `MapZoomTargetField`'s `onSelect` is `(targetSelect)` (`select` is a DOM event name).
- `<geo-map-grid>`: each per-map output emits `{ mapId, event }` (`MapGridEvent`), and `stateChangeDetails` emits `{ state, mapId, change }`, where React's callbacks take the map id as their last argument. Its `geoMapPopup`, `geoMapTooltip` and `geoMapControl` templates replace React's `slots`. With more than six maps the host itself is the alert (`display: block` inline, since a custom element is inline), and a consumer `class` stays on it, where React's error `<div>` drops `className` (its `role` is always `alert`).
- Built-in buttons cancel through `(beforeAction)` + `preventDefault()`; a template `(click)` runs after the action.
- `<geo-map-breadcrumbs>`: React's `onTargetClick(target, event)` is `(targetClick)`, which emits a `MapTargetClickEvent` (a `MapActionEvent<'fitZoomTarget'>` with `target`, the `ZoomTarget`, and `source`, the click); `preventDefault()` on it or on `source` skips the zoom. The host carries `role="navigation"` for React's `<nav>`.
- Angular can't tell whether `(featureSelect)` has a listener, so the React hint "onFeatureSelect is set, but no layer is selectable" is not logged. The Angular guide must say it instead.
- SVG node icons have lucide's attributes but not its `lucide lucide-*` classes; the `<geo-map-icon class="geo-icon">` wrapper has `display: contents`.
- Hidden parts keep their (empty) host element. A consumer `[style.display]` binding can show a hidden part (R7).
- `<geo-map-error-alert>`: React's function children are `<ng-template geoMapError let-error let-dismiss="dismiss">` (or the `[template]` input); `<geo-map>` doesn't forward one, as React's preset has no error slot. `<geo-map-disclaimer>`: `title` is the heading input, so the host never has a `title` attribute; with neither projected content nor `ui.disclaimer.text`, its hidden host keeps one empty `<span>` (it holds the `<ng-content>`).
- `injectMapIcons()` outside a map returns the app's icons, like React's `useMapIcons()`.
- The Angular demo can't serve `apps/demo-shared/public` as assets directly: the CLI only takes asset folders inside the app. Its `dev` and `build` scripts first run `scripts/sync-public.mjs`, which copies it into `apps/demo-angular/public` (gitignored), served at the site root. Start the demo through those scripts (`pnpm --filter geospatial-map-demo-angular dev --port …`), not `exec ng serve`, or the `/data/…` files are missing on a fresh clone.

## Checks

From the repository root:

```sh
pnpm --filter geospatial-map-angular typecheck   # ngc, strict templates: src, then src + tests
pnpm exec vitest run --project angular           # the Angular tests (pnpm test runs every project)
pnpm lint && pnpm format:check
pnpm build:angular                               # the demo, with its budgets
pnpm dev:angular                                 # the demo on http://127.0.0.1:4200
```

**Unit tests** (`test/`): the jsdom tests mock the OpenLayers controller with `test/fake-controller.ts` (`vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)`) and play the renderer (`ready()`, `move()`, `hover()`, `click()`); a part alone gets a fake `MAP_CONTEXT` (see `fakeContext` in `parts.test.ts`). Server-rendering tests start with `// @vitest-environment node` and use `renderApplication` (see `ssr.test.ts`).

**Browser.** Until the shared Playwright config gets the Angular projects (phase 5), port the scenario to `apps/demo-angular` (same labels and routes as the React harness) and run its spec against `ng serve` with a local, untracked config:

```ts
// playwright.angular.local.config.ts (listed in .git/info/exclude)
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'quickstart.spec.ts',
  use: { baseURL: 'http://127.0.0.1:4174' },
  webServer: {
    command: 'pnpm --filter geospatial-map-demo-angular dev --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium-angular', use: { ...devices['Desktop Chrome'] } }],
})
```

Check `?zone` too (zone.js change detection), and that no `[geospatial-map]` hint is logged.

**DOM parity.** Open the same route in both demos (React `pnpm dev`, Angular `pnpm dev:angular`) at the same viewport, and compare the visible elements inside `[data-slot="map"]`: their `geo-*` classes, `data-slot`, `data-*` states, `role`, `aria-*`, `title` and text must be the same. Angular adds only the part hosts' element names and the `<geo-map-icon class="geo-icon">` wrappers. Then compare screenshots of both maps; boxes should match to the pixel.
