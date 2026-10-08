'use client'

import { forwardRef } from 'react'
import { MapAttribution } from './map-attribution'
import { MapBreadcrumbs } from './map-breadcrumbs'
import { useMapStatic } from './map-context'
import { MapControls } from './map-controls'
import { MapDisclaimer } from './map-disclaimer'
import { MapErrorAlert } from './map-error-alert'
import { MapLayerPanel } from './map-layer-panel'
import { MapLegend } from './map-legend'
import { MapPopup } from './map-popup'
import { MapRoot } from './map-root'
import { MapSettings } from './map-settings'
import { MapStatusChips } from './map-status-chips'
import { MapTimeControls } from './map-time-controls'
import { MapTooltip } from './map-tooltip'
import type { GeospatialMapHandle, GeospatialMapProps, MapSlots } from './component-types'

/**
 * The complete map UI, laid out from `config.ui` (profiles, placements, enabled parts). Add
 * your own parts as children, or build a custom layout with `<MapRoot>` and the parts.
 */
export const GeospatialMap = forwardRef<GeospatialMapHandle, GeospatialMapProps>(
  function GeospatialMap({ slots, children, ...props }, ref) {
    return (
      <MapRoot ref={ref} {...props}>
        <GeospatialMapLayout slots={slots} />
        {children}
      </MapRoot>
    )
  },
)

/** The preset's parts, in drawing order, each enabled by `config.ui`. */
function GeospatialMapLayout({ slots }: { slots?: MapSlots | undefined }) {
  const { ui } = useMapStatic()
  return (
    <>
      {ui.controls.enabled && (
        <MapControls {...(slots?.controls ? { customControls: slots.controls } : {})} />
      )}
      {ui.settings.enabled && <MapSettings />}
      {ui.breadcrumbs.enabled && <MapBreadcrumbs />}
      {ui.layerPanel.enabled && <MapLayerPanel />}
      {ui.legend.enabled && <MapLegend />}
      {ui.popup.enabled && <MapPopup>{slots?.popup}</MapPopup>}
      {ui.tooltip.enabled && <MapTooltip>{slots?.tooltip}</MapTooltip>}
      {ui.disclaimer.enabled && <MapDisclaimer />}
      {ui.statusChips.enabled && <MapStatusChips />}
      {ui.time.enabled && <MapTimeControls />}
      {ui.errorAlert.enabled && <MapErrorAlert />}
      {ui.attribution.enabled && <MapAttribution />}
    </>
  )
}
