# Migration

## From the `@org/geospatial-map` npm package (0.1) to the copy-paste folder

The npm package build is gone. The source folder is the component.

| 0.1 package                                                                | Copy-paste folder                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm add @org/geospatial-map`                                             | Copy `packages/geospatial-map/src` into your app. Install `ol ol-mapbox-style proj4 typebox lucide-react` and `@types/geojson`. |
| `import … from '@org/geospatial-map'`                                      | `import … from '@/components/geospatial-map'` (or a relative path)                                                              |
| `import '@org/geospatial-map/styles.css'` (and an implicit import from JS) | `import '…/geospatial-map/geospatial-map.css'` once in the app entry. The JS no longer imports CSS.                             |
| `@org/geospatial-map/schema.json`                                          | `mapConfigSchema` export, or `pnpm schema` in the source repository                                                             |
| Inter bundled through `@fontsource-variable/inter`                         | The map inherits the app font. Set `--geo-font-family` to choose one.                                                           |
| `ol/ol.css` imported globally                                              | The few OpenLayers rules the map needs are scoped inside `geospatial-map.css`.                                                  |

The JSON configuration, `GeospatialMap` props, slots, callbacks, and the `ref` handle are unchanged. New in this release:

- `<MapRoot>` and the composable parts.
- `useMap()` and `useMapActions()`.
- `children` on `<GeospatialMap>`.
- `cellClassName` on `<MapGrid>`.
- The message keys `geographicHierarchy`, `publishedOn`, `nonOfficial`, and `tooManyGridMaps`.

### CSS variables

`config.theme` keys are unchanged. They now write these variables, and only when you set them, so your stylesheet can override the defaults.

| 0.1 variable                                                                              | Now                                                              |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `--geo-ink`                                                                               | `--geo-foreground`                                               |
| `--geo-muted`                                                                             | `--geo-muted-foreground` (`--geo-muted` is now the soft surface) |
| `--geo-surface`                                                                           | `--geo-background`                                               |
| `--geo-surface-soft`                                                                      | `--geo-muted`                                                    |
| `--geo-glass`                                                                             | `--geo-overlay`                                                  |
| `--geo-accent`                                                                            | `--geo-primary` (`--geo-accent` is now the hover surface)        |
| `--geo-accent-hover`                                                                      | `--geo-primary-hover`                                            |
| `--geo-danger`                                                                            | `--geo-destructive`                                              |
| `--geo-focus`                                                                             | `--geo-ring`                                                     |
| `--geo-border`, `--geo-radius`, `--geo-shadow`, `--geo-control-size`, `--geo-font-family` | unchanged                                                        |

### Classes

- The root density class `geo-density-compact` is now the attribute `data-density="compact"`.
- Rules that targeted elements inside panels (`.geo-legend h2`, `.geo-popup dl div`, …) now target explicit classes, such as `.geo-legend-heading` and `.geo-popup-field`.
  - Content you render in slots no longer inherits the map's heading and list styles. Style it from your own CSS.
- The switch markup has classes for its input, track, and label: `.geo-shape-switch-input`, `.geo-shape-switch-track`, `.geo-shape-switch-label`.

## From the legacy 0.1 props

This release intentionally removes the scattered component props.

| Legacy prop                                                          | New location                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| `id`, `ariaLabel`                                                    | `config.id`, `config.accessibility.ariaLabel`           |
| `defaultView`, `defaultBasemapId`, `defaultSelection`, `defaultTime` | `config.initialState`                                   |
| `view`, `activeBasemapId`, `selection`, `time`                       | controlled `state`                                      |
| `layers`, `basemaps`, `zoomTargets`, `hierarchy`                     | `config.data`                                           |
| `projectionBehavior`                                                 | `config.view.projectionBehavior`                        |
| `controls`                                                           | `config.ui` and its profile/panel/control policies      |
| `exportOptions`                                                      | `config.export`                                         |
| `timePlayback`                                                       | `config.time`                                           |
| `renderPopup`                                                        | `slots.popup`                                           |
| `children`                                                           | children of `<GeospatialMap>` or `<MapRoot>`, or a slot |
| `serialize()`, `getView()`                                           | `getState()`                                            |
| `setLayerStyle()`                                                    | `state.layers[layerId].style`                           |

Callbacks retain their names. Add `onStateChange` when the host needs one complete synchronized state contract.
