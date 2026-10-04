'use client'

import { forwardRef, useState } from 'react'
import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react'
import { mapError } from './core/errors'
import { useMapRuntime, useMapStatic, useSlotContext } from './map-context'
import { ShapeIconButton } from './shapes'
import type { ShapeButtonProps } from './shapes'
import type {
  BuiltInControlId,
  ControlGroupConfig,
  CustomControls,
  FitTargetPolicy,
  MapControlId,
  MapPanelId,
  MapPlacement,
  MapSlotContext,
  ResolvedMapUiConfig,
} from './types'
import { cn, composeHandler, warnOnce } from './utils'

export type MapControlsProps = ComponentPropsWithoutRef<'div'> & {
  /** Corner of the map; defaults to `ui.controls.placement`. */
  placement?: MapPlacement
  /** Groups rendered when there are no children; defaults to `ui.controls.groups`. */
  groups?: ControlGroupConfig[]
  /** Renderers for the `custom:*` ids in `groups`. */
  customControls?: CustomControls
}

/**
 * The floating control rail. Pass `<MapControlGroup>` children, or let it render the config.
 * A `custom:*` id without a renderer in `customControls` is skipped (with a console hint).
 */
export const MapControls = forwardRef<HTMLDivElement, MapControlsProps>(function MapControls(
  { placement, groups, customControls, className, children, ...props },
  ref,
) {
  const { ui, messages } = useMapStatic()
  const hasSelection = useMapRuntime((map) => map.state.selection !== null)
  const available = (id: MapControlId) => {
    if (!isCustom(id)) return isControlAvailable(id, ui, hasSelection)
    if (customControls?.[id]) return true
    warnOnce(
      `custom-control:${id}`,
      `Control ${id} is in ui.controls.groups but has no renderer: pass it in slots.controls (or customControls).`,
    )
    return false
  }
  const content =
    children ??
    (groups ?? ui.controls.groups).map((group) => {
      const controls = group.controls.filter(available)
      if (!controls.length) return null
      return (
        <MapControlGroup key={group.id} id={group.id}>
          {controls.map((id) => {
            if (isCustom(id)) return <CustomControl key={id} render={customControls![id]!} />
            const Control = builtInControls[id]
            return <Control key={id} />
          })}
        </MapControlGroup>
      )
    })
  return (
    <div
      ref={ref}
      role="group"
      data-slot="map-controls"
      data-placement={placement ?? ui.controls.placement}
      aria-label={messages.mapControls}
      {...props}
      className={cn('geo-map-controls', className)}
    >
      {content}
    </div>
  )
})

const isCustom = (id: MapControlId): id is `custom:${string}` => id.startsWith('custom:')

/** A `custom:*` control: its renderer gets the map state and actions. */
function CustomControl({ render }: { render: (context: MapSlotContext) => ReactNode }) {
  const context = useSlotContext()
  return (
    <div className="geo-custom-control" data-slot="map-custom-control">
      {render(context)}
    </div>
  )
}

/** Whether "fit" has something to fit: with `fitTarget: 'selection'`, only a selection. */
function isFitAvailable(policy: FitTargetPolicy, hasSelection: boolean): boolean {
  return policy !== 'selection' || hasSelection
}

/** Whether a built-in control has something to do with the current configuration and state. */
function isControlAvailable(
  id: BuiltInControlId,
  ui: ResolvedMapUiConfig,
  hasSelection: boolean,
): boolean {
  if (id === 'layers') return ui.layerPanel.enabled
  if (id === 'settings') return ui.settings.enabled && ui.settings.fields.length > 0
  if (id === 'fit') return isFitAvailable(ui.controls.fitTarget, hasSelection)
  return true
}

export type MapControlGroupProps = ComponentPropsWithoutRef<'div'> & {
  /** Exposed as `data-control-group` for styling. */
  id?: string
}

/** Visually joins related control buttons. */
export const MapControlGroup = forwardRef<HTMLDivElement, MapControlGroupProps>(
  function MapControlGroup({ id, className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="map-control-group"
        data-control-group={id}
        {...props}
        className={cn('geo-control-group', className)}
      />
    )
  },
)

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

type BuiltInButtonProps = MapBuiltInButtonProps & {
  defaultLabel: string
  icon: ReactNode
  action: () => void
}

/** What every built-in button is: a default label and icon, and the action that runs on click. */
const BuiltInButton = forwardRef<HTMLButtonElement, BuiltInButtonProps>(function BuiltInButton(
  { defaultLabel, icon, action, label, children, onClick, ...props },
  ref,
) {
  return (
    <MapControlButton
      ref={ref}
      label={label ?? defaultLabel}
      onClick={composeHandler(onClick, action)}
      {...props}
    >
      {children ?? icon}
    </MapControlButton>
  )
})

type StepProps = MapBuiltInButtonProps & { step?: number }

export const MapZoomInButton = forwardRef<HTMLButtonElement, StepProps>(function MapZoomInButton(
  { step, ...props },
  ref,
) {
  const { ui, messages, actions, icons } = useMapStatic()
  return (
    <BuiltInButton
      ref={ref}
      defaultLabel={messages.zoomIn}
      icon={<icons.ZoomIn aria-hidden="true" />}
      action={() => actions.zoom(step ?? ui.controls.zoomStep)}
      {...props}
    />
  )
})

export const MapZoomOutButton = forwardRef<HTMLButtonElement, StepProps>(function MapZoomOutButton(
  { step, ...props },
  ref,
) {
  const { ui, messages, actions, icons } = useMapStatic()
  return (
    <BuiltInButton
      ref={ref}
      defaultLabel={messages.zoomOut}
      icon={<icons.ZoomOut aria-hidden="true" />}
      action={() => actions.zoom(-(step ?? ui.controls.zoomStep))}
      {...props}
    />
  )
})

export const MapResetZoomButton = forwardRef<HTMLButtonElement, MapBuiltInButtonProps>(
  function MapResetZoomButton(props, ref) {
    const { config, messages, actions, icons } = useMapStatic()
    const zoom = useMapRuntime((map) => map.state.view.zoom)
    return (
      <BuiltInButton
        ref={ref}
        defaultLabel={messages.resetZoom}
        icon={<icons.ResetZoom aria-hidden="true" />}
        action={actions.resetZoom}
        disabled={Math.abs(zoom - config.initialState.view.zoom) < 1e-6}
        {...props}
      />
    )
  },
)

export const MapLocateButton = forwardRef<
  HTMLButtonElement,
  MapBuiltInButtonProps & { zoom?: number }
>(function MapLocateButton({ zoom, ...props }, ref) {
  const { ui, messages, actions, icons } = useMapStatic()
  const [locating, setLocating] = useState(false)
  const options = ui.controls.locate
  const locate = () => {
    const failed = (message: string, cause?: unknown) =>
      actions.reportError(mapError('LOCATION_UNAVAILABLE', message, true, undefined, cause))
    if (!navigator.geolocation) return failed(messages.locationUnavailable)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        actions.setView({ center: [coords.longitude, coords.latitude], zoom: zoom ?? options.zoom })
        setLocating(false)
      },
      (cause) => {
        failed(messages.locationDenied, cause)
        setLocating(false)
      },
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeoutMs,
        maximumAge: options.maximumAgeMs,
      },
    )
  }
  return (
    <BuiltInButton
      ref={ref}
      defaultLabel={messages.findLocation}
      icon={
        locating ? (
          <icons.Spinner className="geo-spin" aria-hidden="true" />
        ) : (
          <icons.Locate aria-hidden="true" />
        )
      }
      action={locate}
      disabled={locating}
      aria-busy={locating || undefined}
      {...props}
    />
  )
})

/** A button that opens and closes one of the map's panels. */
const PanelButton = forwardRef<
  HTMLButtonElement,
  Omit<BuiltInButtonProps, 'action'> & { panel: MapPanelId }
>(function PanelButton({ panel, ...props }, ref) {
  const { actions } = useMapStatic()
  const open = useMapRuntime((map) => map.openPanel === panel)
  return (
    <BuiltInButton
      ref={ref}
      action={() => actions.setOpenPanel(open ? null : panel)}
      active={open}
      aria-expanded={open}
      {...props}
    />
  )
})

export const MapLayersButton = forwardRef<HTMLButtonElement, MapBuiltInButtonProps>(
  function MapLayersButton(props, ref) {
    const { messages, icons } = useMapStatic()
    return (
      <PanelButton
        ref={ref}
        panel="layers"
        defaultLabel={messages.layers}
        icon={<icons.Layers aria-hidden="true" />}
        {...props}
      />
    )
  },
)

export const MapSettingsButton = forwardRef<HTMLButtonElement, MapBuiltInButtonProps>(
  function MapSettingsButton(props, ref) {
    const { messages, icons } = useMapStatic()
    return (
      <PanelButton
        ref={ref}
        panel="settings"
        defaultLabel={messages.mapSettings}
        icon={<icons.Settings aria-hidden="true" />}
        {...props}
      />
    )
  },
)

export const MapFitButton = forwardRef<
  HTMLButtonElement,
  MapBuiltInButtonProps & { fitTarget?: FitTargetPolicy }
>(function MapFitButton({ fitTarget, ...props }, ref) {
  const { ui, messages, actions, icons } = useMapStatic()
  const hasSelection = useMapRuntime((map) => map.state.selection !== null)
  const policy = fitTarget ?? ui.controls.fitTarget
  if (!isFitAvailable(policy, hasSelection)) return null
  return (
    <BuiltInButton
      ref={ref}
      defaultLabel={hasSelection && policy !== 'data' ? messages.fitSelection : messages.fitData}
      icon={<icons.Fit aria-hidden="true" />}
      action={() => actions.fitContent(policy)}
      {...props}
    />
  )
})

export const MapFullscreenButton = forwardRef<
  HTMLButtonElement,
  MapBuiltInButtonProps & { target?: 'map' | 'container' }
>(function MapFullscreenButton({ target, ...props }, ref) {
  const { messages, actions, icons } = useMapStatic()
  return (
    <BuiltInButton
      ref={ref}
      defaultLabel={messages.fullscreen}
      icon={<icons.Fullscreen aria-hidden="true" />}
      action={() => actions.toggleFullscreen(target)}
      {...props}
    />
  )
})

/** Built-in control ids (as used in `ui.controls.groups`) and their components. */
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
