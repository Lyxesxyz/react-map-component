# Export, embeds, grids, Vite, and Next.js

## Report exports

Use configured settings UI or `ref.current.exportImage(options)`. PNG and JPEG require every visible tile/image source to permit anonymous CORS canvas access. SVG is vector-native for GeoJSON-only maps; tiled maps produce a labelled raster wrapper.

## Embeds

`createPublicEmbedConfig(configId, state)` creates versioned state for a server-approved configuration ID. `createEmbedSnippet` only emits an iframe when its origin is explicitly approved. Hosts remain responsible for storing configuration, authorization, CSP, and public-data policy.

## MapGrid

`MapGrid` accepts one `MapGridConfigV1` containing a shared map config and up to six map definitions. Configure desktop, tablet, and mobile columns with `columns`, `tabletColumns`, and `mobileColumns`; also configure gap, cell height, focus behavior, and independent synchronization for view, layers, time, and selection. Tablet and mobile column counts apply below 980 px and 680 px. Each cell uses the `grid` profile until focused.

## Vite

Copy the folder to `src/components/geospatial-map` and import its stylesheet once in `src/main.tsx`. No Vite plugin or alias is required beyond the `@/` alias the Vite templates commonly add; a relative import works just as well.

```tsx
// src/main.tsx
import './components/geospatial-map/geospatial-map.css'
```

```tsx
import { GeospatialMap, type GeospatialMapConfigV1 } from '@/components/geospatial-map'
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

import { GeospatialMap, type GeospatialMapConfigV1 } from '@/components/geospatial-map'

export function IndicatorMap({ config }: { config: GeospatialMapConfigV1 }) {
  return <GeospatialMap config={config} onFeatureSelect={(event) => console.log(event)} />
}
```

`defineMapConfig`, `validateMapConfig`, `initialMapState`, and the types have no client directive, so a server component can build or validate the config and pass it down. The map renders an accessible shell during SSR, and OpenLayers starts after mount. To keep the map out of the initial bundle, import the client wrapper with `next/dynamic` and `ssr: false`.

## Next.js Pages Router

Import the stylesheet in `pages/_app.tsx`. Global CSS cannot be imported from components in the Pages Router, which is why the folder never imports its own CSS.
