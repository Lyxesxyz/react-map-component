// Ready-made layouts
export { GeospatialMap } from './geospatial-map'
export { MapGrid } from './map-grid'

// Composable parts
export { MapRoot } from './map-root'
export { MapAttribution } from './map-attribution'
export type { MapAttributionProps } from './map-attribution'
export { MapBreadcrumbs } from './map-breadcrumbs'
export type { MapBreadcrumbsProps } from './map-breadcrumbs'
export {
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
export type {
  MapBuiltInButtonProps,
  MapControlButtonProps,
  MapControlGroupProps,
  MapControlsProps,
} from './map-controls'
export { MapLayerPanel } from './map-layer-panel'
export type { MapLayerPanelProps } from './map-layer-panel'
export { MapLegend, MapLegendSymbol } from './map-legend'
export type { MapLegendProps, MapLegendSymbolProps } from './map-legend'
export { MapPopup } from './map-popup'
export type { MapPopupProps, MapPopupRenderContext } from './map-popup'
export { MapBasemapField, MapExportField, MapSettings, MapZoomTargetField } from './map-settings'
export type { MapSettingsProps } from './map-settings'
export { MapErrorAlert, MapStatus } from './map-status'
export type { MapErrorAlertProps, MapStatusProps } from './map-status'
export { MapDisclaimer } from './map-disclaimer'
export type { MapDisclaimerProps } from './map-disclaimer'
export { MapTooltip } from './map-tooltip'
export type { MapTooltipProps } from './map-tooltip'
export { MapTimeControls } from './map-time-controls'
export type { MapTimeControlsProps } from './map-time-controls'

// Hooks for custom parts
export { useHoveredFeature, useMap, useMapActions, useMapPixel } from './map-context'

// UI primitives (swap these for your design system in shapes.tsx)
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
export type { ShapeButtonProps, ShapeIconButtonProps, ShapeSwitchProps } from './shapes'
export { cn } from './utils'
export { GEOSPATIAL_MAP_VERSION } from './version'

// Configuration, theming, localization
export {
  defaultInitialView,
  defaultLayerStyle,
  defineMapConfig,
  initialMapState,
  normalizeMapConfig,
  mapConfigSchema,
  mapUiProfiles,
  resolveMapUi,
  validateMapConfig,
} from './config'
export { arcgisBasemap, plainBasemap, tileBasemap, worldBasemap } from './basemaps'
export type { ArcGISBasemapOptions, TileBasemapOptions } from './basemaps'
export { defaultMapMessages, formatMapMessage, resolveMapMessages } from './messages'
export { defaultMapTheme, mapThemeStyle, mapThemeVariables, resolveMapTheme } from './theme'
export { accessiblePalettes, createClassifiedPolygonStyle } from './core/symbology-presets'
export type {
  ClassificationMethod,
  PaletteId,
  SymbologyControlPolicy,
} from './core/symbology-presets'
export { createEmbedSnippet, createPublicEmbedConfig } from './core/embed'
export { fetchGeoJson } from './core/data-sources'
export type * from './types'
