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

Import `@org/geospatial-map/styles.css` exactly once in the host application. The component fills its parent width and uses a 680px default stage height; constrain or override `.geo-map-stage` from the host layout when needed.

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
