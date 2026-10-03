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

| Path           | Purpose                                                                          | Copied to apps? |
| -------------- | -------------------------------------------------------------------------------- | --------------- |
| `src/`         | Component source, stylesheet, and its README                                     | **Yes**         |
| `package.json` | The exact dependency list the folder needs (checked by a test)                   | No              |
| `test/`        | Unit, SSR, portability, token, and consumer-compile tests                        | No              |
| `docs/`        | Detailed guides (configuration, layers, state and events, theming, export, grid) | No              |
| `examples/`    | Typechecked integration examples                                                 | No              |

The demo app (`apps/demo`) imports the folder through `@/components/geospatial-map`, exactly as a host app would.

## Guarantees enforced by tests

- **Portability** ([`test/portability.test.ts`](./test/portability.test.ts)):
  - Relative imports stay inside `src/`.
  - The only bare imports are the dependencies in `package.json`, which match the README install command.
  - There are no CSS imports from TypeScript and no bundler-specific globals.
  - Every React module has `'use client'`.
- **Consumer compile** ([`test/consumer`](./test/consumer)): the folder compiles under a fresh Vite/Next.js strict `tsconfig` with no path aliases and no Node types.
- **Styling contract** ([`test/theme-tokens.test.ts`](./test/theme-tokens.test.ts)):
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
pnpm schema       # writes map-config.schema.json from the runtime TypeBox schema
```

## Configuration helpers

- `defineMapConfig(config)`: identity helper that checks the config at compile time.
- `validateMapConfig(value)`: strict runtime validation that reports issues with their paths.
- `mapConfigSchema`: the JSON Schema 2020-12 object. `pnpm schema` writes it to a file for CMS or API validation.
- `initialMapState(view, layers, basemapId, time?)`: builds layer state from the layer defaults.
- `mapUiProfiles`: the resolved `full`, `compact`, `embedded`, and `grid` defaults.

Invalid or unsupported JSON configuration renders an accessible failure panel and emits `CONFIG_INVALID`; OpenLayers is never partially initialized.

## Guides

- [Getting started](./docs/getting-started.md)
- [Complete configuration reference](./docs/configuration.md)
- [Layers, sources, symbology, and legends](./docs/layers-and-legends.md)
- [State, events, refs, slots, and composition](./docs/state-events-slots.md)
- [Theming and localization](./docs/theming-localization.md)
- [Export, embeds, grids, Vite, and Next.js](./docs/export-grid-integration.md)
- [Troubleshooting and performance](./docs/troubleshooting.md)
- [Migration](./docs/migration.md)

PNG/JPEG export requires anonymous CORS access for every visible source. Vector-only GeoJSON views export as vector-native SVG; configurations that contain tiles or heatmaps use a labelled raster SVG wrapper. Typechecked bubble, categorical-point, and heatmap configurations are in [`examples/layers.ts`](./examples/layers.ts).
