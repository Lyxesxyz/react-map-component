'use client'

import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMapRuntime, useMapStatic } from './map-context'
import { ShapeAlert, ShapeButton } from './shapes'
import type { MapError, MapPlacement } from './types'
import { cn } from './utils'

export type MapErrorAlertProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  /** Corner of the map; defaults to `ui.errorAlert.placement`. */
  placement?: MapPlacement
  /** Show a dismiss button for recoverable errors; defaults to `ui.errorAlert.dismissible`. */
  dismissible?: boolean
  /** Replaces the error message; a function receives the error. */
  children?: ReactNode | ((error: MapError) => ReactNode)
}

/** The latest runtime error (a layer that failed to load, an export, location). */
export const MapErrorAlert = forwardRef<HTMLDivElement, MapErrorAlertProps>(function MapErrorAlert(
  { placement, dismissible, className, children, ...props },
  ref,
) {
  const { ui, messages, actions } = useMapStatic()
  const error = useMapRuntime((map) => map.error)
  if (!error) return null
  const content = typeof children === 'function' ? children(error) : children
  return (
    <ShapeAlert
      ref={ref}
      data-slot="map-error-alert"
      data-placement={placement ?? ui.errorAlert.placement}
      data-code={error.code}
      {...props}
      className={cn('geo-error-alert', className)}
    >
      {children !== undefined ? (
        content
      ) : (
        <span className="geo-alert-message">{error.message}</span>
      )}
      {(dismissible ?? ui.errorAlert.dismissible) && error.recoverable && (
        <ShapeButton className="geo-alert-dismiss" onClick={actions.dismissError}>
          {messages.dismiss}
        </ShapeButton>
      )}
    </ShapeAlert>
  )
})
