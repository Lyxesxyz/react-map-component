# Changelog

This folder is copied into apps rather than installed, so this file travels with it. `GEOSPATIAL_MAP_VERSION` in `version.ts` says which version your copy is.

To update a copy, run the update script from a clone of the source repository. It does a three-way merge, so your own edits are kept:

```sh
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map            # report only
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map --apply    # write changes
```

Each entry lists the files it touches, so you can also copy them over by hand.

## 0.10.0

The first release of the Angular folder: the geospatial map for Angular 21 and 22, with the same features as the React folder. It is released together with the React folder's 0.10.0 and shares its engine, so a configuration, a stylesheet or a theme works the same in both.

### Added

- **`<geo-map>`**, the ready-made layout from `config.ui`, and **`<geo-map-grid>`**, up to six synchronised maps.
- **`<geo-map-root>` and every part**, for your own layout: the control rail and its buttons (`<button geoMapZoomIn>`, …), the layer panel, settings and its fields, legend, popup, tooltip, time controls, breadcrumbs, status chips, error alert, disclaimer and attribution. They are standalone `OnPush` components with signal inputs and outputs. `GEO_MAP_PARTS` lists them all for `imports`.
- **Templates** for your content, with typed contexts: `geoMapPopup`, `geoMapTooltip`, `geoMapControl="custom:…"`, `geoMapError` and `geoMapConfigError`. Projected `geoMapPanelHeader`, `geoMapPanelFooter`, `geoMapLoading` and `geoMapEmpty` replace or add panel content.
- **Two-way bindings and actions:** `[(state)]`, `[(openPanel)]` and the disclaimer's `[(open)]`; the actions through `#map="geoMap"`, `viewChild.required(GeospatialMap)().actions` or `injectMapActions()`.
- **Injection functions for custom parts:** `injectMap()`, `injectMapStatic()`, `injectMapRuntime(select)`, `injectMapActions()`, `injectMapIcons()`, `injectMapPixel()`, `injectHoveredFeature()` and `injectSlotContext()`, plus `anchoredPosition()` to place an overlay next to a point.
- **Icons** from `lucide` (the framework-neutral package): any lucide icon, a node list from another set (with its own `['svg', attributes]` entry), or an icon component. Override them in `icons.ts`, with `provideMapIcons()` for an app or a route, or with `[icons]` on one map. `<geo-map-icon>` draws one in a custom part.
- **`shapes.ts`**, the design-system swap point, as directives (`button[geoShapeButton]`, `[geoShapeCard]`, …) and components (`<geo-shape-select>`, `label[geoShapeSwitch]`), ready for `hostDirectives` or your own templates.
- **Zoneless and zone.js.** The map updates the page by writing signals and runs OpenLayers outside Angular's zone. It uses no `ChangeDetectorRef`, RxJS, `@angular/forms` or CDK.
- **Server rendering.** The server renders an accessible shell; OpenLayers starts in the browser.
- **Guides:** `README.md`, `AGENTS.md` and `CLAUDE.md` for coding agents, eight guides in `docs/`, and an example per common task in `examples/`.

### Shared with the React folder

The engine is the React folder's 0.10.0, which behaves as its 0.9.0: these files are the same in both folders, byte for byte.

- `core/` (OpenLayers), `config/` (schema, defaults, validation, UI profiles), `types.ts`, `map-bridges.ts`, `map-state.ts`.
- `basemaps.ts`, `world-data.ts`, `messages.ts`, `theme.ts`, `utils.ts`, `testing.ts`, `version.ts`.
- `geospatial-map.css`: the same `geo-*` classes, `data-*` attributes and `--geo-*` tokens. The parts render the same elements, roles and labels as the React parts, so themes written for one version restyle the other.
- `examples/symbology-layers.ts`, `examples/map-ready-check.ts`, `examples/brand-theme.css`.

The configuration uses the 0.9 field names; `validateMapConfig` names the replacement for an older one. The fixes listed for 0.9.0 and earlier in the React folder's changelog are in this release.

### Differences from the React version

- **Outputs instead of callbacks.** `(featureSelect)` for `onFeatureSelect`, and so on. React's `onError` is `(mapError)`, because `error` is a DOM event name. `(stateChange)` emits the state (for `[(state)]`) and `(stateChangeDetails)` emits `{ state, change }`. The area field's `onSelect` is `(targetSelect)`.
- **Templates instead of render functions and slots.** `slots.popup` and `<MapPopup>{(context) => …}</MapPopup>` are a `geoMapPopup` template; `slots.controls` and `customControls` are `geoMapControl` templates; `renderConfigError` is a `geoMapConfigError` template; `header` and `footer` props are projected content.
- **Cancelling a built-in button.** React's "`onClick` that calls `preventDefault()`" is `(beforeAction)`, which emits a `MapActionEvent` before the action; a template `(click)` runs after the action. The breadcrumbs' `onTargetClick(target, event)` is `(targetClick)`, a `MapTargetClickEvent` with `target` and `source`.
- **`<geo-map-grid>` outputs** emit `{ mapId, event }`, where React's callbacks take the map id as their last argument.
- **No hint for `(featureSelect)` without selectable layers.** Angular can't tell whether an output has a listener, so the React hint "onFeatureSelect is set, but no layer is selectable" is not logged.
- **Parts that have nothing to show** (no selection, no error, a closed panel) keep their empty element, hidden, where React renders nothing. A bound `[style.display]` on such a part shows it.
- **Icons.** lucide node icons get lucide's attributes but not its `lucide lucide-*` classes, and the `<geo-map-icon class="geo-icon">` wrapper has `display: contents`. Node lists that start with `['svg', attributes]` are Angular-only.
- **The breadcrumbs** carry `role="navigation"` on their element, for React's `<nav>`. `<geo-map-disclaimer>` takes `title` as an input, so the element never has a `title` attribute.
- `injectMapIcons()` outside a map returns the app's icons (`icons.ts` and `provideMapIcons()`), like React's `useMapIcons()`.

### Files changed

New: every file of the folder. The Angular files are `index.ts`, `component-types.ts`, `geospatial-map.ts`, `map-grid.ts`, `map-root.ts`, `map-engine.ts`, `arcgis-config.ts`, `world-fit.ts`, `map-context.ts`, `signals.ts`, `map-anchor.ts`, `map-templates.ts`, `map-action-event.ts`, `map-icon.ts`, `icons.ts`, `shapes.ts`, the parts (`map-controls.ts`, `map-layer-panel.ts`, `map-settings.ts`, `map-legend.ts`, `map-popup.ts`, `map-tooltip.ts`, `map-time-controls.ts`, `map-breadcrumbs.ts`, `map-status-chips.ts`, `map-error-alert.ts`, `map-disclaimer.ts`, `map-attribution.ts`), `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/*.md` and the Angular `examples/*.ts`.
