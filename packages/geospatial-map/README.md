# Geospatial map — source package

This package is not published to npm. **[`src/`](./src) is the component**: a self-contained folder the receiving team copies into their app, in the style of shadcn/ui. Start with [`src/README.md`](./src/README.md); it travels with the folder and covers installation, composition, and styling.

```sh
# in the consuming app
npm install ol ol-mapbox-style proj4 typebox lucide-react
npm install -D @types/geojson
cp -r packages/geospatial-map/src ./src/components/geospatial-map
# then import './components/geospatial-map/geospatial-map.css' once in the app entry
```

## What lives here

| Path               | Purpose                                                                          | Copied to apps? |
| ------------------ | -------------------------------------------------------------------------------- | --------------- |
| `src/`             | Component source, stylesheet, README, `AGENTS.md`, `docs/` and `examples/`       | **Yes**         |
| `package.json`     | The exact dependency list the folder needs (checked by a test)                   | No              |
| `test/`            | SSR, portability, guide, and consumer-compile tests                              | No              |
| `src/CHANGELOG.md` | Release notes, copied along with the folder                                      | **Yes**         |
| `src/docs/`        | Detailed guides (configuration, layers, state and events, theming, export, grid) | **Yes**         |
| `src/examples/`    | Type-checked examples, one per common task (rendered in tests)                   | **Yes**         |
| `src/AGENTS.md`    | Instructions for coding agents working in the copied folder                      | **Yes**         |

The demo app (`apps/demo`) imports the folder through `@/components/geospatial-map`, exactly as a host app would.

The framework-neutral files in `src/` (`core/`, `config/`, `types.ts`, `map-bridges.ts`, `geospatial-map.css` and the others listed in [the core package's README](../geospatial-map-core/README.md)) are committed copies of `packages/geospatial-map-core/src`. Edit them there and run `pnpm sync-core`; `pnpm test` fails when a copy differs. Their unit tests live in that package too.

## Guarantees enforced by tests

- **Portability** ([`test/portability.test.ts`](./test/portability.test.ts)):
  - Relative imports stay inside `src/`.
  - The only bare imports are the dependencies in `package.json`, which match the README install command.
  - There are no CSS imports from TypeScript and no bundler-specific globals.
  - Every React module has `'use client'`.
- **Consumer compile** ([`test/consumer`](./test/consumer)): the folder compiles under a fresh Vite/Next.js strict `tsconfig` with no path aliases and no Node types.
- **Styling contract** ([`theme-tokens.test.ts`](../geospatial-map-core/test/theme-tokens.test.ts) in the core package):
  - Every JSON theme key is a declared CSS token.
  - Every component rule has single-class specificity.
- **Lint:** `eslint-plugin-react-hooks` with the React Compiler rules runs on `src/`, so the folder doesn't add warnings to a host's lint.
- **Browser** (`tests/browser`): the preset, the composed parts, theming, dark mode, and exports.

## Commands (from the repository root)

```sh
pnpm dev          # demo app
pnpm typecheck    # package, examples, consumer fixture, demo
pnpm test         # unit, SSR, portability, styling-contract tests
pnpm lint
pnpm test:browser # Playwright against the demo
pnpm schema       # writes map-config.schema.json and map-config-input.schema.json (next to the core package) from the runtime TypeBox schemas
pnpm sync-core    # copies the shared files from packages/geospatial-map-core/src into src/
```

## Configuration helpers

- `defineMapConfig(config)`: checks the short config form (`MapConfigInput`) at compile time and fills in the defaults (world basemap, starting view, layer defaults, the first time frame).
- `validateMapConfig(value)`: strict runtime validation that applies the same defaults and reports issues with their paths. A field renamed or removed in an earlier release is reported with what to write instead, using the 0.9 names.
- `mapConfigSchema`: the JSON Schema 2020-12 object of the complete config. `pnpm schema` writes it to `map-config.schema.json` for CMS or API validation.
- `mapInputSchema`: the JSON Schema of the short form, for editors and CMS fields. `pnpm schema` writes it to `map-config-input.schema.json`.

Invalid or unsupported JSON configuration renders an accessible failure panel and emits `CONFIG_INVALID`; OpenLayers is never partially initialized.

## Guides

- [Getting started](./src/docs/getting-started.md)
- [Complete configuration reference](./src/docs/configuration.md)
- [Layers, sources, symbology, and legends](./src/docs/layers-and-legends.md)
- [State, events, refs, slots, and composition](./src/docs/state-events-slots.md)
- [Theming and localization](./src/docs/theming-localization.md)
- [Export, grids, Vite, and Next.js](./src/docs/export-grid-integration.md)
- [Troubleshooting and performance](./src/docs/troubleshooting.md)
- [Migration](./src/docs/migration.md)

PNG/JPEG export requires anonymous CORS access for every visible source. Vector-only GeoJSON views export as vector-native SVG; configurations that contain tiles or heatmaps use a labelled raster SVG wrapper. Typechecked bubble, categorical-point, and heatmap configurations are in [`src/examples/symbology-layers.ts`](./src/examples/symbology-layers.ts).
