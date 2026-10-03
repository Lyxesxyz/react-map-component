'use client'

import { forwardRef, useCallback } from 'react'
import { MapAttribution } from './map-attribution'
import { MapBreadcrumbs } from './map-breadcrumbs'
import { useMap, useSlotContext } from './map-context'
import { MapControls } from './map-controls'
import { MapLayerPanel } from './map-layer-panel'
import { MapLegend } from './map-legend'
import { MapPopup } from './map-popup'
import { MapTooltip } from './map-tooltip'
import { MapRoot } from './map-root'
import { MapSettings } from './map-settings'
import { MapErrorAlert, MapStatus } from './map-status'
import { MapTimeControls } from './map-time-controls'
import type {
  ConfigIssue,
  GeospatialMapConfigV1,
  GeospatialMapHandle,
  GeospatialMapProps,
  MapSlots,
  ResolvedMapUiConfig,
} from './types'

/** Rejects `custom:*` controls in `ui.controlRail.groups` that have no `slots.controls` renderer. */
function missingCustomControls(
  ui: ResolvedMapUiConfig,
  slots: MapSlots | undefined,
): ConfigIssue[] {
  return ui.controlRail.groups
    .flatMap((group) => group.controls)
    .filter((id) => id.startsWith('custom:') && !slots?.controls?.[id as `custom:${string}`])
    .map((id) => ({
      path: '/ui/controlRail/groups',
      code: 'missing-renderer',
      message: `Custom control ${id} has no matching slots.controls renderer`,
    }))
}

/**
 * The complete map UI, laid out from `config.ui` (profiles, placements, enabled panels).
 * Add your own parts as children, or build a custom layout with `<MapRoot>` and the parts.
 */
export const GeospatialMap = forwardRef<GeospatialMapHandle, GeospatialMapProps>(
  function GeospatialMap({ slots, children, ...props }, ref) {
    const controls = slots?.controls
    const validate = useCallback(
      (_config: GeospatialMapConfigV1, ui: ResolvedMapUiConfig) =>
        missingCustomControls(ui, controls ? { controls } : undefined),
      [controls],
    )
    const slotError = slots?.error
    return (
      <MapRoot
        ref={ref}
        {...props}
        validate={validate}
        {...(slotError ? { renderConfigError: slotError } : {})}
      >
        <GeospatialMapLayout slots={slots} />
        {children}
      </MapRoot>
    )
  },
)

/** The preset's parts, in drawing order, each enabled by `config.ui`. */
export function GeospatialMapLayout({ slots }: { slots?: MapSlots | undefined }) {
  const { config, ui } = useMap()
  const context = useSlotContext()
  const timeEnabled = config.time?.enabled ?? !['embedded', 'grid'].includes(ui.profile)
  const panelHeader = (panel: 'settings' | 'layers' | 'legend') =>
    slots?.panelHeader?.(panel, context) ?? undefined
  const panelFooter = (panel: 'settings' | 'layers' | 'legend') =>
    slots?.panelFooter?.(panel, context)
  const popup = slots?.popup
  const error = slots?.error
  return (
    <>
      {ui.controlRail.enabled && (
        <MapControls
          renderCustomControl={(id, slotContext) => slots?.controls?.[id]?.(slotContext)}
        />
      )}
      {ui.settings.enabled && (
        <MapSettings header={panelHeader('settings')} footer={panelFooter('settings')} />
      )}
      {ui.hierarchy.enabled && <MapBreadcrumbs />}
      {ui.layers.enabled && (
        <MapLayerPanel header={panelHeader('layers')} footer={panelFooter('layers')} />
      )}
      {ui.legend.enabled && (
        <MapLegend header={panelHeader('legend')} footer={panelFooter('legend')} />
      )}
      {ui.popup.enabled && (
        <MapPopup>{popup ? (popupContext) => popup(popupContext) : undefined}</MapPopup>
      )}
      {ui.tooltip.enabled && <MapTooltip />}
      {ui.status.enabled && (
        <MapStatus loading={slots?.loading?.(context)} empty={slots?.empty?.(context)} />
      )}
      {timeEnabled && <MapTimeControls />}
      {ui.errors.enabled && (
        <MapErrorAlert>{error ? (mapError) => error(mapError, context) : undefined}</MapErrorAlert>
      )}
      {ui.attribution.enabled && <MapAttribution />}
    </>
  )
}
