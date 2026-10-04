# Geospatial map component

A reusable React/OpenLayers map for indicator pages, with a modern [MapCN](https://www.mapcn.dev/docs)-inspired UI, Equal Earth and Web Mercator views, ArcGIS basemaps by URL, indicator data from GeoJSON, CSV, JSON or ArcGIS feature layers, declarative vector, heatmap, and raster layers, a disclaimer, legends, selection events, time playback, a responsive 3 × 2 map grid, and report-ready export.

MapCN's compact floating controls, shadcn-style surfaces, and Lucide icon conventions are adapted to product-owned Shapes components. OpenLayers remains the rendering engine so Equal Earth (`EPSG:8857`) and the full source contract continue to work.

## See the component

```sh
pnpm install
pnpm dev
```

Open the URL printed by Vite. The harness includes global polygons, graduated bubbles, categorical points, weighted heatmaps, point/line/polygon geometry, grouped layer controls, vector-plus-raster time animation, two raster overlays, six regional maps, recoverable errors, and an accessible data table.

Useful deterministic routes:

- `/?scenario=global`
- `/?scenario=global&basemap=arcgis-equal-earth` (live ArcGIS Equal Earth vector basemap)
- `/?scenario=global&projection=EPSG:3857` (the projection is a developer setting; this route starts in Web Mercator)
- `/?scenario=geometry`
- `/?scenario=points`
- `/?scenario=layers`
- `/?scenario=time`
- `/?scenario=raster`
- `/?scenario=grid`
- `/?scenario=configuration`
- `/?scenario=composed` (hand-composed parts, brand tokens, dark mode)
- `/?scenario=quickstart` (short inline config, `fill`, custom data loader)
- `/?scenario=features` (built-in world basemap, clustering, WebGL points, anchored popup, tooltip, a layer added through `onOpenLayersMap`)
- `/?scenario=arcgis` (an ArcGIS Equal Earth basemap from its URL, border style overrides, labels above the data, a disclaimer)
- `/?scenario=themes` (the same map as Material 3-style, IBM Carbon-style and editorial print themes, from CSS and an icon set; add `&theme=carbon` and `&dark`)
- `/?scenario=checks` (engine checks the browser tests drive: a panel controlled at the root, a host that refuses a selection, a grid that adds and removes maps)
- `/?controlled=1`
- `/?scenario=errors`
- `/?sources=1`
- `/?points=50000` (add `&renderer=canvas` or `&renderer=webgl` to compare renderers)
- `/?hidden=1`

## Use the component

The map is a **copy-paste component** in the style of shadcn/ui. Teams copy [`packages/geospatial-map/src`](./packages/geospatial-map/src) into their app, install five packages, import one stylesheet, and own the code from then on. `pnpm update-copy <path-to-their-copy>` merges a newer version into a copy while keeping the team's edits. Everything a receiving team needs is in [`packages/geospatial-map/src/README.md`](./packages/geospatial-map/src/README.md), which travels with the folder.

```sh
npm install ol ol-mapbox-style proj4 typebox lucide-react
npm install -D @types/geojson
cp -r packages/geospatial-map/src <your-app>/src/components/geospatial-map
```

```tsx
import '@/components/geospatial-map/geospatial-map.css' // once, in the app entry

import {
  GeospatialMap,
  MapControls,
  MapLegend,
  MapRoot,
  defineMapConfig,
  type MapLayerInput,
} from '@/components/geospatial-map'

const regionsLayer: MapLayerInput = {
  id: 'regions',
  data: { url: '/data/regions.geojson' },
  featureIdField: 'iso3',
}

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regions map' },
  data: { layers: [regionsLayer] }, // basemap, starting view and UI default sensibly
})

// Ready-made layout, for most maps:
<GeospatialMap config={config} onFeatureSelect={(event) => event && loadStatistics(event.featureId)} />

// For a custom layout, compose the parts you want, and style them with tokens and classes:
<MapRoot config={config} className="brand-map" fill>
  <MapControls placement="top-left" />
  <MapLegend placement="bottom-right" className="brand-legend" />
</MapRoot>
```

- **Restyling.**
  - Override `--geo-*` CSS variables (shadcn-style names; light and dark included).
  - Pass `className` to any part. Every rule has single-class specificity, so host CSS wins.
  - Swap the primitives in `shapes.tsx` for your design system.
- **Config contract.** The public contract uses only serializable library-owned types; OpenLayers layers, sources, views, styles, and features stay internal. The folder includes runtime validation, typed UI profiles, theme and message overrides, and the JSON Schemas `mapConfigSchema` (the complete config) and `mapInputSchema` (the short form, for editors and CMS fields). `pnpm schema` writes them as `map-config.schema.json` and `map-config-input.schema.json`.
- **More docs.** Detailed guides are in [`packages/geospatial-map/src/docs`](./packages/geospatial-map/src/docs), examples in [`src/examples`](./packages/geospatial-map/src/examples), and instructions for coding agents in [`src/AGENTS.md`](./packages/geospatial-map/src/AGENTS.md); all travel with the folder. The `/?scenario=composed` demo route is a styling playground.

## Validate

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm test:browser
```

See [requirements.md](./requirements.md), [technical-architecture.md](./technical-architecture.md), [tests/testing-framework.md](./tests/testing-framework.md), [tests/requirements-matrix.md](./tests/requirements-matrix.md), and [performance-budgets.md](./performance-budgets.md).
