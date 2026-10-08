# Testing framework

## Test layers

- `pnpm test` runs deterministic unit and contract tests for projections, validation (including the messages for fields renamed or removed in 0.9.0), styling, legends, presets, report layout, SVG export (`packages/geospatial-map-core/test/core/svg-export.test.ts`), SSR, requirement-ID traceability, and the sync guard (`packages/geospatial-map-core/test/sync.test.ts`: every shared file in the folder is byte-identical to the core).
- `pnpm test:browser` runs the user-visible harness in Chromium, Firefox, and WebKit. It covers standard and ArcGIS Equal Earth, Mercator (one projection per map), GeoJSON/heatmap/MVT/XYZ/WMS/WMTS sources, vector interactions, grouped layer disclosures, raster controls, time playback, the six-map grid, export, accessibility equivalents, optional-source degradation, hidden-container recovery, and performance fixtures. `tests/browser/engine-checks.spec.ts` drives `/?scenario=checks` for engine behaviour, including the 0.9.0 checks: panels controlled at the root, fit to loaded data, a host that refuses a selection, one OpenLayers map across configuration changes, heatmap time frames, and a grid that adds and removes maps without echoing synchronised changes.
- `pnpm test:browser -- --project=chromium tests/browser/performance.spec.ts` runs the named reference-environment performance acceptance suite.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm format:check` are required release checks.

## Deterministic data

Browser tests do not depend on third-party availability. GeoJSON, XYZ, WMS, WMTS, and MVT requests are fulfilled by local assets or Playwright routes. The OpenStreetMap option remains available for manual interoperability testing but is not required for CI.

## Performance fixtures

The harness exposes query-addressable fixtures:

- `/?scenario=global`: global polygons.
- `/?points=50000`: 50,000 visible points.
- `/?sources=1`: detailed tiled-boundary/source protocol fixture.
- `/?scenario=raster`: two raster layers.
- `/?scenario=points`: graduated bubbles, categorical point symbols, and weighted heatmap layers.
- `/?scenario=grid`: six maps.
- `/?scenario=configuration`: profiles, control policy, theme, messages, custom control, and JSON UI overrides.
- `/?hidden=1`: initially hidden responsive container.

## Failure artifacts

Playwright retains a trace and screenshot on failure. Source failures are asserted by layer ID and structured error code. Export failures are tested through the visible alert and callback path.

## Release gate

No production acceptance claim should be made from a single development-machine run. Before release, run the browser and performance suites on every named reference environment in `performance-budgets.md`, archive the report, and review any budget change explicitly.
