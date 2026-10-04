# Changelog

This folder is copied into apps rather than installed, so this file travels with it. `GEOSPATIAL_MAP_VERSION` in `version.ts` says which version your copy is.

To update a copy, run the update script from a clone of the source repository. It does a three-way merge, so your own edits are kept:

```sh
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map            # report only
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map --apply    # write changes
```

Each entry lists the files it touches, so you can also copy them over by hand.

## 0.9.0

A second refinement pass. It fixes bugs in time layers, exports, heatmaps, controlled state and the grid, gives each concept one place in the code, and removes options that cost more than they gave: automatic projection switching, layer roles, z-indexes, hit priorities, the breadcrumb hierarchy and the embed helpers. **This release renames and removes configuration fields** (see the table below). `validateMapConfig` names the replacement for every old field, and TypeScript flags them, so an update is guided by the errors.

### Fixed

- **"Fit data" fits your data.** The fit button without a selection, and `fitContent('data')`, fitted the whole world. They now fit the loaded features of your visible layers (the world when nothing has loaded).
- **A time layer no longer draws every frame at once** when the configuration sets no starting time: the map starts at the first frame.
- **Heatmaps** release their GPU context when removed, and redraw when the time frame changes (they kept the first frame's weights).
- **Data loaded per time frame:** only the latest load is shown (a slower earlier one used to replace it), a frame that failed is requested again the next time it is shown, and nothing is drawn after the layer was removed.
- **Exports:** two exports in a row wait for each other; the map is back at its size after an export, also a failed one; export waits for every visible layer to load, not only `required` ones; the SVG export draws what the canvas draws (selected lines as lines, sizes from `radiusStops` and `widthStops`, layer opacity, squares at the canvas size).
- **Tile layers:** a few missing tiles (a 404 over the sea) no longer fail the layer, and the loading status no longer flickers while tiles load.
- **A layer that can't be built** leaves the map as it was and shows the error, instead of breaking the React tree.
- **Controlled `state`:** a host that answers a proposed change with another state wins; the map is set back to the host's state. Before, a rejected selection or layer change stayed on the map.
- **One selection path:** a click and `actions.select()` announce the selection the same way, `onFeatureSelect` fires only when the selection changes, and a selection made from code reports its feature once it has loaded instead of `null`.
- **The map is not rebuilt** when a changed configuration is read again (ArcGIS services, the world fit): `onOpenLayersMap` runs once, and your OpenLayers additions stay.
- **Panels:** a controlled panel and its control-rail button no longer disagree (see "Panels are controlled at the root").
- **`MapPopup` and `MapTooltip` refs** point at their elements (they were `null`).
- **Actions:** `zoom()` uses the live zoom; errors from `setLayerVisibility()` and `setLayerOpacity()` (an unknown id, hiding a required layer) go to the error alert and `onError` instead of throwing; `fit()`, `fitSelection()` and `exportImage()` use the `view.fit` and `export` defaults of the configuration, like `downloadImage()`.
- **`MapGrid`** follows `config.maps` (maps can be added and removed), restarts a map's state when the grid configuration changes, and no longer reports the changes a map made to follow another one back to the host.
- **Events:** `onLayerStateChange` reports the order among your layers; switching basemap no longer emits layer events; `FEATURE_ID_MISSING` is reported once per layer instead of on every hover.
- **Accessibility:** a time change is announced once (it was announced twice); changes from a new `state` prop aren't announced; labelled panels and toolbars have a role, so their names are read.
- Layer `minZoom` and `maxZoom` are applied in one place, so the map and the status chip always agree.
- Map ids are valid in the DOM with React 19; the configuration-error shell has `data-map-id`.
- A line symbol drawn on polygons keeps its opacity.

### Changed (check these when updating)

| 0.8                                                                          | 0.9                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `view.projectionBehavior`, basemap `fallbackFor`                             | removed: each map has one projection, set in its configuration                                         |
| `actions.setProjection()`, `onProjectionChange`                              | removed                                                                                                |
| layer `role`                                                                 | removed: the layer panel lists layers under their `group`                                              |
| `ui.layerPanel.groupBy: 'role'`                                              | `'group'` or `'none'`                                                                                  |
| layer `zIndex`                                                               | removed: layers draw in the order of the list                                                          |
| layer `hitPriority`                                                          | removed: the top-most feature is selected                                                              |
| layer `boundarySetId`, `geographyLevel` (also in selections, events)         | removed                                                                                                |
| `time: { available, mode, fieldOrParameter, missingPolicy, prefetchFrames }` | `time: { values, field }`; the mode follows from the layer                                             |
| `data.hierarchy`, `HierarchyItem`                                            | `ui.breadcrumbs.targets`: zoom target ids, widest first                                                |
| zoom target `parentId`, `geographyLevel`                                     | removed                                                                                                |
| `MapBreadcrumbs` `items`, `onItemClick`                                      | `targets`, `onTargetClick`                                                                             |
| basemap `network`                                                            | removed                                                                                                |
| `selectable`, `featureIdField`, `propertyAllowlist` on any layer             | only on GeoJSON and vector tile (`mvt`) layers                                                         |
| `aboveOverlays` on any layer                                                 | only on basemap layers                                                                                 |
| `MapSettings` / `MapLayerPanel` `open`, `onOpenChange`                       | `openPanel`, `onOpenPanelChange` on `<MapRoot>` / `<GeospatialMap>`                                    |
| popup context `selection`                                                    | `feature`                                                                                              |
| `ui.legend.defaultOpen`, `MapLegend` `defaultOpen`                           | `expanded`                                                                                             |
| `LayerStateEvent.index`                                                      | `order`                                                                                                |
| `MapOrigin` `'external'`, `'fit'`, `'projection-switch'`, …                  | `'user'`, `'api'` or `'state'`                                                                         |
| `createPublicEmbedConfig`, `createEmbedSnippet`                              | removed: an embed page renders the map from a configuration your server approved (`validateMapConfig`) |

- **Time.** How a layer follows the frame is inferred: `{time}` in its URL (`url`, or GeoJSON `data.url`) → requested again for each frame; a WMS layer → the request parameter `field` (default `TIME`); otherwise features are filtered by the property `field` (default `time`). A layer is hidden while the map shows a frame it doesn't have (the status chip says "No data for time"). GeoJSON and XYZ layers with `{time}` in their URL load the next frame ahead. WMTS and ArcGIS layers have no time frames, and an XYZ layer with frames needs `{time}` in its URL.
- **Starting time.** With time layers and no `initialState.time`, the map starts at the first frame. Set `initialState: { time: null }` to start with none (time layers are then hidden).
- **Panels are controlled at the root.** `openPanel` (`'layers' | 'settings' | null`) and `onOpenPanelChange` on `<MapRoot>` or `<GeospatialMap>`; uncontrolled, the rail buttons, `actions.setOpenPanel()` and the `defaultOpen` settings drive it.
- **Origins.** `'user'`: someone used the map itself (drag, scroll, click). `'api'`: a `MapActions` call, from your code or a built-in control. `'state'`: the starting state or a new `state` prop. `FeatureEvent.interaction` is gone.
- **World fit.** `defineMapConfig` no longer writes `view.fitWorld: true`; the map decides when it starts (`fitWorld`, by default when the configuration sets no zoom). A configuration spread with a new zoom keeps its zoom.
- **`MapGrid` callbacks** get the map id as their last argument: `onViewChange(event, mapId)`, `onError(error, mapId)`, …
- **The `embedded` profile** turns the layer panel off (it had no button to open it).
- **A `custom:*` control without a renderer** is skipped with a console hint; it was a configuration error.
- **`required`** means the layer must load: users can't hide it, exports and playback wait for it, and if it fails, export fails and playback pauses.
- **Vector tile layers** with a `featureIdField` are selectable by default, like GeoJSON layers. Heatmaps are never selectable.
- **Messages:** `projectionChanged` and `network` are gone; `exportTime`, `exportSelectedArea` and `exportScale` are new (the report text, which was English only). `validateMapConfig` now rejects a `messages` key that isn't a message (it was ignored), so a typo in a translation shows up.
- **The export field's option values** are MIME types (`image/png`, …); the labels are unchanged.
- **No longer exported:** `SerializedMapState`, `PublicEmbedConfig`, `EmbedSnippetOptions`.

### Added

- `useMapRuntime(select)`: one piece of the live map data, for parts that should re-render only when it changes. `MapStaticValue` and `MapContextValue` are public types, and `useMap()` includes `icons`.
- `mapInputSchema`: the JSON Schema of the short form people write, for editors and CMS fields (the source repository's `pnpm schema` writes it to `map-config-input.schema.json`).
- `layerId` in the options a `loadGeoJson` loader receives.
- `actions.getState()` returns the view as the map shows it at that moment, also during an animation.

### Inside (for people who read the code)

- Each layer builder has one `update(change)` hook for zoom, time, selection and theme changes.
- Every validation rule is in `config/validate.ts`; the renderer checks the same rules when it is given a configuration directly.
- `core/symbols.ts` decides symbols, sizes and colours for the canvas, the GPU and the SVG export; `core/time.ts` decides how a layer follows the time frame; `core/layer-order.ts` decides which layers can move.
- The controller keeps one projection, adds and removes layers in place (layers you added and listeners on the layer collection stay), and disposes the OpenLayers map when the component unmounts.
- The parts read the live map data from a store, each for the fields it shows.

### Files changed

New: `core/symbols.ts`, `core/time.ts`, `core/layer-order.ts`.

Removed: `core/embed.ts`.

Changed: almost every other file, including `types.ts`, `index.ts`, `geospatial-map.css` (the disclaimer button), `README.md`, `AGENTS.md`, `docs/*.md` and `examples/*`.

## 0.8.0

A refinement pass over every file: the same features with fewer ways to do each thing, one name per concept, and several bugs fixed that the old structure hid. **This release renames configuration fields** (see the table below). `validateMapConfig` names the new field for every old one, and TypeScript flags them, so an update is a search-and-replace guided by the errors.

### Fixed

- **A selection set by the host opens the popup**, and clearing it closes the popup. The popup and tooltip follow `state.selection` however it was set: a click, controlled `state`, or the new `actions.select()`.
- **`onError` receives every error** the alert shows: layer loads, exports, location and `onOpenLayersMap` throwing (before, only layer loads reached it). Each error has a code that says what failed; export failures are no longer all `EXPORT_TIMEOUT`.
- **`MapGrid`** keeps every change when several maps update at once, keeps your `shared.ui` settings in unfocused cells, and reports which map is focused, so a controlled grid can focus.
- **Panning** no longer creates a new OpenLayers view and redraws every layer after each move; **showing, hiding or fading a layer** no longer reloads its data.
- **Opacity** works for point and line symbols, and for polygons in any CSS colour (`rgba()`, named colours, `var(--token)`); it was ignored before except for polygons in `#rrggbb` or `rgb()`.
- **The GPU renderer draws what the canvas draws.** Absent and out-of-range values could get different symbols on the two renderers. One rule list now decides the symbol for the canvas, the GPU and the legend, so the GPU renderer also accepts any category values and unclamped ramps.
- **Continuous ramps blend any CSS colour.** Stops written as `oklch()`, `hsl()`, named colours or `var(--token)` stepped from one stop to the next instead of blending.
- **Absent values are "missing", not 0.** An empty or `null` property used to be classified as the number 0.
- **PNG and SVG exports show the same legend** (the one on screen, including hand-written `legend.entries`) and the same header and footer.
- A short-form layer that names `kind: 'geojson'` gets the defaults (role, title, style, selectable) like one without `kind`.
- Inline GeoJSON may have `bbox`, `name` and other GeoJSON members.
- Layers can be reordered unless they set `reorderable: false` (it was effectively off by default).
- A layer `style` changed in the configuration applies; after a user showed, hid or moved a layer, the old style stayed.
- The opacity slider's label is a message (`layerOpacity`), so it translates.
- `validateMapConfig` explains a configuration it can't complete instead of listing schema errors.

### Changed (check these when updating)

| 0.7                                                              | 0.8                                                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ui.controlRail`                                                 | `ui.controls`                                                                                                                           |
| `ui.layers`                                                      | `ui.layerPanel`                                                                                                                         |
| `ui.hierarchy`                                                   | `ui.breadcrumbs`                                                                                                                        |
| `ui.errors`                                                      | `ui.errorAlert`                                                                                                                         |
| `ui.status`, `<MapStatus>`                                       | `ui.statusChips`, `<MapStatusChips>`                                                                                                    |
| `time` (top level)                                               | `ui.time`                                                                                                                               |
| `accessibility.keyboard`                                         | `view.interactions.keyboard`                                                                                                            |
| `time.reducedMotion`, `MapTimeControls` `reducedMotion`          | `accessibility.reducedMotion`                                                                                                           |
| `initialState.view.minZoom`, `maxZoom`                           | `view.minZoom`, `view.maxZoom`                                                                                                          |
| layer `urlTemplate` (`mvt`, `xyz`)                               | `url`                                                                                                                                   |
| layer `dataProjection` (`geojson`, `heatmap`)                    | `sourceProjection` (and `sourceProjectionDefinition`)                                                                                   |
| ArcGIS layer `styleUrl`, `styleLayers`, `styleOverrides`         | `mapboxStyle: { url, layers, overrides }`, as on `mvt` layers                                                                           |
| ArcGIS layer `projection`, `arcgisBasemap({ projection })`       | `sourceProjectionDefinition`                                                                                                            |
| `orderLocked: true`                                              | `reorderable: false`                                                                                                                    |
| `theme.accentColor`, `textColor`, `surfaceColor`, …              | token names: `primary`, `foreground`, `background`, `muted`, `mutedForeground`, …                                                       |
| `GeospatialMapConfigV1`, `MapGridConfigV1`, `VectorTileGridSpec` | `MapConfig`, `MapGridConfig`, `TileGridSpec`                                                                                            |
| `MapApi`; the `ref`'s five methods                               | `MapActions` everywhere: `useMapActions()`, slots and the `ref`                                                                         |
| `actions.setPanelOpen(panel, open)`, `useMap().panels`           | `actions.setOpenPanel(panel \| null)`, `useMap().openPanel`                                                                             |
| `<MapControls renderCustomControl>`                              | `<MapControls customControls={{ 'custom:id': … }}>`                                                                                     |
| `slots.panelHeader`, `panelFooter`, `loading`, `empty`, `error`  | compose the parts: `header`/`footer` props, `MapStatusChips` `loading`/`empty`, `MapErrorAlert` children, `MapRoot` `renderConfigError` |

- **Theme keys.** All of them: `textColor` → `foreground`, `mutedColor` → `mutedForeground`, `borderColor` → `border`, `surfaceColor` → `background`, `softSurfaceColor` → `muted`, `glassColor` → `overlay`, `accentColor` → `primary`, `accentHoverColor` → `primaryHover`, `dangerColor` → `destructive`, `focusColor` → `ring`. New: `primaryForeground`, `stage`. Each key is the `--geo-*` token of the same name.
- **Removed, because they did nothing:** `frameFailurePolicy: 'retain-last'` (use `'pause'` or `'skip'`), `legend.presentation`, `legend.showLayerToggle`, WMS `tiled`, `mvt` `sourceLayer`, and the `onSymbologyChange` callback (nothing emitted it).
- **Error codes:** new `EXPORT_FAILED`, `LOCATION_UNAVAILABLE` and `HOOK_FAILED`; removed `PROJECTION_UNSUPPORTED`, `STYLE_INVALID` and `TIME_FRAME_FAILED`, which nothing produced. `exportImage()` rejects with an `Error` carrying the `MapError` as `mapError`.
- **Out-of-range values** use `outOfRange` and no longer fall back to `missing`; give the style an `outOfRange` class if values can fall outside every class.
- **`MapGrid`:** `shared` and the maps take the short config form (`initialState` and `layers` may be left out); `onStateChange` is `(state, mapId | null, change?)`, with `mapId` `null` when focus changes.
- **Basemaps:** `backgroundColor`, `attribution` and `exportable` are optional (`var(--geo-stage)`, none, `true`).
- **No longer exported** (internal): `normalizeMapConfig`, `defaultInitialView`, `defaultLayerStyle`, `initialMapState`, `resolveMapUi`, `mapUiProfiles`, `resolveMapMessages`, `mapThemeStyle`, `mapThemeVariables`, `defaultMapTheme`, `resolveMapTheme`, `SerializedMapState`, `MapPopupRenderContext` (use `PopupContext`), and the testing helpers (import them from `testing.ts`). `useMap().layerState` is gone: `useMap().layers` has each layer's `visible` and `opacity`, in drawing order.
- **CSS:** the error alert is positioned by its own class, `.geo-error-alert` (it was any `.geo-shape-alert` on the map); its `data-slot` is `map-error-alert`, and `data-code` has the error code. The status chips' `data-slot` is `map-status-chips`.

### Added

- `actions.select(selection | null)`, and every action on the component `ref`.
- `open` and `onOpenChange` on `MapSettings` and `MapLayerPanel`, like `MapDisclaimer`.
- `useMapStatic()`: configuration, UI policy, messages, actions and icons, without re-rendering while the map moves.
- `mapThemeTokenNames`, the tokens `config.theme` can set.
- Every part forwards a `ref` to its root element.

### Inside (for people who read the code)

- `config.ts` became `config/`: `schema.ts` (the JSON Schema), `normalize.ts` (`defineMapConfig` and defaults), `validate.ts` (the rules, one small function each), `ui-profiles.ts` and `legacy.ts` (the renamed-field messages). A type test checks that the schema and the hand-written types describe the same fields.
- `core/layer-factory.ts` became `core/layer-registry.ts` and one builder per layer kind in `core/layers/`. `core/map-controller.ts` keeps the view, projection and layers; hit testing and hover moved to `core/interaction.ts`, export to `core/export.ts` and `core/report.ts` (one layout drawn as PNG or SVG), HTTP to `core/http.ts`, and symbol choice to `core/symbol-rules.ts`.
- `use-map-engine.ts` is wiring; the actions and controller callbacks are in `map-bridges.ts`.

### Files changed

New: `config/schema.ts`, `config/normalize.ts`, `config/validate.ts`, `config/ui-profiles.ts`, `config/legacy.ts`, `core/layer-registry.ts`, `core/layers/common.ts`, `core/layers/vector-data.ts`, `core/layers/vector-layer.ts`, `core/layers/vector-tile-layer.ts`, `core/layers/raster-layers.ts`, `core/symbol-rules.ts`, `core/http.ts`, `core/report.ts`, `core/export.ts`, `core/interaction.ts`, `core/validation.ts`, `map-bridges.ts`, `hooks.ts`, `map-status-chips.tsx`, `map-error-alert.tsx`.

Removed: `config.ts`, `core/layer-factory.ts`, `map-status.tsx`.

Changed: almost every other file, including `types.ts`, `index.ts`, `geospatial-map.css` (error alert rules), `README.md`, `AGENTS.md`, `docs/*.md` and `examples/*`.

## 0.7.0

Makes the folder easy for coding agents (and people) to work with in the receiving app.

### Added

- **`AGENTS.md`**, and a `CLAUDE.md` that loads it: where each kind of change belongs (config, CSS tokens, parts, `shapes.tsx`, `onOpenLayersMap`…), what not to edit, how to verify a change, and how to update. Codex, Cursor, Copilot and Claude Code pick these up when they work in the folder.
- **`examples/`**, one per common task: quick start, ArcGIS basemap with indicators, admin areas coloured from a table, authenticated data, custom layout and popup, brand theme (with a CSS file), controlled state and grid, symbology, and an end-to-end readiness check. They are type-checked with the folder and rendered in the source repository's tests.
- **`docs/`**: the detailed guides now travel with the folder (they stayed in the source repository before).
- **Ready state.** The map element has `data-status` (`loading` → `ready`, or `error` for an invalid config) and `data-layer-errors` when layers failed to load. Parts read it as `useMap().mapStatus`.
- **`testing.ts`:** `waitForMapReady(page, { mapId?, timeout? })` and `mapReadySelector()` for Playwright-style tests, typed without depending on Playwright.
- **`fetchGeoJson` takes `init`** (extra `fetch` options), so a loader can add headers or cookies without losing CSV and ArcGIS support: `fetchGeoJson(url, { ...options, init: { headers } })`.
- Engine files start with a comment saying not to edit them to customise the map, and what to change instead.

### Changed (check these when updating)

- New files and folders in the copy: `AGENTS.md`, `CLAUDE.md`, `docs/`, `examples/`, `testing.ts`. The examples are compiled by your app's typecheck like the rest of the folder; delete `examples/` if you don't want them.
- If your root `AGENTS.md` or `CLAUDE.md` should point agents here, add the line from `README.md` → "If you use coding agents".

### Files changed

New: `AGENTS.md`, `CLAUDE.md`, `testing.ts`, `docs/*.md`, `examples/*`.

Changed: `types.ts`, `use-map-engine.ts`, `map-root.tsx`, `index.ts`, `core/data-sources.ts`, the engine files (header comment only: `core/*.ts`, `use-*.ts`, `config.ts`, `map-state.ts`, `map-context.ts`), `version.ts`, `README.md`, `CHANGELOG.md`.

## 0.6.0

### Added

- **A complete set of design tokens.** Type (`--geo-font-size-2xs/-xs/-sm/-title`, `--geo-font-weight/-medium/-bold`, `--geo-line-height`, `--geo-heading-font-family`, `--geo-heading-tracking`, `--geo-label-transform/-tracking/-caps`), shape (`--geo-radius-panel/-control/-rail/-chip/-pill/-stage`, `--geo-border-width`), surfaces (`--geo-backdrop`, `--geo-shadow-control/-control-hover`), states (`--geo-control-hover/-active/-active-foreground`, `--geo-focus-width/-offset`, `--geo-duration`, `--geo-easing`), sizes (`--geo-input-height`, `--geo-icon-size/-stroke`, `--geo-panel-padding`, `--geo-legend-width`) and colours for the tooltip. Every size, weight, radius, blur and duration in the stylesheet now comes from a token; a test keeps it that way.
- **Switch and slider tokens.** `--geo-switch-width/-height/-thumb/-thumb-checked/-on/-off/-thumb-color/-thumb-on-color` and `--geo-slider-track/-thumb/-thumb-width/-thumb-radius/-on/-off/-thumb-color/-thumb-shadow`.
- **Icons per map:** the `icons` prop on `<GeospatialMap>`, `<MapRoot>` and `<MapGrid>` (`{ ZoomIn, Layers, Close, … }`), `useMapIcons()` for custom parts, and the `MapIcon`, `MapIcons` and `MapIconName` types. `defaultMapIcons` in `icons.ts` is the app-wide set.
- **Map labels follow the theme's type:** `--geo-label-size` and `--geo-label-weight` set the canvas label and cluster-count font.
- Demo: `?scenario=themes` restyles the same map as Material 3-style, IBM Carbon-style and editorial print themes (CSS only, plus an icon set).

### Changed (check these when updating)

- **The slider is drawn from tokens** (`appearance: none`), instead of the browser's slider with `accent-color`. Its default look is close to the old one.
- **The select has a wrapper element** (`span.geo-shape-select-wrap`) that draws its chevron; the select itself has `appearance: none`. If you styled `.geo-shape-select` widths, the wrapper is what takes the width now.
- **`icons.ts` exports `defaultMapIcons`** (by role) instead of the named `ZoomInIcon`, `LayersIcon`, … re-exports. If you edited `icons.ts`, move your icons into the object.
- `--geo-icon-stroke` applies only to outline icons (`fill="none"`). Filled icon sets used to be drawn with a 2px stroke, which made them look bold.
- The kicker, group-title and layer-meta labels share one tracking (`0.08em`) and the smallest size (`10px`; they were 9 to 10px). The disclaimer text is 12px (was 13px). The viewport focus ring is 3px like the others (was 4px).

### Fixed

- **Theme classes on a wrapper now repaint the map.** Canvas colours (data, labels, selection) were re-read only when `<html>` or `<body>` changed, so a `.dark` or theme class on a wrapper or on the map's `className` left the map in the old colours. Any `class`, `data-theme` or `style` change on the map or its ancestors now refreshes them.
- **Bottom-left parts no longer overlap.** The time controls covered the bottom of the legend in the default layout, and a bottom-left disclaimer covered the time controls. They now stack: disclaimer, time controls, legend. Narrow maps keep the time controls on one row of buttons.

### Files changed

`geospatial-map.css`, `shapes.tsx`, `icons.ts`, `types.ts`, `map-context.ts`, `map-root.tsx`, `map-grid.tsx`, `map-controls.tsx`, `map-layer-panel.tsx`, `map-popup.tsx`, `map-settings.tsx`, `map-time-controls.tsx`, `index.ts`, `core/canvas-theme.ts`, `core/style-compiler.ts`, `core/map-controller.ts`, `version.ts`, `README.md`, `CHANGELOG.md`.

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
