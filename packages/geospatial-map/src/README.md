# Geospatial map

An interactive React map for indicator pages, delivered the way shadcn/ui delivers its components: **you copy this folder into your app and own the code**. It renders with OpenLayers in Equal Earth, Web Mercator, or the projection of your ArcGIS basemap, and it has a layer panel, legends, tooltips and popups, time playback, a disclaimer, a six-map grid, and PNG/JPEG/SVG export.

- **Drop-in.** Run one install command, copy the folder, and add one CSS import. There's no build step and no path aliases, and nothing outside this folder is imported.
- **Composable.** Use the ready-made `<GeospatialMap>` layout, or build your own from `<MapRoot>` plus the parts you want.
- **Easy to restyle.** Override `--geo-*` CSS variables, pass `className` to any part, or edit the source.

## 1. Install

```sh
npm install ol ol-mapbox-style proj4 typebox lucide-react
npm install -D @types/geojson
```

(Or `pnpm add …` / `yarn add …`.)

- **React:** 18.3+ or 19.
- **TypeScript:** `"moduleResolution": "bundler"`, which is the default in Vite and Next.js.
- **lucide-react:** 0.360 or newer. For older versions, see [Icons](#icons).
- **`typebox`:** the unscoped 1.x package, not `@sinclair/typebox`.

## 2. Copy this folder

Copy it into your app, for example to `src/components/geospatial-map/`. The path is up to you; the examples below assume the `@/components/geospatial-map` alias that Vite and Next.js templates set up.

## 3. Import the styles once

Import the stylesheet in your app entry, **before your own CSS**:

```ts
// Vite: src/main.tsx · Next.js App Router: app/layout.tsx · Pages Router: pages/_app.tsx
import '@/components/geospatial-map/geospatial-map.css'
```

The map inherits your app's font. Set `--geo-font-family` if you want a different one.

## 4. If you use coding agents

The folder has an `AGENTS.md` (and a `CLAUDE.md` that loads it): where each kind of change belongs, what not to edit, and how to check a change. Agents read it when they work in this folder. To point them at it from anywhere in your app, add one line to your root `AGENTS.md` or `CLAUDE.md`:

```md
The map component is copied into `src/components/geospatial-map/`; follow its `AGENTS.md`.
```

Examples for common tasks are in [`examples/`](./examples/) and are type-checked with the rest of the folder.

## Quick start

```tsx
import { GeospatialMap, defineMapConfig } from '@/components/geospatial-map'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regions map' },
  data: {
    layers: [
      {
        id: 'regions',
        title: 'Regions',
        data: { url: '/data/regions.geojson' }, // GeoJSON, CSV, an ArcGIS layer… (see below)
        featureIdField: 'iso3', // optional: a stable id for selection and events
        style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#60a5fa' } },
      },
    ],
  },
})

export function RegionsMap() {
  return (
    <GeospatialMap config={config} onFeatureSelect={(event) => console.log(event?.featureId)} />
  )
}
```

That's the whole setup. `defineMapConfig` fills in everything you leave out:

| Left out        | Default                                                                                                                                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`       | `1`                                                                                                                                                                                                                                                                                                               |
| `data.basemaps` | `[esriWorldBasemap, worldBasemap]`: Esri's World Basemap, which the user's browser loads from `basemaps.arcgis.com`, with the bundled country outlines as its fallback when it can't be loaded. See [Basemaps](#basemaps).                                                                                        |
| `initialState`  | The whole world, fitted to the size of the map, in Equal Earth (or your ArcGIS basemap's projection), with each layer's own `visible` and `opacity`, and the first time frame when layers have [time frames](#time-frames). Pass `initialState: { view: { center: [25, 42], zoom: 5 } }` to start somewhere else. |
| `view`, `ui`    | Default interactions and the `full` UI profile                                                                                                                                                                                                                                                                    |
| Layer `kind`    | `'geojson'`. A GeoJSON layer (no `kind`, or `kind: 'geojson'`) also gets its `id` as `title`, and a default style: `--geo-primary` fill with a `--geo-background` outline (lines and points get the same colour).                                                                                                 |
| `selectable`    | `true` on GeoJSON layers (and on vector tile `mvt` layers with a `featureIdField`). Set `selectable: false` to opt out. Other layer kinds, heatmaps included, are never selectable.                                                                                                                               |

Writing the config inside your component is fine: the map compares configs by content, so re-rendering your component doesn't reset the view. It resets only when `initialState` changes.

The one exception is large inline data (`data: { type: 'FeatureCollection', features }` or `data: { rows }`). Define it outside the component, or memoize it, so the map isn't handed a new dataset on every render.

### Recommended path

The component offers two ways to do some things. For a new integration, use the first one in each pair:

| Task                  | Use                                                          | Also available, for…                                                                                       |
| --------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Colours, sizes, fonts | CSS: `--geo-*` tokens and classes ([Styling](#styling))      | `config.theme`, when the theme comes from a CMS as JSON                                                    |
| Layout and custom UI  | `<GeospatialMap>` and `config.ui`, for most maps             | `<MapRoot>` with the parts you want, for a custom layout ([Build your own layout](#build-your-own-layout)) |
| Popup content         | `slots={{ popup: ({ feature }) => … }}` on `<GeospatialMap>` | `<MapPopup>{({ feature }) => …}</MapPopup>` in your own layout                                             |

### Size

The map is as wide as its container and `--geo-height` (680px) tall. To fill a container you size yourself, pass `fill`:

```tsx
<div style={{ height: '70vh' }}>
  <GeospatialMap fill config={config} />
</div>
```

### Indicator data from anywhere

A layer's `data` can come from most places indicators live. The format is detected from the URL; set `format` when it can't be:

| `data`                                                        | What it reads                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `{ url: '/regions.geojson' }`                                 | GeoJSON: a FeatureCollection, a single Feature or geometry, or an array of features                                                              |
| `{ url: '…/FeatureServer/0' }`                                | An ArcGIS feature layer (or `MapServer/3`). All features are read, page by page, in longitude/latitude.                                          |
| `{ url: 'https://www.arcgis.com/home/item.html?id=…' }`       | An ArcGIS Online item: a feature service, or an uploaded GeoJSON or CSV file. The bare 32-character item id works too.                           |
| `{ url: '/sites.csv' }`                                       | CSV with longitude and latitude columns (`lon`/`lng`/`longitude`/`x` and `lat`/`latitude`/`y` are found automatically; `,` `;` or tab separated) |
| `{ url: '/api/sites', longitude: 'east', latitude: 'north' }` | JSON rows (an array, or one wrapped in `data`, `items`, `results`, `rows` or `records`), with the columns named                                  |
| `{ rows: [{ name: 'HQ', lon: 2.35, lat: 48.85 }] }`           | Rows you already have in memory                                                                                                                  |
| `{ type: 'FeatureCollection', features }`                     | Inline GeoJSON (`bbox`, `name` and other members are allowed)                                                                                    |
| `{ builtin: 'world' }`                                        | The bundled Natural Earth country outlines as one feature with no properties: a backdrop, not countries you can colour                           |
| `{ url: '/api/indicator', format: 'csv' }`                    | Any of the above when the URL doesn't say (`format`: `'geojson'`, `'csv'`, `'json'` or `'arcgis'`)                                               |

CSV and JSON values that look like numbers become numbers, except codes with leading zeros (`'007'`). Polygons and lines that cross the edge of the map (Russia, Fiji, Antarctica) are cut there, so they don't smear across the map.

To colour admin areas from a table, put the values on boundary GeoJSON of your own and style it by that field; see [`docs/layers-and-legends.md`](./docs/layers-and-legends.md#colouring-admin-areas) and [`examples/admin-choropleth.tsx`](./examples/admin-choropleth.tsx). This holds for countries too: use a countries file with a code per country (Natural Earth's admin-0 countries, for example). `{ builtin: 'world' }` has no countries to join onto, and `loadGeoJson` isn't called for it.

#### Data that needs authentication

URLs are loaded with `fetch(url)`. To add headers or credentials, pass `loadGeoJson`. Wrap `fetchGeoJson`, the built-in loader, so CSV, ArcGIS and the rest keep working:

```tsx
import { GeospatialMap, fetchGeoJson } from '@/components/geospatial-map'

;<GeospatialMap
  config={config}
  loadGeoJson={(url, options) => fetchGeoJson(`${url}?token=${token}`, options)}
/>
```

A loader that returns `fetch(url, { headers }).then((r) => r.json())` works too, for GeoJSON only. `options.layerId` names the layer that is loading, so one loader can treat layers differently; `fetchGeoJson(url, options)` accepts the options with or without it.

Tile sources (XYZ, WMS, WMTS, vector tiles) are requested by the browser from their URL templates. For private tiles, use signed URLs or a same-origin proxy.

### Keep it out of your initial bundle

The map adds roughly 290 KB gzipped, mostly OpenLayers. Load it when the page that shows it opens:

```tsx
// Vite / React Router
const RegionsMap = lazy(() => import('./regions-map').then((m) => ({ default: m.RegionsMap })))
// <Suspense fallback={<p>Loading map…</p>}><RegionsMap /></Suspense>

// Next.js
const RegionsMap = dynamic(() => import('./regions-map').then((m) => m.RegionsMap), { ssr: false })
```

### Validating config from a CMS or API

`config` is plain JSON. It contains no functions, so it can be stored or served:

- Check untrusted JSON with `validateMapConfig(json)`. It applies the same defaults and returns either the full config or a list of issues with their paths.
- A config written for an earlier release fails with a message for each renamed or removed field, naming what to write instead (for example `ui.legend.defaultOpen was renamed to ui.legend.expanded in 0.9.0`). Use the 0.9 names.
- An invalid config renders an accessible error panel instead of a broken map.
- For an editor or a CMS field, `mapInputSchema` is the JSON Schema of the short form that `defineMapConfig` takes (`MapConfigInput`); `mapConfigSchema` is the schema of the complete config.
- `config.ui` chooses a profile (`full`, `compact`, `embedded`, `grid`), switches panels on or off, and places each one in a corner. The `embedded` profile has no layer panel.
- `config.messages` translates the UI text.

### Your ArcGIS basemap

Pass the URL of an ArcGIS vector tile service (or its ArcGIS Online item page). The service must be public.

```ts
import { arcgisBasemap, defineMapConfig } from '@/components/geospatial-map'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Indicators' },
  data: {
    basemaps: [
      arcgisBasemap({
        url: 'https://tiles.arcgis.com/tiles/…/arcgis/rest/services/MyBasemap/VectorTileServer',
      }),
    ],
    layers: [/* your indicators */],
  },
})
```

- **Projection.** The map uses the service's projection: Equal Earth (any central meridian), Web Mercator, or anything else ArcGIS describes in WKT. You don't configure it, unless the basemap should be drawn in other projections too ([below](#other-projections-and-a-fallback)).
- **Style.** The service's default style is used, with its fonts and sprites. Pass `styleUrl` to use another style from the same service.
- **Labels and borders above your data.** `arcgisBasemap` splits the style in two: fills under your layers, and labels and boundary lines above them, so country names and borders stay readable over a choropleth. Pass `labelsAboveData: false` to draw the whole basemap underneath.
- **Attribution** comes from the service's copyright text. Pass `attribution` to replace it.

#### Other projections and a fallback

```ts
import { arcgisBasemap, defineMapConfig, worldBasemap } from '@/components/geospatial-map'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Indicators' },
  data: {
    basemaps: [
      arcgisBasemap({
        url: 'https://tiles.arcgis.com/tiles/…/arcgis/rest/services/MyMercatorBasemap/VectorTileServer',
        projections: ['EPSG:8857', 'EPSG:3857'], // a Web Mercator service, drawn in Equal Earth too
        fallbackBasemapId: 'world', // shown when the service can't be loaded
      }),
      worldBasemap,
    ],
    layers: [/* your indicators */],
  },
})
```

- **`projections`** lists the projections to draw the basemap in. When the map's projection is not the service's own, the vector tiles are reprojected in the browser, and the style's zoom-dependent layers switch at about the same scales as in the service's projection. The map starts in Equal Earth when the basemap lists it, unless `initialState.view.projection` says otherwise. The limits, for a Web Mercator service in Equal Earth:
  - Web Mercator tiles stop at about 85° north and south, so the polar caps show the basemap's background colour (`--geo-basemap-water`, as around the world's outline), not the colour of its sea.
  - Near the poles the map loads more tiles, and more detailed ones, than Web Mercator does for the same view, since Web Mercator stretches the land there. At 60° north or south it reads tiles about one level deeper; at Svalbard (78°), three levels deeper: 94 tiles for a view that Web Mercator draws from 3.
  - Only basemaps are reprojected: an ArcGIS vector tile layer in `data.layers` must be in the map's projection.
- **`fallbackBasemapId`** names another basemap of `data.basemaps`, shown when this one can't be loaded: the service can't be read or doesn't answer within 10 seconds, its style fails, or none of a layer's tiles load. The map switches quietly: no error alert, no `onError`, no `data-layer-errors`, and one `[geospatial-map]` console hint that names both basemaps and the reason. The fallback must support the map's projection. When the service can't be read, the map starts on the fallback and leaves the failed basemap out of the settings panel; a host that controls `state` and names the failed basemap gets the fallback through `onStateChange`. When its style or tiles fail after the map started, the switch reaches `state.activeBasemapId` and `onStateChange`, like a choice in the settings panel. A host that controls `state` and keeps the failed basemap's id keeps the fallback on the map. Without a fallback, the failure shows in the error alert (`SOURCE_LOAD_FAILED`).

`esriWorldBasemap` is built this way: `arcgisBasemap({ url: '…/World_Basemap_v2/VectorTileServer', id: 'esri-world', title: 'Esri World Basemap', projections: ['EPSG:8857', 'EPSG:3857'], fallbackBasemapId: 'world' })`.

#### Changing borders and labels

`styleOverrides` changes basemap style layers by id. `*` matches any text:

```ts
arcgisBasemap({
  url,
  styleOverrides: [
    { layers: 'Boundary line/Admin0*', color: '#4b5563', width: 1.5 },
    { layers: 'Boundary line/Admin1*', color: 'var(--brand-muted)', width: 0.75 },
    { layers: 'Boundary line/Admin2*', visible: false },
    { layers: '*/label/*', opacity: 0.8 },
    { layers: 'Water area', paint: { 'fill-antialias': false } },
  ],
})
```

- `color`, `width` and `opacity` set the matching paint property for each layer type (line, fill, text, icon, circle, background). `paint` and `layout` take any Mapbox GL property.
- Colours can be CSS variables; they follow light and dark mode.
- To find the ids, open the style URL (`…/VectorTileServer/resources/styles/root.json`) and look at `layers[].id`. If a pattern matches nothing, the console lists the ids the style has.

To colour admin areas by an indicator, add your own boundary GeoJSON as a layer on top ([Indicator data from anywhere](#indicator-data-from-anywhere)); the basemap only draws them.

### Projection

Each map has one projection, set in its config: `initialState.view.projection` (`'EPSG:8857'` Equal Earth or `'EPSG:3857'` Web Mercator), or an ArcGIS basemap's own. Users can't change it, and neither can an action. The settings panel offers only basemaps in the map's projection, and hides the basemap field when there is just one; `actions.setBasemap` refuses any other with a `BASEMAP_INCOMPATIBLE` error.

Any other projection comes from the basemap that is drawn in it: an ArcGIS basemap brings its own, and a vector tile layer defines one with `sourceProjectionDefinition: { code, definition }` (a proj4 string or WKT). If an ArcGIS service's projection is read wrongly, pass `sourceProjectionDefinition: { code, definition }` to `arcgisBasemap`.

### Basemaps

A configuration that lists no basemaps gets two, both offered in the settings panel:

- **`esriWorldBasemap`** (id `esri-world`), the one the map starts on: Esri's World Basemap from ArcGIS Online, with land, water, borders and place names. Its labels and borders are drawn above your data. Its tiles are Web Mercator; in an Equal Earth map, the default, they are reprojected in the browser (see [Other projections and a fallback](#other-projections-and-a-fallback)).
- **`worldBasemap`** (id `world`), its fallback: Natural Earth country outlines on water, coloured by `--geo-basemap-water`, `--geo-basemap-land` and `--geo-basemap-border`. The data (about 68 KB) ships in `world-data.ts` and loads the first time a map uses it, with no network access or API key.

The Esri basemap comes from Esri, through the user's browser:

- **Network access.** The browser reads the service, its style and its tiles from `https://basemaps.arcgis.com`. With a Content-Security-Policy, allow that host in `connect-src` and `img-src` (the style's sprite images).
- **Terms of use.** Esri's terms of use apply to the basemap. The attribution bar shows the service's copyright text automatically; keep it visible, and check that Esri's terms allow your use before you ship.
- **Its colours.** The Esri basemap keeps its style's light colours in dark mode: unlike `worldBasemap`, it doesn't read the `--geo-basemap-*` tokens. For a dark map, use `worldBasemap`, or build the Esri basemap with `arcgisBasemap()` and `styleOverrides` whose colours are CSS variables (they follow dark mode, see [Changing borders and labels](#changing-borders-and-labels)).
- **When it can't be loaded** (offline, a firewall, a Content-Security-Policy that blocks it, the service down), the map shows `worldBasemap` instead: no error alert, one `[geospatial-map]` console hint ([If something looks wrong](#if-something-looks-wrong)). A network that drops the requests without answering holds the map for up to 10 seconds before it switches.

To keep the default of 0.10 and earlier, bundled outlines with no requests to Esri, list them alone:

```ts
import { defineMapConfig, worldBasemap } from '@/components/geospatial-map'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regions map' },
  data: {
    basemaps: [worldBasemap], // no network access, no third-party requests
    layers: [/* … */],
  },
})
```

`esriWorldBasemap` falls back to the basemap with id `world`, so a list with it needs `worldBasemap` too (validation says so otherwise), or another fallback: `{ ...esriWorldBasemap, fallbackBasemapId: 'plain' }` with `plainBasemap` in the list.

For streets or satellite imagery, use `tileBasemap` with your tile provider's URL and the credit they require:

```ts
import { defineMapConfig, tileBasemap, worldBasemap } from '@/components/geospatial-map'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regions map' },
  data: {
    basemaps: [
      tileBasemap({
        url: 'https://tiles.example.com/{z}/{x}/{y}.png',
        attribution: { label: '© Example Maps', url: 'https://example.com/copyright' },
      }),
      worldBasemap, // also offered in the settings panel: it supports Web Mercator too
    ],
    layers: [/* … */],
  },
  initialState: { view: { projection: 'EPSG:3857' } },
})
```

- Tile services are Web Mercator, so `tileBasemap` only shows in a Web Mercator map. When every basemap is Web Mercator, the map starts in it; otherwise set `initialState.view.projection`, as above.
- Check your provider's terms. For example, the public OpenStreetMap tile servers don't allow heavy production use.
- `exportable` defaults to `false`: tiles are left out of exports unless the provider allows them and sends CORS headers.
- `fallbackBasemapId: 'world'` shows the outlines when the tiles can't be loaded (keep `worldBasemap` in the list, as above).
- For no geography at all, use `basemaps: [plainBasemap]`.
- A basemap you write yourself needs `id`, `title`, `supportedProjections` and `layers`. `backgroundColor` defaults to `var(--geo-stage)`, `attribution` to its layers' own attributions, and `exportable` to `true`. `fallbackBasemapId` names a basemap to show when it can't be loaded.

Any layer or basemap colour can be a CSS variable, for example `fillColor: 'var(--brand-blue)'`. The map resolves it for the canvas and exports, and re-reads it when the page switches theme.

### Tooltips and popups

`<GeospatialMap>` shows a tooltip over selectable features: the first of the `name`, `title` or `label` properties. Change the fields with `ui: { tooltip: { fields: ['region'] } }`, or turn it off with `enabled: false`. For your own content, pass `slots={{ tooltip: (feature) => … }}` to the preset, or a render function to `<MapTooltip>` in your own layout.

The popup opens in a corner by default. `ui: { popup: { anchor: 'feature' } }` (or `<MapPopup anchor="feature">`) opens it next to the clicked feature and keeps it there while the map moves. On narrow maps both become a bottom sheet.

The popup shows the feature in `state.selection`, however it got there: a click, your controlled `state`, or `actions.select({ layerId, featureId })` from `useMapActions()` or the ref. When features overlap, a click selects the top-most one. Clearing the selection (`actions.select(null)`) closes it.

### Time frames

A layer with `time` has one frame per value, and the time controls play through them:

```ts
import type { MapLayerInput } from '@/components/geospatial-map'

const rainfall: MapLayerInput = {
  id: 'rainfall',
  data: { url: '/data/rainfall.geojson' },
  time: { values: ['2021', '2022', '2023'] }, // features are filtered by their `time` property
}
```

How a layer follows the frame depends on the layer:

- A URL with `{time}` in it (`data.url` for GeoJSON and heatmaps, the URL template for tiles) is requested again for each frame.
- A WMS layer gets the frame as a request parameter named by `field` (default `TIME`).
- Otherwise (GeoJSON, heatmap, vector tiles) the features are filtered by the property named by `field` (default `time`).

`time` works on GeoJSON, heatmap, vector tile (`mvt`), XYZ and WMS layers. An XYZ layer with `time` needs `{time}` in its URL.

- The map starts at the first frame. Set `initialState.time` to start at another, or `initialState: { time: null }` to start with no frame (time layers are then hidden).
- While the map shows a frame a layer doesn't have, the layer is hidden and its status chip says "No data for time".
- GeoJSON and XYZ layers with `{time}` in their URL load the next frame ahead while one is shown.
- A `required` layer must load before playback moves on; if it fails, playback pauses.

### Disclaimer

```ts
ui: {
  disclaimer: {
    text: 'Boundaries and names on this map do not imply official endorsement or acceptance.',
    placement: 'bottom-right', // default 'bottom-left'
  },
}
```

A small **Disclaimer** button sits in the corner. Clicking it expands the text across the bottom of the map; clicking again or pressing Escape collapses it. `title` changes the label, and `defaultOpen` starts it open. Exports print the text under the map; set `export: { disclaimer: '' }` to leave it out.

In your own layout, use `<MapDisclaimer>` with the text as children or from the config:

```tsx
<MapDisclaimer placement="bottom-right">
  Boundaries are not official. <a href="/terms">Terms of use</a>
</MapDisclaimer>
```

### Large point layers and clustering

```ts
{ id: 'stations', kind: 'geojson', data: { url: '/stations.geojson' }, featureIdField: 'id',
  cluster: { distance: 40 },   // group nearby points into counted bubbles
  /* … */ }
```

- **Clustering** groups points within `distance` pixels into a bubble with the count. Clicking a bubble zooms in to its points; a single point behaves like any feature. The bubbles use `--geo-cluster-fill` and `--geo-cluster-text`, which default to the primary colours.
- **WebGL rendering.** With `renderer: 'auto'` (the default), point layers with 5,000 or more features are drawn with WebGL when the browser has GPU acceleration. Without it (software WebGL, as on many virtual desktops and servers) WebGL is slower than the canvas, so `auto` keeps the canvas there.
  - `renderer: 'webgl'` always uses WebGL; `'canvas'` never does.
  - WebGL draws point symbols without labels. Clustered layers and time filtering by a feature property use the canvas. Validation explains why if you ask for `'webgl'` on a layer it can't draw.
  - Both renderers pick each feature's symbol with the same rules, so a layer looks the same whichever one draws it.

### OpenLayers access and your own overlays

When the configuration doesn't cover something (drawing, measuring, a graticule, your own layer types), use the OpenLayers map directly:

```tsx
import Graticule from 'ol/layer/Graticule.js'

;<GeospatialMap
  config={config}
  onOpenLayersMap={(map) => {
    const layer = new Graticule({ zIndex: 100 })
    map.addLayer(layer)
    return () => map.removeLayer(layer) // runs before the map is destroyed or recreated
  }}
/>
```

- Layers you add stay when the configured layers change. Configured layers draw in list order; give yours a `zIndex` of 100 or more to draw above them.
- Inside a part, `useMapActions().getOpenLayersMap()` returns the same map. The component `ref` has the same actions as `useMapActions()`, `getOpenLayersMap()` included.
- For HTML on the map (markers, labels, callouts), you don't need OpenLayers: `useMapPixel([lon, lat])` returns the pixel position inside the map stage and keeps it updated while the map moves. `useHoveredFeature()` returns the feature under the pointer.

### If something looks wrong

The map logs a one-time `[geospatial-map]` console hint for the common setup mistakes:

- **The map is unstyled:** `geospatial-map.css` isn't imported (step 3).
- **Clicking a feature does nothing:** every layer has `selectable: false`.
- **The map is 0px tall:** `fill` is set, but the parent element has no height.
- **The map shows plain country outlines instead of the Esri basemap,** and the console says `The basemap "Esri World Basemap" (esri-world) could not be loaded, so the map shows its fallback "World" (world) instead. Reason: …`. The browser couldn't load the basemap from `basemaps.arcgis.com`; the reason at the end says what failed. Check the network (offline, a firewall or a proxy) and the page's Content-Security-Policy (`connect-src` and `img-src` must allow `https://basemaps.arcgis.com`). Any basemap with a `fallbackBasemapId` logs the same hint when it falls back.
- **Is it ready?** The map element has `data-status`: `loading` until the first frame is drawn and while layers load, then `ready`; `error` for an invalid configuration. `data-layer-errors` counts layers that failed to load. Custom parts read the same value as `useMap().mapStatus`; end-to-end tests can `await waitForMapReady(page)` (import it from `testing.ts`).
- **A layer is empty or the wrong colour.** When a layer's data loads, the map checks it against the layer config and names the problem: no features; coordinates that aren't longitude/latitude; a style `field` the features don't have (with the properties they do have); text values in a numeric style; values that match no category; a `featureIdField` that is missing or not unique.
- **A data URL fails.** The error names the URL and the HTTP status, and says when a URL returned a web page (a login page, usually) instead of data.
- **Which error was it?** Every error the alert shows (a layer that failed to load, export, location, an `onOpenLayersMap` that threw) is also passed to `onError` with a `code`, such as `SOURCE_LOAD_FAILED`, `LOCATION_UNAVAILABLE`, `HOOK_FAILED` or `EXPORT_CORS_BLOCKED` (all codes are in `MapErrorCode` in `types.ts`). The alert element has the code as `data-code`.

## Build your own layout

`<GeospatialMap>` is `<MapRoot>` plus every part, arranged from `config.ui`, and it suits most maps. For a custom layout, where you decide what appears and where, compose the parts directly:

```tsx
import {
  MapAttribution,
  MapControlGroup,
  MapControls,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapRoot,
  MapZoomInButton,
  MapZoomOutButton,
} from '@/components/geospatial-map'

export function RegionsMap() {
  return (
    <MapRoot config={config} className="regions-map">
      <MapControls placement="top-left">
        <MapControlGroup>
          <MapZoomInButton />
          <MapZoomOutButton />
        </MapControlGroup>
        <MapControlGroup>
          <MapLayersButton />
        </MapControlGroup>
      </MapControls>
      <MapLayerPanel placement="top-left" allowReorder={false} />
      <MapLegend placement="bottom-right" className="regions-legend" />
      <MapPopup>{({ feature }) => <RegionStats id={feature.featureId} />}</MapPopup>
      <MapAttribution compact />
    </MapRoot>
  )
}
```

Every part follows the same rules:

- It accepts `className`, `style`, and the HTML attributes of its root element.
- `placement` (`top-left`, `top-right`, `bottom-left`, `bottom-right`) and behaviour props (`allowOpacity`, `layout`, `compact`…) default to the matching `config.ui` value, so passing a prop only overrides that one setting.
- A part renders when you include it, and forwards a `ref` to its root element.
- `MapLayerPanel` and `MapSettings` show while their panel is the open one: one at a time, opened from their rail buttons, `actions.setOpenPanel`, or `ui.layerPanel.defaultOpen` / `ui.settings.defaultOpen` at the start. To control it yourself, pass `openPanel` (`'layers'`, `'settings'` or `null`) and `onOpenPanelChange` to `<MapRoot>` or `<GeospatialMap>`. The rail buttons and the panels always agree.

| Part                                                                                                                                                          | What it renders                                                                                                          | Notable props                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MapRoot`                                                                                                                                                     | Map frame, OpenLayers viewport, state, and context. Its `ref` has every map action (the same as `useMapActions()`).      | `config`, `state`, `onStateChange`, `openPanel`, `onOpenPanelChange`, all `on*` callbacks, `renderConfigError`                                   |
| `MapControls`                                                                                                                                                 | Control rail. Without children, it renders `config.ui.controls.groups`.                                                  | `placement`, `groups`, `customControls` (renderers for `custom:*` ids)                                                                           |
| `MapControlGroup`                                                                                                                                             | Joins buttons visually.                                                                                                  | —                                                                                                                                                |
| `MapZoomInButton`, `MapZoomOutButton`, `MapResetZoomButton`, `MapLocateButton`, `MapLayersButton`, `MapSettingsButton`, `MapFitButton`, `MapFullscreenButton` | Built-in rail buttons.                                                                                                   | `label`, `children` (icon); an `onClick` that calls `event.preventDefault()` skips the built-in action                                           |
| `MapControlButton`                                                                                                                                            | A rail-styled icon button for your own controls.                                                                         | `label`, `active`                                                                                                                                |
| `MapLayerPanel`                                                                                                                                               | Layer visibility, opacity, order, and status.                                                                            | `allowVisibility`, `allowOpacity`, `allowReorder`, `groupBy` (`'group'` or `'none'`), `header`, `footer`                                         |
| `MapSettings`                                                                                                                                                 | Basemap, area, and export fields. Also exported separately as `MapBasemapField`, `MapZoomTargetField`, `MapExportField`. | `fields`, `header`, `footer`                                                                                                                     |
| `MapLegend`                                                                                                                                                   | Legends for visible layers. `MapLegendSymbol` draws one swatch.                                                          | `layout`, `expanded`, `header`, `footer`                                                                                                         |
| `MapPopup`                                                                                                                                                    | Dialog for the selected feature.                                                                                         | `anchor` (`corner` or `feature`), `children`: a node, or `({ feature, close, state, actions }) => node`                                          |
| `MapTooltip`                                                                                                                                                  | Label that follows the pointer over selectable features.                                                                 | `fields`, `children`: `(feature) => node`                                                                                                        |
| `MapTimeControls`                                                                                                                                             | Time slider and playback (renders only for time-aware layers).                                                           | `speedsMs`, `defaultSpeedMs`, `loop`, `autoplay`                                                                                                 |
| `MapBreadcrumbs`                                                                                                                                              | A path of zoom targets that zooms on click.                                                                              | `targets` (ids of `data.zoomTargets`, widest first), `onTargetClick`                                                                             |
| `MapStatusChips`, `MapErrorAlert`                                                                                                                             | Loading and no-data chips; recoverable error alert.                                                                      | `loading`, `empty`; `dismissible`, `children` (a node, or `(error) => node`)                                                                     |
| `MapAttribution`                                                                                                                                              | Source attribution (keep it visible when sources require it).                                                            | `compact`                                                                                                                                        |
| `MapDisclaimer`                                                                                                                                               | A corner button that expands to show a disclaimer.                                                                       | `placement`, `title`, `defaultOpen`, `open`, `onOpenChange`, `children`                                                                          |
| `MapGrid`                                                                                                                                                     | Up to six synchronized `GeospatialMap`s.                                                                                 | `config` (`shared` takes the short config form), `onStateChange`, `cellClassName`; each `on*` callback also gets the map id as its last argument |

### Custom parts

Any component rendered inside `<MapRoot>` can use the map:

```tsx
import { useMapActions, useMapRuntime, useMapStatic } from '@/components/geospatial-map'

function SelectedArea() {
  const selected = useMapRuntime((map) => map.selectedFeature) // re-renders when it changes
  const { messages } = useMapStatic() // config, ui, messages, actions, icons
  return <p className="selected-area">{selected?.featureId ?? messages.selectionCleared}</p>
}

function HomeButton() {
  const { fit } = useMapActions() // stable; does not re-render when the map moves
  return <button onClick={() => fit([-180, -90, 180, 90])}>World</button>
}
```

- `useMapRuntime(select)` returns one piece of the live data (`state`, `layers`, `legends`, `statuses`, `selectedFeature`, `openPanel`, `mapStatus`…) and re-renders the part only when that piece changes. Select a field and derive from it while rendering.
- `useMap()` returns everything (`MapContextValue`, icons included) and re-renders the part whenever the map changes.
- A part that only needs the config, the resolved `ui`, messages, actions or icons can use `useMapStatic()`, which doesn't re-render while the map moves; `useMapIcons()` returns just the icons.

Give custom parts `position: absolute` and use the `--geo-inset` token so they line up with the built-in ones. Parts talk to the map through `useMap()` and the actions. `useMapPixel` and `useHoveredFeature` help with overlays, and `getOpenLayersMap()` is there when you need OpenLayers itself ([OpenLayers access](#openlayers-access-and-your-own-overlays)).

## Styling

### Tokens

All colours and sizes are CSS variables. Override them on `:root` for the whole app, or on any wrapper or the map's `className` for one map:

```css
.regions-map {
  --geo-primary: #7c3aed;
  --geo-radius: 6px;
  --geo-height: 520px;
}
```

**Colours**

| Token                                                    | Default (light)          | Used for                                   |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------ |
| `--geo-background` / `--geo-foreground`                  | `#ffffff` / `#18181b`    | Control surface and text                   |
| `--geo-overlay`                                          | `rgba(255,255,255,0.94)` | Floating panels, rail, legend              |
| `--geo-muted` / `--geo-muted-foreground`                 | `#f4f4f5` / `#71717a`    | Secondary surfaces and text                |
| `--geo-primary` / `-foreground` / `-hover`               | `#0f766e` / white / dark | Switches, sliders, links, hover borders    |
| `--geo-accent` / `--geo-accent-foreground`               | tint of primary          | Button hover surface                       |
| `--geo-destructive`                                      | `#a61b1b`                | Errors                                     |
| `--geo-border` / `--geo-input` / `--geo-ring`            | translucent              | Borders, control borders, focus ring       |
| `--geo-stage`                                            | `#cfe4f2`                | Backdrop before the basemap paints         |
| `--geo-tooltip-background` / `-foreground`               | foreground / background  | Hover tooltip                              |
| `--geo-control-hover` / `-active` / `-active-foreground` | muted / muted / text     | Rail button hover and pressed (open panel) |

**Type**

| Token                                             | Default                         | Used for                                       |
| ------------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| `--geo-font-family` / `--geo-heading-font-family` | your app's font                 | All map text, canvas labels, exports / titles  |
| `--geo-font-size`, `-title`, `-sm`, `-xs`, `-2xs` | `14`, `15`, `12`, `11`, `10px`  | Body, panel titles, secondary, labels, kickers |
| `--geo-font-weight`, `-medium`, `-bold`           | `400`, `600`, `700`             | Body, labels and switches, titles              |
| `--geo-line-height`, `--geo-heading-tracking`     | `1.4`, `-0.01em`                |                                                |
| `--geo-label-transform`, `-tracking`, `-caps`     | `uppercase`, `0.08em`, `normal` | Kickers, group titles, layer meta              |

**Shape, surfaces and motion**

| Token                                                                 | Default                               | Used for                                                                             |
| --------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `--geo-radius`                                                        | `12px`                                | Base radius; the others derive from it when unset                                    |
| `--geo-radius-panel`, `-control`, `-rail`, `-chip`, `-pill`, `-stage` | radius, −2px, −1px, ÷2, `999px`, +4px | Cards; buttons and fields; rail; tooltip and chips; badges and tracks; the map frame |
| `--geo-border-width`                                                  | `1px`                                 | Every border and divider                                                             |
| `--geo-shadow`, `--geo-shadow-sm`, `--geo-shadow-control`             | soft shadows                          | Panels, rail, buttons                                                                |
| `--geo-backdrop`                                                      | `blur(16px) saturate(1.2)`            | Glass panels (`none` for flat themes)                                                |
| `--geo-focus-width`, `--geo-focus-offset`                             | `3px`, `2px`                          | Every focus ring (negative offset draws it inside)                                   |
| `--geo-duration`, `--geo-easing`                                      | `150ms`, `ease`                       | Hover and toggle transitions                                                         |

**Sizes and controls**

| Token                                                           | Default                                       | Used for                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--geo-height`                                                  | `680px`                                       | Map height. Narrow maps (<680px wide) use `--geo-height-narrow`, `--geo-inset-narrow`, `--geo-control-size-narrow`. |
| `--geo-control-size`, `--geo-input-height`, `--geo-inset`       | `42px`, `40px`, `14px`                        | Rail buttons, buttons and selects, distance from the edge                                                           |
| `--geo-icon-size`, `--geo-icon-stroke`                          | `18px`, `2`                                   | Icons (the stroke applies to outline icons only)                                                                    |
| `--geo-panel-padding`, `--geo-legend-width`                     | `14px`, `280px`                               | Panels and popup, legend                                                                                            |
| `--geo-switch-width`, `-height`, `-thumb`, `-thumb-checked`     | `36`, `20`, `14px`, thumb                     | Switch geometry (the thumb travels end to end)                                                                      |
| `--geo-switch-on`, `-off`, `-thumb-color`, `-thumb-on-color`    | primary, grey, background, primary-foreground | Switch colours                                                                                                      |
| `--geo-slider-track`, `-thumb`, `-thumb-width`, `-thumb-radius` | `4px`, `16px`, thumb, round                   | Slider geometry (a bar thumb: width `4px`, radius `2px`)                                                            |
| `--geo-slider-on`, `-off`, `-thumb-color`, `-thumb-shadow`      | primary, grey, primary, ring                  | Slider colours                                                                                                      |

**Drawn on the canvas and in exports**

| Token                                                | Default                         | Used for                                   |
| ---------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| `--geo-selection-fill` / `-stroke` / `-line`         | amber / near-black              | Selected feature on the map and in exports |
| `--geo-label-color`, `-halo`, `-size`, `-weight`     | `#172033`, white, `12px`, `500` | Map labels and cluster counts              |
| `--geo-export-background` / `-foreground` / `-muted` | white / dark                    | Exported report images                     |
| `--geo-basemap-water` / `-land` / `-border`          | blue / off-white / grey         | `worldBasemap` (dark values under `.dark`) |
| `--geo-cluster-fill` / `--geo-cluster-text`          | primary colours                 | Cluster bubbles                            |

The canvas and export tokens are read with `getComputedStyle`, so they follow your CSS too, including a theme class added to a wrapper or to the map later.

### Dark mode

Add `.dark` (or `data-theme="dark"`) to `<html>`, a wrapper, or the map, and the tokens switch. Use `.light` / `data-theme="light"` to switch back inside a dark area. If you override tokens for a brand, override the dark values as well:

```css
.dark .regions-map {
  --geo-primary: #a78bfa;
}
```

The basemap and layer colours come from your config (data), not from the theme.

### Classes and states

- **Stable class names.** Every element has a stable `geo-*` class: `geo-map-root`, `geo-map-stage`, `geo-map-controls`, `geo-layer-panel`, `geo-layer-item`, `geo-legend`, `geo-legend-entry`, `geo-popup`, `geo-time-controls`, `geo-attribution`, and so on.
- **Part markers.** Each part also carries `data-slot="map-legend"` (shadcn convention).
- **State attributes:** `data-placement`, `data-state` (time playback), `data-visible` (layers), `data-active` (control buttons), `data-density`.
- **Specificity.** Every rule in `geospatial-map.css` has the specificity of a **single class**. Qualifiers sit in `:where()`. As a result:
  - one class of yours, loaded after the stylesheet, always wins;
  - your global element resets (`button { font: inherit }`, `* { margin: 0 }`) can't break the map.

```css
.regions-legend {
  width: 320px;
  border-left: 4px solid var(--geo-primary);
}
.geo-layer-item[data-visible='false'] {
  opacity: 0.6;
}
```

### Theme from JSON (for CMS-driven configs)

`config.theme` sets a few tokens per map from data. This is useful when the theme comes from a CMS.

- Each key is the token's name in camelCase: `primary` → `--geo-primary`, `mutedForeground` → `--geo-muted-foreground`. The keys are `fontFamily`, `foreground`, `background`, `muted`, `mutedForeground`, `border`, `overlay`, `primary`, `primaryForeground`, `primaryHover`, `destructive`, `ring`, `stage`, `radius`, `shadow` and `controlSize` (exported as `mapThemeTokenNames`).
- `density: 'compact'` sets `data-density="compact"`.
- Only the keys you set are written, as inline styles on the map root.

### Using shadcn/ui tokens

If your app has shadcn/ui variables, paste this to make the map match (dark mode follows automatically):

```css
:root {
  --geo-background: var(--card);
  --geo-foreground: var(--card-foreground);
  --geo-muted: var(--muted);
  --geo-muted-foreground: var(--muted-foreground);
  --geo-primary: var(--primary);
  --geo-primary-foreground: var(--primary-foreground);
  --geo-primary-hover: var(--primary);
  --geo-accent: var(--accent);
  --geo-accent-foreground: var(--accent-foreground);
  --geo-destructive: var(--destructive);
  --geo-border: var(--border);
  --geo-input: var(--input);
  --geo-ring: var(--ring);
  --geo-overlay: var(--popover);
  --geo-radius: var(--radius);
}
```

### Using Tailwind

Import the stylesheet into the components layer, so utility classes passed through `className` override it:

```css
@import './components/geospatial-map/geospatial-map.css' layer(components);
```

If you want conflicting utilities merged, swap the tiny `cn()` in `utils.ts` for `clsx` + `tailwind-merge`.

### Matching a design system

A complete theme is one stylesheet scoped to a class, plus optionally an icon set. The rule of thumb: **tokens for anything that repeats, a class rule for one part**. A rule written as `.your-theme .geo-legend { … }` always beats the component's own rules (they all have single-class specificity), and needs no `!important`.

```css
.brand-carbon {
  --geo-font-family: 'IBM Plex Sans', sans-serif;
  --geo-radius: 0px;
  --geo-backdrop: none;
  --geo-shadow-sm: none;
  --geo-focus-width: 2px;
  --geo-focus-offset: -2px; /* inset focus ring */
  --geo-control-size: 48px;
  --geo-switch-width: 48px;
  --geo-switch-height: 24px;
  --geo-switch-thumb: 18px;
  --geo-switch-on: #24a148;
}

/* One-off adjustments target a part's class. */
.brand-carbon .geo-shape-select {
  border-width: 0 0 1px; /* bottom-rule field */
}
```

```tsx
import { Add, Subtract, Layers } from '@carbon/icons-react'

;<GeospatialMap
  className="brand-carbon"
  config={config}
  icons={{ ZoomIn: Add, ZoomOut: Subtract, Layers }}
/>
```

The source repository's demo has three complete examples, a Material 3-style, an IBM Carbon-style and an editorial print theme, in `apps/demo-shared/styles/themes/` (open `/?scenario=themes`). Each is about 200 to 250 lines of CSS, most of it token values, and changes type, colour, shape, surfaces, the rail, switches, sliders, fields, chips, icons and the data palette, with nothing edited in this folder. Things to know:

- **State rules.** A theme rule like `.theme .geo-shape-button { background: … }` also overrides the pressed state of rail buttons (`.geo-control-active`). Exclude it with `.theme .geo-shape-button:where(:not(.geo-control-active))`, or use the `--geo-control-*` tokens.
- **Data colours.** Layer and basemap colours can be `var(--your-token)`, so the choropleth palette can live in the theme too.
- **Dark mode.** Declare the dark values under `.your-theme.dark` (or `[data-theme='dark']`).

### Your design system's components

Every button, select, slider, switch, card, badge, alert, and label comes from **`shapes.tsx`**. Keep the exported names and props and replace the bodies to use your own components. For example, with shadcn/ui:

```tsx
// shapes.tsx
import { Button } from '@/components/ui/button'

export const ShapeButton = forwardRef<HTMLButtonElement, ShapeButtonProps>(function ShapeButton(
  { className, ...props },
  ref,
) {
  return (
    <Button ref={ref} variant="outline" className={cn('geo-shape-button', className)} {...props} />
  )
})
```

### Icons

Icons come from **`icons.ts`** (`defaultMapIcons`, lucide-react by default), by role: `ZoomIn`, `ZoomOut`, `ResetZoom`, `Locate`, `Spinner`, `Layers`, `Fit`, `Settings`, `Fullscreen`, `Close`, `Collapse`, `Expand`, `MoveUp`, `MoveDown`, `Previous`, `Next`, `Play`, `Pause`, `Replay`.

- **For every map in your app,** replace the components in `icons.ts`.
- **For one map or theme,** pass `icons={{ ZoomIn: MyPlus, Layers: MyLayers }}` to `<GeospatialMap>`, `<MapRoot>` or `<MapGrid>`; the rest keep the defaults. Custom parts get the same set from `useMapIcons()`.
- Any component that renders an SVG and accepts `className` and `aria-hidden` works: lucide, `@carbon/icons-react`, `react-icons`, your own. Size comes from `--geo-icon-size`; `--geo-icon-stroke` applies to outline icons (`fill="none"`), and filled icon sets keep their shapes.
- On lucide-react older than 0.360, change `LoaderCircle` to `Loader2`.

## Framework notes

- **Next.js App Router.**
  - Every module that uses React state starts with `'use client'`, so the parts work as client components.
  - Render the map from your own client component when you pass callbacks or slots, because functions can't cross the server/client boundary.
  - `defineMapConfig`, `validateMapConfig`, and the types are server-safe, so a server component can build or validate the config and pass it down.
  - To keep the map out of the initial bundle, wrap it in `next/dynamic` with `ssr: false`.
- **Server rendering.** The map renders an accessible shell on the server. OpenLayers starts after mount.
- **Size.** The map fills its container's width and is `--geo-height` tall. It resizes itself, including when revealed from a hidden container.

## What's in this folder

| File                                                                       | What it is                                                                    | Edit it?                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| `geospatial-map.css`                                                       | Tokens and all styles                                                         | Override from your CSS; edit only if you must |
| `geospatial-map.tsx`, `map-grid.tsx`                                       | Ready-made layouts                                                            | Yes                                           |
| `map-*.tsx`, `map-anchor.ts`                                               | The parts, `MapRoot` included                                                 | Yes                                           |
| `basemaps.ts`, `world-data.ts`                                             | Ready-made basemaps, world data                                               | `basemaps.ts` yes; the data is generated      |
| `shapes.tsx`, `icons.ts`, `utils.ts`                                       | UI primitives, icons, `cn()`                                                  | Yes (swap points)                             |
| `messages.ts`, `theme.ts`                                                  | English copy, the token names `config.theme` accepts                          | Yes                                           |
| `types.ts`, `component-types.ts`                                           | Every public type, with what each field does                                  | Rarely                                        |
| `config/`                                                                  | Config schema, defaults, validation, UI profiles, messages for renamed fields | No (engine)                                   |
| `core/`                                                                    | OpenLayers engine (no React)                                                  | No (engine)                                   |
| `use-*.ts`, `map-bridges.ts`, `map-state.ts`, `map-context.ts`, `hooks.ts` | Map lifecycle, state, and context                                             | No (engine)                                   |
| `testing.ts`                                                               | `waitForMapReady` for end-to-end tests                                        | No                                            |
| `docs/`, `examples/`                                                       | Guides; type-checked examples for each task                                   | Read; copy examples into your app             |
| `AGENTS.md`, `CLAUDE.md`                                                   | Instructions for coding agents                                                | Add your team's rules if you like             |
| `version.ts`, `CHANGELOG.md`                                               | Which release this copy is                                                    | Don't edit                                    |

Each engine file says so in its header. Change the map's behaviour through the config, the CSS, the parts, or `onOpenLayersMap` instead; engine edits are the most likely to conflict when you update.

The JSON Schema for the config is exported as `mapConfigSchema` (the complete config) and `mapInputSchema` (the short form); the source repository's `pnpm schema` command writes them to `map-config.schema.json` and `map-config-input.schema.json`. Detailed guides for configuration, layers, symbology, time, export and the grid are in [`docs/`](./docs/), and type-checked examples for common tasks in [`examples/`](./examples/).

## Updating

Because you own the copy, updates are a merge rather than an `npm update`. From a clone of the source repository, run:

```sh
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map            # report what would change
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map --apply    # write it
```

- The script reads your version from `version.ts` and compares three versions of every file: the one you copied, the new one, and yours.
  - Files you haven't touched are replaced.
  - Your edits are kept.
  - Files changed on both sides are merged, with any conflicts marked in the file.
- Copies older than 0.3.0 have no `version.ts`; pass `--from <commit>` with the commit you copied.
- Then read `CHANGELOG.md`. Each entry lists behaviour changes and the files it touched.
- Updates go smoothest when your edits live in the parts, `shapes.tsx`, `icons.ts`, and the CSS rather than in the engine files.
