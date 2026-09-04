# Geospatial Map Component Requirements

## 1. Purpose

The geospatial map component will be embedded in an indicator page and will visualize one or more indicator datasets against geographic boundaries. It must support global, regional, national, and subnational views; vector and raster data; user interaction; time-series playback; map grids; and report-ready export.

The component is a frontend visualization library. Data acquisition, geocoding, boundary matching, geometry repair, reprojection, simplification, tile generation, and authorization are data-service or preprocessing responsibilities. This document defines the contracts those systems must satisfy so the map can render their outputs consistently.

## 2. Goals

The component must:

- Render vector and raster geospatial layers on indicator pages.
- Support multiple indicators, boundaries, and thematic layers on one map.
- Remain usable from global scale through Admin 2 or equivalent local detail.
- Use Equal Earth for global thematic views and Web Mercator where local detail or web tile compatibility requires it.
- Provide declarative symbology, legends, selection, drill-down, popups, time animation, and export.
- Perform well for public, high-traffic websites.
- Expose a stable React API and structured events without exposing mapping-library internals.

## 3. Non-goals

The initial component will not:

- Act as a GIS editor or allow users to modify source geometry.
- Geocode place names or infer boundaries in the browser.
- Repair invalid data or resolve ambiguous place-to-boundary matches.
- Define data licensing or publication policy.
- Provide unrestricted, professional cartographic authoring comparable to desktop GIS software.
- Guarantee vector-native SVG export when raster, web-tile, or canvas-only layers are visible.
- Operate its own tile server, spatial database, or indicator API.

## 4. Terminology

- **Admin 0**: country or equivalent top-level territory.
- **Admin 1**: first-level subdivision, such as a state, province, or region.
- **Admin 2**: second-level subdivision, such as a district or county.
- **Boundary set**: a versioned collection of geographic features using a consistent authority and hierarchy.
- **Indicator layer**: geographic data linked to an indicator and its values.
- **Reference layer**: contextual data such as boundaries, cities, roads, or labels.
- **Canonical view**: projection-independent center, zoom, rotation, and selected extent used to preserve map state when projection changes.
- **Level of detail (LOD)**: geometry, tiles, labels, or styling selected for a particular zoom or resolution.

## 5. Priority definitions

- **Must**: required for the first production-capable release.
- **Should**: expected after the core release unless product validation changes the priority.
- **Could**: useful extension that must not complicate the core API prematurely.

## 6. Functional requirements

### 6.1 Component integration

| ID     | Priority | Requirement                                                                                                                                         |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-01 | Must     | The map must be distributed as a reusable React component with TypeScript types.                                                                    |
| INT-02 | Must     | The public API must be declarative: inputs describe view state, layers, styles, legends, time state, selection, and controls.                       |
| INT-03 | Must     | The component must support controlled and uncontrolled view, selection, layer visibility, layer order, symbology, and time state where appropriate. |
| INT-04 | Must     | The component must be safe to render in server-rendered React applications, initializing browser-only map behavior after mount.                     |
| INT-05 | Must     | The component must resize correctly when its container changes size or becomes visible after initially being hidden.                                |
| INT-06 | Must     | Mapping-engine objects must remain internal; application code must communicate through library-owned types and events.                              |
| INT-07 | Should   | The implementation should keep a framework-neutral core so another framework adapter can be added without duplicating map behavior.                 |

### 6.2 Supported projections and view state

| ID      | Priority | Requirement                                                                                                                                             |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROJ-01 | Must     | The component must support Equal Earth (`EPSG:8857`) for global thematic visualization.                                                                 |
| PROJ-02 | Must     | The component must support Web Mercator (`EPSG:3857`) for local detail and compatible web-tile services.                                                |
| PROJ-03 | Must     | Projection changes must preserve a canonical longitude/latitude center and a projection-independent zoom as closely as possible.                        |
| PROJ-04 | Must     | Applications must be able to select the projection explicitly.                                                                                          |
| PROJ-05 | Should   | Applications may enable automatic projection switching using configurable zoom thresholds with hysteresis to avoid repeated switching near a threshold. |
| PROJ-06 | Must     | Unsupported source/projection combinations must produce a structured error or warning rather than silently displaying incorrect geometry.               |

Suggested default for automatic switching: use Equal Earth below canonical zoom `3.5`, retain the current projection between `3.5` and `4`, and use Web Mercator at zoom `4` or above.

### 6.3 Vector layers

| ID     | Priority | Requirement                                                                                                                            |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| VEC-01 | Must     | The component must render point, line, polygon, and multi-part vector geometry.                                                        |
| VEC-02 | Must     | The component must accept GeoJSON feature collections with a declared source CRS or a documented default of WGS 84 longitude/latitude. |
| VEC-03 | Must     | The component must support vector tiles for large or detailed datasets.                                                                |
| VEC-04 | Must     | Multiple vector layers and multiple attributes or indicators must be displayable on one map.                                           |
| VEC-05 | Must     | A vector layer must define stable feature identifiers when selection, popup, drill-down, or data joining is enabled.                   |
| VEC-06 | Must     | Vector features must support zoom-dependent visibility and styling.                                                                    |
| VEC-07 | Should   | Large point datasets should support clustering, aggregation, or server-generated tiles.                                                |
| VEC-08 | Should   | Line and polygon rendering should support simplified geometries selected by zoom level.                                                |

### 6.4 Raster layers

| ID     | Priority | Requirement                                                                                                                            |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| RAS-01 | Must     | The component must render raster tile layers from XYZ, WMS, or WMTS sources.                                                           |
| RAS-02 | Must     | Multiple raster layers must be separately addressable and independently toggled by filters or layer controls.                          |
| RAS-03 | Must     | Raster layers must support opacity, blend order, attribution, visible zoom range, and time parameters where provided by the source.    |
| RAS-04 | Must     | The component must reproject supported raster sources when technically valid, or report an unsupported combination.                    |
| RAS-05 | Should   | Raster rendering should support source-provided overviews or pyramids so an appropriate resolution is loaded for the current zoom.     |
| RAS-06 | Should   | The API should allow a raster color ramp and value range to be represented in the legend even when pixel styling occurs on the server. |

### 6.5 Layers, boundaries, and ordering

| ID     | Priority | Requirement                                                                                                                                          |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAY-01 | Must     | Users must be able to view available layers, turn each permitted layer on or off, and distinguish indicator layers from reference layers.            |
| LAY-02 | Must     | Users must be able to change the display order of reorderable layers.                                                                                |
| LAY-03 | Must     | The application must be able to lock required layers, constrain their order, or hide them from the layer control.                                    |
| LAY-04 | Must     | The component must support multiple versioned boundary sets, including Admin 0, Admin 1, Admin 2, cities, and application-defined sets.              |
| LAY-05 | Must     | Boundary sets must be switchable; overlaying more than one set must be an explicit application choice.                                               |
| LAY-06 | Must     | Each boundary layer must expose source, version, license, attribution, geographic level, and stable feature-key metadata.                            |
| LAY-07 | Must     | The component must not infer that similarly named areas from different boundary sets are equivalent. The data service must provide stable join keys. |
| LAY-08 | Should   | The layer control should support logical groups, mutually exclusive layers, and scale-dependent availability.                                        |
| LAY-09 | Should   | The component should show a clear state when a layer has no data at the current time, extent, or geographic level.                                   |

### 6.6 Symbology and legends

| ID     | Priority | Requirement                                                                                                                                             |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SYM-01 | Must     | Point symbology must support attribute-driven size, shape, fill color, stroke color, stroke width, opacity, and labels.                                 |
| SYM-02 | Must     | Line symbology must support attribute-driven color, width, opacity, and dash pattern.                                                                   |
| SYM-03 | Must     | Polygon symbology must support attribute-driven fill color, fill opacity, outline color, outline width, and dash pattern.                               |
| SYM-04 | Must     | Symbology rules must be declarative, serializable, and independent of OpenLayers classes.                                                               |
| SYM-05 | Must     | Styles must support categorical, graduated, and continuous mappings using metadata or service-defined rules.                                            |
| SYM-06 | Must     | Styles must support explicit missing, suppressed, not-applicable, and out-of-range value states.                                                        |
| SYM-07 | Must     | Symbol size and stroke width must support configurable behavior across zoom levels, including fixed screen size and scale-dependent size.               |
| SYM-08 | Must     | Every thematic layer must be able to provide structured legend metadata and a visual legend.                                                            |
| SYM-09 | Must     | Legends must update when layer visibility, active indicator, time, classification, units, or symbology changes.                                         |
| SYM-10 | Must     | The legend must be included in report-ready exports when requested.                                                                                     |
| SYM-11 | Should   | Users should be able to choose from application-approved palettes, classification methods, class counts, symbol sets, and value ranges.                 |
| SYM-12 | Should   | Applications should be able to constrain which symbology controls are editable for a particular indicator.                                              |
| SYM-13 | Should   | Color palettes should have accessible, color-vision-deficiency-aware options and must not rely on color alone when another visual channel is practical. |

### 6.7 Dynamic scaling and level of detail

| ID     | Priority | Requirement                                                                                                                               |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| LOD-01 | Must     | Each layer must support minimum and maximum zoom or resolution.                                                                           |
| LOD-02 | Must     | The component must support different source detail, feature density, label density, and symbology by zoom level.                          |
| LOD-03 | Must     | Zooming must not require loading a full-resolution global boundary dataset into the browser.                                              |
| LOD-04 | Must     | The source contract must allow simplified GeoJSON, vector tiles, raster pyramids, or service-side generalization to be selected by scale. |
| LOD-05 | Must     | Transitions between LODs must preserve layer identity, selection, and indicator values.                                                   |
| LOD-06 | Should   | The component should avoid visual jumps by using compatible styles and bounded transition durations between LODs.                         |

### 6.8 Navigation, predefined areas, and drill-down

| ID     | Priority | Requirement                                                                                                                            |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| NAV-01 | Must     | The map must support pan, wheel or gesture zoom, zoom controls, keyboard navigation, and touch interaction.                            |
| NAV-02 | Must     | Applications must be able to define named zoom targets for countries, regions, cities, or arbitrary extents.                           |
| NAV-03 | Must     | Selecting a predefined target must fit its extent with configurable padding, maximum zoom, and animation duration.                     |
| NAV-04 | Must     | The map must provide a command to fit all currently selected data or features.                                                         |
| NAV-05 | Must     | Hierarchical navigation must support `Admin 0 → Admin 1 → Admin 2` and reverse navigation when parent-child identifiers are supplied.  |
| NAV-06 | Must     | Breadcrumbs or equivalent UI must communicate the current hierarchy and allow returning to an ancestor.                                |
| NAV-07 | Must     | The component must preserve explicit application filters while drilling through geographic levels unless the application changes them. |
| NAV-08 | Should   | Applications should be able to configure whether selection also changes the viewport or hierarchy level.                               |

### 6.9 Selection, highlighting, popups, and events

| ID     | Priority | Requirement                                                                                                                                                                                                           |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEL-01 | Must     | Users must be able to click or tap a selectable point, line, polygon, or region.                                                                                                                                      |
| SEL-02 | Must     | The component must emit a structured selection event containing the layer ID, feature ID, boundary-set ID, geographic level, source properties permitted by configuration, coordinate, and original interaction type. |
| SEL-03 | Must     | The application must be able to provide associated statistics asynchronously after selection.                                                                                                                         |
| SEL-04 | Must     | A selected feature or boundary must remain visibly highlighted until cleared or replaced.                                                                                                                             |
| SEL-05 | Must     | The application must be able to control selection from external filters and highlight the corresponding boundary polygon.                                                                                             |
| SEL-06 | Must     | Popup content must be defined by the application using an allowlist of fields or a render callback; arbitrary source HTML must not be injected.                                                                       |
| SEL-07 | Must     | Popups must support loading, success, no-data, and error states for asynchronous statistics.                                                                                                                          |
| SEL-08 | Must     | The component must emit documented events for view changes, feature hover, feature selection, selection clearing, layer visibility, layer order, symbology, time, projection, loading, and errors.                    |
| SEL-09 | Must     | Overlapping selectable layers must use a documented hit-priority rule or present the available choices to the user.                                                                                                   |
| SEL-10 | Should   | Hover highlighting may be enabled for pointer devices but must not be required to access information.                                                                                                                 |

### 6.10 Time-series visualization

| ID      | Priority | Requirement                                                                                                                                             |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TIME-01 | Must     | Vector and raster layers must be able to declare available time instants or intervals.                                                                  |
| TIME-02 | Must     | The map must support selecting a time value and updating all time-linked layers consistently.                                                           |
| TIME-03 | Must     | The component must support play, pause, previous, next, replay, and configurable playback speed.                                                        |
| TIME-04 | Must     | The active time and units must be visible and announced accessibly.                                                                                     |
| TIME-05 | Must     | Frames should be prefetched within configurable memory and network limits to reduce flicker.                                                            |
| TIME-06 | Must     | Playback must pause or clearly report when a required frame fails; it must not silently show data from inconsistent times.                              |
| TIME-07 | Must     | Time changes must emit events so the indicator page, legend, statistics, and URL state can stay synchronized.                                           |
| TIME-08 | Should   | Applications should be able to choose whether layers without data for the active time are hidden, marked unavailable, or retain their last valid frame. |

### 6.11 Small multiples: 3 × 2 map grid

| ID      | Priority | Requirement                                                                                                                                                |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GRID-01 | Must     | The library must provide or support composition into a grid of up to six map views arranged as three columns by two rows at the target desktop breakpoint. |
| GRID-02 | Must     | Each cell must identify its region and expose the same loading, no-data, error, legend, attribution, and interaction states as a single map.               |
| GRID-03 | Must     | The grid must support shared indicator, time, layer, and symbology state.                                                                                  |
| GRID-04 | Must     | Each cell must support an independent region extent while synchronized navigation is optional and configurable.                                            |
| GRID-05 | Must     | Selection events must identify the originating grid cell.                                                                                                  |
| GRID-06 | Must     | On narrow screens, the grid must reflow without making controls or map content unusable.                                                                   |
| GRID-07 | Should   | Expensive sources and styles should be shared or cached across cells where the mapping engine and browser permit it.                                       |
| GRID-08 | Should   | A cell should be expandable into a focused single-map view.                                                                                                |

### 6.12 Export and embedding

| ID     | Priority | Requirement                                                                                                                                                                       |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXP-01 | Must     | The component must export the current composed view as PNG and JPEG.                                                                                                              |
| EXP-02 | Must     | An export may include title, subtitle, active time, legend, attribution, source note, scale, and selected-area label in a report-ready layout.                                    |
| EXP-03 | Must     | Export must wait for required visible sources and fonts to finish loading or fail with a structured timeout/error report.                                                         |
| EXP-04 | Must     | Export output size and pixel ratio must be configurable independently of the on-screen map size, within documented browser limits.                                                |
| EXP-05 | Must     | If cross-origin sources prevent canvas export, the component must identify the blocking layer and explain the required CORS configuration.                                        |
| EXP-06 | Should   | SVG export should be supported when every visible layer and symbol can be serialized as vector content.                                                                           |
| EXP-07 | Should   | When exact vector SVG is impossible, the API may generate an SVG report wrapper containing the rasterized map plus vector text and legend, and must label the result accordingly. |
| EXP-08 | Must     | The application must be able to generate reusable embed configuration for an approved map state.                                                                                  |
| EXP-09 | Must     | Embed output must use a versioned configuration and an approved host or script URL; it must not serialize credentials, private URLs, callbacks, or unrestricted HTML.             |
| EXP-10 | Should   | The preferred public embed should be an iframe or small loader snippet that references a server-stored configuration ID, allowing revocation and version management.              |

### 6.13 Attribution and official-use metadata

| ID     | Priority | Requirement                                                                                                                                                                        |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATT-01 | Must     | Attribution for every visible source must be displayed on screen and retained in exports where the source license requires it.                                                     |
| ATT-02 | Must     | The component must be able to display boundary authority, dataset version, license, source URL, publication date, and official or non-official status supplied by the application. |
| ATT-03 | Must     | Switching boundary sets must update attribution and official-status messaging.                                                                                                     |
| ATT-04 | Must     | The component must not determine whether data is approved for public or official use; it must render the status and restrictions supplied by the publishing system.                |
| ATT-05 | Should   | Conflicting boundary authorities should not be overlaid by default because differing geometries can produce doubled or contradictory borders.                                      |

## 7. User experience and accessibility

| ID    | Priority | Requirement                                                                                                                                                             |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01 | Must     | Map controls must have accessible names, visible focus states, and keyboard operation.                                                                                  |
| UX-02 | Must     | Indicator values exposed through pointer interaction must also be available through a keyboard-accessible feature list, table, or equivalent application-provided view. |
| UX-03 | Must     | Status changes such as loading, errors, time changes, and selection must be communicated without relying only on map pixels or color.                                   |
| UX-04 | Must     | Controls, legends, popups, and breadcrumbs must meet WCAG 2.2 AA contrast and interaction requirements.                                                                 |
| UX-05 | Must     | Touch targets must be appropriately sized, and map gestures must not trap page scrolling.                                                                               |
| UX-06 | Must     | Animation must respect reduced-motion preferences and provide a non-animated alternative.                                                                               |
| UX-07 | Must     | The component must provide clear loading, partial-data, no-data, unsupported, and error states.                                                                         |
| UX-08 | Should   | Dense controls should be collapsible while keeping active layers, time, selection, and legend state understandable.                                                     |

## 8. Performance and reliability

Performance budgets must be validated against agreed target devices, browsers, datasets, and network profiles rather than expressed only as a feature-count promise.

| ID      | Priority | Requirement                                                                                                                                                                              |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PERF-01 | Must     | Initial map code and data must be lazy-loaded when the indicator page can render without immediately showing the map.                                                                    |
| PERF-02 | Must     | Static assets, vector tiles, raster tiles, and versioned configurations must be cacheable through a CDN.                                                                                 |
| PERF-03 | Must     | Panning, zooming, layer changes, and time playback must avoid blocking the main thread with unbounded parsing or styling work.                                                           |
| PERF-04 | Must     | Data loading must support cancellation or supersession when view, filters, time, or layer state changes.                                                                                 |
| PERF-05 | Must     | Expensive data preparation must occur during preprocessing or on a service, not on every client.                                                                                         |
| PERF-06 | Must     | The component must expose loading duration, source errors, render errors, and optional performance instrumentation hooks.                                                                |
| PERF-07 | Must     | Failure of one optional layer must not crash the entire map; the failed layer and degraded state must be identifiable.                                                                   |
| PERF-08 | Should   | Feature parsing, classification, or aggregation should use web workers when measurements show meaningful main-thread contention.                                                         |
| PERF-09 | Must     | Automated performance fixtures must cover at least: a global polygon view, 50,000 visible or clustered points, detailed tiled boundaries, two raster layers, and a six-map grid.         |
| PERF-10 | Must     | Before production acceptance, the team must record measurable budgets for load time, interaction latency, animation frame rate, memory, and export time on named reference environments. |

## 9. Data and service contracts

### 9.1 Required layer metadata

Every layer configuration must provide:

- Stable layer ID and human-readable title.
- Layer kind and source kind.
- Source URL or inline data, source CRS, and supported output projections.
- Geographic level and boundary-set ID where relevant.
- Stable feature ID field and data-join key where interaction or statistics are enabled.
- Available attributes with labels, value types, units, formatting, and missing-value semantics.
- Default symbology and structured legend information.
- Visible zoom or resolution range and available LODs.
- Time extent or available frames where relevant.
- Attribution, license, source version, publication status, and usage restrictions.
- Exportability and cross-origin constraints.

### 9.2 Preprocessing and backend responsibilities

The data pipeline or service is responsible for:

- Matching named areas to stable boundary identifiers and reporting ambiguous or unmatched records.
- Validating and repairing geometry.
- Reprojecting or declaring source projection correctly.
- Simplifying global geometry and generating vector tiles for detailed boundaries.
- Producing raster pyramids or tiled services for large raster datasets.
- Enforcing authorization and public-release rules.
- Returning statistics keyed by stable region and indicator identifiers.
- Supplying version, license, attribution, lineage, and official-use metadata.
- Keeping data joins consistent across LODs and geographic levels.

The browser must not fuzzy-match place names to boundaries. Named-area data must be resolved before delivery to the component.

### 9.3 Recommended boundary delivery

- Use simplified Admin 0 geometry for low-zoom global views.
- Use vector tiles for detailed Admin 1 and Admin 2 boundaries.
- Keep disputed or special-status areas in a separate, explicitly styled layer.
- Do not ship a full-resolution global GeoJSON file to every browser session.
- Use one authoritative boundary family at a time by default and preserve its required attribution.

## 10. Proposed component architecture

The recommended implementation is:

- **React adapter**: mounts the component, maps React props to core configuration, and forwards typed events.
- **Framework-neutral map core**: owns canonical state, projections, source/layer lifecycle, styles, legends, interactions, time playback, export composition, and errors.
- **OpenLayers rendering engine**: provides vector, vector-tile, raster, reprojection, interaction, and canvas rendering capabilities.
- **Proj4 integration**: registers Equal Earth (`EPSG:8857`) and transforms supported data and view coordinates.
- **Application/data services**: provide layer manifests, tiles, indicator statistics, boundary hierarchy, embed persistence, and publication metadata.

The React component should remain composable. A dedicated `MapGrid` wrapper may coordinate up to six normal map instances rather than adding grid-specific branches throughout the renderer.

### 10.1 Illustrative public API

The final names are not prescribed, but the contract should cover this shape:

```ts
type MapViewState = {
  center: [longitude: number, latitude: number]
  zoom: number
  projection: 'EPSG:8857' | 'EPSG:3857'
  rotation?: number
}

type MapSelection = {
  layerId: string
  featureId: string
  boundarySetId?: string
  geographyLevel?: 'admin0' | 'admin1' | 'admin2' | 'city' | string
}

type GeospatialMapProps = {
  view?: MapViewState
  defaultView?: MapViewState
  layers: MapLayerConfig[]
  selection?: MapSelection | null
  time?: string
  zoomTargets?: ZoomTarget[]
  controls?: MapControlConfig
  exportOptions?: MapExportConfig
  onViewChange?: (view: MapViewState) => void
  onFeatureSelect?: (event: FeatureSelectEvent) => void
  onLayerStateChange?: (event: LayerStateEvent) => void
  onTimeChange?: (event: TimeChangeEvent) => void
  onError?: (error: MapError) => void
}
```

## 11. Acceptance criteria

The first production-capable release is accepted when all **Must** requirements in its agreed release scope pass automated or documented manual verification, including these end-to-end scenarios:

1. A React indicator page renders a global Equal Earth choropleth from simplified vector data with a correct legend and attribution.
2. Zooming to a configured country target preserves state and changes to the configured local-detail LOD and projection without losing selection.
3. A user navigates from Admin 0 to Admin 1 to Admin 2 and back through an accessible hierarchy control.
4. Selecting a region emits stable IDs, displays asynchronous indicator statistics, highlights the region, and can be driven from an external filter.
5. Point, line, and polygon layers render attribute-driven styles and explicit missing-data states.
6. Two raster layers can be toggled independently, ordered with other layers, animated through time, and represented in the legend.
7. Layer visibility and order can be changed without recreating unrelated sources or resetting the view.
8. A six-map grid compares six regions with shared indicator and time state and identifies which cell emitted an interaction.
9. PNG and JPEG exports reproduce the visible composition with title, active time, legend, attribution, and source note.
10. SVG export clearly distinguishes true vector output from an SVG wrapper containing rasterized map content.
11. An embed configuration recreates the approved public state without exposing credentials or executable popup content.
12. Keyboard and touch users can operate controls and access selected indicator values through an equivalent non-pointer interaction.
13. Global polygons, 50,000 points, detailed tiled boundaries, two rasters, and the six-map grid meet the recorded performance budgets on named reference environments.
14. A failed optional source produces a layer-level error while the rest of the map remains operational.

## 12. Recommended delivery phases

### Phase 1: Core interactive vector map

- React component and framework-neutral core.
- Equal Earth and Web Mercator view handling.
- GeoJSON and vector-tile layers.
- Declarative styles and legends.
- Layer visibility and ordering.
- Predefined zoom targets, fit-to-data, selection, highlighting, events, popups, and hierarchy.
- Accessibility states and baseline performance fixtures.

### Phase 2: Raster and temporal behavior

- XYZ, WMS, and WMTS raster sources.
- Raster metadata and legends.
- Unified vector and raster time controller with playback and prefetching.
- Measured LOD, caching, and high-traffic optimization.

### Phase 3: Comparison and publishing

- Three-by-two map grid and shared-state coordination.
- Report composition and PNG/JPEG export.
- Conditional SVG export.
- Versioned public embed configuration.
- Production telemetry and final performance budgets.

## 13. Suggested improvements to the original requirements

1. **Separate visualization from data preparation.** Boundary-name matching, simplification, tiling, and publication approval should not occur inside the React component.
2. **Use stable geographic identifiers.** Names alone are ambiguous and can change; all statistics, selection, and hierarchy should use versioned boundary IDs and explicit join keys.
3. **Define LOD as a source contract.** “Dynamic scaling on zoom” should cover source resolution, feature density, labels, and symbol scaling, not just enlarging or shrinking symbols.
4. **Treat projection switching as product behavior.** Preserve canonical view state and use hysteresis so the map does not flicker between projections around one zoom threshold.
5. **Constrain user symbology.** Approved palettes, class methods, class counts, and value ranges provide useful control without turning the component into a desktop GIS product.
6. **Make time consistency explicit.** All linked layers, legends, statistics, and labels must represent the same selected time or clearly identify exceptions.
7. **Define grid synchronization deliberately.** Share indicator, time, and symbology by default; keep each region's extent independent; make synchronized pan and zoom optional.
8. **Split export fidelity by format.** PNG/JPEG can reproduce the composed canvas. True SVG is only reliable for serializable vector layers; raster-backed SVG must be labeled as a wrapper.
9. **Prefer server-stored embed configurations.** A versioned configuration ID is safer and easier to revoke than serializing arbitrary state and URLs into copied JavaScript.
10. **Add an accessible data equivalent.** A map alone cannot expose every value reliably to keyboard and assistive-technology users; the indicator page should offer a synchronized list or table.
11. **Measure performance against fixtures.** Record budgets on named devices and networks; “large number of users” is primarily addressed by CDN caching and scalable services, while per-client rendering needs separate budgets.
12. **Preserve source authority.** Multiple boundary families should not be overlaid by default, and every view and export should carry the active source, version, license, and official-status metadata.

## 14. Decisions still required

These decisions should be made before implementation commitments or acceptance budgets are finalized:

- Supported browser versions, target devices, and minimum viewport sizes.
- Exact vector, raster, and tile protocols required for the first release.
- Whether projection choice is user-visible, application-controlled, automatic, or a combination.
- Boundary authorities, versions, disputed-area policy, attribution wording, and official-publication approval process.
- Indicator statistics API, identifiers, authentication, caching, and error contract.
- Initial symbology presets, classification methods, palettes, and who may change them.
- Time model: instants versus intervals, timezone behavior, irregular observations, and missing-frame policy.
- Grid behavior on mobile and whether synchronized pan and zoom is needed.
- Export dimensions, DPI targets, templates, fonts, logos, and browser-versus-server rendering responsibility.
- Definition of “SVG export”: true vector geometry only, or an SVG report wrapper that may embed raster content.
- Embed hosting, allowed origins, configuration persistence, revocation, version compatibility, and analytics.
- Numeric performance budgets and reference datasets, devices, browsers, and network profiles.
