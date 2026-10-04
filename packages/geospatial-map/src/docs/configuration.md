# Complete configuration reference

Most top-level keys are optional when you write the configuration by hand: see [the short form](./getting-started.md#short-form). The reference below describes the full, normalized form, the `MapConfig` type that `defineMapConfig` returns and `validateMapConfig` checks.

The full form requires `accessibility`, `initialState`, `view`, `data`, and `ui`. `version` is optional; when present it must be `1`. Unknown keys are rejected. Fields that were renamed or removed in 0.8.0 are reported with what to write instead, for example `ui.controlRail was renamed to ui.controls in 0.8.0`.

## Top level

| Field           | Required | Purpose                                                                    |
| --------------- | -------- | -------------------------------------------------------------------------- |
| `version`       | no       | `1` when present.                                                          |
| `id`            | no       | Stable map identifier used in events and DOM metadata.                     |
| `accessibility` | yes      | Accessible map name and reduced-motion policy.                             |
| `initialState`  | yes      | Initial view, basemap, layer, selection, and time state.                   |
| `view`          | yes      | Zoom limits, projection switching, interactions, fit defaults, `fitWorld`. |
| `data`          | yes      | Overlay layers, basemaps, zoom targets, and hierarchy.                     |
| `ui`            | yes      | Profile and the settings of every part, including the time controls.       |
| `export`        | no       | Formats and report-image defaults.                                         |
| `theme`         | no       | Per-map design token overrides (the `--geo-*` tokens by name).             |
| `messages`      | no       | Partial typed text override.                                               |

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
    projectionBehavior: { mode: 'manual' },
    interactions: { keyboard: true, select: true },
  },
  data: {
    layers: [
      {
        id: 'literacy',
        title: 'Literacy rate',
        role: 'indicator',
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

The projection is a developer setting: users can't change it from the map. `initialState.view.projection` sets it, or an ArcGIS basemap supplies its own. `initialState.view` holds only `center`, `zoom`, `projection`, and `rotation`; canonical centers are longitude/latitude.

`view.minZoom` and `view.maxZoom` limit how far users can zoom out and in. They default to `0` and `20`, and `minZoom` can't be greater than `maxZoom`.

`view.projectionBehavior.mode` is `manual` or `automatic`; automatic switching uses `equalEarthBelowZoom` and `mercatorAtOrAboveZoom`, and is refused (with a `BASEMAP_INCOMPATIBLE` error) when no basemap supports the target projection.

`view.fitWorld` replaces the starting zoom and center with a view of the whole world at the map's size, measured when the map mounts. `defineMapConfig` turns it on when the config gives no starting zoom.

`view.interactions` exposes `dragPan`, `wheelZoom`, `doubleClickZoom`, `pinchZoom`, `keyboard`, `rotate`, `hover`, `select`, `selectHitTolerance`, and `hoverHitTolerance`. Rotation defaults to disabled; the other booleans default to enabled. Hit tolerances default to 7 and 3 pixels. Keyboard navigation (arrow keys and +/- on the focused map) is set here only.

`view.fit` sets default `padding`, `duration`, and `maxZoom` for configured fit actions.

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

Built-in control IDs are `zoom-in`, `zoom-out`, `reset-zoom`, `locate`, `layers`, `fit`, `settings`, and `fullscreen`. `reset-zoom` restores `config.initialState.view.zoom` while preserving the current center and projection. Custom IDs must start with `custom:` and have a matching renderer: `slots.controls` on `<GeospatialMap>`, or the `customControls` prop of `MapControls`. In `<GeospatialMap>`, a custom ID without a renderer is a configuration error.

## Settings and panels

- `ui.settings` (`MapSettings`): `enabled`, `placement`, `defaultOpen`, and ordered `fields`. Field IDs are `basemap`, `zoom-target`, and `export`. The basemap field lists the basemaps that support the current projection and is hidden when there is only one.
- `ui.layerPanel` (`MapLayerPanel`): `enabled`, `placement`, `defaultOpen`, `allowVisibility`, `allowOpacity`, `allowReorder`, `showMetadata`, `groupBy` (`group`, `role`, or `none`), `itemDetails` (`disclosure` or `always`), `defaultExpandedLayerIds`, and `showSymbolPreview`. The default is grouped, collapsed disclosure rows with symbol previews; expanded IDs must reference configured layers. `allowReorder` lets users move every layer except those with `reorderable: false`.
- `ui.legend` (`MapLegend`): `enabled`, `placement`, `defaultOpen`, and `layout` (`list` or `compact`).
- `ui.popup` (`MapPopup`): `enabled`, `placement`, `closeOnMapClick`, and `anchor` (`corner` or `feature`).
- `ui.tooltip` (`MapTooltip`): `enabled` and `fields` (feature properties to show, first match wins; default `name`, `title`, `label`).
- `ui.attribution` (`MapAttribution`): `enabled`, `placement`, and `compact`. Disabling required attribution is a consumer policy decision and may violate source terms.
- `ui.statusChips` (`MapStatusChips`): `enabled`, `placement`, `showLoading`, `showNoData`, and `showScaleUnavailable`.
- `ui.errorAlert` (`MapErrorAlert`): `enabled`, `placement`, and `dismissible`.
- `ui.breadcrumbs` (`MapBreadcrumbs`): `enabled` and `placement`. The breadcrumbs show `data.hierarchy`.
- `ui.disclaimer` (`MapDisclaimer`): `enabled`, `text`, `title` (button label and heading; defaults to the `disclaimer` message), `placement` (`bottom-left` or `bottom-right`), and `defaultOpen`. It shows when `text` is set.
- `ui.time` (`MapTimeControls`): see [Time and export](#time-and-export).

All placements accept `top-left`, `top-right`, `bottom-left`, or `bottom-right`. Only one of the settings panel and the layer panel is open at a time: opening one closes the other.

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
| `breadcrumbs` | enabled, `top-left`                                                                                                    |
| `time`        | enabled (shown when layers have time values), `bottom-left`; see [Time and export](#time-and-export)                   |

Other profiles change only the fields listed in the profile table below. Consumer objects merge recursively; consumer arrays replace profile arrays.

## Profiles

| Profile    | Changes from `full`                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full`     | None: every part as in the table above.                                                                                                                                                               |
| `compact`  | Control groups: zoom in, zoom out, reset zoom / fit, layers / settings, fullscreen (no locate). Everything else as `full`.                                                                            |
| `embedded` | Control groups: zoom in, zoom out, reset zoom / fullscreen. Settings off. Layer panel without opacity or reordering (and no layers button on the rail). Time controls off. Everything else as `full`. |
| `grid`     | Control group: zoom in, zoom out, reset zoom. Settings, layer panel, legend, popup, status chips, error alert, breadcrumbs, and time controls off. Tooltip, attribution, and disclaimer as `full`.    |

The profiles are defined in `config/ui-profiles.ts`. The resolved settings of a map are `useMap().ui` (or `useMapStatic().ui`); you override fields through `config.ui` without changing the profiles.

## Time and export

`ui.time` accepts `enabled`, `placement`, `speedsMs`, `defaultSpeedMs`, `autoplay`, `loop`, and `frameFailurePolicy` (`pause` or `skip`). With `pause`, playback stops when a required time layer fails to load a frame; with `skip`, it goes on.

Time defaults are enabled in `full` and `compact` (the controls show only when layers have time values), `bottom-left`, `[500, 900, 1500]` ms, `900` ms selected, autoplay off, looping on, and frame failures paused. `embedded` and `grid` turn the time controls off. `defaultSpeedMs` must be present in `speedsMs` when both are supplied.

Reduced motion is set by `accessibility.reducedMotion`. It defaults to `respect`: when the user prefers reduced motion, playback doesn't start by itself. `ignore` autoplays anyway.

`export` accepts `enabled`, `formats`, `defaultFormat`, `width`, `height`, `pixelRatio`, `quality`, `title`, `subtitle`, `selectedAreaLabel`, `includeLegend`, `includeAttribution`, `disclaimer`, and `timeoutMs`.

Export defaults to enabled with PNG, JPEG, and SVG available. `defaultFormat` only changes ordering and must be included in `formats`. Width and height default to the rendered map size, pixel ratio defaults to `1` and is capped at `3`, JPEG quality defaults to `0.92`, the title falls back to `accessibility.ariaLabel`, legend and attribution inclusion default to true, and the renderer timeout defaults to 10 seconds. Reports keep the area shown on screen. PNG, JPEG, and SVG show the same legend as the screen, including hand-written `legend.entries`. The configured disclaimer is printed under the map; `export.disclaimer` replaces it, and `''` leaves it out.
