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
export type { MapPopupProps } from './map-popup'
export { MapBasemapField, MapExportField, MapSettings, MapZoomTargetField } from './map-settings'
export type { MapSettingsProps } from './map-settings'
export { MapErrorAlert } from './map-error-alert'
export type { MapErrorAlertProps } from './map-error-alert'
export { MapStatusChips } from './map-status-chips'
export type { MapStatusChipsProps } from './map-status-chips'
export { MapDisclaimer } from './map-disclaimer'
export type { MapDisclaimerProps } from './map-disclaimer'
export { MapTooltip } from './map-tooltip'
export type { MapTooltipProps } from './map-tooltip'
export { MapTimeControls } from './map-time-controls'
export type { MapTimeControlsProps } from './map-time-controls'

// Hooks for custom parts
export {
  useHoveredFeature,
  useMap,
  useMapActions,
  useMapIcons,
  useMapPixel,
  useMapRuntime,
  useMapStatic,
} from './map-context'
export { defaultMapIcons } from './icons'

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
