# Export, embeds, grids, Vite, and Next.js

## Report exports

Users export from the settings panel's `export` field (on by default; `export: { enabled: false }` hides it). From code, use the actions (the `ref`, `useMapActions()`, or a slot's `actions`):

- `exportImage(options)` returns the report as a `Blob`. If it fails, it rejects with an `Error` whose `mapError` property is the `MapError`: `EXPORT_CORS_BLOCKED`, `EXPORT_TIMEOUT`, `EXPORT_FAILED`, or a layer's `SOURCE_LOAD_FAILED`.
- `downloadImage(format)` exports with the configured `config.export` options and downloads the file. A failure shows in the error alert and reaches `onError`.

PNG, JPEG, and SVG reports have the same layout: header, map, legend, disclaimer, and attribution. The legend is the one on screen, including hand-written `legend.entries`.

PNG and JPEG require every visible tile/image source to permit anonymous CORS canvas access. SVG is vector-native when every visible layer is GeoJSON; otherwise the map inside the SVG report is a raster image, with the same CORS requirement.

## Embeds

`createPublicEmbedConfig(configId, state)` creates versioned state for a server-approved configuration ID. `createEmbedSnippet` only emits an iframe when its origin is explicitly approved. Hosts remain responsible for storing configuration, authorization, CSP, and public-data policy.

## MapGrid

`MapGrid` takes one `MapGridConfig`:

- `shared` is the map config every cell uses, in the short form (`MapConfigInput`).
- `maps` lists one to six cells: `{ id, title, initialState?, layers? }`. A cell's `initialState` is partial and is merged over the shared one. Its `layers` replace the shared layers.
- `layout` sets `columns`, `tabletColumns` (below 980 px), `mobileColumns` (below 680 px), `gapPx`, and `cellHeightPx`.
- `sync` turns synchronization on for `view`, `layers`, `time`, and `selection`, each independently.
- `focus.enabled` (default `true`) adds a button to each cell that shows that map alone, with its full UI.

Unfocused cells use your `shared.ui` with `profile: 'grid'`, so your other `ui` settings still apply. A focused cell uses `shared.ui` as written.

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
/>
```

The grid state (`MapGridState`) holds each map's complete state and the focused map: `{ maps, focusedMapId }`. Pass it as `state` to control the grid. `onStateChange(state, mapId, change?)` receives the complete grid state after every change:

- After a change in one map, `mapId` is that map's ID and `change` is its `MapStateChange`.
- After a focus change, `mapId` is `null` and `change` is undefined.

Several updates in the same tick, such as two synchronised maps reporting at once, all apply. The `on*` callbacks, `slots`, and `icons` you give the grid go to every cell.

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
