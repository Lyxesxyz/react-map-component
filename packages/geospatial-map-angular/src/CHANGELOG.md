# Changelog

This folder is copied into apps rather than installed, so this file travels with it. `GEOSPATIAL_MAP_VERSION` in `version.ts` says which version your copy is.

To update a copy, run the update script from a clone of the source repository. It does a three-way merge, so your own edits are kept:

```sh
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map            # report only
node scripts/update-geospatial-map.mjs path/to/your/geospatial-map --apply    # write changes
```

Each entry lists the files it touches, so you can also copy them over by hand.

## 0.11.1

0.11.0 was built against an offline stand-in of Esri's World Basemap. Checked against the live service, the basemap reprojected to Equal Earth stalled while zooming and showed faint lines along tile edges over the sea, and the map asked ArcGIS services for zoom levels they have no tiles for. This release fixes those, and documents the limits that remain.

### Changed (check these when updating)

- **A reprojected basemap reads its tiles with `fetch()`** instead of `XMLHttpRequest` (a basemap drawn in another projection than its service's, such as the default Esri basemap in Equal Earth). The URLs are the same. A test setup that answers `fetch` for the basemap's service (as jsdom setups do) now also gets its tile requests: answer them, or let them fail and the map shows the fallback.

### Fixed

- **Zooming a reprojected basemap no longer stalls the map.** OpenLayers reprojected every vertex of the tiles each time it drew them at a new zoom level, once for the basemap and once for its labels: up to 3 seconds without a frame per zoom step on a fast laptop. Each tile is now reprojected once, when it is read. With the same pans and zooms, the time the page was blocked fell from 16 to 3 seconds and the longest frame from 3,067 to 234 ms, as in Web Mercator.
- **No lines along the edges of reprojected tiles.** Where the service's tiles met along a curved meridian, a faint lighter line showed over the sea: the later tile's shallow water, under its deep water, came through its anti-aliased edge. The map now puts each of its tiles together from the service's tiles and draws it one style layer at a time. Roads crossing those edges also draw their casings under their fills, as in Web Mercator.
- **No tiles asked for past a service's last level.** ArcGIS vector tile services list zoom levels past the last one they have tiles for (Esri's World Basemap lists 22 and has tiles to 16, its `maxLOD`). The map asked for those levels; Esri's servers make them from level 16, but a service that doesn't would fail them, and the map would switch to its fallback when zoomed in. The map now reads tiles up to `maxLOD` and draws the deeper levels from them, as ArcGIS's own maps do: 4 tiles instead of 12 for a street at zoom 20.
- **`maxSourceZoom` of an `mvt` layer with a `tileGrid`** is honoured: OpenLayers ignored it, and asked for every level of the grid.

### Documented

- The limits of a basemap reprojected to Equal Earth, measured on the live service: the polar caps show the map's `--geo-basemap-water` colour, not the basemap's sea; near the poles the map loads more and more detailed tiles (one level deeper than Web Mercator from about 60°, three at Svalbard); the Esri basemap's labels use Arial only, so its style loads no web fonts.

### Inside (for people who read the code)

- `core/layers/vector-tile-layer.ts`: `reprojectedTileSource()`, a source in the map's projection whose 256-pixel tiles are put together from the service tiles they cover. `OverlapFormat` reads each service tile once (clipped to the tile and a pixel past it, densified, and moved into the map's projection), and the source keeps 256 of them for the neighbouring tiles. A tile of the map holds the lines and areas within 100 pixels of it (OpenLayers' render buffer, for wide strokes) and the points inside it, and any failure while it is put together fails it. It replaces `OverlappingTileGrid` and OpenLayers' own reprojection of vector tiles. `lastSourceLevel()` cuts a tile grid at `maxSourceZoom`.
- `core/http.ts`: `fetchBytes()`, which reads the service tiles with the same errors as `fetchText()`.
- `core/arcgis.ts`: `maxSourceZoom` is the service's `maxLOD` when it has one.

### Files changed

Changed: `version.ts`, `core/arcgis.ts`, `core/http.ts`, `core/layers/vector-tile-layer.ts`, `README.md`, `docs/troubleshooting.md`.

## 0.11.0

The default basemap is now Esri's World Basemap, drawn in Equal Earth by reprojecting its tiles in the browser, with the bundled world outlines as its fallback when it can't be loaded. Any ArcGIS basemap can be drawn in other projections than its service's, and any basemap can name a fallback.

### Changed (check these when updating)

- **The default basemap.** A configuration that lists no `data.basemaps` gets `[esriWorldBasemap, worldBasemap]` instead of `[worldBasemap]`. The map starts on Esri's World Basemap (land, water, borders and place names, with labels and borders above your data), which the user's browser loads from `https://basemaps.arcgis.com`. For each map that relies on the default, check that:
  - users' browsers can reach `basemaps.arcgis.com`, and a Content-Security-Policy allows it in `connect-src` and `img-src`;
  - Esri's terms of use allow your use (the attribution bar shows the service's copyright text);
  - end-to-end tests without network access expect the fallback, or route the service's requests.

  When the service, its style or its tiles can't be loaded, the map shows the World outlines instead, quietly: no error alert, no `(mapError)`, no `data-layer-errors`, and one `[geospatial-map]` console hint. A network that drops the requests without answering holds the map for up to 10 seconds before it switches. To keep the 0.10 default, list `basemaps: [worldBasemap]`. A configuration that lists its own basemaps is unchanged.

- **The settings panel shows the basemap field** on maps with the default basemaps, since two basemaps now support the map's projection. Leave `'basemap'` out of `ui.settings.fields` to hide it.

### Added

- **`esriWorldBasemap`** (id `esri-world`, title "Esri World Basemap"): Esri's World Basemap (v2) vector tile service, drawn in Equal Earth and Web Mercator, with `worldBasemap` (id `world`) as its fallback, so a list with it needs `worldBasemap` too. Exported from `index.ts`.
- **`fallbackBasemapId`** on a basemap (`BasemapConfig`, the JSON Schemas), and as an option of `arcgisBasemap()` and `tileBasemap()`: another basemap of `data.basemaps`, shown when this one can't be loaded (its ArcGIS service can't be read, its style fails, or none of the tiles of one of its layers load). When the fallback supports the map's projection, the map switches quietly, with one console hint; a switch after the map started, or at the start for a host that controls `state` and names the failed basemap, reaches `state.activeBasemapId` and `(stateChange)` (domain `basemap`). `validateMapConfig` rejects a fallback that names no basemap of the list, or the basemap itself.
- **`projections`** option of `arcgisBasemap()`: the projections to draw the basemap in. In a map of another projection than the service's, its vector tiles are reprojected in the browser, and the style's zoom-dependent layers switch at about the same scales as in the service's projection. Web Mercator tiles stop at about 85° north and south, so in Equal Earth the polar caps show the water colour. Only basemaps are reprojected: an ArcGIS vector tile layer in `data.layers` must still be in the map's projection.
- **Time limits** for reading an ArcGIS service or item (10 seconds) and a vector tile style (30 seconds). A request that takes longer fails with `… did not answer in time`, instead of leaving the map loading until the browser gives up.

### Inside (for people who read the code)

- `core/arcgis.ts`: `arcgisFallback()` (the configuration to show when ArcGIS services can't be read: the ArcGIS layers dropped, failed basemaps replaced by their fallbacks, the error to report, `null` when only replaced basemaps failed, and the replaced basemaps) and `arcgisServiceError()`. `arcgis-config.ts` uses them, as `use-arcgis-config.ts` does in the other folder, and `map-engine.ts` passes the replaced basemaps to the controller (`replacedBasemaps`), which shows the replacement for a controlled state that names one and tells the engine once.
- `core/map-controller.ts` switches to the fallback when a layer of the active basemap fails (the new `recover` callback of `LayerRegistry`), and tells the engine through `onBasemapChange`; `map-bridges.ts` proposes it as a basemap change.
- `core/projections.ts` (`registerReprojection`) and `core/layers/vector-tile-layer.ts` draw vector tiles in another projection: no wrapped copies of the world; each tile's lines and areas clipped to the tile (reaching one pixel past it, so no seam shows), with vertices added along long edges so they follow their curve, and areas outlined only along their own edges; and the style's zoom levels scaled to the map's units (tiles drawn in their own projection keep the tile grid's, as before). A vector tile layer with a style counts as loading until the style is applied.
- `core/http.ts`: `withTimeout()`, `SERVICE_TIMEOUT_MS`, `STYLE_TIMEOUT_MS`.

### Files changed

Changed: `basemaps.ts`, `types.ts`, `index.ts` (exports `esriWorldBasemap`), `arcgis-config.ts`, `map-engine.ts`, `map-bridges.ts`, `version.ts`, `config/normalize.ts`, `config/schema.ts`, `config/validate.ts`, `core/arcgis.ts`, `core/http.ts`, `core/layer-registry.ts`, `core/map-controller.ts`, `core/projections.ts`, `core/vector-style.ts`, `core/layers/vector-tile-layer.ts`, `README.md`, `AGENTS.md`, `docs/configuration.md`, `docs/getting-started.md`, `docs/layers-and-legends.md`, `docs/troubleshooting.md`, `docs/migration.md`, `docs/export-grid-integration.md`.

## 0.10.0

The first release of the Angular folder: the geospatial map for Angular 21 and 22, with the same features as the React folder. It is released together with the React folder's 0.10.0 and shares its engine, so a configuration, a stylesheet or a theme works the same in both.

### Added

- **`<geo-map>`**, the ready-made layout from `config.ui`, and **`<geo-map-grid>`**, up to six synchronised maps.
- **`<geo-map-root>` and every part**, for your own layout: the control rail and its buttons (`<button geoMapZoomIn>`, …), the layer panel, settings and its fields, legend, popup, tooltip, time controls, breadcrumbs, status chips, error alert, disclaimer and attribution. They are standalone `OnPush` components with signal inputs and outputs. `GEO_MAP_PARTS` lists them all for `imports`.
- **Templates** for your content, with typed contexts: `geoMapPopup`, `geoMapTooltip`, `geoMapControl="custom:…"`, `geoMapError` and `geoMapConfigError`. Projected `geoMapPanelHeader`, `geoMapPanelFooter`, `geoMapLoading` and `geoMapEmpty` replace or add panel content.
- **Two-way bindings and actions:** `[(state)]`, `[(openPanel)]` and the disclaimer's `[(open)]`; the actions through `#map="geoMap"`, `viewChild.required(GeospatialMap)().actions` or `injectMapActions()`.
- **Injection functions for custom parts:** `injectMap()`, `injectMapStatic()`, `injectMapRuntime(select)`, `injectMapActions()`, `injectMapIcons()`, `injectMapPixel()`, `injectHoveredFeature()` and `injectSlotContext()`, plus `anchoredPosition()` to place an overlay next to a point.
- **Icons** from `lucide` (the framework-neutral package): any lucide icon, a node list from another set (with its own `['svg', attributes]` entry), or an icon component. Override them in `icons.ts`, with `provideMapIcons()` for an app or a route, or with `[icons]` on one map. `<geo-map-icon>` draws one in a custom part.
- **`shapes.ts`**, the design-system swap point, as directives (`button[geoShapeButton]`, `[geoShapeCard]`, …) and components (`<geo-shape-select>`, `label[geoShapeSwitch]`), ready for `hostDirectives` or your own templates.
- **Zoneless and zone.js.** The map updates the page by writing signals and runs OpenLayers outside Angular's zone. It uses no `ChangeDetectorRef`, RxJS, `@angular/forms` or CDK.
- **Server rendering.** The server renders an accessible shell; OpenLayers starts in the browser.
- **Guides:** `README.md`, `AGENTS.md` and `CLAUDE.md` for coding agents, eight guides in `docs/`, and an example per common task in `examples/`.

### Shared with the React folder

The engine is the React folder's 0.10.0, which behaves as its 0.9.0: these files are the same in both folders, byte for byte.

- `core/` (OpenLayers), `config/` (schema, defaults, validation, UI profiles), `types.ts`, `map-bridges.ts`, `map-state.ts`.
- `basemaps.ts`, `world-data.ts`, `messages.ts`, `theme.ts`, `utils.ts`, `testing.ts`, `version.ts`.
- `geospatial-map.css`: the same `geo-*` classes, `data-*` attributes and `--geo-*` tokens. The parts render the same elements, roles and labels as the React parts, so themes written for one version restyle the other.
- `examples/symbology-layers.ts`, `examples/map-ready-check.ts`, `examples/brand-theme.css`.

The configuration uses the 0.9 field names; `validateMapConfig` names the replacement for an older one. The fixes listed for 0.9.0 and earlier in the React folder's changelog are in this release.

### Differences from the React version

- **Outputs instead of callbacks.** `(featureSelect)` for `onFeatureSelect`, and so on. React's `onError` is `(mapError)`, because `error` is a DOM event name. `(stateChange)` emits the state (for `[(state)]`) and `(stateChangeDetails)` emits `{ state, change }`. The area field's `onSelect` is `(targetSelect)`.
- **Templates instead of render functions and slots.** `slots.popup` and `<MapPopup>{(context) => …}</MapPopup>` are a `geoMapPopup` template; `slots.controls` and `customControls` are `geoMapControl` templates; `renderConfigError` is a `geoMapConfigError` template; `header` and `footer` props are projected content.
- **Cancelling a built-in button.** React's "`onClick` that calls `preventDefault()`" is `(beforeAction)`, which emits a `MapActionEvent` before the action; a template `(click)` runs after the action. The breadcrumbs' `onTargetClick(target, event)` is `(targetClick)`, a `MapTargetClickEvent` with `target` and `source`.
- **`<geo-map-grid>` outputs** emit `{ mapId, event }`, where React's callbacks take the map id as their last argument.
- **No hint for `(featureSelect)` without selectable layers.** Angular can't tell whether an output has a listener, so the React hint "onFeatureSelect is set, but no layer is selectable" is not logged.
- **Parts that have nothing to show** (no selection, no error, a closed panel) keep their empty element, hidden, where React renders nothing. A bound `[style.display]` on such a part shows it.
- **Icons.** lucide node icons get lucide's attributes but not its `lucide lucide-*` classes, and the `<geo-map-icon class="geo-icon">` wrapper has `display: contents`. Node lists that start with `['svg', attributes]` are Angular-only.
- **The breadcrumbs** carry `role="navigation"` on their element, for React's `<nav>`. `<geo-map-disclaimer>` takes `title` as an input, so the element never has a `title` attribute.
- `injectMapIcons()` outside a map returns the app's icons (`icons.ts` and `provideMapIcons()`), like React's `useMapIcons()`.

### Files changed

New: every file of the folder. The Angular files are `index.ts`, `component-types.ts`, `geospatial-map.ts`, `map-grid.ts`, `map-root.ts`, `map-engine.ts`, `arcgis-config.ts`, `world-fit.ts`, `map-context.ts`, `signals.ts`, `map-anchor.ts`, `map-templates.ts`, `map-action-event.ts`, `map-icon.ts`, `icons.ts`, `shapes.ts`, the parts (`map-controls.ts`, `map-layer-panel.ts`, `map-settings.ts`, `map-legend.ts`, `map-popup.ts`, `map-tooltip.ts`, `map-time-controls.ts`, `map-breadcrumbs.ts`, `map-status-chips.ts`, `map-error-alert.ts`, `map-disclaimer.ts`, `map-attribution.ts`), `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/*.md` and the Angular `examples/*.ts`.
