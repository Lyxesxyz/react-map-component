# Geospatial map component

A reusable OpenLayers map for indicator pages, for **React and Angular**, with a modern [MapCN](https://www.mapcn.dev/docs)-inspired UI, Equal Earth and Web Mercator views, ArcGIS basemaps by URL, indicator data from GeoJSON, CSV, JSON or ArcGIS feature layers, declarative vector, heatmap, and raster layers, a disclaimer, legends, selection events, time playback, a responsive 3 × 2 map grid, and report-ready export.

MapCN's compact floating controls, shadcn-style surfaces, and Lucide icon conventions are adapted to product-owned Shapes components. OpenLayers remains the rendering engine so Equal Earth (`EPSG:8857`) and the full source contract continue to work.

## Choose React or Angular

Both versions are release 0.10.0 and have the same features. They share the engine, the configuration, the types and the stylesheet: those files are identical, byte for byte, in both folders (their source is [`packages/geospatial-map-core`](./packages/geospatial-map-core)). A configuration, a theme or a stylesheet written for one works in the other. Both render the same elements, `geo-*` classes, roles and labels, and one browser suite runs against both demos.

|                    | React                                                                                | Angular                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Folder to copy     | [`packages/geospatial-map/src`](./packages/geospatial-map/src)                       | [`packages/geospatial-map-angular/src`](./packages/geospatial-map-angular/src)                        |
| Framework          | React 18.3 or 19                                                                     | Angular 21 or 22, zoneless or with zone.js                                                            |
| Icons              | `lucide-react`                                                                       | `lucide`                                                                                              |
| The map            | `<GeospatialMap>`, or `<MapRoot>` with the parts you want                            | `<geo-map>`, or `<geo-map-root>` with the parts you want                                              |
| Guide for the team | [`src/README.md`](./packages/geospatial-map/src/README.md), `AGENTS.md`, `docs/`     | [`src/README.md`](./packages/geospatial-map-angular/src/README.md), `AGENTS.md`, `docs/`              |
| Demo               | `pnpm dev:react`, [http://127.0.0.1:5173](http://127.0.0.1:5173) (`apps/demo`, Vite) | `pnpm dev:angular`, [http://127.0.0.1:4200](http://127.0.0.1:4200) (`apps/demo-angular`, Angular CLI) |
| Release notes      | [`src/CHANGELOG.md`](./packages/geospatial-map/src/CHANGELOG.md)                     | [`src/CHANGELOG.md`](./packages/geospatial-map-angular/src/CHANGELOG.md)                              |

Pick the folder of your app's framework. Each folder is self-contained: you copy one, never both and never the core.

## See the component

```sh
pnpm install
pnpm dev            # the React demo (Vite, port 5173)
pnpm dev:react      # the same, always on port 5173
pnpm dev:angular    # the Angular demo (ng serve, port 4200)
pnpm dev:all        # both: React on 5173, Angular on 4200
```

Open the URL each server prints. The harness includes global polygons, graduated bubbles, categorical points, weighted heatmaps, point/line/polygon geometry, grouped layer controls, vector-plus-raster time animation, two raster overlays, six regional maps, recoverable errors, and an accessible data table. Each demo's header links to the same route in the other one ("Angular version", "React version").

The Angular demo's `dev` and `build` scripts first copy the shared demo data (`apps/demo-shared/public`) into `apps/demo-angular/public`. Start it with `pnpm dev:angular` (or `pnpm --filter geospatial-map-demo-angular dev --port …`), not `ng serve` alone, or the `/data/…` files are missing on a fresh clone.

### Routes

Every route works in both demos: add it to `http://127.0.0.1:5173` (React) or `http://127.0.0.1:4200` (Angular). The routes are parsed in [`apps/demo-shared/src/scenarios.ts`](./apps/demo-shared/src/scenarios.ts), which both demos share.

| Route                                          | What it shows                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/?scenario=global`                            | Global choropleth (the default)                                                                                                           |
| `/?scenario=global&basemap=arcgis-equal-earth` | The live ArcGIS Equal Earth vector basemap                                                                                                |
| `/?scenario=global&projection=EPSG:3857`       | The same map in Web Mercator (the projection is a developer setting, not a user picker)                                                   |
| `/?scenario=geometry`                          | Points, lines and polygons                                                                                                                |
| `/?scenario=points`                            | Graduated bubbles, categorical points and a weighted heatmap                                                                              |
| `/?scenario=layers`                            | Grouped layer controls                                                                                                                    |
| `/?scenario=time`                              | Vector and raster layers with time playback                                                                                               |
| `/?scenario=raster`                            | Two raster overlays                                                                                                                       |
| `/?scenario=grid`                              | Six synchronised regional maps                                                                                                            |
| `/?scenario=configuration`                     | Profiles, control policy, theme, messages, a custom control and JSON UI overrides                                                         |
| `/?scenario=composed`                          | Hand-composed parts, brand tokens, dark mode (a styling playground)                                                                       |
| `/?scenario=quickstart`                        | A short inline config, `fill`, a custom data loader                                                                                       |
| `/?scenario=features`                          | Built-in world basemap, clustering, WebGL points, anchored popup, tooltip, a layer added through `onOpenLayersMap`                        |
| `/?scenario=arcgis`                            | An ArcGIS Equal Earth basemap from its URL, border style overrides, labels above the data, a disclaimer                                   |
| `/?scenario=themes`                            | The same map as Material 3-style, IBM Carbon-style and editorial print themes; add `&theme=carbon` and `&dark`                            |
| `/?scenario=checks`                            | Engine checks the browser tests drive: a panel controlled at the root, a host that refuses a selection, a grid that adds and removes maps |
| `/?scenario=errors`                            | Recoverable errors                                                                                                                        |
| `/?controlled=1`                               | The main map's complete state held by the host                                                                                            |
| `/?sources=1`                                  | GeoJSON, XYZ, WMS, WMTS and MVT source fixtures                                                                                           |
| `/?points=50000`                               | 50,000 points; add `&renderer=canvas` or `&renderer=webgl` to compare renderers                                                           |
| `/?hidden=1`                                   | The map starts in a hidden container                                                                                                      |

The Angular demo also takes `?zone` on any route: it loads zone.js and starts with zone change detection, to check zone-based apps. Without it the demo is zoneless, like a new Angular app.

## Use the component

The map is a **copy-paste component** in the style of shadcn/ui. A team copies one folder into its app, installs five packages, adds one stylesheet, and owns the code from then on. `pnpm update-copy <path-to-their-copy>` merges a newer version into a copy while keeping the team's edits; it sees which framework the copy is for. Everything a receiving team needs is in the folder's `README.md`, which travels with it.

### React

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

The guide is [`packages/geospatial-map/src/README.md`](./packages/geospatial-map/src/README.md).

### Angular

```sh
npm install ol ol-mapbox-style proj4 typebox lucide
npm install -D @types/geojson
cp -r packages/geospatial-map-angular/src <your-app>/src/app/geospatial-map
```

Add the stylesheet to `styles` in `angular.json`, before your own CSS:

```json
"styles": ["src/app/geospatial-map/geospatial-map.css", "src/styles.css"]
```

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { GEO_MAP_PARTS, defineMapConfig, type MapLayerInput } from './geospatial-map'

const regionsLayer: MapLayerInput = {
  id: 'regions',
  data: { url: '/data/regions.geojson' },
  featureIdField: 'iso3',
}

@Component({
  selector: 'app-regions-map',
  imports: [GEO_MAP_PARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Ready-made layout, for most maps: -->
    <geo-map [config]="config" (featureSelect)="selected.set($event?.featureId ?? null)" />

    <!-- For a custom layout, compose the parts you want, and style them with tokens and classes: -->
    <geo-map-root [config]="config" class="brand-map" fill>
      <geo-map-controls placement="top-left" />
      <geo-map-legend placement="bottom-right" class="brand-legend" />
    </geo-map-root>
  `,
})
export class RegionsMap {
  protected readonly config = defineMapConfig({
    accessibility: { ariaLabel: 'Regions map' },
    data: { layers: [regionsLayer] }, // basemap, starting view and UI default sensibly
  })
  protected readonly selected = signal<string | null>(null)
}
```

Popups, tooltips and custom controls are `ng-template`s (`<ng-template geoMapPopup let-feature>`), and the actions are `#map="geoMap"` and `map.actions`. The guide is [`packages/geospatial-map-angular/src/README.md`](./packages/geospatial-map-angular/src/README.md).

### In both

- **Restyling.**
  - Override `--geo-*` CSS variables (shadcn-style names; light and dark included).
  - Put a class on any part (`className` in React, `class` in Angular). Every rule has single-class specificity, so host CSS wins.
  - Swap the primitives in `shapes.tsx` (React) or `shapes.ts` (Angular) for your design system.
- **Config contract.** The public contract uses only serializable library-owned types; OpenLayers layers, sources, views, styles, and features stay internal. The folder includes runtime validation, typed UI profiles, theme and message overrides, and the JSON Schemas `mapConfigSchema` (the complete config) and `mapInputSchema` (the short form, for editors and CMS fields). `pnpm schema` writes them as `map-config.schema.json` and `map-config-input.schema.json`.
- **More docs.** Each folder has its own guides in `docs/`, examples in `examples/`, and instructions for coding agents in `AGENTS.md` (with a `CLAUDE.md` that loads it); all travel with the folder. The `/?scenario=composed` demo route is a styling playground.

## Validate

```sh
pnpm sync-core --check     # the shared files in both folders match the core
pnpm typecheck
pnpm test                  # unit, SSR, portability, guide and sync tests of the core and both folders
pnpm lint
pnpm format:check          # pnpm format fixes it
pnpm build                 # both demos (build:react, build:angular)
pnpm test:paste            # the Angular folder pasted into fresh Angular 21 and 22 apps, built
pnpm test:browser          # every browser project: React, Angular, Angular with zone.js, DOM parity
```

`pnpm test:browser` starts three dev servers (React on 4173, Angular on 4174, Angular with zone.js on 4175). To run one side:

```sh
pnpm test:browser:react    # Chromium, Firefox and WebKit on the React demo
pnpm test:browser:angular  # the same on the Angular demo, and the zone.js project
pnpm test:browser:parity   # both demos, compared element by element
```

How to work on the repository itself (where shared files are edited, the parity rule) is in [AGENTS.md](./AGENTS.md). See also [requirements.md](./requirements.md), [technical-architecture.md](./technical-architecture.md), [tests/testing-framework.md](./tests/testing-framework.md), [tests/requirements-matrix.md](./tests/requirements-matrix.md), [performance-budgets.md](./performance-budgets.md) and [angular-plan.md](./angular-plan.md).
