# Complete configuration reference

Most top-level keys are optional when you write the configuration by hand: see [the short form](./getting-started.md#short-form). The reference below describes the full, normalized form.

Every configuration requires `version: 1`, `accessibility`, `initialState`, `view`, `data`, and `ui`. Unknown keys are rejected.

## Top level

| Field           | Required | Purpose                                                          |
| --------------- | -------- | ---------------------------------------------------------------- |
| `version`       | yes      | Must be `1`.                                                     |
| `id`            | no       | Stable map identifier used in events and DOM metadata.           |
| `accessibility` | yes      | Accessible map name, keyboard policy, and reduced-motion policy. |
| `initialState`  | yes      | Initial view, basemap, layer, selection, and time state.         |
| `view`          | yes      | Projection switching, interactions, and fit defaults.            |
| `data`          | yes      | Overlay layers, basemaps, zoom targets, and hierarchy.           |
| `ui`            | yes      | Profile and all control/panel policies.                          |
| `time`          | no       | Time-control behavior.                                           |
| `export`        | no       | Formats and report-image defaults.                               |
| `theme`         | no       | Partial typed visual token override.                             |
| `messages`      | no       | Partial typed text override.                                     |

## View and interaction

`view.projectionBehavior.mode` is `manual` or `automatic`. Automatic switching uses `equalEarthBelowZoom` and `mercatorAtOrAboveZoom`. Canonical centers are longitude/latitude.

`view.interactions` exposes `dragPan`, `wheelZoom`, `doubleClickZoom`, `pinchZoom`, `keyboard`, `rotate`, `hover`, `select`, `selectHitTolerance`, and `hoverHitTolerance`. Rotation defaults to disabled; the other booleans default to enabled. Hit tolerances default to 7 and 3 pixels.

`view.fit` sets default `padding`, `duration`, and `maxZoom` for configured fit actions.

## Control rail

`ui.controlRail`:

| Field              | Default               | Meaning                                               |
| ------------------ | --------------------- | ----------------------------------------------------- |
| `enabled`          | `true`                | Render the rail.                                      |
| `placement`        | `top-right`           | Any map corner.                                       |
| `groups`           | profile value         | Ordered groups; arrays replace profile groups.        |
| `zoomStep`         | `1`                   | Zoom delta for each button activation.                |
| `locate`           | browser-safe defaults | High accuracy, timeout, maximum age, and result zoom. |
| `fitTarget`        | `selection-or-data`   | `selection`, `data`, or fallback behavior.            |
| `fullscreenTarget` | `map`                 | Fullscreen the map root or its containing element.    |

Built-in control IDs are `zoom-in`, `zoom-out`, `reset-zoom`, `locate`, `layers`, `fit`, `settings`, and `fullscreen`. `reset-zoom` restores `config.initialState.view.zoom` while preserving the current center and projection. Custom IDs must start with `custom:` and have a matching `slots.controls` renderer.

## Settings and panels

- `ui.settings`: `enabled`, `placement`, `defaultOpen`, and ordered `fields`. Field IDs are `projection`, `basemap`, `zoom-target`, and `export`.
- `ui.layers`: `enabled`, `placement`, `defaultOpen`, `allowVisibility`, `allowOpacity`, `allowReorder`, `showMetadata`, `groupBy` (`group`, `role`, or `none`), `itemDetails` (`disclosure` or `always`), `defaultExpandedLayerIds`, and `showSymbolPreview`. The default is grouped, collapsed disclosure rows with symbol previews; expanded IDs must reference configured layers.
- `ui.legend`: `enabled`, `placement`, `defaultOpen`, and `layout` (`list` or `compact`).
- `ui.popup`: `enabled`, `placement`, `closeOnMapClick`, and `anchor` (`corner` or `feature`).
- `ui.tooltip`: `enabled` and `fields` (feature properties to show, first match wins; default `name`, `title`, `label`).
- `ui.attribution`: `enabled`, `placement`, and `compact`. Disabling required attribution is a consumer policy decision and may violate source terms.
- `ui.status`: `enabled`, `placement`, `showLoading`, `showNoData`, and `showScaleUnavailable`.
- `ui.errors`: `enabled`, `placement`, and `dismissible`.
- `ui.hierarchy`: `enabled` and `placement`.

All placements accept `top-left`, `top-right`, `bottom-left`, or `bottom-right`.

The `full` profile supplies these surface defaults before overrides:

| Surface       | Default policy                                                                      |
| ------------- | ----------------------------------------------------------------------------------- |
| `settings`    | enabled, closed, `top-right`; projection, basemap, zoom target, then export         |
| `layers`      | enabled, closed, `top-right`; visibility, opacity, reordering, and metadata enabled |
| `legend`      | enabled, open, `bottom-left`, `list` layout                                         |
| `popup`       | enabled, `top-left`, corner-anchored, closes on an empty-map click                  |
| `tooltip`     | enabled; shows `name`, `title`, or `label`                                          |
| `attribution` | enabled, compact, `bottom-right`                                                    |
| `status`      | enabled, `bottom-right`; loading, no-data, and scale-unavailable states enabled     |
| `errors`      | enabled, dismissible when recoverable, `top-left`                                   |
| `hierarchy`   | enabled, `top-left`                                                                 |

Other profiles replace the policies shown in the profile table below. Consumer objects merge recursively; consumer arrays replace profile arrays.

## Profiles

| Profile    | Default behavior                                                                  |
| ---------- | --------------------------------------------------------------------------------- |
| `full`     | All applicable controls and surfaces.                                             |
| `compact`  | Zoom, fit, layers, settings, fullscreen, attribution, and contextual legend/time. |
| `embedded` | Zoom, fullscreen, legend, and attribution; no settings.                           |
| `grid`     | Per-cell zoom and attribution only.                                               |

Profiles are ordinary exported data in `mapUiProfiles`; consumers override fields without mutating the exported objects.

## Time and export

`time` accepts `enabled`, `placement`, `speedsMs`, `defaultSpeedMs`, `autoplay`, `loop`, `frameFailurePolicy` (`pause`, `retain-last`, or `skip`), and `reducedMotion`. Reduced motion defaults to `respect`.

Time defaults are contextual enablement in `full` and `compact`, `bottom-left`, `[500, 900, 1500]` ms, `900` ms selected, autoplay off, looping on, frame failures paused, and reduced-motion respected. `defaultSpeedMs` must be present in `speedsMs` when both are supplied.

`export` accepts `enabled`, `formats`, `defaultFormat`, `width`, `height`, `pixelRatio`, `quality`, `title`, `subtitle`, `selectedAreaLabel`, `includeLegend`, `includeAttribution`, and `timeoutMs`.

Export defaults to enabled with PNG, JPEG, and SVG available. `defaultFormat` only changes ordering and must be included in `formats`. Width and height default to the rendered map size, pixel ratio defaults to `1` and is capped at `3`, JPEG quality defaults to `0.92`, the title falls back to `accessibility.ariaLabel`, legend and attribution inclusion default to true, and the renderer timeout defaults to 10 seconds.
