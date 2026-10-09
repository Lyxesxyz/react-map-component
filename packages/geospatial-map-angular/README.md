# Geospatial map — Angular source package

This package is not published to npm. **[`src/`](./src) is the component**: a self-contained folder an Angular team copies into their app, in the style of shadcn/ui. Start with [`src/README.md`](./src/README.md); it travels with the folder and covers installation, composition, and styling. The React version is [`packages/geospatial-map`](../geospatial-map); both render the same DOM from the same engine.

```sh
# in the consuming app (Angular 21 or 22)
npm install ol ol-mapbox-style proj4 typebox lucide
npm install -D @types/geojson
cp -r packages/geospatial-map-angular/src ./src/app/geospatial-map
# then add src/app/geospatial-map/geospatial-map.css to "styles" in angular.json, before your own CSS
```

## What lives here

| Path                                       | Purpose                                                                                                  | Copied to apps? |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------- |
| `src/`                                     | Component source, stylesheet, README, `AGENTS.md`, `docs/` and `examples/`                               | **Yes**         |
| `package.json`                             | The exact dependency list and the Angular peer range the folder needs (checked by a test)                | No              |
| `test/`                                    | Unit, server-rendering, portability, API, guide and single-instance tests                                | No              |
| `test/consumer-v21/`, `test/consumer-v22/` | Fresh Angular 21 and 22 apps the folder is pasted into and built (`pnpm test:paste`)                     | No              |
| `CONTRIBUTING.md`                          | How to work on the folder: conventions, porting a part from React, known differences, checks             | No              |
| `tsconfig*.json`, `vitest.config.ts`       | The `ngc` type-check with strict templates, and the folder's Vitest project                              | No              |
| `src/CHANGELOG.md`                         | Release notes, copied along with the folder                                                              | **Yes**         |
| `src/docs/`                                | Detailed guides (configuration, layers, state and templates, theming, export, grid, Angular CLI and SSR) | **Yes**         |
| `src/examples/`                            | Type-checked examples, one per common task (rendered in tests, built in the paste tests)                 | **Yes**         |
| `src/AGENTS.md`                            | Instructions for coding agents working in the copied folder                                              | **Yes**         |

The demo app (`apps/demo-angular`) imports the folder through `@/components/geospatial-map`, exactly as a host app would. It serves the same scenarios and routes as the React demo (`pnpm dev:all` starts both).

The framework-neutral files in `src/` (`core/`, `config/`, `types.ts`, `map-bridges.ts`, `geospatial-map.css` and the others listed in [the core package's README](../geospatial-map-core/README.md)) are committed copies of `packages/geospatial-map-core/src`. Edit them there and run `pnpm sync-core`; `pnpm test` fails when a copy differs. Their unit tests live in that package too. Everything else in `src/` is the Angular layer: the parts, the engine (`map-engine.ts`), context, icons, shapes, guides and examples.

## Guarantees enforced by tests

- **Portability** ([`test/portability.test.ts`](./test/portability.test.ts)):
  - Relative imports stay inside `src/`.
  - The only bare imports are the dependencies in `package.json`, which match the README install command.
  - The folder carries the package version and a changelog entry for it.
  - There are no CSS imports from TypeScript and no bundler-specific globals, and engine files carry the engine header.
  - The Angular conventions: every component is standalone and `OnPush`; no `NgModule`, decorator inputs, outputs or queries, `ChangeDetectorRef`, `NgZone.run`, RxJS, `innerHTML`, `resource()` or `@Service`; `lucide` imported only in `icons.ts` (and in the examples, which are app code); no arrow functions or spread in templates and host bindings.
- **Paste tests** (`pnpm test:paste`, [`scripts/paste-test.mjs`](../../scripts/paste-test.mjs)): `src/` is copied into [`test/consumer-v21`](./test/consumer-v21) (Angular 21.2, TypeScript 5.9) and [`test/consumer-v22`](./test/consumer-v22) (Angular 22.2, TypeScript 6.0) as `src/app/geospatial-map`, the way a team pastes it, and both apps are built with `ng new --strict` settings and no path aliases. The examples are built with them.
- **Single instance** ([`test/single-instance.test.ts`](./test/single-instance.test.ts)): the demo and the folder resolve one copy of `@angular/core`, `ol` and the other shared packages.
- **Public API** ([`test/exports.test.ts`](./test/exports.test.ts)): `index.ts` exports the pinned names, every React export has its Angular form (`useMapRuntime` → `injectMapRuntime`), and every Angular-only or React-only name has a reason. `GEO_MAP_PARTS` lists every part.
- **Guides** ([`test/examples-and-guides.test.ts`](./test/examples-and-guides.test.ts)):
  - Every example renders a valid map (with the fake OpenLayers controller), and every example the agent guide's task table names exists.
  - The README, `AGENTS.md` and the guides mention only files that exist in the folder, and link only inside it or to the web.
  - `CLAUDE.md` loads `AGENTS.md`.
- **Parts and engine** (the other tests in [`test/`](./test)): jsdom tests with a zoneless `TestBed` and the fake controller, and server-rendering tests with `@angular/platform-server` (an accessible shell, no OpenLayers).
- **Styling contract** ([`theme-tokens.test.ts`](../geospatial-map-core/test/theme-tokens.test.ts) in the core package): every JSON theme key is a declared CSS token, and every component rule has single-class specificity.
- **Lint:** angular-eslint with inline templates processed: standalone, `OnPush`, signal inputs, outputs and queries, `geo` selectors, no native or `on*` output names, control flow, and the template accessibility rules.
- **Browser** ([`tests/browser`](../../tests/browser)): every spec runs against the Angular demo in Chromium, Firefox and WebKit, and a Chromium project serves the demo with zone.js for `framework.spec.ts`, `quickstart.spec.ts`, `map.spec.ts` and `tests/browser/zone/`. [`tests/browser/parity`](../../tests/browser/parity) opens each route in both demos and compares their DOM.

## Commands (from the repository root)

```sh
pnpm --filter geospatial-map-angular typecheck   # ngc with strict templates: src, then src + tests
pnpm exec vitest run --project angular           # the Angular tests (pnpm test runs every project)
pnpm lint && pnpm format:check
pnpm test:paste                                  # src/ pasted into fresh Angular 21 and 22 apps, built
pnpm dev:angular                                 # the demo on http://127.0.0.1:4200 (dev:all: both demos)
pnpm build:angular                               # the demo, with its budgets
pnpm test:browser:angular                        # the browser suite on the Angular demo, and with zone.js
pnpm test:browser:parity                         # the same DOM in both demos
pnpm sync-core                                   # copies the shared files from packages/geospatial-map-core/src
```

## Guides

- [Getting started](./src/docs/getting-started.md)
- [Complete configuration reference](./src/docs/configuration.md)
- [Layers, sources, symbology, and legends](./src/docs/layers-and-legends.md)
- [State, events, actions, templates, and composition](./src/docs/state-events-templates.md)
- [Theming and localization](./src/docs/theming-localization.md)
- [Export, grids, the Angular CLI, and SSR](./src/docs/export-grid-integration.md)
- [Troubleshooting and performance](./src/docs/troubleshooting.md)
- [Migration](./src/docs/migration.md)
