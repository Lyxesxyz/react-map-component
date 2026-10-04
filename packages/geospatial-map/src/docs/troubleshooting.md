# Troubleshooting and performance

## Configuration failure

Run `validateMapConfig(value)` before rendering CMS/API JSON. Each issue has `path`, `code`, and `message`. The component also emits `CONFIG_INVALID` and renders a safe accessible panel.

A configuration written for an earlier version fails with one issue per renamed or removed field, saying what to write instead: for example `ui.controlRail was renamed to ui.controls in 0.8.0`, or `frameFailurePolicy 'retain-last' was removed in 0.8.0; use 'pause' or 'skip'`. TypeScript flags the same fields at compile time.

## Error codes

`onError` receives every error the map shows in its error alert, and `actions.reportError()` passes yours to it too. Each `MapError` has a `code`, a `message`, `recoverable`, and, where it applies, `layerId` and `cause`. The alert carries the code as `data-code`.

| Code                   | Meaning                                                                       | What to do                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONFIG_INVALID`       | The configuration is invalid; the map shows why instead of rendering.         | Run `validateMapConfig` and fix each issue it lists at its `path`.                                                                                                                                                   |
| `BASEMAP_INCOMPATIBLE` | No basemap supports the requested projection, or the basemap doesn't exist.   | See [Blank or incompatible basemap](#blank-or-incompatible-basemap).                                                                                                                                                 |
| `SOURCE_LOAD_FAILED`   | A layer's data, tiles or style failed to load. `layerId` names the layer.     | Check the URL, CORS and credentials; see [ArcGIS basemap does not load](#arcgis-basemap-does-not-load). A layer with `required: true` makes the error non-recoverable.                                               |
| `FEATURE_ID_MISSING`   | A selectable layer has features without the id `featureIdField` names.        | Give every feature a unique value in that property, or set `featureIdField` to one that has it.                                                                                                                      |
| `LOCATION_UNAVAILABLE` | The browser couldn't, or wasn't allowed to, report the user's location.       | Nothing to fix in the map: the user denied access, the request took longer than `ui.controls.locate.timeoutMs`, or the page isn't served over HTTPS. Remove `locate` from `ui.controls.groups` if you don't need it. |
| `HOOK_FAILED`          | `onOpenLayersMap` threw.                                                      | Fix your hook; `cause` holds what it threw.                                                                                                                                                                          |
| `EXPORT_CORS_BLOCKED`  | A visible layer's images can't be exported (no CORS, or `exportable: false`). | See [Export fails](#export-fails).                                                                                                                                                                                   |
| `EXPORT_TIMEOUT`       | Layers did not finish loading within the export's `timeoutMs`.                | See [Export fails](#export-fails).                                                                                                                                                                                   |
| `EXPORT_FAILED`        | Export failed for another reason, for example the browser couldn't encode it. | Read `cause` for the original error. If the browser couldn't encode the image, a smaller `width`, `height` or `pixelRatio` may help.                                                                                 |

## Blank or incompatible basemap

The active basemap must exist and list the initial projection in `supportedProjections`. Every supported projection should have a compatible fallback basemap. Switching to a projection no basemap supports, or to a basemap that doesn't support the current projection, is refused with a `BASEMAP_INCOMPATIBLE` error.

## ArcGIS basemap does not load

The error (`SOURCE_LOAD_FAILED`) names the service and the reason. Check that the URL ends in `/VectorTileServer` (or is the item page) and that the service is shared publicly; private services need a token, which `arcgisBasemap` doesn't send. A style override that matches no layer logs the style's layer ids.

## A layer is empty, misplaced, or the wrong colour

The console names the problem when a layer's data loads: no features, coordinates that aren't longitude/latitude (set `sourceProjection`), a style `field` the features don't have, text values in a numeric style, values that match no category (add them or a `fallback`), and missing or duplicate `featureIdField` values. A URL that returns a login page fails with "returned a web page instead of data"; pass `loadGeoJson` to add credentials.

Features that match no rule of their style are not drawn: in a graduated or continuous style, absent or text values need `missing`, and numbers outside every class need `outOfRange`. See [how a value picks its symbol](./layers-and-legends.md#how-a-value-picks-its-symbol).

## Selection does not fire

GeoJSON layers are selectable unless `selectable: false`; tile layers also need `featureIdField`. Confirm `view.interactions.select` is not false. To select from your own code, call `actions.select({ layerId, featureId })` or set `state.selection`; the popup follows either.

## Export fails

`exportImage()` rejects with an `Error` whose `mapError` property is the `MapError`. `downloadImage()` and the settings panel show the error in the alert and pass it to `onError`.

`EXPORT_CORS_BLOCKED` means a visible source or basemap is not exportable. Configure anonymous CORS, mark the source accurately, or switch to an exportable basemap. `EXPORT_TIMEOUT` means required sources did not settle before `timeoutMs`. `EXPORT_FAILED` covers everything else; its `cause` holds the original error.

## Large datasets

Use MVT and scale-aware services for detailed regional/global data. Simplify small GeoJSON at build time. The harness includes `?points=50000` as a rendering regression fixture, not as permission to ship arbitrary full-resolution world files.

Heatmaps use OpenLayers' WebGL renderer. Prefer normalized weights, zoom-bounded layers, and preprocessed point inputs; do not send an unbounded global event table to the browser. Use graduated vector bubbles when users need selectable individual observations.

## Hidden containers

The component observes its target size and updates OpenLayers when revealed. The parent still needs a non-zero width and height.

## Verification

In your app: run your typecheck, then load a page with the map and wait for `data-status="ready"` on the map element (`waitForMapReady` in `testing.ts`). Treat `[geospatial-map]` console messages as failures. In the source repository: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm test:browser`.
