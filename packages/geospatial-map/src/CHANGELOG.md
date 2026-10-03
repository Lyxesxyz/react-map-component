# Changelog

This folder is copied into apps rather than installed, so this file travels with it. `GEOSPATIAL_MAP_VERSION` in `version.ts` says which version your copy is.

To update a copy, run the update script from a clone of the source repository. It does a three-way merge, so your own edits are kept:

```sh
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map            # report only
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map --apply    # write changes
```

Each entry lists the files it touches, so you can also copy them over by hand.

## 0.5.0

### Added

- **ArcGIS basemaps by URL.** `arcgisBasemap({ url })` takes a public ArcGIS vector tile service (or its ArcGIS Online item page) and reads everything else from the service: projection (Equal Earth with any central meridian, Web Mercator, or any WKT), tile grid, default style, fonts and attribution.
  - Labels and boundary lines are drawn above your data, fills below it (`labelsAboveData`, default `true`).
  - `styleOverrides: [{ layers: 'Boundary line/Admin1*', color, width, opacity, visible, paint, layout }]` restyles basemap layers by id or `*` pattern. Colours can be CSS variables. A pattern that matches nothing logs the style's layer ids.
  - The same service can be used as any layer with `kind: 'arcgis-vector-tiles'`, and `mapboxStyle` on `mvt` layers takes `layers` and `overrides` too.
- **Indicator data from more sources.** `data: { url }` reads GeoJSON, ArcGIS feature layers (`…/FeatureServer/0`, paged, any size up to 200,000 features), ArcGIS Online items (feature services, GeoJSON and CSV uploads), CSV with longitude/latitude columns, and JSON rows. `data: { rows }` takes rows you already have. `format`, `longitude` and `latitude` cover URLs and columns that can't be detected.
- `fetchGeoJson(url, options)`, the built-in loader, to wrap in your own `loadGeoJson` (for tokens or headers) without losing the formats above.
- **Shorter layers.** `kind`, `role`, `title` and `style` are optional: `{ id: 'regions', data: { url } }` is a complete layer (a GeoJSON indicator, titled by its id, filled with `--geo-primary`). Point and line data get matching point and line symbols from a polygon style.
- **Disclaimer:** `ui.disclaimer: { text, placement, title, defaultOpen }`, or the `<MapDisclaimer>` part. A button in a bottom corner expands the text across the bottom of the map; Escape collapses it. Exports print the text under the map (`export: { disclaimer }` overrides it).
- `slots.tooltip` for custom tooltip content in `<GeospatialMap>`.
- **Data checks.** When a layer's data loads, the console names the likely problem: no features, coordinates that aren't longitude/latitude, a style field the data doesn't have (listing the fields it has), text in a numeric style, values that match no category, and missing or duplicate `featureIdField` values.
- Polygons and lines that cross the edge of the map (Russia, Fiji, Antarctica, or others for a basemap with a different central meridian) are cut at the edge instead of being drawn as bands across the map.
- `view.fitWorld`: the starting view shows the whole world at the size of the map. It's on when the config gives no starting zoom.

### Changed (check these when updating)

- **Users can no longer change the projection.** The projection field is gone from the settings panel; the projection is set by the developer (`initialState.view.projection`) or by an ArcGIS basemap. `MapProjectionField` is removed, `'projection'` is no longer a `ui.settings.fields` value (remove it from your config), and the `projection`, `equalEarth`, `equalEarthArcgis` and `mercator` messages are removed.
- The basemap field is hidden when only one basemap fits the projection.
- Configs without a starting zoom open on the whole world fitted to the map, instead of zoom 1.2 at [0, 20].
- GeoJSON layers are selectable by default, also without `featureIdField`: features keep their GeoJSON `id`, or get their index. Set `selectable: false` to opt out. Tile layers still need `featureIdField` to be selectable.
- `ProjectionId` accepts any code, and a basemap may leave `supportedProjections` empty when its layers define the projection (ArcGIS basemaps do).
- Exports keep the area shown on screen, and the scale line names the projection ("Equal Earth", "Web Mercator").
- Load errors include the reason (HTTP status, or "returned a web page instead of data").

### Fixed

- Switching to a basemap that doesn't support the current projection broke the map ("No basemap supports …"). The switch is now refused with an error message, and the map keeps working.

### Files changed

New: `core/arcgis.ts`, `core/data-sources.ts`, `core/diagnostics.ts`, `core/seam.ts`, `core/vector-style.ts`, `map-disclaimer.tsx`, `use-arcgis-config.ts`, `use-world-fit.ts`.

Changed: `basemaps.ts`, `config.ts`, `core/layer-factory.ts`, `core/map-controller.ts`, `core/projections.ts`, `core/style-compiler.ts`, `core/svg-export.ts`, `geospatial-map.css`, `geospatial-map.tsx`, `index.ts`, `map-settings.tsx`, `map-state.ts`, `map-tooltip.tsx`, `messages.ts`, `types.ts`, `use-map-engine.ts`, `version.ts`, `README.md`, `CHANGELOG.md`.

## 0.4.0

### Added

- **A real map by default.** `worldBasemap` draws Natural Earth country outlines on water. It's the default when a config lists no basemaps. The data ships with the folder (`world-data.ts`, about 68 KB, loaded on first use), so it needs no network or API key. It's coloured by `--geo-basemap-water`, `--geo-basemap-land` and `--geo-basemap-border`, and follows dark mode.
- `tileBasemap({ url, attribution })` builds a basemap from any `{z}/{x}/{y}` raster tile service. A config whose basemaps are all Web Mercator now starts in Web Mercator.
- Layer and basemap colours can be CSS variables (`fillColor: 'var(--brand)'`). They are resolved for the canvas and exports, and re-read when the page switches between light and dark.
- `data: { builtin: 'world' }` uses the bundled outlines in any GeoJSON layer.
- **Hover tooltip:** the `<MapTooltip>` part, shown by `<GeospatialMap>` by default (`ui.tooltip`). It shows the hovered feature's `name`, `title` or `label`.
- **Popup next to the feature:** `ui.popup.anchor: 'feature'` or `<MapPopup anchor="feature">`. The popup follows the map while it pans, and becomes a bottom sheet on narrow maps.
- `useMapPixel(lonLat)` and `useHoveredFeature()` for your own overlays (markers, labels, callouts).
- **OpenLayers access:** the `onOpenLayersMap(map)` prop, `actions.getOpenLayersMap()`, and `getOpenLayersMap()` on the ref. Use it for drawing, measuring or your own layers. Layers you add are kept when the configured layers change.
- **Large point layers:** `renderer: 'auto' | 'canvas' | 'webgl'` on GeoJSON layers. `auto` (default) draws point layers with 5,000+ features with WebGL, but only when the browser has GPU acceleration. Software WebGL, for example on virtual desktops, is slower than the canvas.
- **Clustering:** `cluster: { distance, minDistance }` on GeoJSON point layers. Bubbles show counts and zoom in when clicked; single points behave like normal features.

### Changed (check these when updating)

- Configs without `data.basemaps` show `worldBasemap` instead of a blank background. Pass `basemaps: [plainBasemap]` to keep the old look.
- `<GeospatialMap>` shows a hover tooltip. Turn it off with `ui: { tooltip: { enabled: false } }`.
- `diamond` point symbols are drawn as diamonds on the canvas (they were drawn as squares).
- PNG and JPEG exports paint the basemap background colour behind the map.

### Fixed

- Dragging an Equal Earth map so its centre left the world outline crashed the component ("coordinates must be finite numbers").
- Exported legends no longer draw a gradient's label on top of the gradient.

### Files changed

Added: `basemaps.ts`, `map-anchor.ts`, `map-tooltip.tsx`, `world-data.ts`, `core/builtin-data.ts`, `core/webgl-style.ts`.
Changed: `CHANGELOG.md`, `README.md`, `config.ts`, `geospatial-map.css`, `geospatial-map.tsx`, `index.ts`, `map-context.ts`, `map-popup.tsx`, `map-root.tsx`, `types.ts`, `use-map-engine.ts`, `version.ts`, `core/canvas-theme.ts`, `core/layer-factory.ts`, `core/map-controller.ts`, `core/projections.ts`, `core/style-compiler.ts`, `core/svg-export.ts`.

## 0.3.0

Files changed: `CHANGELOG.md` and `version.ts` (added); `README.md`, `config.ts`, `geospatial-map.css`, `index.ts`, `map-root.tsx`, `map-state.ts`, `types.ts`, `use-map-engine.ts`, `utils.ts`, `core/layer-factory.ts`, `core/map-controller.ts`.

- A config written inline in a component no longer resets the map on every re-render. The map compares configs by content and resets its view only when `initialState` changes.
- Short configs. `version`, `view`, `ui`, `initialState` and `data.basemaps` are optional. `defineMapConfig` and `validateMapConfig` fill in a plain basemap (coloured by `--geo-stage`), a whole-world view and the layer state (`normalizeMapConfig`, `plainBasemap`, `defaultInitialView`).
- Layers with a `featureIdField` are selectable by default. Set `selectable: false` to opt out.
- One-time console hints: `geospatial-map.css` isn't loaded, `onFeatureSelect` is set but no layer is selectable, or `fill` is set inside a parent with no height.
- `fill` prop on `<MapRoot>` and `<GeospatialMap>`: the map takes its parent's height.
- `loadGeoJson` prop for GeoJSON URLs that need auth headers, credentials or custom caching.
- `GEOSPATIAL_MAP_VERSION` export and this changelog.

## 0.2.0

- First copy-paste release: composable parts, `<MapRoot>`, `useMap()`, CSS-token styling with dark mode, and the `<GeospatialMap>` preset.
