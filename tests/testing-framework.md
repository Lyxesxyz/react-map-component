# Testing framework

The repository has two copy-paste folders, React and Angular, that share their engine. The shared files are tested once, in the core package. Each folder adds the tests of its own layer, and one browser suite runs against both demos.

## Test layers

- `pnpm test` runs Vitest with two projects (root `vitest.config.ts`):
  - **`core`** (Node): the core and React tests.
    - The shared files (`packages/geospatial-map-core/test`): projections, validation (including the messages for fields renamed or removed in 0.9.0), styling, legends, presets, report layout, SVG export (`core/svg-export.test.ts`), the default basemap and its fallback (`short-config.test.ts`, `core/arcgis.test.ts`: reprojected ArcGIS basemaps, `arcgisFallback`, `fallbackBasemapId` validation, service time limits), Web Mercator tiles drawn in Equal Earth (`core/projections.test.ts`), the styling contract (`theme-tokens.test.ts`), the sync guard (`sync.test.ts`: every shared file is byte-identical in both folders and imports no framework, and both folders list the core's dependencies at its version), and the update script (`update-script.test.ts`: a copy of a release gets every commit up to the next release, and keeps the team's edits).
    - The React folder (`packages/geospatial-map/test`): SSR, portability, the guides and examples, and requirement-ID traceability (`requirements-coverage.test.ts`).
  - **`angular`** (jsdom, a zoneless `TestBed`, Analog's Angular plugin; `packages/geospatial-map-angular/vitest.config.ts`): the Angular folder's tests, below.
- `pnpm test:browser` runs the user-visible harness in Chromium, Firefox, and WebKit, against the React demo and the Angular demo (see [Browser matrix](#browser-matrix)). It covers standard and ArcGIS Equal Earth, Mercator (one projection per map), GeoJSON/heatmap/MVT/XYZ/WMS/WMTS sources, vector interactions, grouped layer disclosures, raster controls, time playback, the six-map grid, export, accessibility equivalents, optional-source degradation, hidden-container recovery, and performance fixtures. `tests/browser/default-basemap.spec.ts` checks the default basemap: Esri's World Basemap reprojected to Equal Earth, and the quiet fallback to the World outlines. `tests/browser/engine-checks.spec.ts` drives `/?scenario=checks` for engine behaviour, including the 0.9.0 checks: panels controlled at the root, fit to loaded data, a host that refuses a selection, one OpenLayers map across configuration changes, heatmap time frames, and a grid that adds and removes maps without echoing synchronised changes.
- `pnpm test:paste` pastes the Angular folder into fresh Angular 21 and 22 apps and builds them (see [Paste test](#paste-test)).
- `pnpm test:browser:react --project=chromium performance.spec.ts` runs the named reference-environment performance acceptance suite on the React demo; `pnpm test:browser:angular --project=chromium-angular performance.spec.ts` runs it on the Angular demo. (Don't put `--` before the options: pnpm passes it on, and Playwright then ignores them and runs every test.)
- `pnpm sync-core --check`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm format:check` are required release checks.

## Angular unit tests

The Angular tests are in `packages/geospatial-map-angular/test`. They mock the OpenLayers controller with `fake-controller.ts` and play the renderer (`ready()`, `move()`, `hover()`, `click()`); a part alone gets a fake `MAP_CONTEXT`. `setup.ts` answers requests for Esri's World Basemap with a small Web Mercator stand-in and fails every other ArcGIS request, so no test reaches the network.

| Test                                                                                                                                                                           | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine.test.ts`                                                                                                                                                               | Config identity by content, a host that refuses a proposed state, the open panel, one report per config error and the config-error panel, the actions through `exportAs`, the OpenLayers hook (once per controller, undone on destroy), when the controller is recreated, ArcGIS services and the world fit before the start, a map without basemaps on the Esri World Basemap, the quiet switch to a fallback basemap, loading and layer errors on the map element |
| `parts.test.ts`, `layer-panel.test.ts`, `settings.test.ts`, `time-controls.test.ts`, `breadcrumbs-status.test.ts`, `error-disclaimer.test.ts`, `grid.test.ts`, `icons.test.ts` | Each part alone and in `<geo-map>`: host classes, `data-*` and ARIA, hidden parts, defaults from `config.ui`, templates and projected content, cancellable buttons, icons, shapes, the grid's per-map outputs                                                                                                                                                                                                                                                       |
| `ssr.test.ts` and `*-ssr.test.ts`                                                                                                                                              | Server rendering with `renderApplication` (`// @vitest-environment node`): the accessible shell, no OpenLayers, the config-error panel, each part's server HTML                                                                                                                                                                                                                                                                                                     |
| `hydration.test.ts`                                                                                                                                                            | The server's HTML hydrated in jsdom (`provideClientHydration()`): the map looks the same before and after, and nothing is drawn twice; the same inside `@defer (hydrate on …)` with incremental hydration                                                                                                                                                                                                                                                           |
| `exports.test.ts`                                                                                                                                                              | `index.ts` against a pinned list and against the React `index.ts` (`use*` ↔ `inject*`, React-only `*Props`, Angular-only templates), and `GEO_MAP_PARTS`                                                                                                                                                                                                                                                                                                            |
| `portability.test.ts`                                                                                                                                                          | The copy-paste rules (imports inside the folder, the listed dependencies, the README install line, version and changelog, engine headers) and the Angular conventions (`OnPush`, signal APIs, no NgModule, RxJS, `innerHTML` or v22-only template syntax)                                                                                                                                                                                                           |
| `single-instance.test.ts`                                                                                                                                                      | The demo and the folder resolve one copy of `@angular/core`, `ol` and the other shared packages                                                                                                                                                                                                                                                                                                                                                                     |
| `examples-and-guides.test.ts`                                                                                                                                                  | Every example renders a map; the guides mention only files that exist and link only inside the folder; `CLAUDE.md` loads `AGENTS.md`                                                                                                                                                                                                                                                                                                                                |

`pnpm --filter geospatial-map-angular typecheck` compiles the folder with `ngc` and strict templates, alone and then with its tests.

## Browser matrix

`playwright.config.ts` runs one suite against both demos. The specs are framework-neutral: they find elements by role, label and `data-slot`.

| Project                                                 | Demo and server                                                     | Specs                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `chromium`, `firefox`, `webkit`                         | React (Vite, :4173)                                                 | every spec but `parity/` and `zone/`                                 |
| `chromium-angular`, `firefox-angular`, `webkit-angular` | Angular (`ng serve`, :4174)                                         | the same specs                                                       |
| `chromium-angular-zone`                                 | Angular with zone.js on every route (`--configuration zone`, :4175) | `framework.spec.ts`, `quickstart.spec.ts`, `map.spec.ts` and `zone/` |
| `parity`                                                | both demos, React (:4173) and Angular (:4174)                       | `parity/dom.spec.ts`                                                 |

`PW_FRAMEWORK` (`react`, `angular`, `parity` or `all`, the default) picks the projects and starts only their servers. The root scripts set it through `scripts/playwright.mjs`, which works in the Windows command prompt too:

```sh
pnpm test:browser            # every project (three servers)
pnpm test:browser:react      # the React projects
pnpm test:browser:angular    # the Angular projects and the zone.js project
pnpm test:browser:parity     # the parity project
pnpm test:browser:angular --project chromium-angular composed.spec.ts   # one spec, one project
```

- **`framework.spec.ts`** runs in every project but `parity`. It fails when the server at the project's `baseURL` is the other demo (`ng-version`), or loads zone.js when it shouldn't, or the other way round.
- **The zone project** (`tests/browser/zone/zone.spec.ts`) checks that zone.js is loaded, that Angular runs on a real `NgZone` (its listeners belong to the `angular` zone), and that the map still updates the page.
- **DOM parity** (`tests/browser/parity/dom.spec.ts`) opens each route in both demos at the same viewport, with panels, a popup and a tooltip open where the route says so, and compares the visible elements inside every map (`dom-summary.ts`): element names, `geo-*` classes, `data-*` attributes, `role`, `aria-*` and `for`, `title`, `type`, `disabled`, `open`, `href`, `tabindex`, the live `value` or `checked` of form controls, and text. Angular may differ only by its part hosts' element names and by `display: contents` wrappers that carry nothing else (`<geo-map-icon>`, `<geo-shape-select>`). A failure prints the first differing node with its neighbours.

## Paste test

`pnpm test:paste` (`scripts/paste-test.mjs <v21|v22|all>`) copies `packages/geospatial-map-angular/src` into two apps shaped like `ng new --strict` output, as `src/app/geospatial-map`, the way a team pastes it, and builds them. Any compile error fails, so the folder keeps to the APIs both Angular versions share.

- `packages/geospatial-map-angular/test/consumer-v21`: Angular 21.2, TypeScript 5.9; `ng build`.
- `packages/geospatial-map-angular/test/consumer-v22`: Angular 22.2, TypeScript 6.0; an `ngc` type-check, then the production build. The Angular 22 CLI refuses Node.js older than 22.22.3, so on such a Node the build runs through the Architect API (`scripts/angular-architect-build.mjs`).

The two apps' `src/app/app.ts` use the public API broadly and must stay identical. Their initial budget is raised to the demo's: the map doesn't fit `ng new`'s 1 MB.

The React folder's equivalent is the consumer compile in `packages/geospatial-map/test/consumer`, run by `pnpm typecheck`.

## Deterministic data

Browser tests do not depend on third-party availability. GeoJSON, XYZ, WMS, WMTS, and MVT requests are fulfilled by local assets or Playwright routes. The OpenStreetMap option remains available for manual interoperability testing but is not required for CI.

The default basemap is Esri's World Basemap, which the demos load from `basemaps.arcgis.com`. No test reaches it:

- **The stand-in.** `tests/browser/fixtures/esri-world/` holds an offline stand-in for the service, shaped like the live one (checked in October 2026): its description (`service.json`, Web Mercator with Esri's 512-pixel tile grid, levels listed to 22 and tiles to its `maxLOD`, 2), a style (`style.json`: the sea as a shallow-water fill under a deep-water one, no background layer, a sprite in `sprites/`) and vector tiles for levels 0 to 2, drawn from Natural Earth 1:110m. `node scripts/build-esri-fixture.mjs` writes it; the stand-in's copyright text (`Test stand-in for Esri World Basemap · Natural Earth`) is what the attribution bar shows in tests.
- **The shared fixture.** Every spec imports `test` and `expect` from `tests/browser/fixtures/test.ts`, not from `@playwright/test`. Its automatic fixture routes `**/World_Basemap_v2/VectorTileServer**` to the stand-in for every page of every test. A test that needs the basemap to fail calls `failEsriWorldBasemap(page, 'service' | 'style' | 'sprite' | 'tiles')`, whose page route wins over the context's. A new spec must import from there too, or its pages request the live service.
- **The spec.** `tests/browser/default-basemap.spec.ts` checks, in both demos: the quick start starts on the Esri basemap reprojected to Equal Earth, with land in every part of the world, no seam between tiles (over the sea too, where tiles meet along curved meridians) and no console hint; zoomed in past the service's last level, it asks for no tile the service lacks; the settings panel switches between it and the World outlines; when the service, the style, its sprite or the tiles fail, the map shows the outlines with one `[geospatial-map]` hint and no error alert or `data-layer-errors`; a host that controls the state hears of the switch, whether the service can't be read or the style or tiles fail; a PNG export shows the reprojected basemap's land and an SVG export draws it as an image; the six maps of the grid read the service once.

The live service is never part of a test run. Check it by hand, with network access, before a release that changes the basemap code: the service and style against the stand-in, then both demos zoomed in on curved tile edges over the sea, high latitudes and the antimeridian, with the service, style, sprite and tiles cut in turn. 0.11.1 came from such a check.

## Performance fixtures

The harness exposes query-addressable fixtures. The routes, their parameters and the fixtures are defined once in `apps/demo-shared` (`src/scenarios.ts`, `src/fixtures.ts`), so the React and the Angular demo serve the same ones:

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

No production acceptance claim should be made from a single development-machine run. Before release, run the browser and performance suites on every named reference environment in `performance-budgets.md`, for both demos, archive the report, and review any budget change explicitly.
