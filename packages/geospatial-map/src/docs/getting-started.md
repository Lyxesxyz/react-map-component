# Getting started

## Contract

`config` is policy and initial data. `state` is optional changing state. Callbacks report events. `slots` contain the few React-only render extensions. Configurations contain no functions and can be stored in a CMS or returned by an API.

```tsx
const config = defineMapConfig({
  accessibility: { ariaLabel: 'Indicator map' },
  initialState: {
    view: { center: [20, 5], zoom: 3, projection: 'EPSG:8857' },
    activeBasemapId: 'reference-equal-earth',
  },
  view: {
    interactions: { dragPan: true, wheelZoom: true, keyboard: true, select: true },
  },
  data: { layers, basemaps, zoomTargets },
  ui: { profile: 'compact', breadcrumbs: { targets: ['world', 'africa', 'kenya'] } },
  export: { enabled: true, formats: ['image/png', 'image/svg+xml'] },
})

<GeospatialMap config={config} />
```

Copy `packages/geospatial-map/src` into the host application (for example to `src/components/geospatial-map`), install the packages listed in its README, and import `geospatial-map.css` exactly once in the app entry. The component fills its parent width and is `--geo-height` (680px by default) tall. Set the token from your own CSS or `className` to change it.

Use `<GeospatialMap>` for most maps: it lays the map out from `config.ui`. For a custom layout, where you choose and arrange the parts yourself, use `<MapRoot>` with the parts as children. See [composition](./state-events-slots.md#composition).

The projection is part of the config (`initialState.view.projection`, or an ArcGIS basemap's own). Each map has one; users can't switch it.

## Short form

Only `accessibility` and `data.layers` are required. `defineMapConfig` and `validateMapConfig` fill in the rest:

- `version: 1`
- `view: {}` and `ui: {}` (the `full` profile)
- `data.basemaps`: `esriWorldBasemap` (Esri's World Basemap, loaded from `basemaps.arcgis.com`), with `worldBasemap` (bundled country outlines) as its fallback when it can't be loaded
- a whole-world starting view, fitted to the map's size when the map starts (`view.fitWorld` is on by default when the config sets no starting zoom), with state for every layer in list order
- the first time frame as the starting time, when layers have time frames and `initialState.time` is not set
- for layers without a `kind` or with `kind: 'geojson'`: the `id` as `title`, and a default style
- `selectable: true` on GeoJSON layers and on vector tile (`mvt`) layers with a `featureIdField` (heatmaps are never selectable)

The smallest useful configuration:

```tsx
const config = defineMapConfig({
  accessibility: { ariaLabel: 'Literacy rate by country' },
  data: {
    layers: [{ id: 'literacy', data: { url: '/data/literacy.geojson' }, featureIdField: 'iso3' }],
  },
})
```

The full form remains valid; see [the full form example](./configuration.md#full-form). `defineMapConfig` returns the full form, so its result shows exactly what gets filled in. Two JSON Schemas describe the config: `mapConfigSchema` the full, normalized form, and `mapInputSchema` the short form people write. To validate a short config stored in a CMS, use `validateMapConfig`, which normalizes it first.

## Loading external JSON

```tsx
const result = validateMapConfig(await response.json())
if (!result.success) {
  reportConfigurationIssues(result.issues)
  return <ConfigurationError issues={result.issues} />
}
return <GeospatialMap config={result.config} onError={reportMapError} />
```

The component validates again at its boundary. Unknown keys, unknown schema versions, invalid layer state, and projection-incompatible basemaps fail visibly. A configuration stored before 0.9.0 fails with a message for each renamed or removed field, for example `ui.legend.defaultOpen was renamed to ui.legend.expanded in 0.9.0` or ``data.layers.0.role was removed in 0.9.0: list layers under a heading with `group` ``. Rename the field where the config is stored, using the 0.9 names.

For the CMS side, `mapInputSchema` is the JSON Schema of the short form (`MapConfigInput`): give it to a JSON editor or a CMS field so authors see mistakes as they type. In the source repository, `pnpm schema` writes it to `map-config-input.schema.json`, next to `map-config.schema.json` (the full form). The schema checks the shape; `validateMapConfig` also checks the rules between fields (ids that must exist, basemaps that must support the projection), so still run it before rendering.

An embed page is an ordinary page: it renders `<GeospatialMap>` from a config your server approved, checked with `validateMapConfig` as above.

## Configuration precedence

Defaults resolve in this order:

1. Package defaults.
2. The selected UI profile.
3. Fields supplied in `config`.
4. Controlled `state` for runtime values.

Nested objects merge. Arrays replace the profile array completely, which makes control ordering deterministic.
