# Geospatial map component

A reusable React/OpenLayers map for indicator pages, with Equal Earth and Web Mercator views, declarative vector and raster layers, legends, selection events, time playback, a responsive 3 × 2 map grid, and report-ready export.

## See the component

```sh
pnpm install
pnpm dev
```

Open the URL printed by Vite. The harness includes global polygons, point/line/polygon geometry, layer controls, vector-plus-raster time animation, two raster overlays, six regional maps, recoverable errors, safe embed output, and an accessible data table.

Useful deterministic routes:

- `/?scenario=global`
- `/?scenario=geometry`
- `/?scenario=layers`
- `/?scenario=time`
- `/?scenario=raster`
- `/?scenario=grid`
- `/?scenario=errors`
- `/?sources=1`
- `/?points=50000`
- `/?hidden=1`

## Use the package

```tsx
import { GeospatialMap } from '@org/geospatial-map'
import '@org/geospatial-map/styles.css'

;<GeospatialMap
  ariaLabel="Population by country"
  defaultView={{ center: [0, 15], zoom: 1.2, projection: 'EPSG:8857' }}
  basemaps={basemaps}
  layers={layers}
  onFeatureSelect={(event) => event && loadStatistics(event.featureId)}
/>
```

The public contract uses only serializable library-owned types. OpenLayers layers, sources, views, styles, and features remain internal.

## Validate

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm test:browser
```

See [requirements.md](./requirements.md), [technical-architecture.md](./technical-architecture.md), [tests/testing-framework.md](./tests/testing-framework.md), [tests/requirements-matrix.md](./tests/requirements-matrix.md), and [performance-budgets.md](./performance-budgets.md).
