# State, events, refs, and React slots

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

The component does not expose OpenLayers instances, layers, sources, or option bags.
