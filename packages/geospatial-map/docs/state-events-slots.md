# State, events, refs, slots, and composition

## State ownership

`MapState` contains the view, active basemap, layer state keyed by layer ID, selection, and time. Layer state contains visibility, opacity, order, and an optional style override.

```tsx
const [state, setState] = useState(config.initialState)

<GeospatialMap
  config={config}
  state={state}
  onStateChange={(next, change) => {
    setState(next)
    audit(change.domain, change.origin)
  }}
/>
```

When `state` is supplied, the host is authoritative. Without it, the component updates internal state and still emits complete snapshots. `MapStateChange` identifies `view`, `basemap`, `layers`, `selection`, `time`, or `symbology`, plus the change origin and optional layer ID.

Focused callbacks remain available: `onReady`, `onViewChange`, `onFeatureHover`, `onFeatureSelect`, `onLayerStateChange`, `onSymbologyChange`, `onProjectionChange`, `onTimeChange`, `onError`, `onStatusChange`, and `onMetric`.

## Imperative handle

`GeospatialMapHandle` intentionally contains only operations that do not fit normal state flow:

- `fit(target, options?)`
- `fitSelection(options?)`
- `exportImage(options)`
- `getState()`

## Slots

`slots.popup` renders selected-feature content while the package retains the dialog shell and close behavior. `panelHeader` and `panelFooter` extend settings, layers, and legend panels. `loading`, `empty`, and `error` replace status content. `controls` registers custom controls named `custom:...`.

Every slot receives `state` and renderer-neutral `actions`. Custom controls are placed by their ID in `ui.controlRail.groups`. A referenced custom ID without a renderer is a configuration error.

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
  <MapLegend placement="bottom-right" />
  <MapPopup>{({ selection }) => <Statistics id={selection.featureId} />}</MapPopup>
</MapRoot>
```

`MapRoot` takes the same `config`, `state`, `onStateChange`, callbacks, and `ref` handle as the preset. The parts read from it through context.

- **Placement and behaviour.** Props such as `placement`, `allowOpacity`, or `layout` default to `config.ui`, so a prop overrides only that one setting.
- **Rendering.** A part renders when you include it; `ui.*.enabled` applies only to the preset.
- **Slot equivalents.** Instead of slots, the parts take:
  - `header` and `footer` on panels;
  - a render function as the children of `MapPopup` and `MapErrorAlert`;
  - `loading` and `empty` on `MapStatus`.
- **Custom controls.** Use `MapControlButton`, the rail-styled icon button.

Build your own parts with the hooks:

- `useMap()` returns:
  - `state`, the `layers` with state applied, `layerState`, `legends`, `statuses`, `attributions`, `times`, `selectedFeature`, `error`, and `panels`;
  - the resolved `config`, `ui`, and `messages`;
  - `actions`.
- `useMapActions()` returns only the actions. Their identity is stable, so a component that only sends commands doesn't re-render while the map moves.

The actions are a superset of the slot `MapActions`. They add `setView`, `resetZoom`, `fitContent`, `fitZoomTarget`, `reorderLayer`, `setPanelOpen`, `toggleFullscreen`, `exportImage`, `downloadImage`, `getState`, `announce`, `reportError`, and `dismissError`.

The component does not expose OpenLayers instances, layers, sources, or option bags.
