// Ready-made layout
export { GeospatialMap } from './geospatial-map'

// Composable parts
export { MapRoot, MapRootBase } from './map-root'
export { MapAttribution } from './map-attribution'
export {
  MapBuiltInButton,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapFitButton,
  MapFullscreenButton,
  MapLayersButton,
  MapLocateButton,
  MapResetZoomButton,
  MapSettingsButton,
  MapZoomInButton,
  MapZoomOutButton,
} from './map-controls'
export { MapLegend, MapLegendSymbol } from './map-legend'
export { MapPopup } from './map-popup'
export { MapTooltip } from './map-tooltip'
export { MapActionEvent } from './map-action-event'
export type { MapButtonAction } from './map-action-event'

// Templates for popup, tooltip, custom control and error content
export {
  MapConfigErrorTemplate,
  MapControlTemplate,
  MapErrorTemplate,
  MapPopupTemplate,
  MapTooltipTemplate,
} from './map-templates'

// Injection functions for custom parts
export {
  MAP_CONTEXT,
  injectHoveredFeature,
  injectMap,
  injectMapActions,
  injectMapIcons,
  injectMapPixel,
  injectMapRuntime,
  injectMapStatic,
  injectSlotContext,
} from './map-context'
export type { MapContext } from './map-context'
export { anchoredPosition } from './map-anchor'
export { MAP_ICONS, defaultMapIcons, provideMapIcons } from './icons'
export { MapIconView, SvgIcon, isSvgIcon } from './map-icon'

// UI primitives (swap these for your design system in shapes.ts)
export {
  ShapeAlert,
  ShapeBadge,
  ShapeButton,
  ShapeCard,
  ShapeIconButton,
  ShapeLabel,
  ShapeSelect,
  ShapeSlider,
  ShapeSwitch,
} from './shapes'
export type { ShapeSelectOption } from './shapes'
export { cn } from './utils'
export { GEOSPATIAL_MAP_VERSION } from './version'

// Configuration, theming, localization
export { defineMapConfig } from './config/normalize'
export { validateMapConfig } from './config/validate'
export { mapConfigSchema, mapInputSchema } from './config/schema'
export { arcgisBasemap, plainBasemap, tileBasemap, worldBasemap } from './basemaps'
export type { ArcGISBasemapOptions, TileBasemapOptions } from './basemaps'
export { defaultMapMessages, formatMapMessage } from './messages'
export { mapThemeTokenNames } from './theme'
export { accessiblePalettes, createClassifiedPolygonStyle } from './core/symbology-presets'
export type { ClassificationMethod, PaletteId } from './core/symbology-presets'
export { fetchGeoJson } from './core/data-sources'
export type * from './types'
export type * from './component-types'
