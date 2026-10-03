# Changelog

This folder is copied into apps rather than installed, so this file travels with it. Compare `GEOSPATIAL_MAP_VERSION` in `version.ts` with the newest entry in the source repository to see what your copy is missing. Changes to `core/`, `config.ts`, `types.ts` and the engine files can usually be copied over as-is; re-apply your own edits to the parts, `shapes.tsx`, `icons.ts` and the CSS.

## 0.3.0

- A config written inline in a component no longer resets the map on every re-render. The map compares configs by content and resets its view only when `initialState` changes.
- Short configs. `version`, `view`, `ui`, `initialState` and `data.basemaps` are optional. `defineMapConfig` and `validateMapConfig` fill in a plain basemap (coloured by `--geo-stage`), a whole-world view and the layer state (`normalizeMapConfig`, `plainBasemap`, `defaultInitialView`).
- Layers with a `featureIdField` are selectable by default. Set `selectable: false` to opt out.
- One-time console hints: `geospatial-map.css` isn't loaded, `onFeatureSelect` is set but no layer is selectable, or `fill` is set inside a parent with no height.
- `fill` prop on `<MapRoot>` and `<GeospatialMap>`: the map takes its parent's height.
- `loadGeoJson` prop for GeoJSON URLs that need auth headers, credentials or custom caching.
- `GEOSPATIAL_MAP_VERSION` export and this changelog.

## 0.2.0

- First copy-paste release: composable parts, `<MapRoot>`, `useMap()`, CSS-token styling with dark mode, and the `<GeospatialMap>` preset.
