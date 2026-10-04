# Migration

## 0.7 to 0.8

0.8 renames configuration fields and trims the public API; the full table is in `CHANGELOG.md`. To update:

1. **Merge the files.** Run `node scripts/update-geospatial-map.mjs <your copy> --apply` from the source repository. It adds the new files (`config/`, `core/layers/`, …) and removes `config.ts`, `core/layer-factory.ts` and `map-status.tsx`; if you edited one of those, it tells you, and you move your change to the new file.
2. **Fix TypeScript errors.** Run your typecheck. Each error is a renamed field, type or prop; the table in `CHANGELOG.md` says what it became. The common ones: `ui.controlRail` → `ui.controls`, `ui.layers` → `ui.layerPanel`, `urlTemplate` → `url`, `dataProjection` → `sourceProjection`, top-level `time` → `ui.time`, `GeospatialMapConfigV1` → `MapConfig`, `theme.accentColor` → `theme.primary`.
3. **Fix stored JSON configurations.** Configurations from a CMS or an API aren't typechecked: run them through `validateMapConfig`. Every renamed or removed field comes back as an issue saying what to write instead, for example `ui.controlRail was renamed to ui.controls in 0.8.0`. Fix them at the source, or map the old names when you load them.
4. **Replace removed exports.** `initialMapState(view, layers, basemap)`: write the short form instead, `initialState: { view, activeBasemapId }`; the layer state is filled in. `normalizeMapConfig`: use `defineMapConfig`. `waitForMapReady` and `mapReadySelector`: import them from `testing.ts`. `useMap().layerState`: read `visible` and `opacity` from `useMap().layers`.
5. **Move removed slots to parts.** `slots.panelHeader`/`panelFooter` → compose with `<MapRoot>` and pass `header`/`footer` to the panel; `slots.loading`/`empty` → `<MapStatusChips loading empty>`; `slots.error` → children of `<MapErrorAlert>`. `renderCustomControl` → `customControls={{ 'custom:id': (context) => … }}`.
6. **Check what behaves differently:**
   - A selection in controlled `state` now opens the popup. If you kept a selection in state only for highlighting, also turn the popup off (`ui.popup.enabled: false`) or render `<MapPopup>` yourself.
   - `onError` now also receives export, location and `onOpenLayersMap` errors. If your handler assumed every error is a layer error, check `error.code`.
   - Values outside every class use `outOfRange`, not `missing`. Add an `outOfRange` class where values can fall outside the classes.
   - Point and line `opacity` now applies. If you set it and liked the result without it, remove it.
   - Layers can be moved in the layer panel unless `reorderable: false`.
   - CSS that targeted `.geo-shape-alert` or `[data-slot='map-error']` to place the error alert should target `.geo-error-alert`; `[data-slot='map-status']` is now `[data-slot='map-status-chips']`.

## 0.6 to 0.7

Nothing changes for existing code. The update adds `AGENTS.md`, `CLAUDE.md`, `docs/`, `examples/` and `testing.ts` to your copy. The examples are compiled by your typecheck along with the folder; if your lint or tsconfig rules reject them, delete `examples/` (or exclude it). To have agents anywhere in your app follow the folder's rules, add the one-line pointer from `README.md` → "If you use coding agents" to your root `AGENTS.md` or `CLAUDE.md`.

## 0.5 to 0.6

Run `node scripts/update-geospatial-map.mjs <your copy>` from the source repository. The default look is nearly unchanged; check these if you customised the styles or icons:

- **`icons.ts`** now exports `defaultMapIcons` (an object by role) instead of named `…Icon` re-exports. If you replaced icons there, put your components in the object. For one map or theme, use the new `icons` prop instead.
- **Select:** `ShapeSelect` renders inside `span.geo-shape-select-wrap`, which draws the chevron. Rules that set a select's width should target the wrapper. If you replaced `ShapeSelect` in `shapes.tsx`, nothing changes.
- **Slider:** drawn from `--geo-slider-*` tokens instead of the browser's slider. Rules on `.geo-shape-slider` that used `accent-color` should set `--geo-slider-on` and `--geo-slider-thumb-color`.
- **Hard-coded values became tokens.** If you overrode font sizes, radii, focus rings or blur with class rules, you can now set the token instead (see the token tables in `README.md`).
- **Filled icons** are no longer stroked. Set `--geo-icon-stroke` only for outline icon sets.

## 0.4 to 0.5

Run `node scripts/update-geospatial-map.mjs <your copy>` from the source repository to merge the update into your copy. Then check these behavior changes:

- **No projection picker.** Users can't change the projection any more. Remove `'projection'` from `ui.settings.fields` if you list it (validation rejects it), and remove any `<MapProjectionField>`. Set the projection with `initialState.view.projection`. The `projection`, `equalEarth`, `equalEarthArcgis` and `mercator` messages are gone.
- **Basemap field.** It is hidden when only one basemap supports the projection.
- **Starting view.** Without a starting zoom, the map opens on the whole world fitted to its size (`view.fitWorld`), instead of zoom 1.2 centred on [0, 20]. Give `initialState.view` a `zoom`, or set `view: { fitWorld: false }`, to keep the old view.
- **Selection.** GeoJSON layers are selectable without `featureIdField`. Add `selectable: false` to layers that shouldn't react to clicks.
- **Exports** keep the on-screen area, print the disclaimer under the map, and name the projection in the scale line.
- **Antimeridian.** Polygons and lines that cross the edge of the map are cut there. If you read geometry back from events, a crossing feature is a MultiPolygon or MultiLineString.
- **New options:** `arcgisBasemap`, `kind: 'arcgis-vector-tiles'`, style `layers` and `overrides`, `aboveOverlays`, more `data` forms (`rows`, CSV, ArcGIS feature layers and items, `format`, `longitude`, `latitude`), `fetchGeoJson`, optional `kind`/`role`/`title`/`style`, `ui.disclaimer` and `<MapDisclaimer>`, `slots.tooltip`, and `view.fitWorld`. See `CHANGELOG.md` in the folder.

## 0.3 to 0.4

Run `node scripts/update-geospatial-map.mjs <your copy>` from the source repository to merge the update into your copy. Then check these behavior changes:

- **A basemap by default.** Configs without `data.basemaps` now show `worldBasemap` (country outlines on water) instead of a blank background. Keep the old look with `basemaps: [plainBasemap]`.
- **Hover tooltip.** `<GeospatialMap>` shows the hovered feature's `name`, `title`, or `label`. Turn it off with `ui: { tooltip: { enabled: false } }`. Custom layouts built from `<MapRoot>` are unchanged until you add `<MapTooltip>`.
- **`diamond` points** are drawn as diamonds on the canvas. They used to be drawn as squares.
- **PNG and JPEG exports** paint the basemap's background colour behind the map.
- **New options:** `tileBasemap`, `var()` colours, `ui.popup.anchor`, `MapTooltip`, `useMapPixel`, `useHoveredFeature`, `onOpenLayersMap` / `getOpenLayersMap()`, `renderer`, and `cluster`. See `CHANGELOG.md` in the folder.

## 0.2 to 0.3

Existing full configurations keep working. Check these behavior changes:

- **Selection defaults on.** Layers that declare a `featureIdField` are now selectable unless they set `selectable: false`. Add `selectable: false` to reference layers that should not react to clicks.
- **`defineMapConfig` returns a normalized copy** with defaults filled in, not the same object you passed. Read `initialState` and other defaults from its return value.
- **Fewer resets.** Owned (uncontrolled) state resets only when `initialState` changes. Changing other config, such as styles, panels, or messages, no longer moves the map back to its starting view. A config rebuilt with the same content on every render is treated as unchanged.
- **New options:** the short config form, `fill`, `loadGeoJson`, and `GEOSPATIAL_MAP_VERSION`. See `CHANGELOG.md` in the folder.

## From the `@org/geospatial-map` npm package (0.1) to the copy-paste folder

The npm package build is gone. The source folder is the component.

| 0.1 package                                                                | Copy-paste folder                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm add @org/geospatial-map`                                             | Copy `packages/geospatial-map/src` into your app. Install `ol ol-mapbox-style proj4 typebox lucide-react` and `@types/geojson`. |
| `import … from '@org/geospatial-map'`                                      | `import … from '@/components/geospatial-map'` (or a relative path)                                                              |
| `import '@org/geospatial-map/styles.css'` (and an implicit import from JS) | `import '…/geospatial-map/geospatial-map.css'` once in the app entry. The JS no longer imports CSS.                             |
| `@org/geospatial-map/schema.json`                                          | `mapConfigSchema` export, or `pnpm schema` in the source repository                                                             |
| Inter bundled through `@fontsource-variable/inter`                         | The map inherits the app font. Set `--geo-font-family` to choose one.                                                           |
| `ol/ol.css` imported globally                                              | The few OpenLayers rules the map needs are scoped inside `geospatial-map.css`.                                                  |

The JSON configuration, `GeospatialMap` props, slots, callbacks, and the `ref` handle are unchanged. New in this release:

- `<MapRoot>` and the composable parts.
- `useMap()` and `useMapActions()`.
- `children` on `<GeospatialMap>`.
- `cellClassName` on `<MapGrid>`.
- The message keys `geographicHierarchy`, `publishedOn`, `nonOfficial`, and `tooManyGridMaps`.

### CSS variables

`config.theme` keys are unchanged. They now write these variables, and only when you set them, so your stylesheet can override the defaults.

| 0.1 variable                                                                              | Now                                                              |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `--geo-ink`                                                                               | `--geo-foreground`                                               |
| `--geo-muted`                                                                             | `--geo-muted-foreground` (`--geo-muted` is now the soft surface) |
| `--geo-surface`                                                                           | `--geo-background`                                               |
| `--geo-surface-soft`                                                                      | `--geo-muted`                                                    |
| `--geo-glass`                                                                             | `--geo-overlay`                                                  |
| `--geo-accent`                                                                            | `--geo-primary` (`--geo-accent` is now the hover surface)        |
| `--geo-accent-hover`                                                                      | `--geo-primary-hover`                                            |
| `--geo-danger`                                                                            | `--geo-destructive`                                              |
| `--geo-focus`                                                                             | `--geo-ring`                                                     |
| `--geo-border`, `--geo-radius`, `--geo-shadow`, `--geo-control-size`, `--geo-font-family` | unchanged                                                        |

### Classes

- The root density class `geo-density-compact` is now the attribute `data-density="compact"`.
- Rules that targeted elements inside panels (`.geo-legend h2`, `.geo-popup dl div`, …) now target explicit classes, such as `.geo-legend-heading` and `.geo-popup-field`.
  - Content you render in slots no longer inherits the map's heading and list styles. Style it from your own CSS.
- The switch markup has classes for its input, track, and label: `.geo-shape-switch-input`, `.geo-shape-switch-track`, `.geo-shape-switch-label`.

## From the legacy 0.1 props

This release intentionally removes the scattered component props.

| Legacy prop                                                          | New location                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| `id`, `ariaLabel`                                                    | `config.id`, `config.accessibility.ariaLabel`           |
| `defaultView`, `defaultBasemapId`, `defaultSelection`, `defaultTime` | `config.initialState`                                   |
| `view`, `activeBasemapId`, `selection`, `time`                       | controlled `state`                                      |
| `layers`, `basemaps`, `zoomTargets`, `hierarchy`                     | `config.data`                                           |
| `projectionBehavior`                                                 | `config.view.projectionBehavior`                        |
| `controls`                                                           | `config.ui` and its profile/panel/control policies      |
| `exportOptions`                                                      | `config.export`                                         |
| `timePlayback`                                                       | `config.time`                                           |
| `renderPopup`                                                        | `slots.popup`                                           |
| `children`                                                           | children of `<GeospatialMap>` or `<MapRoot>`, or a slot |
| `serialize()`, `getView()`                                           | `getState()`                                            |
| `setLayerStyle()`                                                    | `state.layers[layerId].style`                           |

Callbacks retain their names. Add `onStateChange` when the host needs one complete synchronized state contract.
