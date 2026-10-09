# State, events, actions, templates, and composition

## State ownership

`MapState` contains the view, active basemap, layer state keyed by layer ID, selection, and time. Layer state contains visibility, opacity, order, and an optional style override (`state.layers[id].style`).

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import {
  GeospatialMap,
  defineMapConfig,
  type MapState,
  type MapStateChangeEvent,
} from './geospatial-map'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regional statistics' },
  data: { layers },
})

@Component({
  selector: 'app-regions-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" [(state)]="state" (stateChangeDetails)="audit($event)" />`,
})
export class RegionsMap {
  protected readonly config = config
  protected readonly state = signal<MapState>(config.initialState)

  protected audit({ change }: MapStateChangeEvent): void {
    console.info(change.domain, change.origin)
  }
}
```

Without `state`, the component keeps the state itself and still emits complete snapshots. With `state`, the host decides:

- The map acts first: it moves when it is dragged, and it highlights a clicked feature. Then it proposes the new state through `(stateChange)` (the state) and `(stateChangeDetails)` (`{ state, change }`).
- The `state` you bind next is the answer. If it differs from the proposal, the map is set back to your state: view, basemap, layers, selection, and time.
- To refuse a change, keep the state you had.

[`examples/controlled-state-and-grid.ts`](../examples/controlled-state-and-grid.ts) keeps the state in a signal.

A host that refuses some changes binds `[state]` and `(stateChangeDetails)` separately, and sets its signal only for the changes it takes:

```ts
@Component({
  selector: 'app-locked-selection-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map [config]="config" [state]="state()" (stateChangeDetails)="propose($event)" />
  `,
})
export class LockedSelectionMap {
  protected readonly config = config
  protected readonly state = signal<MapState>(config.initialState)
  protected readonly locked = signal(true)

  protected propose({ state, change }: MapStateChangeEvent): void {
    // Keep the selection you have: the map goes back to it.
    if (this.locked() && change.domain === 'selection') return
    this.state.set(state)
  }
}
```

`MapStateChange` names the domain that changed (`view`, `basemap`, `layers`, `selection`, or `time`), the origin, and, for layer changes, the layer ID.

The origin is a `MapOrigin`. It says what caused the change:

- `'user'`: someone used the map itself (dragging, scrolling, clicking a feature);
- `'api'`: a `MapActions` call, from your code or from a built-in control such as the layer panel or the zoom buttons;
- `'state'`: the starting state, or a new `state` input. The view reported when the map is ready (`(ready)`) has this origin too.

`ViewChangeEvent`, `LayerStateEvent`, and `TimeChangeEvent` carry the same `origin`.

## Outputs

`<geo-map>` and `<geo-map-root>` have the same outputs:

| Output                 | Emits                                      | When                                                                 |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `(stateChange)`        | `MapState`                                 | Every proposed complete state; with the `state` input, `[(state)]`   |
| `(stateChangeDetails)` | `MapStateChangeEvent`: `{ state, change }` | The same proposals, with why the state changed                       |
| `(openPanelChange)`    | `MapPanelId \| null`                       | A control or a panel asks to open or close a panel (`[(openPanel)]`) |
| `(ready)`              | `MapViewState`                             | The OpenLayers renderer is initialized                               |
| `(viewChange)`         | `ViewChangeEvent`                          | The visible view changed                                             |
| `(featureHover)`       | `FeatureEvent \| null`                     | The feature under the pointer changed                                |
| `(featureSelect)`      | `FeatureEvent \| null`                     | The selection changed                                                |
| `(layerStateChange)`   | `LayerStateEvent`                          | A layer's visibility, opacity or order changed                       |
| `(timeChange)`         | `TimeChangeEvent`                          | The time frame changed                                               |
| `(mapError)`           | `MapError`                                 | An error the map shows (not `error`, which is a DOM event name)      |
| `(statusChange)`       | `LayerStatus[]`                            | Layer loading or availability changed                                |
| `(metric)`             | `MapMetric`                                | A renderer timing measurement                                        |

There is no separate symbology output: a style override is layer state, so it arrives through `(stateChange)`.

`(layerStateChange)` emits a `LayerStateEvent`: `layerId`, `visible`, `opacity`, `order`, and `origin`. `order` is the layer's drawing order among your layers, 0 at the bottom, as in `state.layers[id].order`. Switching the basemap emits no layer events.

There is no projection output. Each map has one projection, set in its config (`initialState.view.projection`, or an ArcGIS basemap's own).

`(mapError)` emits every error the error alert shows. `error.code` says what failed:

- `CONFIG_INVALID`, `BASEMAP_INCOMPATIBLE`, `FEATURE_ID_MISSING` (once per layer);
- `SOURCE_LOAD_FAILED`, with `layerId`;
- `LOCATION_UNAVAILABLE`, when the browser can't or won't report the location;
- `HOOK_FAILED`, when the `[onOpenLayersMap]` function throws;
- `EXPORT_CORS_BLOCKED`, `EXPORT_TIMEOUT`, and `EXPORT_FAILED`.

With zone.js, OpenLayers runs outside the Angular zone, and the outputs that follow map events are emitted there too. Keep what you take from an output in a signal, as the samples here do: a signal write updates the view with or without zone.js.

## Actions

There is one set of actions, `MapActions`, and three ways to reach it. They are the same object:

- the `actions` property of `<geo-map>` and `<geo-map-root>`: `#map="geoMap"` in the template, or `viewChild.required(GeospatialMap)` (or `MapRoot`) in the class;
- `injectMapActions()` in a part;
- `actions` in a template's context (`let-actions="actions"`).

The identity is stable for the life of the map.

```html
<geo-map #map="geoMap" [config]="config" />
<button type="button" (click)="map.actions.setOpenPanel('layers')">Layers</button>
```

```ts
@Component({
  selector: 'app-brazil-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" />`,
})
export class BrazilMap {
  protected readonly config = config
  private readonly map = viewChild.required(GeospatialMap)

  selectBrazil(): void {
    this.map().actions.select({ layerId: 'regions', featureId: 'BR' })
  }
}
```

What the actions do:

- **View:** `zoom(delta)` (from the zoom the map shows now), `setView(view)`, `resetZoom()` (back to the starting zoom, the world fit when there was one), `fit(target, options?)`, `fitSelection(options?)`, `fitContent(policy?)`, `fitZoomTarget(id)`. `fit` and `fitSelection` use `config.view.fit` for the options you leave out. `fitContent('data')` fits the loaded features of your visible layers, or the world when nothing has loaded.
- **Layers and basemap:** `setBasemap(id)`, `setLayerVisibility(id, visible)`, `setLayerOpacity(id, opacity)`, `reorderLayer(id, direction)`. An unknown layer ID, or hiding a `required` layer, shows in the error alert and reaches `(mapError)`. `setBasemap` refuses a basemap that doesn't support the map's projection (`BASEMAP_INCOMPATIBLE`).
- **Time and selection:** `setTime(time)`, `select(selection | null)`, `clearSelection()`.
- **Panels and screen:** `setOpenPanel('layers' | 'settings' | null)`, `toggleFullscreen(target?)`.
- **Export:** `exportImage(options)` returns a `Promise<Blob>`, with `config.export` for the options you leave out. It rejects with an `Error` whose `mapError` property is the `MapError`. `downloadImage(format)` uses the configured report options and downloads the file; a failure shows in the error alert and reaches `(mapError)`.
- **State and messages:** `getState()`, `announce(message)`, `reportError(error)` (shows the alert and emits `(mapError)`), `dismissError()`. `getState()` returns the view as the map shows it now, also during an animation or a drag.
- **Overlays:** `getOpenLayersMap()`, `pixelAt(lonLat)`, `onRender(listener)`, `getHoveredFeature()`, `onHoverChange(listener)`.

There is no `setProjection`: the projection is the config's.

Before the map exists (on the server, and in the browser until the map's first render), commands do nothing, `exportImage()` rejects, and `getOpenLayersMap()` and `pixelAt()` return `null`. Call actions from event handlers, or after `(ready)`.

## Selection

`state.selection` is the single source of truth for the popup and the tooltip. A selection is `{ layerId, featureId }`. A click, the host's controlled `state`, and `actions.select()` all set it the same way:

- When the selection is set, the popup opens for that feature once its layer has loaded.
- When the selection is cleared, the popup closes. That happens with `null` in controlled state, `actions.select(null)` or `clearSelection()`, the popup's close button, or a click on empty map space when `ui.popup.closeOnMapClick` is on.
- The tooltip doesn't show for the selected feature, since the popup already shows it.

A click and `actions.select()` take one path. The map highlights the feature and announces it, `(stateChange)` emits the `selection` domain, and then `(featureSelect)` emits:

- `(featureSelect)` emits only when the selection changes. Selecting the selected feature again emits nothing.
- For a selection made from code, `(featureSelect)` waits until the feature has loaded and then reports it. It never reports `null` for a feature that is still loading.
- With controlled `state`, apply the proposed state as usual. If you keep another selection, the map goes back to yours.

When several features are under a click, the top-most one is selected. The others are in `event.candidates`.

Angular can't tell whether `(featureSelect)` has a listener, so the map doesn't warn when you listen for selections and no layer is selectable. If it never fires, check that a layer is selectable (see [troubleshooting](./troubleshooting.md#selection-does-not-fire)).

If you keep a selection in state only to highlight a feature, turn the popup off (`ui.popup.enabled: false`) or compose the map without `<geo-map-popup>`.

## Panels

`<geo-map-settings>` and `<geo-map-layer-panel>` share one open panel: at most one of them is open at a time. The map root holds it, so the rail buttons and the panels always agree. The settings panel shows while the open panel is `'settings'`, and the layer panel while it is `'layers'`.

- **Uncontrolled.** Without an `openPanel` input, the rail buttons, `actions.setOpenPanel()`, and `ui.layerPanel.defaultOpen` / `ui.settings.defaultOpen` drive it. `injectMapRuntime((map) => map.openPanel)` says which panel is open, or `null`.
- **Controlled.** With `[(openPanel)]` on `<geo-map-root>` or `<geo-map>`, the host decides. `(openPanelChange)` emits when a control or a panel asks to open or close one: a rail button, a panel's close button, `actions.setOpenPanel()`, and in settings, a chosen area.

```ts
@Component({
  selector: 'app-panel-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" [(openPanel)]="openPanel" />`,
})
export class PanelMap {
  protected readonly config = config
  protected readonly openPanel = signal<MapPanelId | null>(null)
}
```

`<geo-map-disclaimer>` is not a panel. It takes `[(open)]` (or `defaultOpen`) for its own expanded state.

## Templates

`<geo-map>` takes three kinds of template. Declare them inside it, and import their directives (`MapPopupTemplate`, `MapTooltipTemplate`, `MapControlTemplate`, or `GEO_MAP_PARTS`):

- `<ng-template geoMapPopup>` renders the selected feature's content. The map keeps the dialog shell and close button. Its context is a `MapPopupContext`: the `feature` (a `FeatureEvent`, also `let-feature`), `close`, `state`, and `actions`.
- `<ng-template geoMapTooltip let-feature>` renders the hovered `FeatureEvent` instead of its `name`, `title` or `label`. For a feature it draws nothing for (an `@if` around its content), no tooltip shows.
- `<ng-template geoMapControl="custom:…">` renders a `custom:*` control. Its context has `state` (also `let-state`) and `actions`. Place it by ID in `ui.controls.groups`. A `custom:` ID without a template is skipped, with a console hint.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core'
import { Globe } from 'lucide'
import {
  GeospatialMap,
  MapControlButton,
  MapControlTemplate,
  MapPopupTemplate,
  SvgIcon,
} from './geospatial-map'

@Component({
  selector: 'app-statistics-map',
  imports: [
    GeospatialMap,
    MapPopupTemplate,
    MapControlTemplate,
    MapControlButton,
    SvgIcon,
    Statistics,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // config.ui: { controls: { groups: [{ id: 'extra', controls: ['custom:world'] }] } }
  template: `
    <geo-map [config]="config">
      <ng-template geoMapPopup let-feature>
        <app-statistics [id]="feature.featureId" />
      </ng-template>
      <ng-template geoMapControl="custom:world" let-actions="actions">
        <button geoMapControl label="Whole world" (click)="actions.fit([-180, -90, 180, 90])">
          <svg [geoIcon]="globe"></svg>
        </button>
      </ng-template>
    </geo-map>
  `,
})
export class StatisticsMap {
  protected readonly config = config
  protected readonly globe = Globe
}
```

Every template is typed under `strictTemplates`: `let-feature` is a `FeatureEvent`, `let-actions` is `MapActions`.

| Directive                                     | Inside                                              | `let-` variables                                                                 |
| --------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `geoMapPopup` (`MapPopupContext`)             | `<geo-map>`, `<geo-map-popup>`, `<geo-map-grid>`    | `let-feature`, `let-close="close"`, `let-state="state"`, `let-actions="actions"` |
| `geoMapTooltip` (`MapTooltipContext`)         | `<geo-map>`, `<geo-map-tooltip>`, `<geo-map-grid>`  | `let-feature`                                                                    |
| `geoMapControl` (`MapControlContext`)         | `<geo-map>`, `<geo-map-controls>`, `<geo-map-grid>` | `let-state`, `let-actions="actions"`                                             |
| `geoMapError` (`MapErrorContext`)             | `<geo-map-error-alert>`                             | `let-error`, `let-dismiss="dismiss"`                                             |
| `geoMapConfigError` (`MapConfigErrorContext`) | `<geo-map-root>`                                    | `let-error`, `let-state="state"`, `let-actions="actions"`                        |

For anything else, compose the parts with `<geo-map-root>` (below). Other content goes into the parts:

| Content                        | In a custom layout                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Panel header and footer        | An element with `geoMapPanelHeader` or `geoMapPanelFooter` inside `<geo-map-settings>`, `<geo-map-layer-panel>` or `<geo-map-legend>` |
| Loading and empty content      | An element with `geoMapLoading` or `geoMapEmpty` inside `<geo-map-status-chips>`                                                      |
| The error message              | `<ng-template geoMapError>`, or plain content, inside `<geo-map-error-alert>`                                                         |
| The invalid-configuration text | `<ng-template geoMapConfigError>` inside `<geo-map-root>`                                                                             |
| The disclaimer text            | Plain content inside `<geo-map-disclaimer>` (links allowed); `ui.disclaimer.text` otherwise                                           |

## Composition

`<geo-map>` is a preset: `<geo-map-root>` plus every part, arranged and enabled by `config.ui`, with the popup, tooltip and control templates passed to the matching parts. Content you give the preset other than those templates is rendered after its parts. Use it for most maps.

To arrange the map yourself, render `<geo-map-root>` with the parts you need:

```html
<geo-map-root [config]="config" [(state)]="state" #map="geoMap">
  <geo-map-controls placement="top-left">
    <geo-map-control-group>
      <button geoMapZoomIn></button>
      <button geoMapZoomOut></button>
    </geo-map-control-group>
  </geo-map-controls>
  <geo-map-legend placement="bottom-right">
    <p geoMapPanelFooter class="source-note">Source: national statistics offices</p>
  </geo-map-legend>
  <geo-map-popup>
    <ng-template geoMapPopup let-feature>
      <app-statistics [id]="feature.featureId" />
    </ng-template>
  </geo-map-popup>
  <geo-map-error-alert>
    <ng-template geoMapError let-error let-dismiss="dismiss">
      <span>{{ error.message }}</span>
      <button type="button" (click)="dismiss()">OK</button>
    </ng-template>
  </geo-map-error-alert>
  <ng-template geoMapConfigError let-error>
    <p>This map can't be shown: {{ error.message }}</p>
  </ng-template>
</geo-map-root>
```

The component that holds this template imports the parts and templates it uses, or `GEO_MAP_PARTS` for all of them. [`examples/custom-layout.ts`](../examples/custom-layout.ts) is a complete custom layout, with a custom control and a custom part.

`<geo-map-root>` takes the same `config`, `[(state)]`, `[(openPanel)]`, inputs and outputs as the preset, and `#map="geoMap"` gives the same `actions`. It also takes `validate`: extra checks (`(config, ui) => ConfigIssue[]`) whose issues show the configuration-error panel. The parts read the map from it through injection.

- **Placement and behaviour.** Inputs such as `placement`, `allowOpacity`, or `layout` default to `config.ui`, so an input overrides only that one setting.
- **Rendering.** A part renders when you include it; `ui.*.enabled` applies only to the preset. `<geo-map-settings>` and `<geo-map-layer-panel>` render while the root's open panel is theirs.
- **Host elements.** Each part's element is its root element: the `class`, `style`, `id`, `aria-*` and `data-*` you write on it land there, and `viewChild(MapLegend, { read: ElementRef })` gives you the element. A part with nothing to show (a closed panel, no selection, no error) keeps its element, empty, with no classes or ARIA attributes and `display: none`. Leave `display` to the part: a `[style.display]` binding would show the empty element.
- **Content.** The parts take:
  - `[geoMapPanelHeader]` and `[geoMapPanelFooter]` content in `<geo-map-settings>`, `<geo-map-layer-panel>`, and `<geo-map-legend>`;
  - `[(openPanel)]` on `<geo-map-root>` for the panels, and `[(open)]` on `<geo-map-disclaimer>`;
  - a `geoMapPopup` template (or plain content) in `<geo-map-popup>`, and a `geoMapTooltip` template in `<geo-map-tooltip>`;
  - a `geoMapError` template, or plain content, in `<geo-map-error-alert>`;
  - `[geoMapLoading]` and `[geoMapEmpty]` content in `<geo-map-status-chips>`;
  - `geoMapControl` templates in `<geo-map-controls>`, or `[customControls]` (templates keyed by `custom:*` id);
  - a `geoMapConfigError` template in `<geo-map-root>`.
- **Custom controls.** Use `<button geoMapControl [label]="…">` (`MapControlButton`), the rail-styled icon button, with your icon as its content.
- **Built-in buttons.** `<button geoMapZoomIn>` and the other built-in buttons take `label`, and content you put inside them replaces the icon. To cancel a built-in action, listen to `(beforeAction)` and call `preventDefault()`. A `(click)` on the button runs after the action, so it can't cancel it.
- **Breadcrumbs.** `(targetClick)` on `<geo-map-breadcrumbs>` emits a `MapTargetClickEvent` (`target`, the zoom target, and `source`, the click) before the map zooms; `preventDefault()` skips the zoom.

```html
<geo-map-controls placement="top-left">
  <geo-map-control-group>
    <button geoMapZoomIn (beforeAction)="confirmZoom($event)"></button>
  </geo-map-control-group>
</geo-map-controls>
<geo-map-breadcrumbs (targetClick)="openRegion($event)" />
```

```ts
protected confirmZoom(event: MapActionEvent<'zoomIn'>): void {
  if (this.zoomLocked()) event.preventDefault()
}

protected openRegion(event: MapTargetClickEvent): void {
  this.region.set(event.target.id)
}
```

## Custom parts

Build your own parts with the injection functions. Call them in a field initializer or the constructor of a component that sits inside `<geo-map-root>` or `<geo-map>` (or inside one of their templates):

- `injectMapRuntime(select)` returns a signal of one piece of the live data, which changes only when that piece changes: `injectMapRuntime((map) => map.statuses)`. Select a field and derive from it with `computed`. The live data (`MapRuntime`) is:
  - `state`, `layers` (each with its `visible` and `opacity` applied, in drawing order), `legends`, `statuses`, `attributions`, `times`, `selectedFeature`, `error`, `openPanel`, and `mapStatus`.
- `injectMapStatic()` returns a signal of `mapId`, `config`, `ui`, `messages`, `actions`, and `icons` (`MapStaticValue`). It changes only with the configuration, so a component that only reads these doesn't update while the map moves.
- `injectMap()` returns everything at once (a signal of `MapContextValue`, the static value and the live data), which changes on every change.
- `injectMapActions()` returns only the actions (not a signal: they don't change).
- `injectMapIcons()` returns a signal of the map's icons, so your buttons match the built-in ones (`<geo-map-icon [icon]="icons().Fit" />`).
- `injectMapPixel(() => lonLat)` and `injectHoveredFeature()` help place your own HTML on the map; `anchoredPosition(() => pixel, gap)` places an element next to a pixel, as the popup and the tooltip do.
- `injectSlotContext()` returns a signal of `{ state, actions }`, the context the control templates get.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core'
import { injectMapRuntime } from './geospatial-map'

@Component({
  selector: 'app-loading-count',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <span class="loading-count">{{ loading() }} loading</span>
    }
  `,
})
export class LoadingCount {
  protected readonly loading = injectMapRuntime(
    (map) => map.statuses.filter((status) => status.loading).length,
  )
}
```

```html
<geo-map [config]="config">
  <app-loading-count />
</geo-map>
```

Outside a map, each function throws "must be used inside `<geo-map-root>` or `<geo-map>`", except `injectMapIcons()`, which returns the app's icons.

Config, state, and events use no OpenLayers types. For what they don't cover, `[onOpenLayersMap]` and `actions.getOpenLayersMap()` give you the OpenLayers map (see [OpenLayers access](../README.md#openlayers-access-and-your-own-overlays)).

## Grid outputs

`<geo-map-grid>` has the per-map outputs of `<geo-map>`, from `(ready)` to `(metric)`, for every map in it. An output has one payload, so each one emits a `MapGridEvent`: `{ mapId, event }`, where `event` is what `<geo-map>` would emit.

```html
<geo-map-grid
  [config]="grid"
  [(state)]="gridState"
  (featureSelect)="selected($event)"
  (mapError)="report($event.mapId, $event.event.code)"
/>
```

```ts
protected selected({ mapId, event }: MapGridEvent<FeatureEvent | null>): void {
  this.selection.set(event ? `${mapId}: ${event.featureId}` : null)
}
```

`(stateChange)` emits the complete grid state (`MapGridState`), so `[(state)]` works. `(stateChangeDetails)` emits `{ state, mapId, change }`: after a change in one map, `mapId` is that map's ID and `change` its `MapStateChange`; after a focus change, `mapId` is `null` and there is no `change`. See [MapGrid](./export-grid-integration.md#mapgrid).
