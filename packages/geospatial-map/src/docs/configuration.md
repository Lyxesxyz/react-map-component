# Complete configuration reference

Most top-level keys are optional when you write the configuration by hand: see [the short form](./getting-started.md#short-form). The reference below describes the full, normalized form, the `MapConfig` type that `defineMapConfig` returns and `validateMapConfig` checks. Its JSON Schema is `mapConfigSchema`; the short form's is `mapInputSchema` (see [loading external JSON](./getting-started.md#loading-external-json)).

The full form requires `accessibility`, `initialState`, `view`, `data`, and `ui`. `version` is optional; when present it must be `1`. Unknown keys are rejected. Fields that were renamed or removed in 0.8.0 or 0.9.0 are reported with what to write instead, for example `ui.legend.defaultOpen was renamed to ui.legend.expanded in 0.9.0`.

## Top level

| Field           | Required | Purpose                                                              |
| --------------- | -------- | -------------------------------------------------------------------- |
| `version`       | no       | `1` when present.                                                    |
| `id`            | no       | Stable map identifier used in events and DOM metadata.               |
| `accessibility` | yes      | Accessible map name and reduced-motion policy.                       |
| `initialState`  | yes      | Initial view, basemap, layer, selection, and time state.             |
| `view`          | yes      | Zoom limits, interactions, fit defaults, `fitWorld`.                 |
| `data`          | yes      | Overlay layers, basemaps, and zoom targets.                          |
| `ui`            | yes      | Profile and the settings of every part, including the time controls. |
| `export`        | no       | Formats and report-image defaults.                                   |
| `theme`         | no       | Per-map design token overrides (the `--geo-*` tokens by name).       |
| `messages`      | no       | Partial typed text override.                                         |

### Full form

A complete `MapConfig`, with one GeoJSON layer and the bundled world basemap:

```ts
import { worldBasemap, type MapConfig } from '@/components/geospatial-map'

const config: MapConfig = {
  version: 1,
  id: 'literacy-map',
  accessibility: { ariaLabel: 'Literacy rate by country', reducedMotion: 'respect' },
  initialState: {
    view: { center: [0, 20], zoom: 1.2, projection: 'EPSG:8857' },
    activeBasemapId: 'world',
    layers: { literacy: { visible: true, opacity: 1, order: 0 } },
    selection: null,
    time: null,
  },
  view: {
    minZoom: 1,
    maxZoom: 12,
    fitWorld: true,
    interactions: { keyboard: true, select: true },
  },
  data: {
    layers: [
      {
        id: 'literacy',
        title: 'Literacy rate',
        group: 'Education',
        kind: 'geojson',
        data: { url: '/data/literacy.geojson' },
        featureIdField: 'iso3',
        selectable: true,
        style: {
          type: 'continuous',
          field: 'rate',
          domain: [40, 100],
          stops: [
            { value: 40, color: '#fef3c7' },
            { value: 100, color: '#065f46' },
          ],
        },
      },
    ],
    basemaps: [worldBasemap],
  },
  ui: { profile: 'full', controls: { placement: 'top-left' } },
  export: { formats: ['image/png', 'image/svg+xml'] },
}
```

## View and interaction

The projection is a developer setting: each map has one projection, and users can't change it from the map. `initialState.view.projection` sets it, or an ArcGIS basemap supplies its own. Basemaps that don't list that projection in `supportedProjections` aren't offered in the basemap picker, and `actions.setBasemap` refuses them with a `BASEMAP_INCOMPATIBLE` error. To show another projection, render another map with its own config. `initialState.view` holds only `center`, `zoom`, `projection`, and `rotation`; canonical centers are longitude/latitude.

`view.minZoom` and `view.maxZoom` limit how far users can zoom out and in. They default to `0` and `20`, and `minZoom` can't be greater than `maxZoom`.

`view.fitWorld` replaces the starting zoom and center with a view of the whole world at the map's size, measured when the map mounts. It defaults to on when the configuration sets no starting zoom, and to off otherwise; set it to `true` or `false` to decide yourself. `defineMapConfig` doesn't write it: the map decides when it starts.

`view.interactions` exposes `dragPan`, `wheelZoom`, `doubleClickZoom`, `pinchZoom`, `keyboard`, `rotate`, `hover`, `select`, `selectHitTolerance`, and `hoverHitTolerance`. Rotation defaults to disabled; the other booleans default to enabled. Hit tolerances default to 7 and 3 pixels. Keyboard navigation (arrow keys and +/- on the focused map) is set here only.

`view.fit` sets default `padding`, `duration`, and `maxZoom` for configured fit actions.

## Basemaps

`data.basemaps` lists the basemaps (`BasemapConfig`). The short form defaults to `[esriWorldBasemap, worldBasemap]`: Esri's World Basemap, loaded from `basemaps.arcgis.com` by the user's browser, with the bundled world outlines as its fallback. `initialState.activeBasemapId` names the one the map starts on; by default, the first that supports the map's projection.

| Field                  | Required | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `title`          | yes      | A unique id, and the name the settings panel shows.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `supportedProjections` | yes      | The projections it can be drawn in. `arcgisBasemap()` leaves it empty unless you pass `projections`: it is read from the service when the map loads.                                                                                                                                                                                                                                                                                                                       |
| `layers`               | yes      | Its layers, drawn below yours; a layer with `aboveOverlays: true` draws above them.                                                                                                                                                                                                                                                                                                                                                                                        |
| `backgroundColor`      | no       | The colour behind its layers. Default `var(--geo-stage)`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `attribution`          | no       | Default: the attributions of its layers.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `exportable`           | no       | Whether exports may include it. Default `true`.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `fallbackBasemapId`    | no       | Another basemap of the list, shown instead when this one can't be loaded: its ArcGIS service can't be read (or doesn't answer within 10 seconds), its style fails, or none of the tiles of one of its layers load. When the fallback supports the map's projection, the switch is quiet: no error alert, no `onError`, no `data-layer-errors`, and one `[geospatial-map]` console hint. Validation rejects an id that names no basemap of the list, or the basemap itself. |

The helpers build these for you. `arcgisBasemap()` takes `url`, `id`, `title`, `styleUrl`, `styleOverrides`, `labelsAboveData`, `attribution`, `exportable`, `sourceProjectionDefinition`, `projections` and `fallbackBasemapId`. `projections` lists the projections to draw it in; when the map's is not the service's own, its vector tiles are reprojected in the browser (default: the service's projection only). `tileBasemap()` takes `fallbackBasemapId` too. A switch to a fallback after the map started reaches `state.activeBasemapId` and `onStateChange` (domain `basemap`), like a choice in the settings panel; so does the switch at the start for a host that controls `state` and names a basemap whose service couldn't be read. See [basemaps](./layers-and-legends.md#basemaps) and [The basemap switched to its fallback](./troubleshooting.md#the-basemap-switched-to-its-fallback).

## Control rail

`ui.controls` (the `MapControls` part):

| Field              | Default             | Meaning                                                                  |
| ------------------ | ------------------- | ------------------------------------------------------------------------ |
| `enabled`          | `true`              | Render the rail.                                                         |
| `placement`        | `top-right`         | Any map corner.                                                          |
| `groups`           | profile value       | Ordered groups; arrays replace profile groups.                           |
| `zoomStep`         | `1`                 | Zoom delta for each button activation.                                   |
| `locate`           | see meaning         | High accuracy off, 10 s timeout, 60 s maximum age, zoom 6 on a result.   |
| `fitTarget`        | `selection-or-data` | `selection`, `data`, or the selection when there is one, else the data.  |
| `fullscreenTarget` | `map`               | Fullscreen the map root (`map`) or its containing element (`container`). |

Built-in control IDs are `zoom-in`, `zoom-out`, `reset-zoom`, `locate`, `layers`, `fit`, `settings`, and `fullscreen`. `reset-zoom` returns to the starting zoom (the world fit, when the map started with one) and keeps the current center. Custom IDs must start with `custom:` and have a matching renderer: `slots.controls` on `<GeospatialMap>`, or the `customControls` prop of `MapControls`. A custom ID without a renderer is skipped, and the console says which one. Fitting the data fits the loaded features of the visible layers, or the world when nothing has loaded yet.

## Settings and panels

- `ui.settings` (`MapSettings`): `enabled`, `placement`, `defaultOpen`, and ordered `fields`. Field IDs are `basemap`, `zoom-target`, and `export`. The basemap field lists the basemaps that support the map's projection and is hidden when there is only one.
- `ui.layerPanel` (`MapLayerPanel`): `enabled`, `placement`, `defaultOpen`, `allowVisibility`, `allowOpacity`, `allowReorder`, `showMetadata`, `groupBy` (`group` or `none`), `itemDetails` (`disclosure` or `always`), `defaultExpandedLayerIds`, and `showSymbolPreview`. The default lists layers under their `group` heading (layers without one under "Other layers"), in collapsed disclosure rows with symbol previews; with `showMetadata`, each row's details show the layer's kind and status; expanded IDs must reference configured layers. `allowReorder` lets users move every layer except those with `reorderable: false`.
- `ui.legend` (`MapLegend`): `enabled`, `placement`, `expanded` (starts expanded), and `layout` (`list` or `compact`).
- `ui.popup` (`MapPopup`): `enabled`, `placement`, `closeOnMapClick`, and `anchor` (`corner` or `feature`).
- `ui.tooltip` (`MapTooltip`): `enabled` and `fields` (feature properties to show, first match wins; default `name`, `title`, `label`).
- `ui.attribution` (`MapAttribution`): `enabled`, `placement`, and `compact`. Disabling required attribution is a consumer policy decision and may violate source terms.
- `ui.statusChips` (`MapStatusChips`): `enabled`, `placement`, `showLoading`, `showNoData`, and `showScaleUnavailable`.
- `ui.errorAlert` (`MapErrorAlert`): `enabled`, `placement`, and `dismissible`.
- `ui.breadcrumbs` (`MapBreadcrumbs`): `enabled`, `placement`, and `targets`: ids of `data.zoomTargets`, widest first (`['world', 'africa', 'kenya']`). Each id must name a zoom target. The breadcrumbs show nothing while `targets` is empty.
- `ui.disclaimer` (`MapDisclaimer`): `enabled`, `text`, `title` (button label and heading; defaults to the `disclaimer` message), `placement` (`bottom-left` or `bottom-right`), and `defaultOpen`. It shows when `text` is set.
- `ui.time` (`MapTimeControls`): see [Time and export](#time-and-export).

All placements accept `top-left`, `top-right`, `bottom-left`, or `bottom-right`. Only one of the settings panel and the layer panel is open at a time: opening one closes the other. `defaultOpen` sets which one is open when the map loads; to control it from your app, pass `openPanel` (`'layers'`, `'settings'`, or `null`) and `onOpenPanelChange` to `<GeospatialMap>` or `<MapRoot>`. See [panels](./state-events-slots.md#panels).

The `full` profile supplies these defaults before overrides:

| Part          | Default policy                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `controls`    | enabled, `top-right`; groups: zoom in, zoom out, reset zoom / locate / layers / fit / settings, fullscreen             |
| `settings`    | enabled, closed, `top-right`; basemap, zoom target, then export                                                        |
| `layerPanel`  | enabled, closed, `top-right`; visibility, opacity, reordering, and metadata enabled; grouped by `group`, with previews |
| `legend`      | enabled, open, `bottom-left`, `list` layout                                                                            |
| `popup`       | enabled, `top-left`, corner-anchored, closes on an empty-map click                                                     |
| `tooltip`     | enabled; shows `name`, `title`, or `label`                                                                             |
| `disclaimer`  | shown when `text` is set, collapsed, `bottom-left`                                                                     |
| `attribution` | enabled, compact, `bottom-right`                                                                                       |
| `statusChips` | enabled, `bottom-right`; loading, no-data, and scale-unavailable states enabled                                        |
| `errorAlert`  | enabled, dismissible when recoverable, `top-left`                                                                      |
| `breadcrumbs` | enabled, `top-left`, no targets                                                                                        |
| `time`        | enabled (shown when layers have time values), `bottom-left`; see [Time and export](#time-and-export)                   |

Other profiles change only the fields listed in the profile table below. Consumer objects merge recursively; consumer arrays replace profile arrays.

## Profiles

| Profile    | Changes from `full`                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full`     | None: every part as in the table above.                                                                                                                                                            |
| `compact`  | Control groups: zoom in, zoom out, reset zoom / fit, layers / settings, fullscreen (no locate). Everything else as `full`.                                                                         |
| `embedded` | Control groups: zoom in, zoom out, reset zoom / fullscreen. Settings, layer panel, and time controls off. Everything else as `full`.                                                               |
| `grid`     | Control group: zoom in, zoom out, reset zoom. Settings, layer panel, legend, popup, status chips, error alert, breadcrumbs, and time controls off. Tooltip, attribution, and disclaimer as `full`. |

The profiles are defined in `config/ui-profiles.ts`. The resolved settings of a map are `useMap().ui` (or `useMapStatic().ui`); you override fields through `config.ui` without changing the profiles.

## Time and export

A layer's time frames are `time: { values, field? }`, on GeoJSON, heatmap, vector tile (`mvt`), XYZ, and WMS layers. `values` lists the frames in order (`['2021', '2022', …]`). How the layer follows the frame comes from the layer itself:

- a URL with `{time}` in it (the layer's `url`, or `data.url` for GeoJSON and heatmaps) is requested again for each frame;
- a WMS layer gets the frame as the request parameter named by `field` (default `TIME`);
- otherwise (GeoJSON, heatmaps, vector tiles) features are filtered by the property named by `field` (default `time`).

An XYZ layer with `time` needs `{time}` in its URL. While the map shows a frame a layer doesn't list, that layer is hidden and its status chip says "No data for time". GeoJSON and XYZ layers with `{time}` in their URL load the next frame ahead. When layers have time frames and `initialState.time` is not set, the map starts at the first frame; `initialState: { time: null }` starts with no frame, and the time layers stay hidden until a frame is chosen.

`ui.time` accepts `enabled`, `placement`, `speedsMs`, `defaultSpeedMs`, `autoplay`, `loop`, and `frameFailurePolicy` (`pause` or `skip`). Playback waits while a time layer loads a frame. With `pause`, playback stops when a `required` time layer fails to load a frame; with `skip`, it goes on.

Time defaults are enabled in `full` and `compact` (the controls show only when layers have time values), `bottom-left`, `[500, 900, 1500]` ms, `900` ms selected, autoplay off, looping on, and frame failures paused. `embedded` and `grid` turn the time controls off. `defaultSpeedMs` must be present in `speedsMs` when both are supplied.

Reduced motion is set by `accessibility.reducedMotion`. It defaults to `respect`: when the user prefers reduced motion, playback doesn't start by itself. `ignore` autoplays anyway.

`export.formats` and `defaultFormat` take MIME types: `image/png`, `image/jpeg`, and `image/svg+xml` (labelled PNG, JPEG, and SVG in the settings panel). `export` also accepts `enabled`, `formats`, `defaultFormat`, `width`, `height`, `pixelRatio`, `quality`, `title`, `subtitle`, `selectedAreaLabel`, `includeLegend`, `includeAttribution`, `disclaimer`, and `timeoutMs`.

Export defaults to enabled with PNG, JPEG, and SVG available. `defaultFormat` only changes ordering and must be included in `formats`. The report is 1200 × 720 report pixels unless `width` and `height` say otherwise, pixel ratio defaults to `1` and is capped at `3`, JPEG quality defaults to `0.92`, the title falls back to `accessibility.ariaLabel`, legend and attribution inclusion default to true, and the renderer timeout defaults to 10 seconds. Export waits for every visible layer to load. A visible layer that failed is exported without its data, unless it is `required`: then the export fails with that layer's error. Reports keep the area shown on screen. PNG, JPEG, and SVG show the same legend as the screen, including hand-written `legend.entries`. The configured disclaimer is printed under the map; `export.disclaimer` replaces it, and `''` leaves it out.
