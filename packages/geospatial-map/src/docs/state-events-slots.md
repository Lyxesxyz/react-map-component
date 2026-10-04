# State, events, actions, slots, and composition

## State ownership

`MapState` contains the view, active basemap, layer state keyed by layer ID, selection, and time. Layer state contains visibility, opacity, order, and an optional style override (`state.layers[id].style`).

```tsx
const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regional statistics' },
  data: { layers },
})

function RegionsMap() {
  const [state, setState] = useState(config.initialState)
  return (
    <GeospatialMap
      config={config}
      state={state}
      onStateChange={(next, change) => {
        setState(next)
        audit(change.domain, change.origin)
      }}
    />
  )
}
```

Without `state`, the component keeps the state itself and still emits complete snapshots. With `state`, the host decides:

- The map acts first: it moves when it is dragged, and it highlights a clicked feature. Then it proposes the new state through `onStateChange`.
- Your next `state` is the answer. If it differs from the proposal, the map is set back to your state: view, basemap, layers, selection, and time.
- To refuse a change, keep the state you had.

`MapStateChange` names the domain that changed (`view`, `basemap`, `layers`, `selection`, or `time`), the origin, and, for layer changes, the layer ID.

The origin is a `MapOrigin`. It says what caused the change:

- `'user'`: someone used the map itself (dragging, scrolling, clicking a feature);
- `'api'`: a `MapActions` call, from your code or from a built-in control such as the layer panel or the zoom buttons;
- `'state'`: the starting state, or a new `state` prop. The view reported when the map is ready (`onReady`) has this origin too.

`ViewChangeEvent`, `LayerStateEvent`, and `TimeChangeEvent` carry the same `origin`.

Focused callbacks are also available: `onReady`, `onViewChange`, `onFeatureHover`, `onFeatureSelect`, `onLayerStateChange`, `onTimeChange`, `onError`, `onStatusChange`, and `onMetric`. There is no separate symbology callback: a style override is layer state, so it arrives through `onStateChange`.

`onLayerStateChange` receives a `LayerStateEvent`: `layerId`, `visible`, `opacity`, `order`, and `origin`. `order` is the layer's drawing order among your layers, 0 at the bottom, as in `state.layers[id].order`. Switching the basemap emits no layer events.

There is no projection callback. Each map has one projection, set in its config (`initialState.view.projection`, or an ArcGIS basemap's own).

`onError` receives every error the error alert shows. `error.code` says what failed:

- `CONFIG_INVALID`, `BASEMAP_INCOMPATIBLE`, `FEATURE_ID_MISSING` (once per layer);
- `SOURCE_LOAD_FAILED`, with `layerId`;
- `LOCATION_UNAVAILABLE`, when the browser can't or won't report the location;
- `HOOK_FAILED`, when `onOpenLayersMap` throws;
- `EXPORT_CORS_BLOCKED`, `EXPORT_TIMEOUT`, and `EXPORT_FAILED`.

## Actions

There is one set of actions, `MapActions`, and three ways to reach it. They are the same object:

- the component `ref` (`GeospatialMapHandle` is `MapActions`), on `<GeospatialMap>` and `<MapRoot>`;
- `useMapActions()` in a part;
- `actions` in the slot context.

The identity is stable for the life of the map.

```tsx
const mapRef = useRef<GeospatialMapHandle>(null)

<GeospatialMap ref={mapRef} config={config} />

mapRef.current?.select({ layerId: 'regions', featureId: 'BR' })
mapRef.current?.setOpenPanel('layers')
```

What the actions do:

- **View:** `zoom(delta)` (from the zoom the map shows now), `setView(view)`, `resetZoom()` (back to the starting zoom, the world fit when there was one), `fit(target, options?)`, `fitSelection(options?)`, `fitContent(policy?)`, `fitZoomTarget(id)`. `fit` and `fitSelection` use `config.view.fit` for the options you leave out. `fitContent('data')` fits the loaded features of your visible layers, or the world when nothing has loaded.
- **Layers and basemap:** `setBasemap(id)`, `setLayerVisibility(id, visible)`, `setLayerOpacity(id, opacity)`, `reorderLayer(id, direction)`. An unknown layer ID, or hiding a `required` layer, shows in the error alert and reaches `onError`. `setBasemap` refuses a basemap that doesn't support the map's projection (`BASEMAP_INCOMPATIBLE`).
- **Time and selection:** `setTime(time)`, `select(selection | null)`, `clearSelection()`.
- **Panels and screen:** `setOpenPanel('layers' | 'settings' | null)`, `toggleFullscreen(target?)`.
- **Export:** `exportImage(options)` returns a `Blob`, with `config.export` for the options you leave out. It rejects with an `Error` whose `mapError` property is the `MapError`. `downloadImage(format)` uses the configured report options and downloads the file; a failure shows in the error alert and reaches `onError`.
- **State and messages:** `getState()`, `announce(message)`, `reportError(error)` (shows the alert and calls `onError`), `dismissError()`. `getState()` returns the view as the map shows it now, also during an animation or a drag.
- **Overlays:** `getOpenLayersMap()`, `pixelAt(lonLat)`, `onRender(listener)`, `getHoveredFeature()`, `onHoverChange(listener)`.

There is no `setProjection`: the projection is the config's.

Before the map has mounted, commands do nothing, `exportImage()` rejects, and `getOpenLayersMap()` and `pixelAt()` return `null`.

## Selection

`state.selection` is the single source of truth for the popup and the tooltip. A selection is `{ layerId, featureId }`. A click, the host's controlled `state`, and `actions.select()` all set it the same way:

- When the selection is set, the popup opens for that feature once its layer has loaded.
- When the selection is cleared, the popup closes. That happens with `null` in controlled state, `actions.select(null)` or `clearSelection()`, the popup's close button, or a click on empty map space when `ui.popup.closeOnMapClick` is on.
- The tooltip doesn't show for the selected feature, since the popup already shows it.

A click and `actions.select()` take one path. The map highlights the feature and announces it, `onStateChange` receives the `selection` domain, and then `onFeatureSelect` is called:

- `onFeatureSelect` is called only when the selection changes. Selecting the selected feature again calls nothing.
- For a selection made from code, `onFeatureSelect` waits until the feature has loaded and then reports it. It never reports `null` for a feature that is still loading.
- With controlled `state`, apply the proposed state as usual. If you keep another selection, the map goes back to yours.

When several features are under a click, the top-most one is selected. The others are in `event.candidates`.

If you keep a selection in state only to highlight a feature, turn the popup off (`ui.popup.enabled: false`) or compose the map without `<MapPopup>`.

## Panels

`MapSettings` and `MapLayerPanel` share one open panel: at most one of them is open at a time. The map root holds it, so the rail buttons and the panels always agree. `MapSettings` shows while the open panel is `'settings'`, and `MapLayerPanel` while it is `'layers'`.

- **Uncontrolled.** Without an `openPanel` prop, the rail buttons, `actions.setOpenPanel()`, and `ui.layerPanel.defaultOpen` / `ui.settings.defaultOpen` drive it. `useMap().openPanel` says which panel is open, or `null`.
- **Controlled.** With `openPanel` on `<MapRoot>` or `<GeospatialMap>`, the host decides. `onOpenPanelChange(panel)` is called when a control or a panel asks to open or close one: a rail button, a panel's close button, `actions.setOpenPanel()`, and in settings, a chosen area.

```tsx
const [openPanel, setOpenPanel] = useState<MapPanelId | null>(null)

<GeospatialMap config={config} openPanel={openPanel} onOpenPanelChange={setOpenPanel} />
```

`MapDisclaimer` is not a panel. It takes `open` and `onOpenChange` for its own expanded state.

## Slots

`<GeospatialMap>` takes three slots:

- `popup` renders the selected feature's content. The map keeps the dialog shell and close button. It receives a `PopupContext`: the `feature` (a `FeatureEvent`), `close`, `state`, and `actions`.
- `tooltip` receives the hovered `FeatureEvent`; return `null` to show none.
- `controls` maps `custom:*` control IDs to renderers that receive `state` and `actions`. Place them by ID in `ui.controls.groups`. A `custom:` ID without a renderer is skipped, with a console hint.

```tsx
// config.ui: { controls: { groups: [{ id: 'extra', controls: ['custom:world'] }] } }
<GeospatialMap
  config={config}
  slots={{
    popup: ({ feature }) => <Statistics id={feature.featureId} />,
    controls: {
      'custom:world': ({ actions }) => (
        <MapControlButton label="Whole world" onClick={() => actions.fit([-180, -90, 180, 90])}>
          <Globe aria-hidden="true" />
        </MapControlButton>
      ),
    },
  }}
/>
```

For anything else, compose the parts with `<MapRoot>` (below). The slots that 0.8 removed map to part props:

| Removed slot                 | Use instead                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `panelHeader`, `panelFooter` | `header` and `footer` on `MapSettings`, `MapLayerPanel`, and `MapLegend`            |
| `loading`, `empty`           | `loading` and `empty` on `MapStatusChips`                                           |
| `error`                      | children of `MapErrorAlert`; `renderConfigError` on `MapRoot` for an invalid config |

## Composition

`<GeospatialMap>` is a preset: `<MapRoot>` plus every part, arranged and enabled by `config.ui`, with `slots` passed to the matching parts. Children you give the preset are rendered after its parts. Use it for most maps.

To arrange the map yourself, render `<MapRoot>` with the parts you need:

```tsx
<MapRoot config={config} state={state} onStateChange={setState} ref={mapRef}>
  <MapControls placement="top-left">
    <MapControlGroup>
      <MapZoomInButton />
      <MapZoomOutButton />
    </MapControlGroup>
  </MapControls>
  <MapLegend placement="bottom-right" footer={<SourceNote />} />
  <MapPopup>{({ feature }) => <Statistics id={feature.featureId} />}</MapPopup>
</MapRoot>
```

`MapRoot` takes the same `config`, `state`, `onStateChange`, `openPanel`, `onOpenPanelChange`, callbacks, and `ref` as the preset. The parts read from it through context.

- **Placement and behaviour.** Props such as `placement`, `allowOpacity`, or `layout` default to `config.ui`, so a prop overrides only that one setting.
- **Rendering.** A part renders when you include it; `ui.*.enabled` applies only to the preset. `MapSettings` and `MapLayerPanel` render while the root's open panel is theirs.
- **Refs.** Every part forwards a `ref` to its root element, including `MapPopup` and `MapTooltip`.
- **Slot equivalents.** Instead of slots, the parts take:
  - `header` and `footer` on `MapSettings`, `MapLayerPanel`, and `MapLegend`;
  - `openPanel` and `onOpenPanelChange` on `MapRoot` for the panels, and `open` and `onOpenChange` on `MapDisclaimer`;
  - a render function as the children of `MapPopup` (`({ feature, close, state, actions }) => …`) and `MapTooltip`;
  - a node, or a function of the error, as the children of `MapErrorAlert`;
  - `loading` and `empty` on `MapStatusChips`;
  - `customControls={{ 'custom:id': ({ state, actions }) => … }}` on `MapControls`;
  - `renderConfigError` on `MapRoot`.
- **Custom controls.** Use `MapControlButton`, the rail-styled icon button.

Build your own parts with the hooks:

- `useMapRuntime(select)` returns one piece of the live data and re-renders the part only when that piece changes: `useMapRuntime((map) => map.statuses)`. Select a field and derive from it while rendering. The live data (`MapRuntime`) is:
  - `state`, `layers` (each with its `visible` and `opacity` applied, in drawing order), `legends`, `statuses`, `attributions`, `times`, `selectedFeature`, `error`, `openPanel`, and `mapStatus`.
- `useMapStatic()` returns `mapId`, `config`, `ui`, `messages`, `actions`, and `icons` (`MapStaticValue`). A component that only reads these doesn't re-render while the map moves.
- `useMap()` returns everything at once (`MapContextValue`, the static value and the live data) and re-renders on every change.
- `useMapActions()` returns only the actions.
- `useMapIcons()` returns the map's icons, so your buttons match the built-in ones.
- `useMapPixel(lonLat)` and `useHoveredFeature()` help place your own HTML on the map.

```tsx
function LoadingCount() {
  const loading = useMapRuntime((map) => map.statuses.filter((status) => status.loading).length)
  return loading ? <span>{loading} loading</span> : null
}
```

Config, state, and events use no OpenLayers types. For what they don't cover, `onOpenLayersMap` and `actions.getOpenLayersMap()` give you the OpenLayers map (see [OpenLayers access](../README.md#openlayers-access-and-your-own-overlays)).
