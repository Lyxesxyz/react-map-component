'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMap } from './map-context'
import { ShapeAlert, ShapeBadge, ShapeButton } from './shapes'
import type { MapError, MapPlacement, StatusConfig } from './types'
import { cn, withDefaults } from './utils'

type StatusOptions = Required<
  Pick<StatusConfig, 'showLoading' | 'showNoData' | 'showScaleUnavailable'>
>

export type MapStatusProps = ComponentPropsWithoutRef<'div'> &
  Partial<StatusOptions> & {
    /** Corner of the map; defaults to `ui.status.placement`. */
    placement?: MapPlacement
    /** Replaces the "Loading" badge. */
    loading?: ReactNode
    /** Shown when the map has no layers. */
    empty?: ReactNode
  }

/** Non-blocking status chips: loading, no data for the selected time, unavailable at scale. */
export function MapStatus({
  placement,
  showLoading,
  showNoData,
  showScaleUnavailable,
  loading: loadingContent,
  empty,
  className,
  ...props
}: MapStatusProps) {
  const { ui, messages, statuses, layers } = useMap()
  const options = withDefaults<StatusOptions>(ui.status, {
    showLoading,
    showNoData,
    showScaleUnavailable,
  })
  const loading = statuses.some((item) => item.loading)
  const noData = statuses.some((item) => item.noData)
  const scaleUnavailable = statuses.some((item) => item.scaleUnavailable)
  return (
    <div
      data-slot="map-status"
      data-placement={placement ?? ui.status.placement}
      {...props}
      className={cn('geo-status-chips', className)}
    >
      {loading &&
        options.showLoading &&
        (loadingContent ?? <ShapeBadge>{messages.loading}</ShapeBadge>)}
      {noData && options.showNoData && <ShapeBadge>{messages.noDataForTime}</ShapeBadge>}
      {scaleUnavailable && options.showScaleUnavailable && (
        <ShapeBadge>{messages.unavailableAtScale}</ShapeBadge>
      )}
      {!layers.length && empty}
    </div>
  )
}

export type MapErrorAlertProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  /** Corner of the map; defaults to `ui.errors.placement`. */
  placement?: MapPlacement
  /** Show a dismiss button for recoverable errors; defaults to `ui.errors.dismissible`. */
  dismissible?: boolean
  /** Replaces the error message; a function receives the error. */
  children?: ReactNode | ((error: MapError) => ReactNode)
}

/** Alert for recoverable runtime errors (failed source, export, location). */
export function MapErrorAlert({
  placement,
  dismissible,
  className,
  children,
  ...props
}: MapErrorAlertProps) {
  const { ui, messages, actions, error } = useMap()
  if (!error) return null
  const content = typeof children === 'function' ? children(error) : children
  return (
    <ShapeAlert
      data-slot="map-error"
      data-placement={placement ?? ui.errors.placement}
      {...props}
      className={className}
    >
      {children !== undefined ? (
        content
      ) : (
        <span className="geo-alert-message">{error.message}</span>
      )}
      {(dismissible ?? ui.errors.dismissible) && error.recoverable && (
        <ShapeButton className="geo-alert-dismiss" onClick={actions.dismissError}>
          {messages.dismiss}
        </ShapeButton>
      )}
    </ShapeAlert>
  )
}
