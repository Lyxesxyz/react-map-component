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

When `state` is supplied, the host is authoritative. Without it, the component updates internal state and still emits complete snapshots. `MapStateChange` names the domain that changed (`view`, `basemap`, `layers`, `selection`, or `time`), the change origin, and, for layer changes, the layer ID.

Focused callbacks are also available: `onReady`, `onViewChange`, `onFeatureHover`, `onFeatureSelect`, `onLayerStateChange`, `onProjectionChange`, `onTimeChange`, `onError`, `onStatusChange`, and `onMetric`. There is no separate symbology callback: a style override is layer state, so it arrives through `onStateChange`.

`onError` receives every error the error alert shows. `error.code` says what failed:

- `CONFIG_INVALID`, `BASEMAP_INCOMPATIBLE`, `FEATURE_ID_MISSING`;
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

- **View:** `zoom(delta)`, `setView(view)`, `resetZoom()`, `fit(target, options?)`, `fitSelection(options?)`, `fitContent(policy?)`, `fitZoomTarget(id)`, `setProjection(projection)`.
- **Layers and basemap:** `setBasemap(id)`, `setLayerVisibility(id, visible)`, `setLayerOpacity(id, opacity)`, `reorderLayer(id, direction)`.
- **Time and selection:** `setTime(time)`, `select(selection | null)`, `clearSelection()`.
- **Panels and screen:** `setOpenPanel('layers' | 'settings' | null)`, `toggleFullscreen(target?)`.
- **Export:** `exportImage(options)` returns a `Blob`. It rejects with an `Error` whose `mapError` property is the `MapError`. `downloadImage(format)` uses the configured report options and downloads the file; a failure shows in the error alert and reaches `onError`.
- **State and messages:** `getState()`, `announce(message)`, `reportError(error)` (shows the alert and calls `onError`), `dismissError()`.
- **Overlays:** `getOpenLayersMap()`, `pixelAt(lonLat)`, `onRender(listener)`, `getHoveredFeature()`, `onHoverChange(listener)`.

Before the map has mounted, commands do nothing, `exportImage()` rejects, and `getOpenLayersMap()` and `pixelAt()` return `null`.

## Selection

`state.selection` is the single source of truth for the popup and the tooltip. A click, the host's controlled `state`, and `actions.select()` all set it the same way:

- When the selection is set, the popup opens for that feature once its layer has loaded.
- When the selection is cleared, the popup closes. That happens with `null` in controlled state, `actions.select(null)` or `clearSelection()`, the popup's close button, or a click on empty map space when `ui.popup.closeOnMapClick` is on.
- The tooltip doesn't show for the selected feature, since the popup already shows it.

`actions.select()` reports the change like a click: `onStateChange` with the `selection` domain, then `onFeatureSelect`. With controlled `state`, apply the proposed state as usual.

If you keep a selection in state only to highlight a feature, turn the popup off (`ui.popup.enabled: false`) or compose the map without `<MapPopup>`.

## Panels

`MapSettings` and `MapLayerPanel` share one open panel: at most one of them is open at a time.

- **Uncontrolled.** Without an `open` prop, a panel follows the rail buttons and `actions.setOpenPanel()`. `useMap().openPanel` says which panel is open, or `null`.
- **Controlled.** With `open`, the host decides. `onOpenChange(false)` is called when the panel asks to close: its close button, and in settings, a chosen area.

`MapDisclaimer` takes `open` and `onOpenChange` the same way.

```tsx
const [layersOpen, setLayersOpen] = useState(false)

<MapLayerPanel open={layersOpen} onOpenChange={setLayersOpen} />
```

## Slots

`<GeospatialMap>` takes three slots:

- `popup` renders the selected feature's content. The map keeps the dialog shell and close button. It receives the `selection` (a `FeatureEvent`), `close`, `state`, and `actions`.
- `tooltip` receives the hovered `FeatureEvent`; return `null` to show none.
- `controls` maps `custom:*` control IDs to renderers that receive `state` and `actions`. Place them by ID in `ui.controls.groups`. In `<GeospatialMap>`, a `custom:` ID without a renderer is a configuration error.

```tsx
// config.ui: { controls: { groups: [{ id: 'extra', controls: ['custom:world'] }] } }
<GeospatialMap
  config={config}
  slots={{
    popup: ({ selection }) => <Statistics id={selection.featureId} />,
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

`<GeospatialMap>` is a preset: `<MapRoot>` plus every part, arranged and enabled by `config.ui`, with `slots` passed to the matching parts. Children you give the preset are rendered after its parts.

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
  <MapPopup>{({ selection }) => <Statistics id={selection.featureId} />}</MapPopup>
</MapRoot>
```

`MapRoot` takes the same `config`, `state`, `onStateChange`, callbacks, and `ref` as the preset. The parts read from it through context.

- **Placement and behaviour.** Props such as `placement`, `allowOpacity`, or `layout` default to `config.ui`, so a prop overrides only that one setting.
- **Rendering.** A part renders when you include it; `ui.*.enabled` applies only to the preset.
- **Refs.** Every part forwards a `ref` to its root element.
- **Slot equivalents.** Instead of slots, the parts take:
  - `header` and `footer` on `MapSettings`, `MapLayerPanel`, and `MapLegend`;
  - `open` and `onOpenChange` on `MapSettings`, `MapLayerPanel`, and `MapDisclaimer`;
  - a render function as the children of `MapPopup` and `MapTooltip`;
  - a node, or a function of the error, as the children of `MapErrorAlert`;
  - `loading` and `empty` on `MapStatusChips`;
  - `customControls={{ 'custom:id': ({ state, actions }) => … }}` on `MapControls`;
  - `renderConfigError` on `MapRoot`.
- **Custom controls.** Use `MapControlButton`, the rail-styled icon button.

Build your own parts with the hooks:

- `useMap()` returns:
  - `state`, `layers` (each with its `visible` and `opacity` applied, in drawing order), `legends`, `statuses`, `attributions`, `times`, `selectedFeature`, `error`, `openPanel`, and `mapStatus`;
  - `mapId`, and the resolved `config`, `ui`, and `messages`;
  - `actions`.
- `useMapStatic()` returns `mapId`, `config`, `ui`, `messages`, `actions`, and `icons`. A component that only reads these doesn't re-render while the map moves.
- `useMapActions()` returns only the actions.
- `useMapIcons()` returns the map's icons, so your buttons match the built-in ones.
- `useMapPixel(lonLat)` and `useHoveredFeature()` help place your own HTML on the map.

Config, state, and events use no OpenLayers types. For what they don't cover, `onOpenLayersMap` and `actions.getOpenLayersMap()` give you the OpenLayers map (see [OpenLayers access](../README.md#openlayers-access-and-your-own-overlays)).
