# Geospatial map repository: instructions for coding agents

This repository builds the geospatial map, a copy-paste map component (shadcn/ui style) with a React folder and, being added, an Angular folder. This file is for work on the repository itself. The guide for an app that copied a folder travels with it: `packages/geospatial-map/src/AGENTS.md`.

## Layout

| Path                                                              | What it is                                                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/geospatial-map-core/`                                   | The shared, framework-neutral files (`src/`) and their unit tests (`test/`). Synced into the framework folders; never copied by teams. |
| `packages/geospatial-map/`                                        | The React folder. `src/` is what React teams copy; `test/` holds the SSR, portability, guide and consumer-compile tests.               |
| `packages/geospatial-map-angular/`                                | The Angular folder, once added (see `angular-plan.md`). Same shape as the React one.                                                   |
| `apps/demo/`                                                      | The React demo. It imports the folder as `@/components/geospatial-map`, like a host app.                                               |
| `tests/browser/`                                                  | The Playwright suite, run against the demo. `tests/requirements-matrix.md` maps each requirement to its tests.                         |
| `scripts/`                                                        | `sync-core.mjs`, `update-geospatial-map.mjs` (updates a team's copy), `write-schema.mjs`, `build-world-data.mjs`                       |
| `requirements.md`, `technical-architecture.md`, `angular-plan.md` | What the map must do, how it is built, and the plan for the Angular version                                                            |

## Rules

- **Edit shared files only in `packages/geospatial-map-core/src`, then run `pnpm sync-core`.** Never edit the synced copies in a framework folder (`core/`, `config/`, `types.ts`, `map-bridges.ts`, `geospatial-map.css`, …; the full list is in `packages/geospatial-map-core/README.md`). `pnpm test` fails when a copy differs from the core.
- **Keep shared files framework-neutral.** No React or Angular imports and no JSX. Comments name both forms (`useMapActions()` in React, `injectMapActions()` in Angular) or neither. A framework's own types go in its folder's `component-types.ts`.
- **Parity.** Once the Angular folder exists, a change to a part, prop or input, hook, doc or example lands in both the React and the Angular folder in the same change. Both render the same elements, `geo-*` classes, `data-*` attributes, roles and labels: the browser suite is the contract.
- **React stays green.** Every change leaves the React folder, its demo and all its tests passing. Never break the React version while working on the Angular one.
- **Each folder stays self-contained.** A team copies one folder, never the core, and installs what its `package.json` lists. Shared dependencies keep the same versions in the core and in every folder (a test checks it).
- **Generated files.** `world-data.ts` comes from `node scripts/build-world-data.mjs`, which writes the core and syncs. The JSON Schemas come from `pnpm schema`.

## Before pushing

Run from the repository root; all must pass:

```sh
pnpm sync-core --check
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check   # pnpm format fixes it
pnpm build
pnpm test:browser
```

## Where to look

| Question                                     | File                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| How teams install, compose and style the map | `packages/geospatial-map/src/README.md`, `packages/geospatial-map/src/AGENTS.md` |
| Which files are shared                       | `packages/geospatial-map-core/README.md`                                         |
| What the tests guarantee                     | `packages/geospatial-map/README.md`, `tests/testing-framework.md`                |
| How the Angular version is built             | `angular-plan.md`                                                                |
