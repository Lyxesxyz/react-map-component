# Export, grids, Vite, and Next.js

## Report exports

Users export from the settings panel's `export` field (on by default; `export: { enabled: false }` hides it). From code, use the actions (the `ref`, `useMapActions()`, or a slot's `actions`):

- `exportImage(options)` returns the report as a `Blob`. If it fails, it rejects with an `Error` whose `mapError` property is the `MapError`: `EXPORT_CORS_BLOCKED`, `EXPORT_TIMEOUT`, `EXPORT_FAILED`, or a layer's `SOURCE_LOAD_FAILED`.
- `downloadImage(format)` exports with the configured `config.export` options and downloads the file. A failure shows in the error alert and reaches `onError`.

PNG, JPEG, and SVG reports have the same layout: header, map, legend, disclaimer, and attribution. The legend is the one on screen, including hand-written `legend.entries`.

What an export does when you leave the options out:

- **Size.** The report is 1200 × 720 report pixels, the legend and text included. `width`, `height`, and `pixelRatio` (1 to 3) change it. The map is drawn at the export size and is back at its screen size afterwards, even after a failed export.
- **Options.** `exportImage` and `downloadImage` both use `config.export` for the report options you don't pass. The title defaults to `accessibility.ariaLabel`, and the disclaimer to the configured one.
- **Report text.** The header lines come from the messages `exportTime` ("Time: {time}", when a frame is shown), `exportSelectedArea` ("Selected area: {area}", when you pass `selectedAreaLabel`), and `exportScale` ("Scale: zoom {zoom} · {projection}"). Translate them in `config.messages`.
- **Order.** Exports run one after another, in the order they were asked for. A second export waits for the first.
- **Loading.** An export waits for every visible layer to load, up to `timeoutMs` (10 seconds), then for fonts and a drawn frame. An optional layer that failed is exported without its data. A `required` layer that failed fails the export.

PNG and JPEG require every visible tile/image source to permit anonymous CORS canvas access. SVG is vector-native when every visible layer is GeoJSON; otherwise the map inside the SVG report is a raster image, with the same CORS requirement. The default basemap, Esri's World Basemap, is vector tiles: with it, the map inside an SVG report is an image. List `basemaps: [worldBasemap]` (or other GeoJSON basemaps) for vector-native SVG. Vector SVG draws what the canvas draws: symbol sizes from `radiusStops` and `widthStops` at the current zoom, layer opacity, drawing order, and the selection.

## Embed pages

There are no embed helpers. An embed page is an ordinary page that renders the map from a config your server approved. Check that config with `validateMapConfig` before you render it. Storing configs, authorization, CSP, and public-data policy stay with the host.

## MapGrid

`MapGrid` takes one `MapGridConfig`:

- `shared` is the map config every cell uses, in the short form (`MapConfigInput`).
- `maps` lists one to six cells: `{ id, title, initialState?, layers? }`. A cell's `initialState` is partial and is merged over the shared one. Its `layers` replace the shared layers. The grid follows the list: add or remove a cell and the map appears or goes.
- `layout` sets `columns`, `tabletColumns` (below 980 px), `mobileColumns` (below 680 px), `gapPx`, and `cellHeightPx`.
- `sync` turns synchronization on for `view`, `layers`, `time`, and `selection`, each independently. Only changes a user or an action made (origin `'user'` or `'api'`) are passed to the other maps. The changes a map makes to follow the grid are not passed on, so they don't echo back.
- `focus.enabled` (default `true`) adds a button to each cell that shows that map alone, with its full UI.

Unfocused cells use your `shared.ui` with `profile: 'grid'`, so your other `ui` settings still apply. A focused cell uses `shared.ui` as written.

A changed grid config starts each map's state over from its config. A config you rebuild with new layers or a new starting zoom therefore shows them.

```tsx
<MapGrid
  config={{
    shared: { accessibility: { ariaLabel: 'Unemployment' }, data: { layers } },
    maps: [
      { id: 'y2020', title: '2020', initialState: { time: '2020' } },
      { id: 'y2024', title: '2024', initialState: { time: '2024' } },
    ],
    layout: { columns: 2 },
    sync: { view: true, layers: true },
  }}
  onStateChange={(state, mapId, change) => {
    if (mapId === null) saveFocus(state.focusedMapId)
    else saveView(mapId, state.maps[mapId]!.view, change?.origin)
  }}
  onError={(error, mapId) => report(mapId, error.code)}
/>
```

The grid state (`MapGridState`) holds each map's complete state and the focused map: `{ maps, focusedMapId }`. Pass it as `state` to control the grid. `onStateChange(state, mapId, change?)` receives the complete grid state after every change:

- After a change in one map, `mapId` is that map's ID and `change` is its `MapStateChange`.
- After a focus change, `mapId` is `null` and `change` is undefined.

Several updates in the same tick, such as two synchronised maps reporting at once, all apply. `slots` and `icons` you give the grid go to every cell.

The `on*` callbacks (`MapGridCallbacks`) go to every cell too, with the map's ID as an extra last argument: `onViewChange(event, mapId)`, `onFeatureSelect(event, mapId)`, `onError(error, mapId)`, and so on.

## Vite

Copy the folder to `src/components/geospatial-map` and import its stylesheet once in `src/main.tsx`. No Vite plugin or alias is required beyond the `@/` alias the Vite templates commonly add; a relative import works just as well.

```tsx
// src/main.tsx
import './components/geospatial-map/geospatial-map.css'
```

```tsx
import { GeospatialMap, type MapConfig } from '@/components/geospatial-map'
```

## Next.js App Router

Import the stylesheet from the root layout. The parts already carry `'use client'`. Render the map from a client component of your own when you pass callbacks or slots, since functions cannot cross the server/client boundary.

```tsx
// app/layout.tsx
import '@/components/geospatial-map/geospatial-map.css'
```

```tsx
// components/indicator-map.tsx
'use client'

import { GeospatialMap, type MapConfig } from '@/components/geospatial-map'

export function IndicatorMap({ config }: { config: MapConfig }) {
  return <GeospatialMap config={config} onFeatureSelect={(event) => console.log(event)} />
}
```

`defineMapConfig`, `validateMapConfig`, the basemap helpers (`arcgisBasemap`, `worldBasemap`, …), and the types have no client directive, so a server component can build or validate the config and pass it down. The map renders an accessible shell during SSR, and OpenLayers starts after mount. To keep the map out of the initial bundle, import the client wrapper with `next/dynamic` and `ssr: false`.

## Next.js Pages Router

Import the stylesheet in `pages/_app.tsx`. Global CSS cannot be imported from components in the Pages Router, which is why the folder never imports its own CSS.
