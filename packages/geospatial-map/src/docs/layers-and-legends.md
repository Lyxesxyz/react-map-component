# Layers, sources, symbology, and legends

## Layer sources

`MapLayerConfig` is a discriminated union:

| Kind                  | Required source fields                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geojson`             | Inline `FeatureCollection`, `{ url }`, `{ rows }` or `{ builtin: 'world' }` (see [Data sources](#data-sources)), optional `dataProjection`, client `style`, and optional `renderer` and `cluster`. The default `kind`. |
| `heatmap`             | The same `data` as `geojson`, optional `dataProjection`, weight, radius, blur, and gradient.                                                                                                                           |
| `mvt`                 | `urlTemplate`, `sourceProjection`, optional projection definition/tile grid, and client or Mapbox style (with `layers` and `overrides`).                                                                               |
| `arcgis-vector-tiles` | `url` of an ArcGIS VectorTileServer or its item; optional `styleUrl`, `styleLayers`, `styleOverrides`, and `projection`. Everything else is read from the service.                                                     |
| `xyz`                 | `urlTemplate`, `sourceProjection`, CORS mode, and optional source zoom.                                                                                                                                                |
| `wms`                 | `url`, `params.LAYERS`, `sourceProjection`, CORS mode, and tiled mode.                                                                                                                                                 |
| `wmts`                | Service identity, source projection, format, and matrix tile grid.                                                                                                                                                     |

Common fields configure identity, role, default visibility/opacity, scale range, ordering, groups, selection, feature identity, allowed popup properties, boundary metadata, attribution, time, legend, and export eligibility.

GeoJSON layers are selectable by default. Features are identified by `featureIdField` when it is set, else by their GeoJSON `id`, else by their position in the data, so set `featureIdField` when ids must stay stable across data updates. Tile layers need `featureIdField` to be selectable. Restrict popup/event properties with `propertyAllowlist`.

### Data sources

`geojson` and `heatmap` layers take `data` in any of these forms. URLs are detected by extension or path; `format` (`'geojson'`, `'csv'`, `'json'`, `'arcgis'`) overrides the detection.

- **GeoJSON** (`.geojson`, `.json`): a FeatureCollection, a Feature, a geometry, or an array of features.
- **ArcGIS feature layers** (`…/FeatureServer/<n>`, `…/MapServer/<n>`): queried as GeoJSON in longitude/latitude, page by page (`resultOffset`), up to 200,000 features. A layer that can't page returns at most its `maxRecordCount`, with a console warning.
- **ArcGIS Online items** (`…/home/item.html?id=<id>`, `…/sharing/rest/content/items/<id>`, or the bare id): feature services resolve to their first layer; GeoJSON and CSV uploads are downloaded.
- **CSV** (`.csv`, or a `text/csv` response): longitude and latitude columns are found by name (`lon`, `lng`, `long`, `longitude`, `x`; `lat`, `latitude`, `y`, any case), or named with `longitude` and `latitude`. Comma, semicolon and tab separators, quoted fields and a byte-order mark are handled. Rows without valid coordinates are skipped with a warning.
- **JSON rows**: an array of objects, or one wrapped in `data`, `items`, `results`, `rows` or `records`, with coordinate columns as for CSV.
- **`{ rows }`**: rows already in memory. The array is compared by identity, so keep it stable between renders.

All URL forms go through `loadGeoJson` when you pass one. Wrap the exported `fetchGeoJson(url, options)` to add credentials while keeping these formats.

Lines and polygons in longitude/latitude are cut where they cross the projection's edge (the meridian opposite its central meridian), and rings around a pole are closed along it, so features like Russia, Fiji and Antarctica draw correctly.

### Colouring admin areas

The basemap draws admin boundaries but can't be coloured by your data. Add the boundaries as your own layer and style them by a property:

```ts
{
  id: 'admin1-poverty',
  title: 'Poverty rate',
  data: { url: '/data/admin1-poverty.geojson' }, // boundaries with a `poverty` property
  featureIdField: 'adm1_code',
  style: {
    type: 'graduated',
    field: 'poverty',
    classes: [
      { label: '< 10%', max: 10, symbol: { kind: 'polygon', fillColor: '#fef3c7' } },
      { label: '10–30%', min: 10, max: 30, symbol: { kind: 'polygon', fillColor: '#f59e0b' } },
      { label: '≥ 30%', min: 30, symbol: { kind: 'polygon', fillColor: '#b45309' } },
    ],
  },
}
```

If the values live in a separate table, join them onto the boundaries before passing the GeoJSON (in your API, or in `loadGeoJson`). With an ArcGIS basemap, its labels and boundary lines stay above the fills.

### Basemaps

`data.basemaps` lists the basemaps a user can choose from in the settings panel. Each has the projections it supports, its layers, a background colour, attribution, and whether it may be exported. Basemap layers with `aboveOverlays: true` draw above the data layers.

- `arcgisBasemap({ url, styleOverrides, labelsAboveData, styleUrl, attribution, projection })` uses a public ArcGIS vector tile service. Its projection, tile grid, style and attribution are read from the service when the map loads; `supportedProjections` is left empty and filled in from it. Labels and boundary lines (style layers that are symbols, or lines whose id or source layer mentions `bound`, `admin` or `border`) draw above the data unless `labelsAboveData` is `false`. `styleOverrides` changes style layers by id pattern; see the README.

- `worldBasemap` (the default) draws the bundled Natural Earth 1:110m outlines. The data is generated by `scripts/build-world-data.mjs` in the source repository.
- `tileBasemap({ url, attribution })` wraps any `{z}/{x}/{y}` raster tile service; it is Web Mercator only and not exportable unless you say so.
- `plainBasemap` has no geography.

Colours in symbols and `backgroundColor` may be CSS variables (`var(--token)`). They are resolved against the map element for the canvas and exports.

### Large point layers

- `cluster: { distance?: number, minDistance?: number }` groups points into counted bubbles. A click on a bubble zooms in to its points. Property time filtering is applied before clustering. SVG exports rasterize clustered layers.
- `renderer: 'auto' | 'canvas' | 'webgl'` chooses how a GeoJSON layer is drawn. `auto` switches point layers with 5,000+ features to WebGL when the browser reports a hardware GPU. Software renderers (SwiftShader, llvmpipe, Microsoft Basic Render) stay on the canvas, where they are much faster.
  - WebGL supports point symbols of every shape, colour and size, with zoom stops, constant, categorical, graduated and clamped continuous styles, and selection highlighting.
  - Labels, clustering, unclamped continuous styles, boolean categories and property time filtering need the canvas. `renderer: 'webgl'` on such a layer is a validation error.

## Symbology

`ThematicStyleSpec` supports constant, categorical, graduated, and continuous styles. Point, line, and polygon symbols support zoom-dependent size/width stops. Use `createClassifiedPolygonStyle` and the exported accessible palettes for consumer-editable classification.

Runtime style overrides belong in `state.layers[layerId].style`; this keeps symbology synchronized through normal React state instead of imperative renderer calls.

### Graduated bubbles

Bubble maps use the existing graduated point style. Give each numeric class a point symbol with a progressively larger `radius`; set `legend.presentation` to `size-ramp`. This keeps classification, rendering, and legend meaning in one declarative style. See [`../examples/symbology-layers.ts`](../examples/symbology-layers.ts).

### Heatmaps

Heatmaps are aggregate GeoJSON-backed layers. `weightField` defaults to `weight`; numeric values are clamped to `0–1`, while missing or non-numeric values contribute `1`. `radius` and `blur` default to `8` and `15`; `radiusStops` and `blurStops` override them as zoom changes. `gradient` must contain at least two CSS colors.

Property-filtered, URL-template, and source-replacement time modes are supported. WMS-parameter time and `selectable: true` are rejected because a heatmap does not expose individually highlighted features. Pair it with a selectable point layer when users need both density and individual observations.

When no explicit entries are supplied, the legend is derived from the low-to-high gradient. PNG and JPEG capture the rendered heatmap; SVG uses the documented raster wrapper whenever a heatmap is visible. Heatmaps work in both Equal Earth and Mercator because source features use the normal GeoJSON reprojection lifecycle.

## Legends

Legends may be supplied explicitly or derived from thematic styles. Metadata includes title, subtitle, units, description, source note, presentation, entries, and time-specific overrides.

Legend visibility follows layer visibility and scale availability. The export renderer uses the same normalized legend model, so the on-screen and report meanings stay aligned.

## Delivery guidance

Do not load detailed global boundary files directly into the browser. Simplify small GeoJSON fixtures at build time and deliver detailed or high-volume boundaries as MVT or another scale-aware service. Keep source attribution and official/non-official status in layer metadata.
