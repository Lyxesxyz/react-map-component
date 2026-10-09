# Geospatial map: instructions for coding agents

This folder is an Angular map component copied into this app (shadcn/ui style). The app owns the copy. `version.ts` says which release it is; newer releases are merged in with a script (see [Updating](#updating)). Humans start at `README.md`; this file is the short version for agents.

## Choose where a change belongs

Most requests need no edit inside this folder. Use the first place in this table that fits:

| The request                                         | Change                                                                                                                                                 | Example and guide                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Show data, add or restyle a layer, a legend         | The map config (`defineMapConfig({ … })`) in the component class                                                                                       | `examples/quick-start.ts`, `docs/layers-and-legends.md`            |
| Change the default basemap, or keep the map offline | `data.basemaps`: the default is `[esriWorldBasemap, worldBasemap]` (loaded from `basemaps.arcgis.com`); `[worldBasemap]` makes no third-party requests | `README.md` → Basemaps                                             |
| Use the team's ArcGIS basemap, change its borders   | `arcgisBasemap({ url, styleOverrides })` in the config; `projections` to draw it in another projection, `fallbackBasemapId` for when it can't load     | `examples/arcgis-indicators.ts`, `README.md` → Your ArcGIS basemap |
| Colour admin areas by a value table                 | Your own boundary GeoJSON (countries too: `{ builtin: 'world' }` has none) + join in `[loadGeoJson]`                                                   | `examples/admin-choropleth.ts`                                     |
| Data needs a token, header or cookie                | `[loadGeoJson]` wrapping `fetchGeoJson(url, { ...options, init })`                                                                                     | `examples/authenticated-data.ts`                                   |
| Colours, fonts, sizes, radius, dark mode            | `--geo-*` tokens and `.your-class .geo-*` rules in the app's global stylesheet                                                                         | `examples/brand-theme.ts` + `.css`, `docs/theming-localization.md` |
| Different icons                                     | `[icons]` (one map), `provideMapIcons()` (an app or a route) or `icons.ts` (every map)                                                                 | `examples/brand-theme.ts`, `README.md` → Icons                     |
| Move, remove or add controls and panels             | `config.ui` (`controls`, `layerPanel`, `settings`, …), or `<geo-map-root>` with the parts you want                                                     | `examples/custom-layout.ts`, `docs/configuration.md`               |
| Custom popup, tooltip or control                    | `<ng-template geoMapPopup>`, `geoMapTooltip` or `geoMapControl="custom:…"` inside `<geo-map>`                                                          | `docs/state-events-templates.md` → Templates                       |
| Panel header/footer, loading or error content       | `<geo-map-root>` with the parts: projected `geoMapPanelHeader`/`geoMapPanelFooter`, `geoMapLoading`, a `geoMapError` template                          | `examples/custom-layout.ts`, `docs/state-events-templates.md`      |
| React to clicks, keep state in the app              | `(featureSelect)`, `[(state)]` (the popup follows `state.selection`)                                                                                   | `examples/controlled-state-and-grid.ts`                            |
| Select a feature, open a panel, export from code    | `#map="geoMap"` and `map.actions`, `viewChild.required(GeospatialMap)().actions`, or `injectMapActions()` in a part                                    | `docs/state-events-templates.md`                                   |
| Keep the open panel in the app's state              | `[(openPanel)]` on `<geo-map>` or `<geo-map-root>`                                                                                                     | `docs/state-events-templates.md`                                   |
| A custom part that reads map data                   | `injectMapRuntime((map) => map.statuses)` in a component inside `<geo-map-root>` (`injectMap()` for everything)                                        | `examples/custom-layout.ts`, `docs/state-events-templates.md`      |
| Use the app's own Button/Select/Switch              | Replace bodies in `shapes.ts` (`hostDirectives` or templates), keeping names, selectors, inputs and outputs                                            | `README.md` → Your design system's components                      |
| Drawing, measuring, an OpenLayers feature           | `[onOpenLayersMap]="hook"` (the hook returns a cleanup)                                                                                                | `README.md` → OpenLayers access                                    |
| Several synchronised maps                           | `<geo-map-grid>` (each per-map output emits `{ mapId, event }`)                                                                                        | `examples/controlled-state-and-grid.ts`                            |
| Config comes from a CMS or API as JSON              | `validateMapConfig(json)` before rendering; `mapInputSchema` for the CMS field                                                                         | `docs/getting-started.md`                                          |
| Keep the map out of the initial bundle              | `@defer (on viewport)` around the component that shows the map (`hydrate on viewport` with SSR)                                                        | `README.md` → Keep it out of your initial bundle                   |

Every config field is typed and documented in `types.ts` (start at `MapConfigInput` and `MapLayerInput`). The Angular types (icons, template contexts, output payloads) are in `component-types.ts`. Every public export is listed in `index.ts`, and `GEO_MAP_PARTS` there lists every part, template and shape for a component's `imports`.

## Rules

- **Don't edit the engine files** to customise behaviour: `core/`, `config/`, `map-engine.ts`, `arcgis-config.ts`, `world-fit.ts`, `map-bridges.ts`, `map-state.ts`, `map-context.ts`, `signals.ts`. Their header says so. Edits there are the most likely to conflict when the folder is updated. If something can't be done through the table above, report it rather than patching the engine.
- **Don't edit** `version.ts`, `CHANGELOG.md` or `world-data.ts` (generated).
- **Don't edit `geospatial-map.css` to restyle.** Override tokens and classes in the app's global stylesheet (listed in `styles` in `angular.json` after the map's, or `src/styles.css`). Scope rules to one class (`.brand-map .geo-legend { … }`). Never use `!important`, `::ng-deep` or deeper selectors: every component rule has single-class specificity, so one scoped class always wins. A component's own `styles` reach only the map element itself (tokens set there still apply inside), not the parts in it.
- **Keep layer `id`s unique and stable**, and give selectable layers a `featureIdField` whose values are unique.
- **Use the 0.9 field names.** A config written for an earlier release fails validation with a message naming the new field or what replaces a removed one (`ui.legend.defaultOpen was renamed to ui.legend.expanded in 0.9.0`). Rename the field where the config is written.
- **Each map has one projection**, the developer's choice (`initialState.view.projection`, or the ArcGIS basemap's own). There is no projection switching; don't add a projection picker for users.
- **Keep a basemap's fallback in the list.** `esriWorldBasemap` falls back to `worldBasemap` (`fallbackBasemapId: 'world'`); validation fails when the list has no basemap with that id. Keep both, or give it another fallback (`{ ...esriWorldBasemap, fallbackBasemapId: 'plain' }` with `plainBasemap`). Keep the attribution of an Esri basemap visible: Esri's terms of use apply.
- **Layers draw in list order.** To change the order, reorder `data.layers`. Group them in the layer panel with `group`.
- **Large inline data** (`data: { type: 'FeatureCollection', … }` or `data: { rows }`) must keep its identity: keep it in a constant or a class field, not in a getter or a method the template calls.
- **Colours in the config may be CSS variables** (`fillColor: 'var(--brand-500)'`); prefer that to hard-coding a theme's colours in data.
- **Import from the folder's `index.ts`**, not from internal files, except `testing.ts` in tests.
- **Import the directive of every template you declare**: `MapPopupTemplate`, `MapTooltipTemplate`, `MapControlTemplate`, `MapErrorTemplate`, `MapConfigErrorTemplate`, or `GEO_MAP_PARTS`. Without it, `<ng-template geoMapPopup>` still compiles, as a plain template: the map ignores it and shows its default content, with no error or hint.
- **Keep parts standalone and `OnPush`.** Every component in the folder sets `changeDetection: ChangeDetectionStrategy.OnPush`; new parts and the app's custom parts should too. No `NgModule`.
- **Signal APIs and control flow.** `input()`, `model()`, `output()`, `viewChild()`, `contentChild()`, host bindings in `host: {}`, and `@if`, `@for`, `@switch`. No `@Input`, `@Output`, `@HostBinding`, `@HostListener`, `*ngIf` or `*ngFor`.
- **No `NgZone.run`, `ChangeDetectorRef`, RxJS or `innerHTML` in the folder.** The map updates the UI by writing signals, so it works zoneless and with zone.js. The one zone API it uses is `NgZone.runOutsideAngular` around OpenLayers, which does nothing without zone.js. Read the map in a part with the `inject*()` functions, never by injecting `MapRoot` or `GeospatialMap`.
- **No template syntax newer than Angular 21.0 while the app supports 21.** No arrow functions or spread in templates and host bindings (call a method of the component instead), and no API that was experimental in 21 (`resource()`, Signal Forms).
- **Override a part's `role` or `aria-*` with a static attribute** (`<geo-map-legend aria-label="Key">`): the part reads it and lets it win. A binding (`[attr.aria-label]`) competes with the part's own. `class` and `style` can be bound freely.

## Verify your change

1. **Build** the app with `ng build`. Angular apps type-check templates strictly by default: a wrong input, output or template variable is a build error, and the config is fully typed, so a type error usually names the wrong field. `bundle initial exceeded maximum budget` means the first page loads the map (about 1.1 MB, above a new app's 1 MB budget): load it with `@defer`, or raise the `initial` budget in `angular.json` (`docs/export-grid-integration.md` → Bundle budgets).
2. **Run the app's tests** with `ng test`.
3. **Load a page with the map** and wait until the map element (`[data-slot="map"]`) has `data-status="ready"`; in Playwright, `waitForMapReady(page)` from `testing.ts` does this (see `examples/map-ready-check.ts`). `data-status="error"` means the config is invalid; the map shows the reason.
4. **No `[geospatial-map]` console messages.** The map logs one-time hints for setup and data mistakes: the stylesheet missing from `angular.json`, a style field the data doesn't have, coordinates that aren't longitude/latitude, values matching no category, duplicate ids. Treat them as failures. One hint is about the environment, not the code: `The basemap "…" could not be loaded, so the map shows its fallback …` means the browser couldn't reach the basemap's service (no network access, a firewall, the page's Content-Security-Policy). Fix the access; in tests without network access, route the requests (`**/World_Basemap_v2/VectorTileServer**`) or list `basemaps: [worldBasemap]`. Angular can't tell whether `(featureSelect)` has a listener, so nothing warns when every layer has `selectable: false`: if the output never fires, check `selectable` and `featureIdField`.
5. **No `data-layer-errors` attribute** on the map element. It counts layers that failed to load; the layer panel marks which ones, and the error alert on the map shows the reason (also emitted by `(mapError)`).
6. **Look at it**: take a screenshot, including dark mode and a narrow (phone) width if you changed styles.

## Updating

Never re-copy the folder over the app's copy; that drops the app's edits. From a clone of the source repository:

```sh
node scripts/update-geospatial-map.mjs path/to/this/folder           # report
node scripts/update-geospatial-map.mjs path/to/this/folder --apply   # three-way merge
```

The script sees that this is the Angular folder (it has `map-root.ts`). Then read the `CHANGELOG.md` entries newer than the old version, especially "Changed (check these when updating)", and run the checks above.

## Where to look

| Question                                                     | File                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| What can the config contain?                                 | `types.ts`, `docs/configuration.md`                               |
| Layer kinds, data sources, styles, legends                   | `docs/layers-and-legends.md`                                      |
| Inputs, outputs, state, actions, templates, inject functions | `docs/state-events-templates.md`, `component-types.ts`            |
| Tokens, classes, dark mode, themes                           | `README.md` → Styling, `docs/theming-localization.md`             |
| Export, grids, the Angular CLI, SSR and `@defer`             | `docs/export-grid-integration.md`                                 |
| Something looks wrong                                        | `docs/troubleshooting.md`, `README.md` → If something looks wrong |
| What changed between versions                                | `CHANGELOG.md`, `docs/migration.md`                               |
