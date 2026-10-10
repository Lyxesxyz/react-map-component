# Angular version: implementation plan

This plan adds an Angular version of the geospatial map next to the React one. Both stay copy-paste folders in the shadcn/ui style, both travel with agent guides, and both demos can be launched side by side.

- **Target:** Angular 21 and 22, standalone components, signals, zoneless, `OnPush`.
- **Status:** implemented, released as 0.10.0. Decisions confirmed by the owner are in section 12; what changed during implementation is in section 13. The plan below is kept as written; where it differs from the code, section 13 and the code win.
- **Release:** both folders ship as 0.10.0.

## 1. Decisions at a glance

| #   | Decision                                                                                                                                                                                                                                                        | Why                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Share the engine, rewrite only the UI layer.** `core/`, `config/`, the types, the bridge, messages, theme, basemaps and the stylesheet are framework-neutral. They move to one source of truth and are synced, byte for byte, into both folders.              | About three quarters of the code (by lines) and all of the OpenLayers behaviour is framework-neutral already. Writing it twice would make the two versions drift apart.                                              |
| D2  | **Each folder stays self-contained.** The Angular team copies one folder and runs one install command, exactly like the React team. The shared files are committed copies, not an import from elsewhere.                                                        | This keeps the copy-paste promise. It also keeps the three-way update script working, because it reads each folder's git history.                                                                                    |
| D3  | **Same DOM, same CSS, same tests.** Angular parts render the same elements, `geo-*` classes, `data-slot`, `data-*` state attributes, roles and labels as the React parts. One stylesheet and one Playwright suite serve both.                                   | The browser suite becomes the parity contract. The demo themes (Material, Carbon, editorial) restyle both versions unchanged.                                                                                        |
| D4  | **Same public names.** Angular classes use the React names (`GeospatialMap`, `MapRoot`, `MapLegend`, …). Element selectors are `geo-map-*`. Hooks become `inject*()` functions (`useMapRuntime` → `injectMapRuntime`).                                          | Docs, examples and agent guides map one to one. Angular's current style guide drops the `Component` suffix anyway.                                                                                                   |
| D5  | **Only APIs that are stable in both Angular 21 and 22.** Use `signal`, `computed`, `linkedSignal`, `effect`, `afterNextRender`, `afterRenderEffect`, `input`, `model`, `output`, `contentChild`, control flow, `@defer`, and `ng-content` fallback content.     | `resource`, Signal Forms and `@angular/aria` were experimental or in developer preview in 21. Arrow functions and spread in templates, and `@Service`, are new in 22. A v21 consumer build in CI enforces this rule. |
| D6  | **Every component sets `changeDetection: ChangeDetectionStrategy.OnPush` explicitly.** It's the default only from v22. Nothing depends on zone.js, but the map also works in zone-based apps: OpenLayers runs outside the Angular zone.                         | Zoneless is the default for new v21 apps. Many existing apps still load zone.js.                                                                                                                                     |
| D7  | **Dependencies: `ol ol-mapbox-style proj4 typebox lucide`**, dev `@types/geojson`, and peers `@angular/core` and `@angular/common` `^21.0.0 \|\| ^22.0.0`. No RxJS imports, no `@angular/forms`, no CDK.                                                        | `lucide` is the framework-neutral icon package. It mirrors `lucide-react`, needs no Angular wrapper, and has no Angular version range.                                                                               |
| D8  | **The demos are two apps sharing one set of scenarios.** `apps/demo` (React, Vite) and `apps/demo-angular` (Angular CLI) import fixtures, configs, harness CSS, themes and data from `apps/demo-shared`. Each demo header links to the same route in the other. | The demos load the folders exactly as a host app would. Two frameworks in one page would hide real integration problems.                                                                                             |

## 2. What is shared and what is rewritten

The inventory below is of `packages/geospatial-map/src` today (about 14,800 lines of TypeScript and CSS, about 11,400 of them framework-neutral).

**Shared unchanged (synced copies).** These are framework-neutral now:

- `core/**` (27 files, OpenLayers engine)
- `config/**` (schema, normalize, validate, ui-profiles, legacy)
- `basemaps.ts`, `world-data.ts` (generated), `messages.ts`, `theme.ts`, `map-state.ts`, `utils.ts`, `testing.ts`, `version.ts`
- `geospatial-map.css`
- `examples/symbology-layers.ts`, `examples/map-ready-check.ts`, `examples/brand-theme.css`

**Shared after a small refactor** (phase 1):

| File                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`           | Keep every config, state, event, action and runtime type here. Move the React-only types (`MapSlots`, `CustomControls`, `MapIcon`, `MapIcons`, `MapRootProps`, `GeospatialMapProps`, `MapGridProps`, `MapStaticValue`, `MapContextValue`) to a new per-framework `component-types.ts`. Add a neutral `MapHostInputs` type: `MapCallbacks` plus `state`, `onStateChange`, `openPanel`, `onOpenPanelChange`, `loadGeoJson` and `onOpenLayersMap`. |
| `map-bridges.ts`     | Type its `props` as `MapHostInputs` instead of `MapRootProps`. No behaviour change.                                                                                                                                                                                                                                                                                                                                                             |
| `geospatial-map.css` | (1) Give `.geo-map-root` (and any other part class that relies on a `div`'s default display) `display: block`; Angular host elements are inline by default. (2) Let the two `.geo-shape-icon-button > svg` rules also match an icon component's `svg` one level down, using `:where()` so specificity stays at one class. Both changes are invisible in React.                                                                                  |
| `docs/`              | Four guides are framework-neutral apart from a few samples: `configuration`, `layers-and-legends`, `theming-localization` (tokens and classes) and `troubleshooting`. Rewrite their samples as plain config objects and share them. `getting-started`, `state-events-slots`, `export-grid-integration` and `migration` stay per framework.                                                                                                      |

**Rewritten for Angular.** These are the React-specific files, about 3,000 lines:

- the parts (`map-*.tsx`), `geospatial-map.tsx`, `map-grid.tsx`, `map-root.tsx`
- the engine hook and its helpers (`use-map-engine.ts`, `use-arcgis-config.ts`, `use-world-fit.ts`, `hooks.ts`)
- context and anchoring (`map-context.ts`, `map-anchor.ts`)
- primitives and icons (`shapes.tsx`, `icons.ts`)
- the agent guides, README, getting started and examples

## 3. Repository layout after the change

```text
/
├── AGENTS.md, CLAUDE.md            NEW: contributor guide for agents (sync rule, parity rule, commands)
├── angular.json?                   only if the phase 0 spike needs it (see R1)
├── apps/
│   ├── demo/                       React demo (Vite), now imports apps/demo-shared
│   ├── demo-angular/               NEW: Angular CLI demo (v22, zoneless), same scenarios and routes
│   └── demo-shared/                NEW: scenario ids and URL parsing, demo-config, world, fixtures,
│                                   harness CSS, themes/*.css, public/data
├── packages/
│   ├── geospatial-map-core/        NEW: source of truth for the shared files and their unit tests
│   │   ├── src/                    core/, config/, types.ts, map-bridges.ts, css, shared docs/examples…
│   │   └── test/                   moved from the React package: core/*, config, schema, theme tokens
│   ├── geospatial-map/             React folder (unchanged path; shared files are synced copies)
│   └── geospatial-map-angular/     NEW: Angular folder
│       ├── src/                    ← what Angular teams copy
│       ├── test/                   unit, SSR, portability, guide tests; consumer-v21/, consumer-v22/
│       ├── package.json            the exact dependency list (checked by a test)
│       └── vitest.config.ts
├── scripts/
│   ├── sync-core.mjs               NEW: copies shared files into both folders; --check fails on drift
│   ├── update-geospatial-map.mjs   framework-aware (detects .tsx or .ts parts, or --framework)
│   ├── write-schema.mjs, build-world-data.mjs   now write into geospatial-map-core
└── tests/browser/                  one suite, run against both demos
```

The React package keeps its path. The update script's history lookups and every existing link keep working.

## 4. The Angular folder

### 4.1 Files

```text
packages/geospatial-map-angular/src/
├── README.md  AGENTS.md  CLAUDE.md  CHANGELOG.md
├── index.ts                     every public export, plus GEO_MAP_PARTS (all parts, for `imports`)
├── component-types.ts           MapIcon, MapIcons, MapStaticValue, MapContextValue, template contexts,
│                                MapGridEvent<T>
├── geospatial-map.ts            <geo-map>: the preset layout
├── map-root.ts                  <geo-map-root>, plus MapRootBase (inputs and outputs shared with the preset)
├── map-engine.ts                engine (port of use-map-engine.ts); engine header
├── arcgis-config.ts             ArcGIS service loading with signals (port of use-arcgis-config.ts)
├── world-fit.ts                 measure before start (port of use-world-fit.ts)
├── map-context.ts               MAP_CONTEXT token and the inject*() functions; engine header
├── signals.ts                   controllable-state helper (port of hooks.ts); engine header
├── map-anchor.ts                anchoredPosition(): afterRenderEffect that places popup and tooltip
├── map-templates.ts             ng-template directives with typed contexts; header and footer markers
├── map-icon.ts                  <geo-map-icon>: renders an SVG icon node or an icon component
├── icons.ts                     defaultMapIcons (from lucide), provideMapIcons()
├── shapes.ts                    UI primitives, the design-system swap point
├── map-controls.ts  map-layer-panel.ts  map-legend.ts  map-popup.ts  map-tooltip.ts  map-settings.ts
├── map-time-controls.ts  map-breadcrumbs.ts  map-status-chips.ts  map-error-alert.ts
├── map-disclaimer.ts  map-attribution.ts  map-grid.ts
├── (synced) types.ts messages.ts theme.ts utils.ts map-state.ts map-bridges.ts basemaps.ts
│            world-data.ts testing.ts version.ts geospatial-map.css config/ core/
├── docs/        shared guides, plus Angular getting-started, state-events-templates,
│                export-grid-integration (Angular CLI, SSR, @defer) and migration
└── examples/    quick-start.ts, admin-choropleth.ts, arcgis-indicators.ts, authenticated-data.ts,
                 brand-theme.ts (+ shared .css), controlled-state-and-grid.ts, custom-layout.ts,
                 and the shared symbology-layers.ts and map-ready-check.ts
```

Templates are inline, so each part is one file, like the `.tsx` parts. Components declare no `styles`; everything comes from `geospatial-map.css`.

### 4.2 Component conventions (enforced by tests and lint)

- **Standalone and `OnPush`.** Every component is standalone (the default) with `changeDetection: ChangeDetectionStrategy.OnPush`. No `NgModule`.
- **Signal APIs only.**
  - Use `input()`, `input.required()`, `model()`, `output()`, `contentChild()` and `viewChild()`. No `@Input`, `@Output` or `@HostBinding` decorators; host bindings go in `host: {}`.
  - Boolean attributes use `booleanAttribute`, so `<geo-map fill>` and `<geo-map-attribution compact>` work.
- **Template syntax.** Use `@if`, `@for` and `@switch`; no structural directives other than `ngTemplateOutlet` and `ngComponentOutlet`. No template syntax that is new in v22.
- **The host element is the part's root.** It carries the same classes, `data-slot`, `data-placement` and ARIA attributes as the React root element. A consumer's `class`, `style`, `id`, `aria-*` and `data-*` on the element land on the root, like `className` in React. Angular's styling precedence lets the consumer's static `style` beat the map's own `config.theme` host style, as in React.
- **Element or attribute selector.**
  - When the React root is a `div` or `section`, the part is an element (`<geo-map-legend>`, `<geo-map-popup>`).
  - When it is a `button`, `label` or `svg`, the part is an attribute selector on that element (`<button geoMapZoomIn>`, `<label geoMapBasemapField>`, `<svg geoMapLegendSymbol>`), so semantics and CSS don't change.
  - Breadcrumbs keep their landmark with `role="navigation"` on the host.
- **Parts that React renders as `null`** (a closed panel, no selection, no error, no time layers, no disclaimer text) keep their host but drop their classes and ARIA attributes and bind `display: none`. A consumer class on a hidden part can't draw an empty box.
- **Primitives through `hostDirectives`.** Parts compose shape directives: the layer panel host applies `ShapeCard`. Swapping `ShapeCard` for a design-system directive restyles every card.
- **No zone assumptions.**
  - OpenLayers is created and listened to inside `NgZone.runOutsideAngular`, which is a no-op when zoneless.
  - Map events reach the UI only by writing signals. No `ChangeDetectorRef`, no `NgZone.run`, no RxJS.
- **SSR-safe.**
  - The server renders the accessible shell.
  - OpenLayers, `ResizeObserver`, `matchMedia`, geolocation and fullscreen are touched only in `afterNextRender` or `afterRenderEffect`, or in event handlers.
  - OpenLayers adds its DOM after hydration, so hydration needs no `ngSkipHydration`.

### 4.3 Engine: React to Angular mapping

The engine logic stays the same; only the reactive primitives change.

| React (`use-map-engine.ts` and friends)                           | Angular (`map-engine.ts`)                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config kept by content: `useResettableState(fingerprint(config))` | `computed(() => config(), { equal: (a, b) => fingerprint(a) === fingerprint(b) })`. A config rebuilt with the same content keeps the old object, so nothing downstream re-runs.                                                                                        |
| `useMemo` (validation, ui, messages, layers, times)               | `computed`                                                                                                                                                                                                                                                             |
| `useResettableState(key, init)` (own state, own panel)            | `linkedSignal({ source: key, computation: init })`, which is the same "reset when the key changes" semantics.                                                                                                                                                          |
| `useState` (derived, error, live message, rendered)               | `signal`                                                                                                                                                                                                                                                               |
| `useReducer` proposals counter                                    | `signal(0)`, incremented by the bridge's `proposed()`. The commit effect reads it, so a host that refuses a proposed state gets the map set back to its own state.                                                                                                     |
| `useEffect` that creates the controller                           | `afterRenderEffect` keyed on `started`, the interactions key and the projection, with `onCleanup` destroying the controller and undoing `onOpenLayersMap`.                                                                                                             |
| `useEffect` that commits config and state                         | `afterRenderEffect` (write phase) reading config, layers, state, `mapId` and the proposals counter.                                                                                                                                                                    |
| `useIsomorphicLayoutEffect` world-fit measuring                   | `afterRenderEffect({ earlyRead })`, which measures `clientWidth` and `clientHeight` before the first controller exists.                                                                                                                                                |
| `useArcgisConfig`                                                 | Signals plus a cancellable promise keyed on the service URLs. Don't use `resource()`: it was experimental in v21.                                                                                                                                                      |
| `useSyncExternalStore` runtime store                              | The runtime is a `computed`. `injectMapRuntime(select)` is `computed(() => select(runtime()))`, so a part updates only when its slice changes.                                                                                                                         |
| Context providers                                                 | `MapRoot` provides the `MAP_CONTEXT` token. Parts inject the token, not the engine class, so tests can provide a fake context.                                                                                                                                         |
| `useId`                                                           | `config.id`, or a per-app counter. Ids only link ARIA attributes; on hydration the client re-applies them.                                                                                                                                                             |
| `forwardRef` + `useImperativeHandle`                              | `exportAs: 'geoMap'` and a readonly `actions: MapActions` on `MapRoot` and `GeospatialMap`. Use `#map="geoMap"` or `viewChild.required(GeospatialMap).actions`.                                                                                                        |
| Setup hints (`warnOnce`)                                          | The same hints, with Angular wording ("add `geospatial-map.css` to `styles` in `angular.json`"). Angular can't tell whether an output has listeners, so the "`onFeatureSelect` set but nothing selectable" hint becomes a check on `featureSelect` usage in the guide. |

### 4.4 Public API: React to Angular

**Root and preset** (`<geo-map-root>`, `<geo-map>`; both extend `MapRootBase`).

Inputs:

- `config` (required)
- `state`, with `stateChange` as its output, so `[(state)]` works
- `openPanel`, with `openPanelChange`, so `[(openPanel)]` works
- `fill`, `icons`, `loadGeoJson`, `onOpenLayersMap` (a function input, because it returns a cleanup)
- `validate` (root only)

Outputs:

- `stateChange` (`MapState`)
- `stateChangeDetails` (`{ state, change }`)
- `ready`, `viewChange`, `featureHover`, `featureSelect`, `layerStateChange`, `timeChange`, `statusChange`, `metric`
- `mapError`: the React `onError`, renamed because `error` is a DOM event name (`@angular-eslint/no-output-native`)

A controlled `state` works like React: the map proposes, and if the host doesn't take the proposal, the map returns to the host's state.

**Slots become templates.** Render functions become `ng-template` directives with typed contexts (`ngTemplateContextGuard`), so `let-feature` is typed under `strictTemplates`.

| React                                                  | Angular                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `slots.popup`, `<MapPopup>{(ctx) => …}</MapPopup>`     | `<ng-template geoMapPopup let-feature let-close="close" let-state="state" let-actions="actions">` inside `<geo-map>` or `<geo-map-popup>` |
| `slots.tooltip`, `<MapTooltip>{(f) => …}</MapTooltip>` | `<ng-template geoMapTooltip let-feature>`                                                                                                 |
| `slots.controls['custom:share']`                       | `<ng-template geoMapControl="custom:share" let-state let-actions="actions">`                                                              |
| `renderConfigError`                                    | `<ng-template geoMapConfigError let-error>` inside `<geo-map-root>`                                                                       |
| `<MapErrorAlert>{(error) => …}</MapErrorAlert>`        | `<ng-template geoMapError let-error>`                                                                                                     |
| `header` / `footer` props on panels and the legend     | Projected `[geoMapPanelHeader]` / `[geoMapPanelFooter]`, with the default header as `ng-content` fallback content                         |
| `MapStatusChips` `loading` / `empty`                   | Projected `[geoMapLoading]` / `[geoMapEmpty]` with fallback content                                                                       |
| `MapDisclaimer` children                               | Projected content (links allowed), falling back to `ui.disclaimer.text`                                                                   |

**Parts.** The table lists only the props that differ from React.

| React                                                                                                                      | Angular class (same name) | Selector                                                                                                                                                    | Notes                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GeospatialMap`                                                                                                            | `GeospatialMap`           | `geo-map`                                                                                                                                                   | Lays out every part from `config.ui`, plus projected extra parts.                                                                                                                                            |
| `MapRoot`                                                                                                                  | `MapRoot`                 | `geo-map-root`                                                                                                                                              |                                                                                                                                                                                                              |
| `MapGrid`                                                                                                                  | `MapGrid`                 | `geo-map-grid`                                                                                                                                              | `[(state)]`. Per-map outputs emit `{ mapId, event }`, because an output has one payload.                                                                                                                     |
| `MapControls`                                                                                                              | `MapControls`             | `geo-map-controls`                                                                                                                                          | `placement`, `groups`. Custom controls come from `geoMapControl` templates.                                                                                                                                  |
| `MapControlGroup`                                                                                                          | `MapControlGroup`         | `geo-map-control-group`                                                                                                                                     |                                                                                                                                                                                                              |
| `MapControlButton`                                                                                                         | `MapControlButton`        | `button[geoMapControl]`                                                                                                                                     | `label`, `active`                                                                                                                                                                                            |
| `MapZoomIn…`, `MapZoomOut…`, `MapResetZoom…`, `MapLocate…`, `MapLayers…`, `MapSettings…`, `MapFit…`, `MapFullscreenButton` | same names                | `button[geoMapZoomIn]`, `[geoMapZoomOut]`, `[geoMapResetZoom]`, `[geoMapLocate]`, `[geoMapLayers]`, `[geoMapSettings]`, `[geoMapFit]`, `[geoMapFullscreen]` | `label`; projected content replaces the icon. React's "`onClick` calls `preventDefault()`" becomes a `beforeAction` output whose event has `preventDefault()` (see R2). An unavailable fit button is hidden. |
| `MapLayerPanel`                                                                                                            | `MapLayerPanel`           | `geo-map-layer-panel`                                                                                                                                       | Same behaviour inputs (`allowOpacity`, `groupBy`, …). Expanded rows use `linkedSignal`.                                                                                                                      |
| `MapSettings`, `MapBasemapField`, `MapZoomTargetField`, `MapExportField`                                                   | same names                | `geo-map-settings`, `label[geoMapBasemapField]`, `label[geoMapZoomTargetField]`, `label[geoMapExportField]`                                                 | `fields`                                                                                                                                                                                                     |
| `MapLegend`, `MapLegendSymbol`                                                                                             | same names                | `geo-map-legend`, `svg[geoMapLegendSymbol]`                                                                                                                 | `layout`, `expanded`. The symbol template uses `svg:` prefixed elements.                                                                                                                                     |
| `MapPopup`                                                                                                                 | `MapPopup`                | `geo-map-popup`                                                                                                                                             | `placement`, `anchor`. Static projected content or a `geoMapPopup` template; property list by default.                                                                                                       |
| `MapTooltip`                                                                                                               | `MapTooltip`              | `geo-map-tooltip`                                                                                                                                           | `fields`                                                                                                                                                                                                     |
| `MapTimeControls`                                                                                                          | `MapTimeControls`         | `geo-map-time-controls`                                                                                                                                     | `speedsMs`, `defaultSpeedMs`, `loop`, `autoplay`. Playback is an `effect` with `onCleanup`; respects reduced motion.                                                                                         |
| `MapBreadcrumbs`                                                                                                           | `MapBreadcrumbs`          | `geo-map-breadcrumbs`                                                                                                                                       | `targets`. `targetClick` output with a cancellable event.                                                                                                                                                    |
| `MapStatusChips`, `MapErrorAlert`                                                                                          | same names                | `geo-map-status-chips`, `geo-map-error-alert`                                                                                                               | `dismissible`                                                                                                                                                                                                |
| `MapAttribution`                                                                                                           | `MapAttribution`          | `geo-map-attribution`                                                                                                                                       | `compact`                                                                                                                                                                                                    |
| `MapDisclaimer`                                                                                                            | `MapDisclaimer`           | `geo-map-disclaimer`                                                                                                                                        | `title`, `placement`, `defaultOpen`, `[(open)]`; Escape closes it.                                                                                                                                           |

**Hooks become injection functions.** Call them in a constructor or field initializer of a component inside the map.

| React                   | Angular                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `useMap()`              | `injectMap(): Signal<MapContextValue>`                                                                                       |
| `useMapStatic()`        | `injectMapStatic(): Signal<MapStaticValue>` (config, ui, messages, actions, icons)                                           |
| `useMapActions()`       | `injectMapActions(): MapActions`, which is stable                                                                            |
| `useMapRuntime(select)` | `injectMapRuntime(select): Signal<T>`                                                                                        |
| `useMapIcons()`         | `injectMapIcons(): Signal<MapIcons>`                                                                                         |
| `useMapPixel(lonLat)`   | `injectMapPixel(() => lonLat): Signal<[x, y] \| null>`. It subscribes to `actions.onRender` and cleans up with `DestroyRef`. |
| `useHoveredFeature()`   | `injectHoveredFeature(): Signal<FeatureEvent \| null>`                                                                       |

Outside a map, each one throws "must be used inside `<geo-map-root>` or `<geo-map>`".

**Shapes** (`shapes.ts`, the design-system swap point). Keep the names, selectors, inputs and outputs, and replace the bodies:

| Shape                                                 | Angular form                                                                                                                                 | Swap example                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ShapeButton`, `ShapeIconButton`                      | Directives `button[geoShapeButton]` and `button[geoShapeIconButton]` (`label` sets `aria-label` and `title`; `type` defaults to `button`)    | `hostDirectives: [HlmButton]` (spartan/ui), or Material's button attribute styles |
| `ShapeCard`, `ShapeAlert`, `ShapeLabel`, `ShapeBadge` | Directives `[geoShapeCard]`, `[geoShapeAlert]` (`role="alert"`), `[geoShapeLabel]`, `[geoShapeBadge]`                                        | `hostDirectives: [HlmCard]` …                                                     |
| `ShapeSelect`                                         | Component `geo-shape-select`, rendering the wrapper span and a native `<select>`: `value`, `options`, `ariaLabel`, `disabled`, `valueChange` | Template becomes `<mat-select>` or `<brn-select>`                                 |
| `ShapeSlider`                                         | `input[type=range][geoShapeSlider]`: `value`, `min`, `max`, `step`, `valueChange`; sets `--geo-slider-fill`                                  | Template becomes `<mat-slider>`                                                   |
| `ShapeSwitch`                                         | `label[geoShapeSwitch]` with a checkbox, track and label: `label`, `[(checked)]`, `disabled`                                                 | Template becomes `<mat-slide-toggle>` or `<hlm-switch>`                           |

**Icons.**

- `MapIcon` is either `MapSvgIcon` or `Type<unknown>`. `MapSvgIcon` is an SVG node list in the shape of lucide's `IconNode`, so any `import { Globe } from 'lucide'` works. `Type<unknown>` is any icon component (Material, Carbon, your own).
- `<geo-map-icon>` (`display: contents`) renders a node list with `Renderer2`, never `innerHTML`, or a component with `NgComponentOutlet`.
- Three levels of override:
  - edit `icons.ts`, for every map;
  - `provideMapIcons({ … })` on an app or route;
  - `[icons]="{ ZoomIn: Plus }"` on one map.

**Theming** is identical to React: `--geo-*` tokens, single-class rules, `.dark` and `[data-theme]`, and `config.theme` written as host style. The stylesheet is added once to `styles` in `angular.json`, or with `@import` in `styles.css`. With Tailwind 4, use `@import … layer(components)`.

**Lazy loading.** Wrap the map in `@defer (on viewport) { … } @placeholder { … }`; under SSR, use `@defer (hydrate on viewport)`. This replaces `React.lazy` and `next/dynamic`.

### 4.5 What Angular usage looks like

```ts
@Component({
  selector: 'app-regions-map',
  imports: [GeospatialMap, MapPopupTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map [config]="config" fill (featureSelect)="selected.set($event?.featureId ?? null)">
      <ng-template geoMapPopup let-feature let-close="close">
        <app-region-stats [id]="feature.featureId" (done)="close()" />
      </ng-template>
    </geo-map>
  `,
})
export class RegionsMap {
  protected readonly config = defineMapConfig({
    accessibility: { ariaLabel: 'Regions map' },
    data: {
      layers: [{ id: 'regions', data: { url: '/data/regions.geojson' }, featureIdField: 'iso3' }],
    },
  })
  protected readonly selected = signal<string | null>(null)
}
```

```html
<!-- A custom layout -->
<geo-map-root [config]="config" class="brand-map" [(openPanel)]="panel" #map="geoMap">
  <geo-map-controls placement="top-left">
    <geo-map-control-group>
      <button geoMapZoomIn></button>
      <button geoMapZoomOut></button>
    </geo-map-control-group>
    <geo-map-control-group><button geoMapLayers></button></geo-map-control-group>
  </geo-map-controls>
  <geo-map-layer-panel placement="top-left" [allowReorder]="false" />
  <geo-map-legend placement="bottom-right" class="brand-legend" />
  <app-selected-area />
  <geo-map-attribution compact />
</geo-map-root>
<button (click)="map.actions.fit([-180, -90, 180, 90])">World</button>
```

```ts
// A custom part
@Component({
  selector: 'app-selected-area',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="selected-area">
    {{ selected()?.featureId ?? map().messages.selectionCleared }}
  </p>`,
})
export class SelectedArea {
  protected readonly selected = injectMapRuntime((map) => map.selectedFeature)
  protected readonly map = injectMapStatic()
}
```

## 5. AI agent support

This mirrors what the React folder has, rewritten for Angular, plus hooks into Angular's own agent tooling.

**In the Angular folder (travels with the copy):**

- `AGENTS.md` follows the same structure as the React guide.
  - **Choose where a change belongs**, with Angular answers:
    - config → `defineMapConfig` in the component class
    - custom popup, tooltip or control → `ng-template` directives
    - state in the app → `[(state)]` and `(featureSelect)`
    - commands → `#map="geoMap"`, `viewChild(...).actions` or `injectMapActions()`
    - custom part → `injectMapRuntime`
    - design system → `shapes.ts` with `hostDirectives`
    - icons → `[icons]`, `provideMapIcons()` or `icons.ts`
    - OpenLayers → `[onOpenLayersMap]`
    - lazy loading → `@defer`
  - **Rules:** the React rules (engine files, CSS, ids, inline data identity, one projection), plus Angular ones:
    - keep parts standalone and `OnPush`
    - use signal APIs and control flow
    - no zone.js APIs, no `ChangeDetectorRef`, no RxJS, no `innerHTML`
    - no v22-only template syntax while the app supports v21
  - **Verify your change:** `ng build` (strict templates), `ng test`, `waitForMapReady`, no `[geospatial-map]` console hints, no `data-layer-errors`, screenshots in light, dark and narrow widths.
- `CLAUDE.md` imports `@AGENTS.md`.
- `examples/` holds one compiled example per row of the table, and `docs/` holds the guides it links to.
- README section **If you use coding agents**:
  - add the one-line pointer to the app's root `AGENTS.md`;
  - or, if the app uses `ng generate ai-config`, add it to the generated `.claude/CLAUDE.md`, `.cursor/rules/…` and so on;
  - connect the Angular CLI MCP server (`ng mcp`) for Angular's own best practices. The folder's guide covers the map; Angular's covers the framework.

**In this repository (for agents working on the map itself):**

- A root `AGENTS.md` and `CLAUDE.md`:
  - Shared files are edited only in `packages/geospatial-map-core`, then `pnpm sync-core` is run.
  - Any change to a part, prop, hook or doc lands in both frameworks in the same PR.
  - Checks before pushing: `pnpm typecheck && pnpm test && pnpm lint && pnpm test:browser`.
  - Where each kind of change lives.
- An API parity test (`tests/parity.test.ts`) compares the React and Angular `index.ts` exports.
  - Matching rules: same name; `use*` ↔ `inject*`; `*Props` types are React-only; template directives, `provideMapIcons` and `GEO_MAP_PARTS` are Angular-only.
  - Anything else must be in a short allowlist with a reason.
  - An agent that adds a React part without the Angular one gets a failing test that names it.
- A DOM parity test renders the preset for one fixture config with React SSR and Angular `platform-server`, then compares the sets of `geo-*` classes, `data-slot` values and roles.

**Later, optional: in-page agent tools.** Angular 22 adds experimental WebMCP support. A small framework-neutral module in core could register `getState`, `fit`, `select`, `setTime` and `setLayerVisibility` as in-browser agent tools, opt-in per map. That would serve both frameworks. It is not part of this plan's scope until WebMCP is stable.

## 6. Demos

- **`apps/demo-shared`** (new private workspace package, no build). It holds:
  - scenario ids and URL-parameter parsing (`?scenario=`, `basemap`, `projection`, `points`, `renderer`, `controlled`, `hidden`, `sources`, `theme`, `dark`), shared by both harnesses so the routes stay identical
  - `demo-config.ts`, `world.ts`, fixtures (benchmark points, source fixtures), harness CSS, `themes/*.css` and `public/data`
  - It imports `@/components/geospatial-map`; each app maps that alias to its own folder. Because the shared types and helpers are identical, the same file type-checks in both apps.
- **`apps/demo`** (React) imports from `demo-shared`. It gains a header link "Angular version" that opens the same path and query string on the Angular demo.
- **`apps/demo-angular`** (new):
  - **App:** Angular CLI 22 using the `@angular/build:application` builder; zoneless, standalone, `OnPush` and strict templates. The folder comes in through the `@/components/geospatial-map` path alias, as a host app would import it.
  - **Harness:** a port of `App.tsx`, with the same control labels and test ids the browser suite uses ("Scenario", "Inspect state", `serialized-state`, "Re-render parent (n)", "Custom loader calls", …).
  - **Scenarios:** a component per scenario: grid, composed, quickstart, features, arcgis, themes, checks; the rest run on the main harness map.
  - **Themes:** the Carbon theme uses `@carbon/icons` descriptors through a 10-line node adapter (proving `MapSvgIcon`), and the Material theme uses an icon component (proving `Type` icons).
  - **Zone check:** `?zone` loads zone.js and bootstraps with `provideZoneChangeDetection()`, to check zone-based apps.
  - **Bundle budgets** go in `angular.json`.
- **Root scripts:**

| Script                                      | Runs                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev` / `pnpm dev:react`               | React demo (Vite, :5173), unchanged                                                                    |
| `pnpm dev:angular`                          | Angular demo (`ng serve`, :4200)                                                                       |
| `pnpm dev:all`                              | Both in parallel; each header links to the other                                                       |
| `pnpm build`                                | Both demos (`build:react`, `build:angular`)                                                            |
| `pnpm preview:all` (optional)               | Both builds under one origin, `/react/` and `/angular/`, with a chooser page, for publishing the demos |
| `pnpm test:browser`, `:react`, `:angular`   | The shared Playwright suite against one or both                                                        |
| `pnpm sync-core` / `pnpm sync-core --check` | Copies the shared files, or fails on drift (run by `pnpm test`)                                        |

The cross-links come from `VITE_ANGULAR_DEMO_URL` in React and a `define` constant in Angular, with localhost defaults.

## 7. Tests, lint and tooling

| Area                          | Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core unit tests               | Move `test/core/*`, `config`, `schema`, `short-config`, `schema-types` and `theme-tokens` tests to `packages/geospatial-map-core/test`. They run once for both folders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Sync guard                    | `sync-core --check` runs in `pnpm test`. Every synced file is byte-identical to the core copy. The shared engine header says the file is shared by the React and Angular folders.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Angular unit tests            | Vitest project `packages/geospatial-map-angular/vitest.config.ts` with `@analogjs/vite-plugin-angular` and `@analogjs/vitest-angular`, jsdom and a zoneless `TestBed`, added to the root Vitest `projects` so `pnpm test` stays one command. Fallback: `ng test`, Angular's own Vitest runner (R6). Tests: engine (config identity, controlled and refused state, open panel, one report per config error), parts (only composed parts render, host classes, theme keys inline, a part outside a map explains itself, disclaimer, icons override, custom control without a template hints, slider fill, select wrapper), signals helpers. |
| Angular SSR test              | `renderApplication` from `@angular/platform-server` renders the preset: an accessible shell, no OpenLayers, the config-error panel for invalid JSON. This is the equivalent of `ssr.test.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Portability (Angular)         | The React checks: imports stay in the folder, only the listed dependencies, README install line matches `package.json`, version and changelog, no CSS imports or bundler globals, engine headers. Angular checks: every `@Component` sets `OnPush`; no `NgModule`, `standalone: false`, `@Input`, `@Output`, `@HostBinding`, `ChangeDetectorRef`, `NgZone.run(`, RxJS or `innerHTML`.                                                                                                                                                                                                                                                     |
| Paste test (consumer compile) | `test/consumer-v21/` (Angular 21.2, TypeScript 5.9) and `test/consumer-v22/` (Angular 22, TypeScript 6.0) are minimal apps shaped like `ng new --strict` output (`strictTemplates`, `strictInjectionParameters`, `typeCheckHostBindings`, no path aliases). A script copies `src/` into each and runs `ng build`. They are separate pnpm workspace packages, so two Angular versions can coexist. This test enforces D5.                                                                                                                                                                                                                  |
| Guides                        | Port `examples-and-guides.test`: every task row has an example, the guides mention only files that exist, links stay inside the folder, and `CLAUDE.md` loads `AGENTS.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Parity                        | API parity and DOM parity tests (section 5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Browser                       | `playwright.config.ts` gets two `webServer`s (React on :4173, Angular on :4174) and six projects: `{chromium, firefox, webkit} × {react, angular}`. The specs stay framework-neutral (roles, labels, `data-slot`). A `framework` fixture allows a rare, documented `test.skip`. Add a small `chromium-angular-zone` project for the zone-compat smoke tests (quickstart and map).                                                                                                                                                                                                                                                         |
| Lint                          | `angular-eslint` (22.x supports ESLint 10) for the Angular folder and demo, with inline templates processed. Rules: `prefer-on-push-component-change-detection`, `prefer-signals`, `prefer-standalone`, `no-output-native`, `no-output-on-prefix`, selector prefix `geo` (kebab-case elements, camelCase attributes), template `prefer-control-flow`, and the template accessibility set. The React hooks rules stay scoped to the React folder.                                                                                                                                                                                          |
| Typecheck                     | `pnpm typecheck` adds `ngc -p` with strict templates for the Angular folder and the Angular demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Versions                      | Pin `typescript` to `~6.0` (Angular 22 needs `>=6.0 <6.1`, TypeScript 7 is out). Raise `engines.node` to `^22.22.3 \|\| ^24.15.0 \|\| >=26` (Angular 22's requirement; this container runs 22.22.0). Vitest 4 already matches `@angular/build` 22.                                                                                                                                                                                                                                                                                                                                                                                        |

## 8. Updating, versions and releases

- **Lockstep versions.** `version.ts` is shared, so both folders release 0.10.0 together. Each folder keeps its own `CHANGELOG.md`. A release check asserts both have the version heading and that the shared "Fixed" entries appear in both.
- **Update script.** `update-geospatial-map.mjs` detects the framework of a copy: `map-root.tsx` means React, `map-root.ts` means Angular, and `--framework` overrides. It merges from the matching package path. The three-way merge logic is unchanged.
- **React 0.10.0 notes.** No behaviour change. React-only types moved from `types.ts` to `component-types.ts`; imports from `index.ts` are unchanged. Two harmless CSS additions.

## 9. Repository docs to update

- `README.md`: "Choose React or Angular", with both install lines, both quick starts, both demo commands, and the routes table marked as working in both demos.
- `technical-architecture.md`:
  - section 4 (layout)
  - a new section, "Angular composition layer", based on this plan's section 4
  - section 20 (demo harness: two apps, shared scenarios)
- `tests/testing-framework.md` and `tests/requirements-matrix.md`: Angular evidence for each requirement, and the browser matrix.
- `requirements.md` §6.1 (component integration): add Angular 21 and 22 support.
- `performance-budgets.md`: Angular initial and lazy-chunk budgets, measured on the demo.

## 10. Phases

Each phase ends green on `pnpm typecheck && pnpm test && pnpm lint && pnpm test:browser`. Sizes are rough, for one developer.

| Phase                          | Scope                                                                                                                                                                                                                                                                                                | Done when                                                                                                                                          | Size     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **0. Spike**                   | Resolve R1–R6 in a throwaway branch: an Angular CLI app consuming a folder outside its workspace through a path alias; OpenLayers in a zoneless `afterRenderEffect`; host versus template listener order; lucide's `IconNode` shape; Analog Vitest with Angular 22; CommonJS warnings in `ng build`. | Every risk has a decision written into this plan.                                                                                                  | 1–2 days |
| **1. Shared core**             | Create `geospatial-map-core`, `sync-core.mjs` and its `--check` guard. Split `types.ts` and add `MapHostInputs`. Make the CSS additions. Move the neutral tests and docs. Make the update script framework-aware. Add the root `AGENTS.md`.                                                          | The React demo and every existing test pass unchanged, and the React copy's files are byte-identical to core.                                      | 2–3 days |
| **2. Angular engine and root** | `map-engine.ts`, `arcgis-config.ts`, `world-fit.ts`, `map-context.ts`, `signals.ts`, `MapRoot`, `MapRootBase`, shapes, icons, `map-icon.ts`, plus `MapControls` and its buttons, `MapLegend`, `MapAttribution`. Scaffold `apps/demo-angular` with the quickstart scenario.                           | `/?scenario=quickstart` on the Angular demo passes `quickstart.spec.ts`. Engine unit tests and the SSR test pass.                                  | 3–4 days |
| **3. All parts and preset**    | Layer panel, settings and fields, popup, tooltip, anchoring, time controls, breadcrumbs, status chips, error alert, disclaimer, the templates, `GeospatialMap`, `MapGrid`, `index.ts` and `GEO_MAP_PARTS`.                                                                                           | API and DOM parity tests pass; portability tests pass.                                                                                             | 5–7 days |
| **4. Demos**                   | `apps/demo-shared`; port the harness and every scenario; cross-links; root scripts; budgets; `?zone`.                                                                                                                                                                                                | `pnpm dev:all` serves both, and every README route works in both.                                                                                  | 4–5 days |
| **5. Test matrix**             | The Playwright matrix with both servers, the zone project, the v21 and v22 paste tests, angular-eslint, `ngc` typecheck.                                                                                                                                                                             | The full suite is green in all six projects; the paste tests build on 21 and 22.                                                                   | 3–4 days |
| **6. Docs and agent guides**   | Angular README, `AGENTS.md`, `CLAUDE.md`, the four Angular guides, shared guides with neutral samples, examples, CHANGELOGs, and the repository docs in section 9.                                                                                                                                   | The guide tests pass. Optional check: a fresh agent session completes three `AGENTS.md` tasks in a scratch `ng new` app with the folder pasted in. | 2–3 days |
| **7. Release**                 | Bump both to 0.10.0, run the update script against a 0.9 React copy and against a fresh Angular copy.                                                                                                                                                                                                | Both copies update cleanly.                                                                                                                        | ½ day    |

The total is roughly four to six weeks. Phases 2 and 3 can be split across two people once phase 1 lands, because the parts only depend on `MAP_CONTEXT`.

## 11. Risks to settle in the spike

| #   | Risk                                                                                                                                                                                                             | Plan A / fallback                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | The Angular CLI may not compile sources outside its workspace root through a `tsconfig` path alias (`apps/demo-angular` → `packages/geospatial-map-angular/src`).                                                | Plan A: alias, as in the React demo. Fallback: a root `angular.json` with the project root at `apps/demo-angular`, which puts every package inside the workspace root.                          |
| R2  | Built-in buttons in React let the host's `onClick` cancel the built-in action. In Angular, a directive's host listener probably runs before the template's `(click)`, so `preventDefault()` would come too late. | A cancellable `beforeAction` output, emitted synchronously before the action. Verify the listener order; if template listeners run first, `(click)` + `preventDefault()` can also be supported. |
| R3  | The shared core must compile under TypeScript 5.9 (Angular 21 apps) and 6.0.                                                                                                                                     | The v21 paste test covers it; avoid TypeScript 6-only syntax in shared files.                                                                                                                   |
| R4  | `ng build` may warn about CommonJS dependencies of OpenLayers or proj4 (proj4 declares an ESM `module` entry, so probably not).                                                                                  | Document `allowedCommonJsDependencies` in the README if needed.                                                                                                                                 |
| R5  | The node format of `lucide` 1.x icons and the effect of `display: contents` on icon sizing.                                                                                                                      | Adapt `MapSvgIcon`, or render the `svg` as the host (`svg[geoMapIcon]`) for node icons.                                                                                                         |
| R6  | The Analog Vitest plugin with Angular 22, signal inputs and a zoneless `TestBed`.                                                                                                                                | Fallback: `ng test` (Angular's Vitest runner) through a test-only Angular CLI project.                                                                                                          |
| R7  | Hiding parts with a `display: none` host binding can be overridden by a consumer's inline `display` style.                                                                                                       | Document it; rare in practice.                                                                                                                                                                  |

## 12. Confirmed decisions

1. **Three folders: core, React and Angular.** `packages/geospatial-map-core` is the source of truth for the shared files. A team copies only the React folder or only the Angular folder; each contains synced copies of the shared files, so nobody copies core.
2. **Angular 21 for the tooling.** The Angular demo and the dev tooling use Angular 21, which runs on this repository's Node 22.22 and TypeScript 6.0. The folder declares `^21.0.0 || ^22.0.0` as its peer range and is compile-checked against Angular 22 too.
3. **Angular class names identical to React's** (`MapLegend`, not `GeoMapLegend`). The selectors carry the `geo` prefix.
4. **`lucide` (vanilla) for default icons.**
5. **Full scenario parity in the Angular demo**, because the shared browser suite is the parity contract.
6. **The React version stays working at every step.** Each phase ends with the full React suite green before the next starts.
7. **No npm package and no CLI for either version.** Copy-paste plus the update script stays the delivery model.

## 13. Deviations from the plan

What changed while the plan was implemented. The Angular folder's `CONTRIBUTING.md` (Known differences) has the details for each part.

- **Docs per framework, not shared.** Section 2 shared four guides with neutral samples. Each folder now has its own eight guides in `docs/`, with samples in its own API, and its own examples; the core shares only `examples/symbology-layers.ts`, `examples/map-ready-check.ts` and `examples/brand-theme.css`. The Angular guide for state is `docs/state-events-templates.md`.
- **Cancelling a built-in button: `(beforeAction)` only (R2).** A directive's host listener runs before a template `(click)`, so `preventDefault()` in `(click)` comes too late, and a template `(click)` runs after the action. Built-in buttons emit a cancellable `MapActionEvent` (new file `map-action-event.ts`) through `(beforeAction)`. The breadcrumbs' `(targetClick)` emits a `MapTargetClickEvent`, with the `target` and the `source` click.
- **`MapSvgIcon` may start with `['svg', attributes]`.** Not in the plan: that entry sets the svg's own attributes (view box, `fill`), so filled sets on another view box work as node lists. The themes demo uses it for Carbon's `@carbon/icons` and Material icon components for the other kind. Node icons are drawn by `svg[geoIcon]` inside `<geo-map-icon class="geo-icon">` (`display: contents`), with lucide's attributes but not its `lucide lucide-*` classes (R5).
- **Hydration.** `svg[geoIcon]`, the one part that adds nodes with `Renderer2`, replaces the server's nodes instead of drawing a second set; `test/hydration.test.ts` hydrates server HTML and checks it.
- **The zone.js check has its own server.** The `chromium-angular-zone` project runs against a second `ng serve` (port 4175) built with angular.json's `zone` configuration, which defines `GEO_DEMO_FORCE_ZONE` so every route runs with zone.js, not only `?zone` routes. Its serve configuration turns prebundling off: every `ng serve` of the demo shares one Vite prebundle folder, and a server with other build options rewrites it under the others. `tests/browser/zone/zone.spec.ts` checks that Angular runs on a real `NgZone`. `?zone` still works on any route.
- **The Angular demo copies its assets.** The Angular CLI serves asset folders only from inside the app, so the demo's `dev` and `build` scripts first run `scripts/sync-public.mjs`, which copies `apps/demo-shared/public` into `apps/demo-angular/public` (gitignored).
- **Angular 22 builds through the Architect API.** The Angular 22 CLI refuses Node.js older than 22.22.3, and this container runs 22.22.0. `pnpm test:paste` type-checks the v22 app with `ngc`, then builds it through the Architect API (`scripts/angular-architect-build.mjs`) until the container has Node 22.22.3; on a newer Node it runs `ng build`. The root `engines.node` is `>=22.12` (raised for Astro 7, which the docs site needs), still below the `^22.22.3 || ^24.15.0 || >=26` that section 7 planned.
- **Tooling on Angular 21.** With decision 2 (Angular 21 for the tooling), the demo is Angular CLI 21, not 22 (section 6), and the lint uses angular-eslint 21.4 with ESLint 10, not 22.x (section 7). `@angular/build` 21.2 declares TypeScript below 6.0 but runs on 6.0.3; `pnpm-workspace.yaml` allows it.
- **Parity tests.** API parity is `packages/geospatial-map-angular/test/exports.test.ts`, not `tests/parity.test.ts`: it pins the Angular exports and matches each one against the React `index.ts`. DOM parity is the `parity` browser project (`tests/browser/parity/dom.spec.ts`), which compares the two running demos route by route, with panels, a popup and a tooltip open, instead of comparing server-rendered HTML for one fixture.
- **More browser tooling.** `tests/browser/framework.spec.ts` fails a project whose server is the other demo, or has zone.js when it shouldn't. `PW_FRAMEWORK` picks the projects and servers, and `scripts/playwright.mjs` sets it for `test:browser:react`, `test:browser:angular` and the new `test:browser:parity`, on every OS.
- **API details.** `injectSlotContext()` is added. `injectMapIcons()` outside a map returns the app's icons, like React's `useMapIcons()`, where section 4.4 says every function throws. `MapZoomTargetField`'s `onSelect` is `(targetSelect)`. `<geo-map-grid>`'s `(stateChangeDetails)` emits `{ state, mapId, change }`, and with more than six maps its host is the alert. `<geo-map-disclaimer>` takes `title` as an input, so its host never has a `title` attribute. `<geo-map>` doesn't forward a `geoMapError` template, as React's preset has no error slot.
- **A third CSS addition.** Besides the block map root and the icon rules (section 2), the shared stylesheet gives `.geo-icon` `display: contents`. React's `component-types.ts` also holds `GeospatialMapHandle`.
- **Releases.** Each folder's portability test checks that its changelog has the version heading (the Angular one as its newest entry), and `test/sync.test.ts` checks that the three manifests have the same version. No check compares "Fixed" entries (section 8): 0.10.0 fixes nothing in the shared engine, and the Angular changelog points to the React one for fixes up to 0.9.0.
- **Update script base.** Without `--from`, `update-geospatial-map.mjs` now starts from the commit that set the copy's version (its release), not from the last commit before the next bump. 0.10.0 landed over several commits with the bump last, so the old base would have skipped them: a 0.9.0 copy would have kept its 0.9.0 files under a 0.10.0 `version.ts`. `packages/geospatial-map-core/test/update-script.test.ts` covers it.
- **Not built:** the optional `pnpm preview:all` (section 6).
- **Risks, as settled.** R1: the path alias works (no root `angular.json`). R3: the v21 paste test builds on TypeScript 5.9. R4: `ng build` reports no CommonJS dependencies. R6: the Analog Vitest plugin works with a zoneless `TestBed` (no `ng test` fallback). R7: documented in the Angular README.

## Sources

- Angular versions and requirements were checked on npm on 2026-10-08:
  - `@angular/core` latest 22.2.1, v21 LTS 21.2.25
  - `@angular/compiler-cli` 21.2 needs TypeScript `>=5.9 <6.1`; 22.x needs `>=6.0 <6.1`
  - `@angular/core` 22 needs Node `^22.22.3 || ^24.15.0 || >=26`
  - `@angular/build` 22 needs Vitest `^4 || ^5`
  - `angular-eslint` 22.5 supports ESLint `^9 || ^10`
- Release feature summaries: [InfoQ: Angular v22 released](https://www.infoq.com/news/2026/08/angular-v22-released/) (Signal Forms stable, OnPush by default, experimental WebMCP), [Angular Architects: Angular 22 at a glance](https://www.angulararchitects.io/en/blog/angular-22-the-most-important-new-features-at-a-glance/), [AlternativeTo: Angular v21](https://alternativeto.net/news/2025/11/angular-v21-brings-experimental-signal-forms-aria-preview-and-vitest-support) (experimental Signal Forms, Aria preview, Vitest), [Angular unit testing guide](https://angular.dev/guide/testing/unit-tests), [`ng generate ai-config`](https://docs.w3cub.com/angular/cli/generate/ai-config).
