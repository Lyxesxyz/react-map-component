import { GeospatialMap } from './geospatial-map'
import { MapAttribution } from './map-attribution'
import { MapBreadcrumbs } from './map-breadcrumbs'
import {
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
import { MapDisclaimer } from './map-disclaimer'
import { MapErrorAlert } from './map-error-alert'
import { MapGrid } from './map-grid'
import { MapIconView, SvgIcon } from './map-icon'
import { MapLayerPanel } from './map-layer-panel'
import { MapLegend, MapLegendSymbol } from './map-legend'
import { MapPopup } from './map-popup'
import { MapRoot } from './map-root'
import { MapBasemapField, MapExportField, MapSettings, MapZoomTargetField } from './map-settings'
import { MapStatusChips } from './map-status-chips'
import {
  MapConfigErrorTemplate,
  MapControlTemplate,
  MapErrorTemplate,
  MapPopupTemplate,
  MapTooltipTemplate,
} from './map-templates'
import { MapTimeControls } from './map-time-controls'
import { MapTooltip } from './map-tooltip'
import {
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

// Ready-made layouts
export { GeospatialMap } from './geospatial-map'
export { MapGrid } from './map-grid'

// Composable parts
export { MapRoot, MapRootBase } from './map-root'
export { MapAttribution } from './map-attribution'
export { MapBreadcrumbs, MapTargetClickEvent } from './map-breadcrumbs'
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
export { MapDisclaimer } from './map-disclaimer'
export { MapErrorAlert } from './map-error-alert'
export { MapLayerPanel } from './map-layer-panel'
export { MapLegend, MapLegendSymbol } from './map-legend'
export { MapPopup } from './map-popup'
export { MapBasemapField, MapExportField, MapSettings, MapZoomTargetField } from './map-settings'
export { MapStatusChips } from './map-status-chips'
export { MapTimeControls } from './map-time-controls'
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

/**
 * Every part, template and shape a template can use, for `imports: [GEO_MAP_PARTS]` in a
 * component that builds its own layout. Importing only the ones you use works too.
 */
export const GEO_MAP_PARTS = [
  // Ready-made layouts and the root
  GeospatialMap,
  MapGrid,
  MapRoot,
  // Parts
  MapControls,
  MapControlGroup,
  MapControlButton,
  MapZoomInButton,
  MapZoomOutButton,
  MapResetZoomButton,
  MapLocateButton,
  MapLayersButton,
  MapSettingsButton,
  MapFitButton,
  MapFullscreenButton,
  MapSettings,
  MapBasemapField,
  MapZoomTargetField,
  MapExportField,
  MapBreadcrumbs,
  MapLayerPanel,
  MapLegend,
  MapLegendSymbol,
  MapPopup,
  MapTooltip,
  MapDisclaimer,
  MapStatusChips,
  MapTimeControls,
  MapErrorAlert,
  MapAttribution,
  // Templates
  MapPopupTemplate,
  MapTooltipTemplate,
  MapControlTemplate,
  MapErrorTemplate,
  MapConfigErrorTemplate,
  // Icons and shapes
  MapIconView,
  SvgIcon,
  ShapeButton,
  ShapeIconButton,
  ShapeSelect,
  ShapeSlider,
  ShapeSwitch,
  ShapeCard,
  ShapeAlert,
  ShapeLabel,
  ShapeBadge,
] as const

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
