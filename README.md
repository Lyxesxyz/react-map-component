# Geospatial map component

A reusable React/OpenLayers map for indicator pages, with a modern [MapCN](https://www.mapcn.dev/docs)-inspired UI, Equal Earth and Web Mercator views, declarative vector, heatmap, and raster layers, legends, selection events, time playback, a responsive 3 × 2 map grid, and report-ready export.

MapCN's compact floating controls, shadcn-style surfaces, and Lucide icon conventions are adapted to product-owned Shapes components. OpenLayers remains the rendering engine so Equal Earth (`EPSG:8857`) and the full source contract continue to work.

## See the component

```sh
pnpm install
pnpm dev
```

Open the URL printed by Vite. The harness includes global polygons, graduated bubbles, categorical points, weighted heatmaps, point/line/polygon geometry, grouped layer controls, vector-plus-raster time animation, two raster overlays, six regional maps, recoverable errors, safe embed output, and an accessible data table.

Useful deterministic routes:

- `/?scenario=global`
- `/?scenario=global&basemap=arcgis-equal-earth` (live ArcGIS Equal Earth vector basemap)
- `/?scenario=geometry`
- `/?scenario=points`
- `/?scenario=layers`
- `/?scenario=time`
- `/?scenario=raster`
- `/?scenario=grid`
- `/?scenario=configuration`
- `/?controlled=1`
- `/?scenario=errors`
- `/?sources=1`
- `/?points=50000`
- `/?hidden=1`

## Use the package

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

The public contract uses only serializable library-owned types. OpenLayers layers, sources, views, styles, and features remain internal.
The package ships runtime validation, a JSON Schema at `@org/geospatial-map/schema.json`,
typed UI profiles, theme/message overrides, and detailed guides in
[`packages/geospatial-map/docs`](./packages/geospatial-map/docs).

## Validate

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm test:browser
```

See [requirements.md](./requirements.md), [technical-architecture.md](./technical-architecture.md), [tests/testing-framework.md](./tests/testing-framework.md), [tests/requirements-matrix.md](./tests/requirements-matrix.md), and [performance-budgets.md](./performance-budgets.md).
