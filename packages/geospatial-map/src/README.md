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

| Left out        | Default                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`       | `1`                                                                                                                                                                                                                                        |
| `data.basemaps` | `worldBasemap`: country outlines on water, bundled with the folder (no network, no API key). See [Basemaps](#basemaps).                                                                                                                    |
| `initialState`  | The whole world, fitted to the size of the map, in Equal Earth (or your ArcGIS basemap's projection), with each layer's own `visible` and `opacity`. Pass `initialState: { view: { center: [25, 42], zoom: 5 } }` to start somewhere else. |
| `view`, `ui`    | Default interactions and the `full` UI profile                                                                                                                                                                                             |
| Layer `kind`    | `'geojson'`. A layer without a `kind` also gets `role: 'indicator'`, its `id` as `title`, and a default style: `--geo-primary` fill with a `--geo-background` outline (lines and points get the same colour).                              |
| `selectable`    | `true` on GeoJSON layers (and on tile layers with a `featureIdField`). Set `selectable: false` to opt out.                                                                                                                                 |

Writing the config inside your component is fine: the map compares configs by content, so re-rendering your component doesn't reset the view. It resets only when `initialState` changes.

The one exception is large inline data (`data: { type: 'FeatureCollection', features }` or `data: { rows }`). Define it outside the component, or memoize it, so the map isn't handed a new dataset on every render.

### Recommended path

The component offers two ways to do some things. For a new integration, use the first one in each pair:

| Task                  | Use                                                                                   | Also available, for…                                                                        |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Colours, sizes, fonts | CSS: `--geo-*` tokens and classes ([Styling](#styling))                               | `config.theme`, when the theme comes from a CMS as JSON                                     |
| Layout and custom UI  | `<MapRoot>` with the parts you want ([Build your own layout](#build-your-own-layout)) | `<GeospatialMap>` and `config.ui`, for a ready-made layout; `slots`, for older integrations |
| Popup content         | `<MapPopup>{({ selection }) => …}</MapPopup>`                                         | `slots.popup` on the preset                                                                 |

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
| `{ type: 'FeatureCollection', features }`                     | Inline GeoJSON                                                                                                                                   |
| `{ builtin: 'world' }`                                        | The bundled Natural Earth country outlines                                                                                                       |
| `{ url: '/api/indicator', format: 'csv' }`                    | Any of the above when the URL doesn't say (`format`: `'geojson'`, `'csv'`, `'json'` or `'arcgis'`)                                               |

CSV and JSON values that look like numbers become numbers, except codes with leading zeros (`'007'`). Polygons and lines that cross the edge of the map (Russia, Fiji, Antarctica) are cut there, so they don't smear across the map.

To colour admin areas from a table, put the values on boundary GeoJSON (yours, or `{ builtin: 'world' }` for countries) and style it by that field; see [`docs/layers-and-legends.md`](https://github.com/Lyxesxyz/react-map-component/blob/main/packages/geospatial-map/docs/layers-and-legends.md).

#### Data that needs authentication

URLs are loaded with `fetch(url)`. To add headers or credentials, pass `loadGeoJson`. Wrap `fetchGeoJson`, the built-in loader, so CSV, ArcGIS and the rest keep working:

```tsx
import { GeospatialMap, fetchGeoJson } from '@/components/geospatial-map'

;<GeospatialMap
  config={config}
  loadGeoJson={(url, options) => fetchGeoJson(`${url}?token=${token}`, options)}
/>
```

A loader that returns `fetch(url, { headers }).then((r) => r.json())` works too, for GeoJSON only.

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
- An invalid config renders an accessible error panel instead of a broken map.
- `config.ui` chooses a profile (`full`, `compact`, `embedded`, `grid`), switches panels on or off, and places each one in a corner.
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

- **Projection.** The map uses the service's projection: Equal Earth (any central meridian), Web Mercator, or anything else ArcGIS describes in WKT. You don't configure it.
- **Style.** The service's default style is used, with its fonts and sprites. Pass `styleUrl` to use another style from the same service.
- **Labels and borders above your data.** `arcgisBasemap` splits the style in two: fills under your layers, and labels and boundary lines above them, so country names and borders stay readable over a choropleth. Pass `labelsAboveData: false` to draw the whole basemap underneath.
- **Attribution** comes from the service's copyright text. Pass `attribution` to replace it.

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

The projection is a developer setting: set `initialState.view.projection` (`'EPSG:8857'` Equal Earth or `'EPSG:3857'` Web Mercator), or let an ArcGIS basemap decide. Users can't change it; the settings panel offers only basemaps that fit the current projection, and hides the basemap field when there is just one.

Any other projection comes from the basemap that is drawn in it: an ArcGIS basemap brings its own, and a vector tile layer defines one with `sourceProjectionDefinition: { code, definition }` (a proj4 string or WKT). If an ArcGIS service's projection is read wrongly, pass `projection: { code, definition }` to `arcgisBasemap`.

### Basemaps

The default `worldBasemap` draws Natural Earth country outlines on water, coloured by `--geo-basemap-water`, `--geo-basemap-land` and `--geo-basemap-border`. The data (about 68 KB) ships in `world-data.ts` and loads the first time a map uses it.

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
      worldBasemap, // offered in the settings panel in Equal Earth
    ],
    layers: [/* … */],
  },
})
```

- Tile services are Web Mercator, so `tileBasemap` only shows in that projection. When every basemap is Web Mercator, the map starts in it.
- Check your provider's terms. For example, the public OpenStreetMap tile servers don't allow heavy production use.
- `exportable` defaults to `false`: tiles are left out of exports unless the provider allows them and sends CORS headers.
- For no geography at all, use `basemaps: [plainBasemap]`.

Any layer or basemap colour can be a CSS variable, for example `fillColor: 'var(--brand-blue)'`. The map resolves it for the canvas and exports, and re-reads it when the page switches theme.

### Tooltips and popups

`<GeospatialMap>` shows a tooltip over selectable features: the first of the `name`, `title` or `label` properties. Change the fields with `ui: { tooltip: { fields: ['region'] } }`, or turn it off with `enabled: false`. For your own content, pass `slots={{ tooltip: (feature) => … }}` to the preset, or a render function to `<MapTooltip>` in your own layout.

The popup opens in a corner by default. `ui: { popup: { anchor: 'feature' } }` (or `<MapPopup anchor="feature">`) opens it next to the clicked feature and keeps it there while the map moves. On narrow maps both become a bottom sheet.

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

- Layers you add stay when the configured layers change. Give them a `zIndex` of 100 or more to draw above them.
- Inside a part, `useMapActions().getOpenLayersMap()` returns the same map, and the ref has `getOpenLayersMap()` too.
- For HTML on the map (markers, labels, callouts), you don't need OpenLayers: `useMapPixel([lon, lat])` returns the pixel position inside the map stage and keeps it updated while the map moves. `useHoveredFeature()` returns the feature under the pointer.

### If something looks wrong

The map logs a one-time `[geospatial-map]` console hint for the common setup mistakes:

- **The map is unstyled:** `geospatial-map.css` isn't imported (step 3).
- **Clicking a feature does nothing:** every layer has `selectable: false`.
- **The map is 0px tall:** `fill` is set, but the parent element has no height.
- **A layer is empty or the wrong colour.** When a layer's data loads, the map checks it against the layer config and names the problem: no features; coordinates that aren't longitude/latitude; a style `field` the features don't have (with the properties they do have); text values in a numeric style; values that match no category; a `featureIdField` that is missing or not unique.
- **A data URL fails.** The error names the URL and the HTTP status, and says when a URL returned a web page (a login page, usually) instead of data.

## Build your own layout

`<GeospatialMap>` is `<MapRoot>` plus every part, arranged from `config.ui`. To decide yourself what appears and where, compose the parts directly:

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
      <MapPopup>{({ selection }) => <RegionStats id={selection.featureId} />}</MapPopup>
      <MapAttribution compact />
    </MapRoot>
  )
}
```

Every part follows the same rules:

- It accepts `className`, `style`, and the HTML attributes of its root element.
- `placement` (`top-left`, `top-right`, `bottom-left`, `bottom-right`) and behaviour props (`allowOpacity`, `layout`, `compact`…) default to the matching `config.ui` value, so passing a prop only overrides that one setting.
- A part renders when you include it. Panels open from their buttons.

| Part                                                                                                                                                          | What it renders                                                                                                          | Notable props                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `MapRoot`                                                                                                                                                     | Map frame, OpenLayers viewport, state, and context. Takes `ref` for `fit`, `fitSelection`, `exportImage`, `getState`.    | `config`, `state`, `onStateChange`, all `on*` callbacks                                                   |
| `MapControls`                                                                                                                                                 | Control rail. Without children, it renders `config.ui.controlRail.groups`.                                               | `placement`, `groups`                                                                                     |
| `MapControlGroup`                                                                                                                                             | Joins buttons visually.                                                                                                  | —                                                                                                         |
| `MapZoomInButton`, `MapZoomOutButton`, `MapResetZoomButton`, `MapLocateButton`, `MapLayersButton`, `MapSettingsButton`, `MapFitButton`, `MapFullscreenButton` | Built-in rail buttons.                                                                                                   | `label`, `children` (icon); an `onClick` that calls `event.preventDefault()` skips the built-in action    |
| `MapControlButton`                                                                                                                                            | A rail-styled icon button for your own controls.                                                                         | `label`, `active`                                                                                         |
| `MapLayerPanel`                                                                                                                                               | Layer visibility, opacity, order, and status.                                                                            | `allowVisibility`, `allowOpacity`, `allowReorder`, `groupBy`, `header`, `footer`, `open`                  |
| `MapSettings`                                                                                                                                                 | Basemap, area, and export fields. Also exported separately as `MapBasemapField`, `MapZoomTargetField`, `MapExportField`. | `fields`, `header`, `footer`, `open`                                                                      |
| `MapLegend`                                                                                                                                                   | Legends for visible layers. `MapLegendSymbol` draws one swatch.                                                          | `layout`, `defaultOpen`, `header`, `footer`                                                               |
| `MapPopup`                                                                                                                                                    | Dialog for the selected feature.                                                                                         | `anchor` (`corner` or `feature`), `children`: a node, or `({ selection, close, state, actions }) => node` |
| `MapTooltip`                                                                                                                                                  | Label that follows the pointer over selectable features.                                                                 | `fields`, `children`: `(feature) => node`                                                                 |
| `MapTimeControls`                                                                                                                                             | Time slider and playback (renders only for time-aware layers).                                                           | `speedsMs`, `loop`, `autoplay`                                                                            |
| `MapBreadcrumbs`                                                                                                                                              | Geographic hierarchy that zooms on click.                                                                                | `items`, `onItemClick`                                                                                    |
| `MapStatus`, `MapErrorAlert`                                                                                                                                  | Loading and no-data chips; recoverable error alert.                                                                      | `loading`, `empty`, `dismissible`                                                                         |
| `MapAttribution`                                                                                                                                              | Source attribution (keep it visible when sources require it).                                                            | `compact`                                                                                                 |
| `MapDisclaimer`                                                                                                                                               | A corner button that expands to show a disclaimer.                                                                       | `placement`, `title`, `defaultOpen`, `open`, `onOpenChange`, `children`                                   |
| `MapGrid`                                                                                                                                                     | Up to six synchronized `GeospatialMap`s.                                                                                 | `config`, `cellClassName`                                                                                 |

### Custom parts

Any component rendered inside `<MapRoot>` can use the map:

```tsx
import { useMap, useMapActions } from '@/components/geospatial-map'

function SelectedArea() {
  const { selectedFeature, messages } = useMap() // state, legends, statuses, ui, config…
  return <p className="selected-area">{selectedFeature?.featureId ?? messages.selectionCleared}</p>
}

function HomeButton() {
  const { fit } = useMapActions() // stable; does not re-render when the map moves
  return <button onClick={() => fit([-180, -90, 180, 90])}>World</button>
}
```

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

| Token                                                  | Default (light)          | Used for                                                                                                                      |
| ------------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `--geo-background` / `--geo-foreground`                | `#ffffff` / `#18181b`    | Panel surface and text                                                                                                        |
| `--geo-muted` / `--geo-muted-foreground`               | `#f4f4f5` / `#71717a`    | Secondary surfaces and text                                                                                                   |
| `--geo-primary` / `--geo-primary-foreground`           | `#0f766e` / `#ffffff`    | Switches, sliders, links, hover borders                                                                                       |
| `--geo-primary-hover`                                  | `#115e59`                | Links and pressed states                                                                                                      |
| `--geo-accent`                                         | tint of primary          | Button hover surface (optional)                                                                                               |
| `--geo-destructive`                                    | `#a61b1b`                | Errors                                                                                                                        |
| `--geo-border` / `--geo-input` / `--geo-ring`          | translucent              | Borders, control borders, focus ring                                                                                          |
| `--geo-overlay`                                        | `rgba(255,255,255,0.94)` | Floating panels (glass)                                                                                                       |
| `--geo-stage`                                          | `#cfe4f2`                | Backdrop before the basemap paints                                                                                            |
| `--geo-radius`, `--geo-shadow`, `--geo-shadow-sm`      | `12px`, soft shadows     | Shape                                                                                                                         |
| `--geo-control-size`, `--geo-inset`, `--geo-font-size` | `42px`, `14px`, `14px`   | Density and spacing                                                                                                           |
| `--geo-height`                                         | `680px`                  | Map height. Narrow maps (<680px wide) use `--geo-height-narrow` (`700px`), `--geo-inset-narrow`, `--geo-control-size-narrow`. |
| `--geo-font-family`                                    | your app's font          | All map text, canvas labels, exports                                                                                          |
| `--geo-selection-fill` / `-stroke` / `-line`           | amber / near-black       | Selected feature on the map and in exports                                                                                    |
| `--geo-label-color` / `--geo-label-halo`               | `#172033` / `#ffffff`    | Map labels                                                                                                                    |
| `--geo-export-background` / `-foreground` / `-muted`   | white / dark             | Exported report images                                                                                                        |
| `--geo-basemap-water` / `-land` / `-border`            | blue / off-white / grey  | `worldBasemap` (dark values under `.dark`)                                                                                    |
| `--geo-cluster-fill` / `--geo-cluster-text`            | primary colours          | Cluster bubbles (optional)                                                                                                    |

The canvas and export tokens are read with `getComputedStyle`, so they follow your CSS too.

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

- Keys map onto variables: `accentColor` → `--geo-primary`, `textColor` → `--geo-foreground`, `surfaceColor` → `--geo-background`, and so on (see `theme.ts`).
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

Every icon comes from **`icons.ts`**, under semantic names (`ZoomInIcon`, `LayersIcon`, `CloseIcon`…). Re-export any component that accepts SVG props to use a different icon set. On lucide-react older than 0.360, change `LoaderCircle` to `Loader2`.

## Framework notes

- **Next.js App Router.**
  - Every module that uses React state starts with `'use client'`, so the parts work as client components.
  - Render the map from your own client component when you pass callbacks or slots, because functions can't cross the server/client boundary.
  - `defineMapConfig`, `validateMapConfig`, and the types are server-safe, so a server component can build or validate the config and pass it down.
  - To keep the map out of the initial bundle, wrap it in `next/dynamic` with `ssr: false`.
- **Server rendering.** The map renders an accessible shell on the server. OpenLayers starts after mount.
- **Size.** The map fills its container's width and is `--geo-height` tall. It resizes itself, including when revealed from a hidden container.

## What's in this folder

| File                                         | What it is                       | Edit it?                                 |
| -------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `geospatial-map.css`                         | Tokens and all styles            | Yes, freely                              |
| `geospatial-map.tsx`, `map-grid.tsx`         | Ready-made layouts               | Yes                                      |
| `map-*.tsx`, `map-anchor.ts`                 | The parts                        | Yes                                      |
| `basemaps.ts`, `world-data.ts`               | Ready-made basemaps, world data  | `basemaps.ts` yes; the data is generated |
| `shapes.tsx`, `icons.ts`, `utils.ts`         | UI primitives, icons, `cn()`     | Yes (swap points)                        |
| `messages.ts`, `theme.ts`                    | English copy, JSON theme mapping | Yes                                      |
| `map-root.tsx`, `map-context.ts`, `use-*.ts` | Map lifecycle and context        | Rarely                                   |
| `config.ts`, `types.ts`, `map-state.ts`      | Config schema, validation, types | Rarely                                   |
| `version.ts`, `CHANGELOG.md`                 | Which release this copy is       | Don't edit                               |
| `core/`                                      | OpenLayers engine (no React)     | Only for engine changes                  |

The JSON Schema for the config is exported as `mapConfigSchema`; the source repository's `pnpm schema` command writes it to a file. Detailed guides for layers, symbology, time, export, embedding, and the grid live in the source repository's `packages/geospatial-map/docs/`.

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
- Updates go smoothest when your edits live in the parts, `shapes.tsx`, `icons.ts`, and the CSS rather than in `core/` and the engine files.
