# Layers, sources, symbology, and legends

## Layer sources

`MapLayerConfig` is a discriminated union:

| Kind                  | Required source fields                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geojson`             | Inline `FeatureCollection`, `{ url }`, `{ rows }` or `{ builtin: 'world' }` (see [Data sources](#data-sources)), optional `sourceProjection` and `sourceProjectionDefinition`, client `style`, and optional `renderer` and `cluster`. The default `kind`. |
| `heatmap`             | The same `data` as `geojson`, optional `sourceProjection` and `sourceProjectionDefinition`, weight, radius, blur, and gradient.                                                                                                                           |
| `mvt`                 | `url` (tile template), `sourceProjection`, optional `sourceProjectionDefinition`/`tileGrid`, and client `style` or `mapboxStyle` (`url`, with optional `layers` and `overrides`).                                                                         |
| `arcgis-vector-tiles` | `url` of an ArcGIS VectorTileServer or its item; optional `mapboxStyle` (`url`, `layers`, `overrides`; `url` defaults to the service's own style) and `sourceProjectionDefinition`. Everything else is read from the service.                             |
| `xyz`                 | `url` (tile template), `sourceProjection`, CORS mode, and optional source zoom.                                                                                                                                                                           |
| `wms`                 | `url`, `params.LAYERS`, `sourceProjection`, and CORS mode. WMS layers are always tiled.                                                                                                                                                                   |
| `wmts`                | Service identity, source projection, format, and matrix tile grid.                                                                                                                                                                                        |

Common fields configure identity, role, default visibility/opacity, scale range, ordering (`zIndex`, and `reorderable`, which defaults to `true`; `reorderable: false` keeps a layer in place in the layer panel), groups, selection, feature identity, allowed popup properties, boundary metadata, attribution, time, legend, and export eligibility.

GeoJSON layers are selectable by default. Features are identified by `featureIdField` when it is set, else by their GeoJSON `id`, else by their position in the data, so set `featureIdField` when ids must stay stable across data updates. Tile layers need `featureIdField` to be selectable. Restrict popup/event properties with `propertyAllowlist`.

### Data sources

`geojson` and `heatmap` layers take `data` in any of these forms. URLs are detected by extension or path; `format` (`'geojson'`, `'csv'`, `'json'`, `'arcgis'`) overrides the detection.

- **GeoJSON** (`.geojson`, `.json`): a FeatureCollection, a Feature, a geometry, or an array of features.
- **ArcGIS feature layers** (`…/FeatureServer/<n>`, `…/MapServer/<n>`): queried as GeoJSON in longitude/latitude, page by page (`resultOffset`), up to 200,000 features. A layer that can't page returns at most its `maxRecordCount`, with a console warning.
- **ArcGIS Online items** (`…/home/item.html?id=<id>`, `…/sharing/rest/content/items/<id>`, or the bare id): feature services resolve to their first layer; GeoJSON and CSV uploads are downloaded.
- **CSV** (`.csv`, or a `text/csv` response): longitude and latitude columns are found by name (`lon`, `lng`, `long`, `longitude`, `x`; `lat`, `latitude`, `y`, any case), or named with `longitude` and `latitude`. Comma, semicolon and tab separators, quoted fields and a byte-order mark are handled. Rows without valid coordinates are skipped with a warning.
- **JSON rows**: an array of objects, or one wrapped in `data`, `items`, `results`, `rows` or `records`, with coordinate columns as for CSV.
- **`{ rows }`**: rows already in memory. The array is compared by identity, so keep it stable between renders.
- **Inline GeoJSON**: a `FeatureCollection` object. Other GeoJSON members such as `bbox` and `name` are allowed. Like rows, keep it stable between renders.

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
    missing: { label: 'No data', symbol: { kind: 'polygon', fillColor: '#e5e7eb' } },
  },
}
```

If the values live in a separate table, join them onto the boundaries before passing the GeoJSON (in your API, or in `loadGeoJson`). With an ArcGIS basemap, its labels and boundary lines stay above the fills.

### Basemaps

`data.basemaps` lists the basemaps a user can choose from in the settings panel. Each has an `id`, a `title`, the projections it supports, and its layers. `backgroundColor` (default `var(--geo-stage)`), `attribution` (default: the attributions of its layers), and `exportable` (default `true`) are optional. Basemap layers with `aboveOverlays: true` draw above the data layers.

- `arcgisBasemap({ url, id, title, styleOverrides, labelsAboveData, styleUrl, attribution, exportable, sourceProjectionDefinition })` uses a public ArcGIS vector tile service. Its projection, tile grid, style and attribution are read from the service when the map loads; `supportedProjections` is left empty and filled in from it. Labels and boundary lines (style layers that are symbols, or lines whose id or source layer mentions `bound`, `admin` or `border`) draw above the data unless `labelsAboveData` is `false`. `styleOverrides` changes style layers by id pattern; see the README. `sourceProjectionDefinition` is only for services in a spatial reference the map doesn't recognise. These options stay flat; the layers it creates hold them in `mapboxStyle`.

- `worldBasemap` (the default) draws the bundled Natural Earth 1:110m outlines. The data is generated by `scripts/build-world-data.mjs` in the source repository.
- `tileBasemap({ url, attribution })` wraps any `{z}/{x}/{y}` raster tile service; it is Web Mercator only and not exportable unless you say so.
- `plainBasemap` has no geography.

Colours in symbols and `backgroundColor` may be CSS variables (`var(--token)`). They are resolved against the map element for the canvas and exports.

### Large point layers

- `cluster: { distance?: number, minDistance?: number }` groups points into counted bubbles. A click on a bubble zooms in to its points. Property time filtering is applied before clustering. SVG exports rasterize clustered layers.
- `renderer: 'auto' | 'canvas' | 'webgl'` chooses how a GeoJSON layer is drawn. `auto` switches point layers with 5,000+ features to WebGL when the browser reports a hardware GPU. Software renderers (SwiftShader, llvmpipe, Microsoft Basic Render) stay on the canvas, where they are much faster.
  - WebGL draws exactly what the canvas draws: point symbols of every shape, colour, size and opacity, with zoom stops, every style type (including boolean categories and unclamped continuous styles), the same [symbol precedence](#how-a-value-picks-its-symbol), and selection highlighting.
  - Line and polygon symbols, labels, clustering and property time filtering need the canvas. `renderer: 'webgl'` on such a layer is a validation error.

## Symbology

`ThematicStyleSpec` supports constant, categorical, graduated, and continuous styles. Point, line, and polygon symbols support zoom-dependent size/width stops. Use `createClassifiedPolygonStyle` and the exported accessible palettes for consumer-editable classification.

Runtime style overrides belong in `state.layers[layerId].style`; this keeps symbology synchronized through normal React state instead of imperative renderer calls.

### How a value picks its symbol

Each thematic style becomes one ordered list of rules. The canvas renderer, the WebGL renderer, the legend and exports all read the same list, so a value gets the same symbol everywhere. The first rule that matches a feature's `field` value draws it:

1. **`specialValues`**: an exact match on the value. A special value of `null` also matches an absent property.
2. **`missing`** (graduated and continuous styles): the value is absent, empty (`''`), or not a number (text, `true`/`false`, `NaN`). Numeric strings such as `'12.5'` count as numbers.
3. **The main rules**: `categories` (exact match: the string `'1'` does not match the number `1`), graduated `classes` (`min` inclusive, `max` exclusive; either may be left out), or the continuous ramp. A clamped ramp (`clamp` defaults to `true`) takes every number; an unclamped ramp takes only numbers inside `domain`.
4. **`outOfRange`** (graduated and continuous styles): a number no class covers, or outside the domain of an unclamped ramp. Such numbers don't use `missing`.
5. **`fallback`** (categorical styles): any value no category matched, including absent ones.

A feature that no rule matches is not drawn. For example, a graduated style without `missing` hides features whose value is absent or text, and one without `outOfRange` hides numbers outside its classes.

The legend lists the main rules first, then `fallback` or `missing`, then `outOfRange`, then the special values.

### Opacity

`opacity` (0 to 1) works on every symbol and with any CSS colour: hex, `rgb()`/`rgba()`, named colours, and `var(--token)`.

- **Polygon**: `opacity` applies to the fill only; the outline keeps its own colour.
- **Point and line**: `opacity` applies to the whole symbol: a point's fill and stroke together, a line's stroke.

Labels are not faded.

A layer's opacity (`opacity` on the layer, or the layer panel slider) multiplies with the symbol's.

### Graduated bubbles

Bubble maps use the existing graduated point style. Give each numeric class a point symbol with a progressively larger `radius`. The legend draws each class's point at its own radius (between 2 and 8 pixels). This keeps classification, rendering, and legend meaning in one declarative style. See [`../examples/symbology-layers.ts`](../examples/symbology-layers.ts).

### Heatmaps

Heatmaps are aggregate GeoJSON-backed layers. `weightField` defaults to `weight`; numeric values are clamped to `0–1`, while missing or non-numeric values contribute `1`. `radius` and `blur` default to `8` and `15`; `radiusStops` and `blurStops` override them as zoom changes. `gradient` must contain at least two CSS colors.

Property-filtered, URL-template, and source-replacement time modes are supported. WMS-parameter time and `selectable: true` are rejected because a heatmap does not expose individually highlighted features. Pair it with a selectable point layer when users need both density and individual observations.

When no explicit entries are supplied, the legend is derived from the low-to-high gradient. PNG and JPEG capture the rendered heatmap; SVG uses the documented raster wrapper whenever a heatmap is visible. Heatmaps work in both Equal Earth and Mercator because source features use the normal GeoJSON reprojection lifecycle.

## Legends

Legends may be supplied explicitly or derived from thematic styles. Metadata includes title, subtitle, units, description, source note, entries, and time-specific overrides (`byTime`). Hand-written `entries` replace the derived ones. The legend has no layer toggles; users show and hide layers from the layer panel.

Legend visibility follows layer visibility and scale availability. PNG, JPEG and SVG exports show the same legend as the screen, including hand-written `entries`, so the on-screen and report meanings stay aligned.

## Delivery guidance

Do not load detailed global boundary files directly into the browser. Simplify small GeoJSON fixtures at build time and deliver detailed or high-volume boundaries as MVT or another scale-aware service. Keep source attribution and official/non-official status in layer metadata.
