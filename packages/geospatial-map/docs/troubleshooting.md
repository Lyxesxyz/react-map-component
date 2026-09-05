# Troubleshooting and performance

## Configuration failure

Run `validateMapConfig(value)` before rendering CMS/API JSON. Each issue has `path`, `code`, and `message`. The component also emits `CONFIG_INVALID` and renders a safe accessible panel.

## Blank or incompatible basemap

The active basemap must exist and list the initial projection in `supportedProjections`. Every supported projection should have a compatible fallback basemap.

## Selection does not fire

Confirm that the vector layer is selectable and has stable feature IDs through GeoJSON IDs or `featureIdField`. Confirm `view.interactions.select` is not false.

## Export fails

`EXPORT_CORS_BLOCKED` means a visible source or basemap is not exportable. Configure anonymous CORS, mark the source accurately, or switch to an exportable basemap. `EXPORT_TIMEOUT` means required sources did not settle before `timeoutMs`.

## Large datasets

Use MVT and scale-aware services for detailed regional/global data. Simplify small GeoJSON at build time. The harness includes `?points=50000` as a rendering regression fixture, not as permission to ship arbitrary full-resolution world files.

Heatmaps use OpenLayers' WebGL renderer. Prefer normalized weights, zoom-bounded layers, and preprocessed point inputs; do not send an unbounded global event table to the browser. Use graduated vector bubbles when users need selectable individual observations.

## Hidden containers

The component observes its target size and updates OpenLayers when revealed. The parent still needs a non-zero width and height.

## Verification

Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm test:browser` before publishing.
