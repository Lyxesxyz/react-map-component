// What `@/components/geospatial-map` resolves to when this package is type-checked on its own
// (`pnpm --filter geospatial-map-demo-shared typecheck`): the exports that the React and the
// Angular folder's index.ts both have, which are the shared helpers and types, taken from the
// core they are synced from. Shared demo code that imports a part, a hook, an icon or a
// framework type fails this check. The demos map the alias to their own folder instead, so the
// same files also type-check against the React folder (apps/demo) and the Angular folder
// (apps/demo-angular).

export { defineMapConfig } from '../../../packages/geospatial-map-core/src/config/normalize'
export { validateMapConfig } from '../../../packages/geospatial-map-core/src/config/validate'
export {
  mapConfigSchema,
  mapInputSchema,
} from '../../../packages/geospatial-map-core/src/config/schema'
export {
  arcgisBasemap,
  esriWorldBasemap,
  plainBasemap,
  tileBasemap,
  worldBasemap,
} from '../../../packages/geospatial-map-core/src/basemaps'
export type {
  ArcGISBasemapOptions,
  TileBasemapOptions,
} from '../../../packages/geospatial-map-core/src/basemaps'
export {
  defaultMapMessages,
  formatMapMessage,
} from '../../../packages/geospatial-map-core/src/messages'
export { mapThemeTokenNames } from '../../../packages/geospatial-map-core/src/theme'
export {
  accessiblePalettes,
  createClassifiedPolygonStyle,
} from '../../../packages/geospatial-map-core/src/core/symbology-presets'
export type {
  ClassificationMethod,
  PaletteId,
} from '../../../packages/geospatial-map-core/src/core/symbology-presets'
export { fetchGeoJson } from '../../../packages/geospatial-map-core/src/core/data-sources'
export { cn } from '../../../packages/geospatial-map-core/src/utils'
export { GEOSPATIAL_MAP_VERSION } from '../../../packages/geospatial-map-core/src/version'
export type * from '../../../packages/geospatial-map-core/src/types'
