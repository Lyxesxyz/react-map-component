# @org/geospatial-map

## Public surface

- `GeospatialMap` and `GeospatialMapHandle`
- `MapGrid`
- `createMapController` for future framework adapters
- declarative `MapLayerConfig`, symbology, legend, time, selection, projection, attribution, and export types
- `createClassifiedPolygonStyle` with approved accessible palettes
- `createPublicEmbedConfig` and `createEmbedSnippet`

GeoJSON defaults to `EPSG:4326`; other source coordinate systems must be declared. Detailed boundaries should be delivered as MVT, simplified GeoJSON selected outside the browser, or a scale-aware service. Raster layers support XYZ, tiled WMS, and WMTS.

PNG/JPEG export requires every visible source to allow anonymous CORS canvas use. Vector-only GeoJSON views export as vector-native SVG; configurations containing tiles use an explicitly labeled raster SVG wrapper.
