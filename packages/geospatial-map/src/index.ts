export { GeospatialMap } from './react/GeospatialMap.js'
export { MapGrid } from './react/MapGrid.js'
export { createMapController, MapController } from './core/map-controller.js'
export { ensureEqualEarthProjection, projectionForZoom } from './core/projections.js'
export { legendEntriesForStyle, normalizeLegend } from './core/legend-model.js'
export { symbolForValue } from './core/style-compiler.js'
export { accessiblePalettes, createClassifiedPolygonStyle } from './core/symbology-presets.js'
export type {
  ClassificationMethod,
  PaletteId,
  SymbologyControlPolicy,
} from './core/symbology-presets.js'
export { createEmbedSnippet, createPublicEmbedConfig } from './core/embed.js'
export * from './types.js'
import './styles.css'
