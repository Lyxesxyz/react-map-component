# Layers, sources, symbology, and legends

## Layer sources

`MapLayerConfig` is a discriminated union:

| Kind      | Required source fields                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------- |
| `geojson` | Inline `FeatureCollection` or `{ url }`, optional `dataProjection`, and client `style`.                  |
| `heatmap` | Inline `FeatureCollection` or `{ url }`, optional `dataProjection`, weight, radius, blur, and gradient.  |
| `mvt`     | `urlTemplate`, `sourceProjection`, optional projection definition/tile grid, and client or Mapbox style. |
| `xyz`     | `urlTemplate`, `sourceProjection`, CORS mode, and optional source zoom.                                  |
| `wms`     | `url`, `params.LAYERS`, `sourceProjection`, CORS mode, and tiled mode.                                   |
| `wmts`    | Service identity, source projection, format, and matrix tile grid.                                       |

Common fields configure identity, role, default visibility/opacity, scale range, ordering, groups, selection, feature identity, allowed popup properties, boundary metadata, attribution, time, legend, and export eligibility.

Selectable vector layers need `featureIdField` unless every feature already has a stable GeoJSON ID. Restrict popup/event properties with `propertyAllowlist`.

## Symbology

`ThematicStyleSpec` supports constant, categorical, graduated, and continuous styles. Point, line, and polygon symbols support zoom-dependent size/width stops. Use `createClassifiedPolygonStyle` and the exported accessible palettes for consumer-editable classification.

Runtime style overrides belong in `state.layers[layerId].style`; this keeps symbology synchronized through normal React state instead of imperative renderer calls.

### Graduated bubbles

Bubble maps use the existing graduated point style. Give each numeric class a point symbol with a progressively larger `radius`; set `legend.presentation` to `size-ramp`. This keeps classification, rendering, and legend meaning in one declarative style. See [`../examples/layers.ts`](../examples/layers.ts).

### Heatmaps

Heatmaps are aggregate GeoJSON-backed layers. `weightField` defaults to `weight`; numeric values are clamped to `0–1`, while missing or non-numeric values contribute `1`. `radius` and `blur` default to `8` and `15`; `radiusStops` and `blurStops` override them as zoom changes. `gradient` must contain at least two CSS colors.

Property-filtered, URL-template, and source-replacement time modes are supported. WMS-parameter time and `selectable: true` are rejected because a heatmap does not expose individually highlighted features. Pair it with a selectable point layer when users need both density and individual observations.

When no explicit entries are supplied, the legend is derived from the low-to-high gradient. PNG and JPEG capture the rendered heatmap; SVG uses the documented raster wrapper whenever a heatmap is visible. Heatmaps work in both Equal Earth and Mercator because source features use the normal GeoJSON reprojection lifecycle.

## Legends

Legends may be supplied explicitly or derived from thematic styles. Metadata includes title, subtitle, units, description, source note, presentation, entries, and time-specific overrides.

Legend visibility follows layer visibility and scale availability. The export renderer uses the same normalized legend model, so the on-screen and report meanings stay aligned.

## Delivery guidance

Do not load detailed global boundary files directly into the browser. Simplify small GeoJSON fixtures at build time and deliver detailed or high-volume boundaries as MVT or another scale-aware service. Keep source attribution and official/non-official status in layer metadata.
