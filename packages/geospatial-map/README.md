# @org/geospatial-map

A reusable React 18/19 map for indicator pages. OpenLayers remains private; consumers configure projections, sources, controls, panels, time, legends, export, branding, and messages through a versioned JSON-safe contract.

## Install

```sh
pnpm add @org/geospatial-map
```

```tsx
import { GeospatialMap, defineMapConfig, initialMapState } from '@org/geospatial-map'
import '@org/geospatial-map/styles.css'

const config = defineMapConfig({
  version: 1,
  accessibility: { ariaLabel: 'Population by country' },
  initialState: initialMapState(
    { center: [0, 15], zoom: 1.2, projection: 'EPSG:8857' },
    layers,
    'equal-earth',
  ),
  view: { projectionBehavior: { mode: 'manual' } },
  data: { layers, basemaps },
  ui: { profile: 'full' },
})

export function PopulationMap() {
  return (
    <GeospatialMap
      config={config}
      onFeatureSelect={(event) => event && loadStatistics(event.featureId)}
    />
  )
}
```

Use `state` and `onStateChange` when the host owns map state. Without `state`, the component initializes itself from `config.initialState`.

The maintained controlled-state, slot, and six-cell grid examples are typechecked from [`examples/complete.tsx`](./examples/complete.tsx) during every package typecheck.

## Configuration helpers

- `defineMapConfig(config)`: compile-time configuration identity helper.
- `validateMapConfig(value)`: strict runtime validation with path-based issues.
- `mapConfigSchema`: JSON Schema 2020-12 object.
- `@org/geospatial-map/schema.json`: distributable JSON Schema.
- `initialMapState(view, layers, basemapId, time?)`: creates layer state from layer defaults.
- `mapUiProfiles`: resolved `full`, `compact`, `embedded`, and `grid` defaults.

Invalid or unsupported JSON configuration renders an accessible failure panel and emits `CONFIG_INVALID`; OpenLayers is not partially initialized.

## Guides

- [Getting started](./docs/getting-started.md)
- [Complete configuration reference](./docs/configuration.md)
- [Layers, sources, symbology, and legends](./docs/layers-and-legends.md)
- [State, events, refs, and React slots](./docs/state-events-slots.md)
- [Theming and localization](./docs/theming-localization.md)
- [Export, embeds, grids, Vite, and Next.js](./docs/export-grid-integration.md)
- [Troubleshooting and performance](./docs/troubleshooting.md)
- [Migration from the legacy 0.1 props](./docs/migration.md)

PNG/JPEG export requires anonymous CORS access for every visible source. Vector-only GeoJSON views export as vector-native SVG; configurations containing tiles or heatmaps use a labelled raster SVG wrapper. Typechecked bubble, categorical-point, and heatmap configurations are included in [`examples/layers.ts`](./examples/layers.ts).
