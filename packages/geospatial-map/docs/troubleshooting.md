# Troubleshooting and performance

## Configuration failure

Run `validateMapConfig(value)` before rendering CMS/API JSON. Each issue has `path`, `code`, and `message`. The component also emits `CONFIG_INVALID` and renders a safe accessible panel.

## Blank or incompatible basemap

The active basemap must exist and list the initial projection in `supportedProjections`. Every supported projection should have a compatible fallback basemap. Switching to a projection no basemap supports is refused with a `BASEMAP_INCOMPATIBLE` error.

## ArcGIS basemap does not load

The error names the service and the reason. Check that the URL ends in `/VectorTileServer` (or is the item page) and that the service is shared publicly; private services need a token, which `arcgisBasemap` doesn't send. A style override that matches no layer logs the style's layer ids.

## A layer is empty, misplaced, or the wrong colour

The console names the problem when a layer's data loads: no features, coordinates that aren't longitude/latitude (set `dataProjection`), a style `field` the features don't have, text values in a numeric style, values that match no category (add them or a `fallback`), and missing or duplicate `featureIdField` values. A URL that returns a login page fails with "returned a web page instead of data"; pass `loadGeoJson` to add credentials.

## Selection does not fire

GeoJSON layers are selectable unless `selectable: false`; tile layers also need `featureIdField`. Confirm `view.interactions.select` is not false.

## Export fails

`EXPORT_CORS_BLOCKED` means a visible source or basemap is not exportable. Configure anonymous CORS, mark the source accurately, or switch to an exportable basemap. `EXPORT_TIMEOUT` means required sources did not settle before `timeoutMs`.

## Large datasets

Use MVT and scale-aware services for detailed regional/global data. Simplify small GeoJSON at build time. The harness includes `?points=50000` as a rendering regression fixture, not as permission to ship arbitrary full-resolution world files.

Heatmaps use OpenLayers' WebGL renderer. Prefer normalized weights, zoom-bounded layers, and preprocessed point inputs; do not send an unbounded global event table to the browser. Use graduated vector bubbles when users need selectable individual observations.

## Hidden containers

The component observes its target size and updates OpenLayers when revealed. The parent still needs a non-zero width and height.

## Verification

Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm test:browser` before publishing.
