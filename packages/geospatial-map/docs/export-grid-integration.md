# Export, embeds, grids, Vite, and Next.js

## Report exports

Use configured settings UI or `ref.current.exportImage(options)`. PNG and JPEG require every visible tile/image source to permit anonymous CORS canvas access. SVG is vector-native for GeoJSON-only maps; tiled maps produce a labelled raster wrapper.

## Embeds

`createPublicEmbedConfig(configId, state)` creates versioned state for a server-approved configuration ID. `createEmbedSnippet` only emits an iframe when its origin is explicitly approved. Hosts remain responsible for storing configuration, authorization, CSP, and public-data policy.

## MapGrid

`MapGrid` accepts one `MapGridConfigV1` containing a shared map config and up to six map definitions. Configure desktop, tablet, and mobile columns with `columns`, `tabletColumns`, and `mobileColumns`; also configure gap, cell height, focus behavior, and independent synchronization for view, layers, time, and selection. Tablet and mobile column counts apply below 980 px and 680 px. Each cell uses the `grid` profile until focused.

## Vite

Import the component and package CSS normally. No Vite plugin is required.

```tsx
import { GeospatialMap, type GeospatialMapConfigV1 } from '@org/geospatial-map'
import '@org/geospatial-map/styles.css'
```

## Next.js App Router

Put the map behind a client boundary and import the global package CSS from the root layout.

```tsx
// app/layout.tsx
import '@org/geospatial-map/styles.css'
```

```tsx
// components/IndicatorMap.tsx
'use client'

import { GeospatialMap } from '@org/geospatial-map'

export function IndicatorMap({ config }: { config: GeospatialMapConfigV1 }) {
  return <GeospatialMap config={config} />
}
```

The package can be imported during SSR; OpenLayers initialization occurs after mount. If a page should defer the complete map bundle, dynamically import the client wrapper with `ssr: false`.
