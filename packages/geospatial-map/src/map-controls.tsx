'use client'

import { forwardRef, useState } from 'react'
import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react'
import { useMap, useMapIcons, useSlotContext } from './map-context'
import { ShapeIconButton } from './shapes'
import type { ShapeButtonProps } from './shapes'
import type {
  BuiltInControlId,
  ControlGroupConfig,
  ControlRailConfig,
  MapContextValue,
  MapPlacement,
  MapSlotContext,
} from './types'
import { cn, composeHandler } from './utils'

export type MapControlsProps = ComponentPropsWithoutRef<'div'> & {
  /** Corner of the map; defaults to `ui.controlRail.placement`. */
  placement?: MapPlacement
  /** Groups rendered when there are no children; defaults to `ui.controlRail.groups`. */
  groups?: ControlGroupConfig[]
  /** Renders `custom:*` ids listed in `groups`. */
  renderCustomControl?: (id: `custom:${string}`, context: MapSlotContext) => ReactNode
}

/** The floating control rail. Pass `<MapControlGroup>` children, or let it render the config. */
export function MapControls({
  placement,
  groups,
  renderCustomControl,
  className,
  children,
  ...props
}: MapControlsProps) {
  const map = useMap()
  const slotContext = useSlotContext()
  const content =
    children ??
    (groups ?? map.ui.controlRail.groups).map((group) => {
      const controls = group.controls.filter((id) =>
        id.startsWith('custom:')
          ? Boolean(renderCustomControl)
          : isControlAvailable(id as BuiltInControlId, map),
      )
      if (!controls.length) return null
      return (
        <MapControlGroup key={group.id} id={group.id}>
          {controls.map((id) => {
            if (id.startsWith('custom:'))
              return (
                <div key={id} className="geo-custom-control" data-slot="map-custom-control">
                  {renderCustomControl?.(id as `custom:${string}`, slotContext)}
                </div>
              )
            const Control = builtInControls[id as BuiltInControlId]
            return <Control key={id} />
          })}
        </MapControlGroup>
      )
    })
  return (
    <div
      data-slot="map-controls"
      data-placement={placement ?? map.ui.controlRail.placement}
      aria-label={map.messages.mapControls}
      {...props}
      className={cn('geo-map-controls', className)}
    >
      {content}
    </div>
  )
}

/** Whether a built-in control has something to do with the current configuration and state. */
function isControlAvailable(id: BuiltInControlId, map: MapContextValue): boolean {
  if (id === 'layers') return map.ui.layers.enabled
  if (id === 'settings') return map.ui.settings.enabled && map.ui.settings.fields.length > 0
  if (id === 'fit')
    return map.ui.controlRail.fitTarget !== 'selection' || Boolean(map.state.selection)
  return true
}

export type MapControlGroupProps = ComponentPropsWithoutRef<'div'> & {
  /** Exposed as `data-control-group` for styling. */
  id?: string
}

/** Visually joins related control buttons. */
export function MapControlGroup({ id, className, ...props }: MapControlGroupProps) {
  return (
    <div
      data-slot="map-control-group"
      data-control-group={id}
      {...props}
      className={cn('geo-control-group', className)}
    />
  )
}

export type MapControlButtonProps = Omit<ShapeButtonProps, 'children'> & {
  /** Accessible name and tooltip. */
  label: string
  /** Shows the pressed/open styling. */
  active?: boolean
  /** The icon. */
  children: ReactNode
}

/** An icon button styled for the control rail. Use it for your own controls. */
export const MapControlButton = forwardRef<HTMLButtonElement, MapControlButtonProps>(
  function MapControlButton({ active, className, ...props }, ref) {
    return (
      <ShapeIconButton
        ref={ref}
        data-slot="map-control-button"
        data-active={active ? '' : undefined}
        {...props}
        className={cn(active && 'geo-control-active', className)}
      />
    )
  },
)

/**
 * Props for the built-in buttons. `label` and `children` (the icon) are optional overrides.
 * An `onClick` runs first; call `event.preventDefault()` to skip the built-in action.
 */
export type MapBuiltInButtonProps = Omit<MapControlButtonProps, 'label' | 'children'> & {
  label?: string
  children?: ReactNode
}

export function MapZoomInButton({
  step,
  label,
  children,
  onClick,
  ...props
}: MapBuiltInButtonProps & { step?: number }) {
  const { ui, messages, actions } = useMap()
  const icons = useMapIcons()
  return (
    <MapControlButton
      label={label ?? messages.zoomIn}
      onClick={composeHandler(onClick, () => actions.zoom(step ?? ui.controlRail.zoomStep))}
      {...props}
    >
      {children ?? <icons.ZoomIn aria-hidden="true" />}
    </MapControlButton>
  )
}

export function MapZoomOutButton({
  step,
  label,
  children,
  onClick,
  ...props
}: MapBuiltInButtonProps & { step?: number }) {
  const { ui, messages, actions } = useMap()
  const icons = useMapIcons()
  return (
    <MapControlButton
      label={label ?? messages.zoomOut}
      onClick={composeHandler(onClick, () => actions.zoom(-(step ?? ui.controlRail.zoomStep)))}
      {...props}
    >
      {children ?? <icons.ZoomOut aria-hidden="true" />}
    </MapControlButton>
  )
}

export function MapResetZoomButton({ label, children, onClick, ...props }: MapBuiltInButtonProps) {
  const { config, state, messages, actions } = useMap()
  const icons = useMapIcons()
  return (
    <MapControlButton
      label={label ?? messages.resetZoom}
      disabled={Math.abs(state.view.zoom - config.initialState.view.zoom) < 1e-6}
      onClick={composeHandler(onClick, actions.resetZoom)}
      {...props}
    >
      {children ?? <icons.ResetZoom aria-hidden="true" />}
    </MapControlButton>
  )
}

export function MapLocateButton({
  zoom,
  label,
  children,
  onClick,
  ...props
}: MapBuiltInButtonProps & { zoom?: number }) {
  const { ui, messages, actions } = useMap()
  const icons = useMapIcons()
  const [locating, setLocating] = useState(false)
  const options = ui.controlRail.locate
  const locate = () => {
    const failed = (message: string) =>
      actions.reportError({ code: 'SOURCE_LOAD_FAILED', message, recoverable: true })
    if (!navigator.geolocation) return failed(messages.locationUnavailable)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        actions.setView({ center: [coords.longitude, coords.latitude], zoom: zoom ?? options.zoom })
        setLocating(false)
      },
      () => {
        failed(messages.locationDenied)
        setLocating(false)
      },
      {
        ...(options.enableHighAccuracy !== undefined
          ? { enableHighAccuracy: options.enableHighAccuracy }
          : {}),
        ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
        ...(options.maximumAgeMs !== undefined ? { maximumAge: options.maximumAgeMs } : {}),
      },
    )
  }
  return (
    <MapControlButton
      label={label ?? messages.findLocation}
      disabled={locating}
      aria-busy={locating || undefined}
      onClick={composeHandler(onClick, locate)}
      {...props}
    >
      {children ??
        (locating ? (
          <icons.Spinner className="geo-spin" aria-hidden="true" />
        ) : (
          <icons.Locate aria-hidden="true" />
        ))}
    </MapControlButton>
  )
}

export function MapLayersButton({ label, children, onClick, ...props }: MapBuiltInButtonProps) {
  const { panels, messages, actions } = useMap()
  const icons = useMapIcons()
  return (
    <MapControlButton
      label={label ?? messages.layers}
      active={panels.layers}
      aria-expanded={panels.layers}
      onClick={composeHandler(onClick, () => actions.setPanelOpen('layers', !panels.layers))}
      {...props}
    >
      {children ?? <icons.Layers aria-hidden="true" />}
    </MapControlButton>
  )
}

export function MapFitButton({
  fitTarget,
  label,
  children,
  onClick,
  ...props
}: MapBuiltInButtonProps & { fitTarget?: ControlRailConfig['fitTarget'] }) {
  const { ui, state, messages, actions } = useMap()
  const icons = useMapIcons()
  const policy = fitTarget ?? ui.controlRail.fitTarget
  const hasSelection = Boolean(state.selection)
  if (policy === 'selection' && !hasSelection) return null
  return (
    <MapControlButton
      label={label ?? (hasSelection ? messages.fitSelection : messages.fitData)}
      onClick={composeHandler(onClick, () => actions.fitContent(policy))}
      {...props}
    >
      {children ?? <icons.Fit aria-hidden="true" />}
    </MapControlButton>
  )
}

export function MapSettingsButton({ label, children, onClick, ...props }: MapBuiltInButtonProps) {
  const { panels, messages, actions } = useMap()
  const icons = useMapIcons()
  return (
    <MapControlButton
      label={label ?? messages.mapSettings}
      active={panels.settings}
      aria-expanded={panels.settings}
      onClick={composeHandler(onClick, () => actions.setPanelOpen('settings', !panels.settings))}
      {...props}
    >
      {children ?? <icons.Settings aria-hidden="true" />}
    </MapControlButton>
  )
}

export function MapFullscreenButton({
  target,
  label,
  children,
  onClick,
  ...props
}: MapBuiltInButtonProps & { target?: 'map' | 'container' }) {
  const { messages, actions } = useMap()
  const icons = useMapIcons()
  return (
    <MapControlButton
      label={label ?? messages.fullscreen}
      onClick={composeHandler(onClick, () => actions.toggleFullscreen(target))}
      {...props}
    >
      {children ?? <icons.Fullscreen aria-hidden="true" />}
    </MapControlButton>
  )
}

/** Built-in control ids (as used in `ui.controlRail.groups`) and their components. */
const builtInControls: Record<BuiltInControlId, ComponentType<MapBuiltInButtonProps>> = {
  'zoom-in': MapZoomInButton,
  'zoom-out': MapZoomOutButton,
  'reset-zoom': MapResetZoomButton,
  locate: MapLocateButton,
  layers: MapLayersButton,
  fit: MapFitButton,
  settings: MapSettingsButton,
  fullscreen: MapFullscreenButton,
}
