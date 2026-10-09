# Troubleshooting and performance

## Configuration failure

Run `validateMapConfig(value)` before rendering CMS/API JSON. Each issue has `path`, `code`, and `message`. The component also emits `CONFIG_INVALID` through `(mapError)` and renders a safe accessible panel. In a custom layout, `<ng-template geoMapConfigError let-error>` inside `<geo-map-root>` replaces the panel's text; `error.cause` lists the issues.

A configuration written for an earlier version fails with one issue per renamed or removed field, saying what to write instead. A config written for 0.8 fails, for example, with `ui.legend.defaultOpen was renamed to ui.legend.expanded in 0.9.0`, `data.layers.0.time.available was renamed to time.values in 0.9.0`, `data.layers.0.zIndex was removed in 0.9.0: layers are drawn in the order of the list`, or `groupBy 'role' was removed in 0.9.0 with layer roles; use 'group' or 'none'`. Rename the field where the config is stored, using the 0.9 names. TypeScript flags the same fields at compile time.

## Error codes

`(mapError)` emits every error the map shows in its error alert, and `actions.reportError()` passes yours to it too. Each `MapError` has a `code`, a `message`, `recoverable`, and, where it applies, `layerId` and `cause`. The alert carries the code as `data-code`.

| Code                   | Meaning                                                                       | What to do                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONFIG_INVALID`       | The configuration is invalid; the map shows why instead of rendering.         | Run `validateMapConfig` and fix each issue it lists at its `path`.                                                                                                                                                   |
| `BASEMAP_INCOMPATIBLE` | The requested basemap doesn't support the map's projection, or doesn't exist. | See [Blank or incompatible basemap](#blank-or-incompatible-basemap).                                                                                                                                                 |
| `SOURCE_LOAD_FAILED`   | A layer's data, tiles or style failed to load. `layerId` names the layer.     | Check the URL, CORS and credentials; see [ArcGIS basemap does not load](#arcgis-basemap-does-not-load). A layer with `required: true` makes the error non-recoverable.                                               |
| `FEATURE_ID_MISSING`   | A selectable layer has features without the id `featureIdField` names.        | Give every feature a unique value in that property, or set `featureIdField` to one that has it.                                                                                                                      |
| `LOCATION_UNAVAILABLE` | The browser couldn't, or wasn't allowed to, report the user's location.       | Nothing to fix in the map: the user denied access, the request took longer than `ui.controls.locate.timeoutMs`, or the page isn't served over HTTPS. Remove `locate` from `ui.controls.groups` if you don't need it. |
| `HOOK_FAILED`          | The `[onOpenLayersMap]` function threw.                                       | Fix your hook; `cause` holds what it threw.                                                                                                                                                                          |
| `EXPORT_CORS_BLOCKED`  | A visible layer's images can't be exported (no CORS, or `exportable: false`). | See [Export fails](#export-fails).                                                                                                                                                                                   |
| `EXPORT_TIMEOUT`       | Layers did not finish loading within the export's `timeoutMs`.                | See [Export fails](#export-fails).                                                                                                                                                                                   |
| `EXPORT_FAILED`        | Export failed for another reason, for example the browser couldn't encode it. | Read `cause` for the original error. If the browser couldn't encode the image, a smaller `width`, `height` or `pixelRatio` may help.                                                                                 |

## Blank or incompatible basemap

The active basemap must exist and list the map's projection (`initialState.view.projection`) in `supportedProjections`; otherwise the configuration is invalid. Each map has one projection, so every basemap users may choose should support it: the basemap picker lists only those that do. `actions.setBasemap` with a basemap that doesn't support the projection, or doesn't exist, is refused with a `BASEMAP_INCOMPATIBLE` error.

## ArcGIS basemap does not load

The error (`SOURCE_LOAD_FAILED`) names the service and the reason. Check that the URL ends in `/VectorTileServer` (or is the item page) and that the service is shared publicly; private services need a token, which `arcgisBasemap` doesn't send. A style override that matches no layer logs the style's layer ids.

## A layer is empty, misplaced, or the wrong colour

The console names the problem when a layer's data loads: no features, coordinates that aren't longitude/latitude (set `sourceProjection`), a style `field` the features don't have, text values in a numeric style, values that match no category (add them or a `fallback`), and missing or duplicate `featureIdField` values. A URL that returns a login page fails with "returned a web page instead of data"; bind `[loadGeoJson]` to add credentials.

Features that match no rule of their style are not drawn: in a graduated or continuous style, absent or text values need `missing`, and numbers outside every class need `outOfRange`. See [how a value picks its symbol](./layers-and-legends.md#how-a-value-picks-its-symbol).

## Selection does not fire

Only GeoJSON and vector tile (`mvt`) layers are selectable. GeoJSON layers are selectable unless `selectable: false`; vector tile layers are selectable when they have a `featureIdField`. Heatmaps and the other kinds (XYZ, WMS, WMTS, ArcGIS vector tiles) are never selectable. Confirm `view.interactions.select` is not false. Angular can't tell whether `(featureSelect)` has a listener, so the map doesn't warn when you listen for selections and no layer is selectable: check the layers yourself. When features overlap, the top-most one under the click is selected. To select from your own code, call `actions.select({ layerId, featureId })` or set `state.selection`; the popup follows either.

## Export fails

`exportImage()` rejects with an `Error` whose `mapError` property is the `MapError`. `downloadImage()` and the settings panel show the error in the alert and emit it through `(mapError)`.

`EXPORT_CORS_BLOCKED` means a visible source or basemap is not exportable. Configure anonymous CORS, mark the source accurately, or switch to an exportable basemap. `EXPORT_TIMEOUT` means visible layers did not finish loading before `timeoutMs`: export waits for every visible layer, not only `required` ones. A visible layer that failed to load is exported without its data, unless it is `required`: then the export fails with that layer's `SOURCE_LOAD_FAILED` error. `EXPORT_FAILED` covers everything else; its `cause` holds the original error.

## Layers draw in the wrong order

Layers draw in the order of `data.layers`, the first at the bottom; there is no `zIndex` in the config. Reorder the list to change it. Layers you add yourself in `[onOpenLayersMap]` need a `zIndex` above the configured ones (for example `100`) to draw on top.

## A time layer disappears

A layer with `time` is hidden while the map shows a frame that isn't in its `time.values`, and its status chip says "No data for time". This is expected when layers have different frames. List the frame in the layer's `values` if it has data for it.

When layers have time frames and the config sets no `initialState.time`, the map starts at the first frame. With `initialState: { time: null }`, every time layer stays hidden until a frame is chosen.

An XYZ layer with `time` needs `{time}` in its URL; without it, the configuration is invalid.

## A custom control doesn't show

A `custom:*` id in `ui.controls.groups` without a template is skipped, and the console says which one: `Control custom:… is in ui.controls.groups but has no template`. Put `<ng-template geoMapControl="custom:…">` inside `<geo-map>` or `<geo-map-controls>`, or pass `customControls` to `<geo-map-controls>`.

The template must be recognised: import `MapControlTemplate` (or `GEO_MAP_PARTS`) in the component that declares it. Without the import, Angular compiles `<ng-template geoMapControl="…">` as a plain template that no part finds, and the hint above appears. The same goes for `MapPopupTemplate`, `MapTooltipTemplate`, `MapErrorTemplate` and `MapConfigErrorTemplate`: without them the default content shows, and under `strictTemplates` `let-feature` is typed `any`.

## Breadcrumbs or the layers button don't show

The breadcrumbs show the zoom targets listed in `ui.breadcrumbs.targets`, widest first; with no targets they render nothing. The `embedded` and `grid` profiles turn the layer panel off, and its button with it. To bring it back, set `ui.layerPanel.enabled: true` and add `layers` to a group in `ui.controls.groups`, or use the `full` or `compact` profile.

## Angular setup

- **The map is unstyled**, and the console says `geospatial-map.css is not loaded`: add it to `styles` in `angular.json`, or `@import` it in `src/styles.css`. The parts declare no component styles, so nothing else loads it.
- **`ng build` fails on a bundle budget.** OpenLayers is in the bundle that loads the map. Load the map with `@defer` or a lazy route, or raise the `initial` budget in `angular.json`. See [deferred loading](./export-grid-integration.md#deferred-loading).
- **A component throws "must be used inside `<geo-map-root>` or `<geo-map>`".** The `inject*()` functions read the map from where the component is declared. Put the component inside `<geo-map-root>` or `<geo-map>` in a template (directly, or inside one of the map's templates), and call the function in a field initializer or the constructor.
- **A popup, tooltip or control template is ignored.** Import its directive (`MapPopupTemplate`, `MapTooltipTemplate`, `MapControlTemplate`, or `GEO_MAP_PARTS`); see [A custom control doesn't show](#a-custom-control-doesnt-show).
- **`window is not defined` during server rendering** comes from your own code, not the map: the map touches OpenLayers and browser APIs only in the browser, after render. Call actions from event handlers or `afterNextRender`; before the map exists, and on the server, commands do nothing.

## Large datasets

Use MVT and scale-aware services for detailed regional/global data. Simplify small GeoJSON at build time. The harness includes `?points=50000` as a rendering regression fixture, not as permission to ship arbitrary full-resolution world files.

Heatmaps use OpenLayers' WebGL renderer. Prefer normalized weights, zoom-bounded layers, and preprocessed point inputs; do not send an unbounded global event table to the browser. Use graduated vector bubbles when users need selectable individual observations.

## Hidden containers

The component observes its target size and updates OpenLayers when revealed. The parent still needs a non-zero width and height. With `fill`, the map is as tall as its parent: give the parent a height, or the console says `The map has \`fill\` but its parent has no height`.

## Verification

In your app: run `ng build` (it type-checks the templates with `strictTemplates`) and `ng test`, then load a page with the map and wait for `data-status="ready"` on the map element (`waitForMapReady` in `testing.ts`; see [`examples/map-ready-check.ts`](../examples/map-ready-check.ts)). Treat `[geospatial-map]` console messages as failures. In the source repository: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm test:paste`, `pnpm build`, and `pnpm test:browser`.
