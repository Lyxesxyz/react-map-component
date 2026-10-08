# Geospatial map — shared core

This package is the single source of the framework-neutral files of the geospatial map: the OpenLayers engine, the configuration, the types, the stylesheet and a few helpers. It is not published and teams never copy it. `pnpm sync-core` copies [`src/`](./src) into each framework folder, at the same paths, as committed files:

- the React folder, `packages/geospatial-map/src`;
- the Angular folder, `packages/geospatial-map-angular/src`, once it exists.

A team copies one of those folders and gets everything it needs.

## Editing a shared file

1. Edit the file here, in `packages/geospatial-map-core/src`. Never edit the synced copies in the framework folders.
2. Run `pnpm sync-core` from the repository root.
3. Run the checks of both folders (see the root `AGENTS.md`).

`pnpm test` fails when a copy differs from this package (`test/sync.test.ts`). `pnpm sync-core --check` lists the copies that differ or are missing.

## What is shared

| Path                                                                                      | What it is                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `core/`                                                                                   | OpenLayers engine: controller, layers, styles, legends, export      |
| `config/`                                                                                 | Config schema, defaults, validation, UI profiles, renamed fields    |
| `types.ts`                                                                                | Config, state, event, action and runtime types, and `MapHostInputs` |
| `map-bridges.ts`, `map-state.ts`                                                          | Actions, controller callbacks, state proposals; state helpers       |
| `basemaps.ts`, `world-data.ts`                                                            | Ready-made basemaps; world outlines (generated)                     |
| `messages.ts`, `theme.ts`, `utils.ts`, `testing.ts`, `version.ts`                         | Copy, theme tokens, helpers, `waitForMapReady`, the release         |
| `geospatial-map.css`                                                                      | Tokens and every style                                              |
| `examples/symbology-layers.ts`, `examples/map-ready-check.ts`, `examples/brand-theme.css` | Framework-neutral examples                                          |

The engine files in `core/` and `config/`, `map-bridges.ts` and `map-state.ts` start with the engine header, which says the file is identical in the React and Angular versions. Everything else (the parts, the engine hook or service, context, icons, shapes, `component-types.ts`, guides and the other examples) is written per framework.

Shared files import only each other and the dependencies in `package.json` (plus `geojson` types); a test checks it. Each framework folder lists the same dependencies at the same versions.

## Commands (from the repository root)

```sh
pnpm sync-core          # copy src/ into the framework folders
pnpm sync-core --check  # list copies that differ; exit 1 if any
pnpm schema             # write map-config.schema.json and map-config-input.schema.json here
node scripts/build-world-data.mjs   # regenerate src/world-data.ts, then sync
```
