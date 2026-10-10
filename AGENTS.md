# Geospatial map repository: instructions for coding agents

This repository builds the geospatial map, a copy-paste map component (shadcn/ui style) with a React folder and an Angular folder, released together (0.11.2). This file is for work on the repository itself. The guide for an app that copied a folder travels with it: `packages/geospatial-map/src/AGENTS.md` (React) and `packages/geospatial-map-angular/src/AGENTS.md` (Angular).

## Layout

| Path                                                              | What it is                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/geospatial-map-core/`                                   | The shared, framework-neutral files (`src/`) and their unit tests (`test/`). Synced into the framework folders; never copied by teams.                                                                                                                                                               |
| `packages/geospatial-map/`                                        | The React folder. `src/` is what React teams copy; `test/` holds the SSR, portability, guide and consumer-compile tests.                                                                                                                                                                             |
| `packages/geospatial-map-angular/`                                | The Angular folder. Same shape as the React one; `CONTRIBUTING.md` says how to build a part and lists the known differences from React.                                                                                                                                                              |
| `apps/demo/`, `apps/demo-angular/`                                | The React and Angular demos. Each imports its folder as `@/components/geospatial-map`, like a host app.                                                                                                                                                                                              |
| `apps/demo-shared/`                                               | Scenarios, URL parameters, fixtures, harness CSS, themes and data that both demos import as `@demo-shared/*`. No framework code.                                                                                                                                                                     |
| `apps/site/`                                                      | The docs site (Astro and Starlight). It renders each folder's `README.md`, `AGENTS.md`, `CHANGELOG.md` and `docs/` and embeds both demos in its examples; `.github/workflows/docs-site.yml` publishes it to GitHub Pages. `apps/site/README.md` says how it is built.                                |
| `tests/browser/`                                                  | The Playwright suite, run against both demos; `parity/` compares them. Every spec imports `test` and `expect` from `tests/browser/fixtures/test.ts`, which serves the offline stand-in for Esri's World Basemap (`fixtures/esri-world/`). `tests/requirements-matrix.md` maps requirements to tests. |
| `scripts/`                                                        | `sync-core.mjs`, `update-geospatial-map.mjs` (updates a team's copy), `write-schema.mjs`, `build-world-data.mjs`, `build-esri-fixture.mjs`, `paste-test.mjs` (with `angular-architect-build.mjs`), `playwright.mjs`                                                                                  |
| `requirements.md`, `technical-architecture.md`, `angular-plan.md` | What the map must do, how it is built, and how the Angular version was planned (with the deviations)                                                                                                                                                                                                 |

## Rules

- **Edit shared files only in `packages/geospatial-map-core/src`, then run `pnpm sync-core`.** Never edit the synced copies in a framework folder (`core/`, `config/`, `types.ts`, `map-bridges.ts`, `geospatial-map.css`, …; the full list is in `packages/geospatial-map-core/README.md`). `pnpm test` fails when a copy differs from the core.
- **Keep shared files framework-neutral.** No React or Angular imports and no JSX. Comments name both forms (`useMapActions()` in React, `injectMapActions()` in Angular) or neither. A framework's own types go in its folder's `component-types.ts`.
- **Parity.** A change to a part, prop or input, hook or `inject*()` function, doc or example lands in both the React and the Angular folder in the same change. Both render the same elements, `geo-*` classes, `data-*` attributes, roles and labels: the browser suite is the contract. A difference that can't be avoided goes in the Angular folder's `CONTRIBUTING.md` (Known differences) and in its guides.
- **Docs are per framework.** Each folder has its own `README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/` (eight guides) and `examples/`, with samples in that framework's API; only three examples are shared (`packages/geospatial-map-core/src/examples`). Update both folders' docs and examples together, and keep every sample correct against the real API: the guide tests check that examples render and that the guides name only files that exist.
- **The docs site renders the guides as they are.** Keep each folder's `README.md`, `AGENTS.md`, `CHANGELOG.md` and `docs/*.md` plain GitHub Markdown: no frontmatter, a `# Title` on the first line, Markdown links (not raw HTML ones) relative inside the folder. `apps/site` copies them on every build (into gitignored folders) and rewrites its copies' links; never add frontmatter or site links to the folders. A new guide also needs an entry in both frameworks' `guides` in `apps/site/src/guides/catalog.mjs`, which sets its place and label in the sidebar (a site test fails until it has one).
- **React stays green.** Every change leaves the React folder, its demo and all its tests passing. Never break the React version while working on the Angular one.
- **Each folder stays self-contained.** A team copies one folder, never the core, and installs what its `package.json` lists. Shared dependencies keep the same versions in the core and in every folder (a test checks it).
- **Generated files.** `world-data.ts` comes from `node scripts/build-world-data.mjs`, which writes the core and syncs. The JSON Schemas come from `pnpm schema`. The browser suite's stand-in for Esri's World Basemap (`tests/browser/fixtures/esri-world/`) comes from `node scripts/build-esri-fixture.mjs`.
- **No test reaches the network.** The default basemap is Esri's World Basemap, loaded from `basemaps.arcgis.com`. A browser spec imports `test` and `expect` from `tests/browser/fixtures/test.ts` (never from `@playwright/test`), which answers the service from the stand-in for every page; `failEsriWorldBasemap(page, …)` makes it fail. The Angular unit tests answer it in `packages/geospatial-map-angular/test/setup.ts`.

## Before pushing

Run from the repository root; all must pass:

```sh
pnpm sync-core --check
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check   # pnpm format fixes it
pnpm test:paste     # the Angular folder pasted into fresh Angular 21 and 22 apps, built
pnpm build          # both demos (build:react, build:angular)
pnpm build:site     # the docs site and both demos below /react-map-component/ (links checked)
pnpm test:browser   # every project: React, Angular, Angular with zone.js, DOM parity
```

`pnpm test:browser` starts three dev servers (React on 4173, Angular on 4174, Angular with zone.js on 4175). For one side: `pnpm test:browser:react`, `pnpm test:browser:angular` (with the zone.js project) or `pnpm test:browser:parity` (both demos, compared by `tests/browser/parity`); they set `PW_FRAMEWORK`, which picks the projects and the servers, through `scripts/playwright.mjs` (it works in the Windows command prompt too). `tests/browser/framework.spec.ts` fails a project whose server is the other demo. `pnpm dev:all` serves both demos (React on 5173, Angular on 4200). `pnpm dev:site` serves the docs site on 4321 (`http://localhost:4321/react-map-component/`); its pages embed the demos that `pnpm dev:all` serves.

## Where to look

| Question                                     | File                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| How teams install, compose and style the map | `packages/geospatial-map/src/README.md` and `AGENTS.md` (React); `packages/geospatial-map-angular/src/README.md` and `AGENTS.md` (Angular) |
| Which files are shared                       | `packages/geospatial-map-core/README.md`                                                                                                   |
| What the tests guarantee                     | `packages/geospatial-map/README.md`, `packages/geospatial-map-angular/README.md`, `tests/testing-framework.md`                             |
| How the Angular version is built             | `technical-architecture.md` (section 5.2), `packages/geospatial-map-angular/CONTRIBUTING.md`, `angular-plan.md`                            |
| What changed in a release                    | Each folder's `src/CHANGELOG.md`                                                                                                           |
| How the docs site is built                   | `apps/site/README.md`                                                                                                                      |
