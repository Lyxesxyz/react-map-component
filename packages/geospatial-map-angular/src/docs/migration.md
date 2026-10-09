# Migration

## Angular starts at 0.10.0

The Angular folder is new in 0.10.0. There are no earlier Angular releases, so there is nothing to migrate inside Angular yet. Its configuration, state, events and actions are the same as the React folder's 0.10.0: a configuration that works in one works in the other, and both render the same elements, `geo-*` classes and `data-*` attributes.

To update your copy to a later release, run the update script from a clone of the source repository. It sees that the copy is the Angular folder (it has `map-root.ts`) and merges from it:

```sh
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map            # report
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map --apply    # three-way merge
```

Then read the `CHANGELOG.md` entries newer than your version.

## From the React folder to the Angular folder

To move a map from a React app to an Angular app:

1. **Copy the Angular folder.** Copy `packages/geospatial-map-angular/src` into the Angular app, for example to `src/app/geospatial-map`. Install `ol ol-mapbox-style proj4 typebox lucide` and `@types/geojson` (`lucide`, not `lucide-react`). Add `geospatial-map.css` to `styles` in `angular.json` (see [Angular CLI](./export-grid-integration.md#angular-cli)).
2. **Keep the configurations.** Configs are plain data, so `defineMapConfig({ … })`, `validateMapConfig(json)`, stored JSON, `mapInputSchema` and the basemap helpers carry over unchanged. Put a config in a constant or a class field of the component.
3. **Rewrite the components** with the table below. Props become inputs, callbacks become outputs, render functions become templates, and hooks become `inject*()` functions.
4. **Keep your CSS.** Token overrides and class rules work unchanged: the parts have the same `geo-*` classes and `data-*` attributes. Two things differ: a part's root is its own element (`<geo-map-legend class="geo-legend">`), so a rule that names an element (`div.geo-legend`) no longer matches, and a part with nothing to show keeps its empty element, with `display: none`. Keep the rules in a global stylesheet (`styles` in `angular.json`): a component's own `styles` are encapsulated and don't reach the parts.
5. **Port your swap points.** If you edited the React folder's shapes or icons, make the same changes in `shapes.ts` (directives and components with the same names) and `icons.ts` (`lucide` node lists or icon components).
6. **Keep your end-to-end tests.** Roles, labels, `data-slot` values and `data-status` are the same, and `waitForMapReady` works as before.

### Props, callbacks, and refs

| React                                                              | Angular                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `<GeospatialMap config={config} />`, `<MapRoot>`, `<MapGrid>`      | `<geo-map [config]="config" />`, `<geo-map-root>`, `<geo-map-grid>`                                     |
| `state` and `onStateChange={(state, change) => …}`                 | `[(state)]`, or `[state]` and `(stateChange)`; `(stateChangeDetails)` emits `{ state, change }`         |
| `openPanel` and `onOpenPanelChange`                                | `[(openPanel)]`                                                                                         |
| `onReady`, `onViewChange`, `onFeatureHover`, `onFeatureSelect`     | `(ready)`, `(viewChange)`, `(featureHover)`, `(featureSelect)`                                          |
| `onLayerStateChange`, `onTimeChange`, `onStatusChange`, `onMetric` | `(layerStateChange)`, `(timeChange)`, `(statusChange)`, `(metric)`                                      |
| `onError`                                                          | `(mapError)` (`error` is a DOM event name)                                                              |
| `fill`, `icons`, `loadGeoJson`                                     | `fill`, `[icons]`, `[loadGeoJson]`                                                                      |
| `onOpenLayersMap={(map) => …}`                                     | `[onOpenLayersMap]="hook"`, a function input (`MapOpenLayersHook`) that may return a cleanup            |
| `validate` and `renderConfigError` on `MapRoot`                    | `[validate]`, and `<ng-template geoMapConfigError let-error>` inside `<geo-map-root>`                   |
| `className`, `style`, `id`, `aria-*`                               | `class`, `style`, `id`, `aria-*` on the element                                                         |
| `ref` (`GeospatialMapHandle`)                                      | `#map="geoMap"` and `map.actions`, or `viewChild.required(GeospatialMap)().actions`                     |
| `ref` on a part                                                    | The part's element: `viewChild(MapLegend, { read: ElementRef })`                                        |
| `children` of `<GeospatialMap>` or `<MapRoot>`                     | Content of `<geo-map>` or `<geo-map-root>`                                                              |
| `'use client'`, `React.lazy`, `next/dynamic`                       | Nothing, `@defer`, a lazy route (see [Deferred loading](./export-grid-integration.md#deferred-loading)) |

### Slots and render props

| React                                                        | Angular                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slots.popup`, `<MapPopup>{(context) => …}</MapPopup>`       | `<ng-template geoMapPopup let-feature let-close="close" let-state="state" let-actions="actions">` in `<geo-map>` or `<geo-map-popup>`                        |
| `slots.tooltip`, `<MapTooltip>{(feature) => …}</MapTooltip>` | `<ng-template geoMapTooltip let-feature>` in `<geo-map>` or `<geo-map-tooltip>`                                                                              |
| `slots.controls['custom:share']`, `customControls`           | `<ng-template geoMapControl="custom:share" let-state let-actions="actions">` in `<geo-map>` or `<geo-map-controls>`; `[customControls]` takes `TemplateRef`s |
| `<MapErrorAlert>{(error) => …}</MapErrorAlert>`              | `<ng-template geoMapError let-error let-dismiss="dismiss">` in `<geo-map-error-alert>`                                                                       |
| `header` and `footer` on panels and the legend               | Content with `geoMapPanelHeader` or `geoMapPanelFooter`                                                                                                      |
| `loading` and `empty` on `MapStatusChips`                    | Content with `geoMapLoading` or `geoMapEmpty`                                                                                                                |
| `MapDisclaimer` children, `open` and `onOpenChange`          | Content of `<geo-map-disclaimer>`, `[(open)]`                                                                                                                |

Import the template directives you use (`MapPopupTemplate`, `MapTooltipTemplate`, `MapControlTemplate`, `MapErrorTemplate`, `MapConfigErrorTemplate`), or `GEO_MAP_PARTS`.

### Parts

| React                                                                                             | Angular                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `<MapControls>`, `<MapControlGroup>`                                                              | `<geo-map-controls>`, `<geo-map-control-group>`                                                                               |
| `<MapZoomInButton />`, `MapZoomOutButton`, `MapResetZoomButton`, `MapLocateButton`                | `<button geoMapZoomIn></button>`, `geoMapZoomOut`, `geoMapResetZoom`, `geoMapLocate`                                          |
| `MapLayersButton`, `MapSettingsButton`, `MapFitButton`, `MapFullscreenButton`                     | `geoMapLayers`, `geoMapSettings`, `geoMapFit`, `geoMapFullscreen`                                                             |
| An `onClick` on a built-in button that calls `event.preventDefault()`                             | `(beforeAction)` and `$event.preventDefault()`; a `(click)` runs after the action                                             |
| `<MapControlButton label="…">`                                                                    | `<button geoMapControl label="…">`                                                                                            |
| `<MapLayerPanel>`, `<MapSettings>`, `<MapLegend>`, `<MapPopup>`, `<MapTooltip>`                   | `<geo-map-layer-panel>`, `<geo-map-settings>`, `<geo-map-legend>`, `<geo-map-popup>`, `<geo-map-tooltip>`                     |
| `<MapTimeControls>`, `<MapStatusChips>`, `<MapErrorAlert>`, `<MapAttribution>`, `<MapDisclaimer>` | `<geo-map-time-controls>`, `<geo-map-status-chips>`, `<geo-map-error-alert>`, `<geo-map-attribution>`, `<geo-map-disclaimer>` |
| `<MapBasemapField>`, `<MapZoomTargetField onSelect>`, `<MapExportField>`                          | `<label geoMapBasemapField>`, `<label geoMapZoomTargetField (targetSelect)>`, `<label geoMapExportField>`                     |
| `<MapLegendSymbol entry={entry} />`                                                               | `<svg geoMapLegendSymbol [entry]="entry"></svg>`                                                                              |
| `<MapBreadcrumbs onTargetClick={(target, event) => …}>`                                           | `<geo-map-breadcrumbs (targetClick)="…">`: a `MapTargetClickEvent` with `target`, `source` and `preventDefault()`             |
| `MapGrid` callbacks with the map id last: `onViewChange(event, mapId)`                            | Outputs that emit `{ mapId, event }`: `(viewChange)`                                                                          |
| `MapGrid` `onStateChange(state, mapId, change)`                                                   | `(stateChange)` (the grid state, `[(state)]`) and `(stateChangeDetails)` (`{ state, mapId, change }`)                         |

Other props keep their names as inputs: `placement`, `allowOpacity`, `layout`, `expanded`, `compact`, `fields`, `anchor`, `speedsMs`, `targets`, `dismissible`, `cellClassName`, …

### Hooks, shapes, and icons

| React                        | Angular                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `useMap()`                   | `injectMap()`, a signal                                                                                                                 |
| `useMapStatic()`             | `injectMapStatic()`, a signal                                                                                                           |
| `useMapActions()`            | `injectMapActions()`                                                                                                                    |
| `useMapRuntime(select)`      | `injectMapRuntime(select)`, a signal                                                                                                    |
| `useMapIcons()`              | `injectMapIcons()`, a signal                                                                                                            |
| `useMapPixel(lonLat)`        | `injectMapPixel(() => lonLat)`                                                                                                          |
| `useHoveredFeature()`        | `injectHoveredFeature()`                                                                                                                |
| The shape components         | `shapes.ts`: `button[geoShapeButton]`, `<geo-shape-select>`, `[geoShapeCard]`, …; swap their bodies with `hostDirectives` or a template |
| `icons.ts` with lucide-react | `icons.ts` with `lucide` node lists, or any icon component                                                                              |
| The `icons` prop             | `[icons]` for one map, `provideMapIcons()` for an app or a route                                                                        |

Call the `inject*()` functions in a field initializer or the constructor of a component inside `<geo-map-root>` or `<geo-map>`.

## Configuration renames (both folders)

Configurations are shared by the React and Angular folders, so these renames apply to configs written for either, and to configs stored in a CMS. `validateMapConfig` reports every renamed or removed field with what to write instead, and TypeScript flags the same fields in a typed config. Rename them where the config is stored.

### 0.8 to 0.9

- Delete `role`, `zIndex`, `hitPriority`, `boundarySetId` and `geographyLevel` from layers. To list layers under headings, give them a `group`. Layers draw in the order of `data.layers`: to put a layer on top, move it to the end of the list.
- Rewrite `time`: `{ available: [...], mode: 'property', fieldOrParameter: 'year' }` becomes `{ values: [...], field: 'year' }`. Drop `mode`, `missingPolicy` and `prefetchFrames`. A WMS layer's `fieldOrParameter` becomes `field`; a URL with `{time}` needs nothing else.
- Replace `data.hierarchy` with `ui.breadcrumbs.targets`, the ids of the zoom targets on the path, and remove `parentId` and `geographyLevel` from zoom targets.
- Delete `view.projectionBehavior` and basemap `fallbackFor`; pick the projection with `initialState.view.projection`. Delete basemap `network`.
- `ui.legend.defaultOpen` becomes `ui.legend.expanded`.
- `ui.layerPanel.groupBy: 'role'` becomes `'group'` or `'none'`.
- `selectable`, `featureIdField` and `propertyAllowlist` on raster or heatmap layers did nothing; delete them. Move `aboveOverlays` from your layers to the basemap's layers.
- Remove the `projectionChanged` and `network` messages from your dictionaries. A `messages` key that isn't a message is now an error.

What a 0.9 config does differently:

- A map with time layers and no `initialState.time` starts at the first frame. `initialState: { time: null }` starts with no frame.
- A layer is hidden while the map shows a frame it doesn't have. To keep a layer visible at every frame, give it every frame, or no `time`.
- With the `embedded` profile, the layer panel is off; turn it on with `ui: { profile: 'embedded', layerPanel: { enabled: true } }` and a `'layers'` control.
- Vector tile layers with a `featureIdField` are selectable by default. Heatmaps are never selectable.

### 0.7 to 0.8

| 0.7                                                              | 0.8                                                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ui.controlRail`                                                 | `ui.controls`                                                                     |
| `ui.layers`                                                      | `ui.layerPanel`                                                                   |
| `ui.hierarchy`                                                   | `ui.breadcrumbs`                                                                  |
| `ui.errors`                                                      | `ui.errorAlert`                                                                   |
| `ui.status`                                                      | `ui.statusChips`                                                                  |
| `time` (top level)                                               | `ui.time`                                                                         |
| `accessibility.keyboard`                                         | `view.interactions.keyboard`                                                      |
| `time.reducedMotion`                                             | `accessibility.reducedMotion`                                                     |
| `initialState.view.minZoom`, `maxZoom`                           | `view.minZoom`, `view.maxZoom`                                                    |
| layer `urlTemplate` (`mvt`, `xyz`)                               | `url`                                                                             |
| layer `dataProjection` (`geojson`, `heatmap`)                    | `sourceProjection` (and `sourceProjectionDefinition`)                             |
| ArcGIS layer `styleUrl`, `styleLayers`, `styleOverrides`         | `mapboxStyle: { url, layers, overrides }`, as on `mvt` layers                     |
| ArcGIS layer `projection`, `arcgisBasemap({ projection })`       | `sourceProjectionDefinition`                                                      |
| `orderLocked: true`                                              | `reorderable: false`                                                              |
| `theme.accentColor`, `textColor`, `surfaceColor`, …              | token names: `primary`, `foreground`, `background`, `muted`, `mutedForeground`, … |
| `GeospatialMapConfigV1`, `MapGridConfigV1`, `VectorTileGridSpec` | `MapConfig`, `MapGridConfig`, `TileGridSpec`                                      |

What a 0.8 config does differently:

- Values outside every class of a graduated or continuous style use `outOfRange`, not `missing`. Add an `outOfRange` class where values can fall outside the classes.
- Point and line `opacity` applies.
- Layers can be moved in the layer panel unless `reorderable: false`.
- A selection in controlled `state` opens the popup. If you keep a selection only for highlighting, turn the popup off (`ui.popup.enabled: false`).
