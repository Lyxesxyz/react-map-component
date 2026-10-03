# Getting started

## Contract

`config` is versioned policy and initial data. `state` is optional changing state. Callbacks report events. `slots` contain the few React-only render extensions. Configurations contain no functions and can be stored in a CMS or returned by an API.

```tsx
const config = defineMapConfig({
  version: 1,
  accessibility: { ariaLabel: 'Indicator map', keyboard: true },
  initialState: initialMapState(initialView, layers, 'reference-equal-earth'),
  view: {
    projectionBehavior: { mode: 'manual' },
    interactions: { dragPan: true, wheelZoom: true, keyboard: true, select: true },
  },
  data: { layers, basemaps, zoomTargets, hierarchy },
  ui: { profile: 'compact' },
  export: { enabled: true, formats: ['image/png', 'image/svg+xml'] },
})

<GeospatialMap config={config} />
```

Copy `packages/geospatial-map/src` into the host application (for example to `src/components/geospatial-map`), install the packages listed in its README, and import `geospatial-map.css` exactly once in the app entry. The component fills its parent width and is `--geo-height` (680px by default) tall. Set the token from your own CSS or `className` to change it.

`<GeospatialMap>` lays the map out from `config.ui`. To choose and arrange the parts yourself, use `<MapRoot>` with the parts as children. See [composition](./state-events-slots.md#composition).

## Short form

Only `accessibility` and `data.layers` are required. `defineMapConfig` and `validateMapConfig` fill in the rest:

- `version: 1`
- `view: {}` and `ui: {}`
- `worldBasemap` (bundled country outlines)
- a whole-world starting view fitted to the map's size, with state for every layer
- for layers without a `kind`: `kind: 'geojson'`, `role: 'indicator'`, the `id` as `title`, and a default style
- `selectable: true` on GeoJSON layers and on layers with a `featureIdField`

The full form above remains valid, and `normalizeMapConfig` shows exactly what gets filled in. The JSON Schema (`mapConfigSchema`) describes the full, normalized form. To validate a short config stored in a CMS, use `validateMapConfig`, which normalizes it first.

## Loading external JSON

```tsx
const result = validateMapConfig(await response.json())
if (!result.success) {
  reportConfigurationIssues(result.issues)
  return <ConfigurationError issues={result.issues} />
}
return <GeospatialMap config={result.config} onError={reportMapError} />
```

The component validates again at its boundary. Unknown keys, unknown schema versions, invalid layer state, and projection-incompatible basemaps fail visibly.

## Configuration precedence

Defaults resolve in this order:

1. Package defaults.
2. The selected UI profile.
3. Fields supplied in `config`.
4. Controlled `state` for runtime values.

Nested objects merge. Arrays replace the profile array completely, which makes control ordering deterministic.
