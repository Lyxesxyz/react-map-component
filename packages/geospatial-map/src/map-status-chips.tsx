'use client'

import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMapRuntime, useMapStatic } from './map-context'
import { ShapeBadge } from './shapes'
import type { MapPlacement, StatusChipsConfig } from './types'
import { cn } from './utils'

type StatusOptions = Required<
  Pick<StatusChipsConfig, 'showLoading' | 'showNoData' | 'showScaleUnavailable'>
>

export type MapStatusChipsProps = ComponentPropsWithoutRef<'div'> &
  Partial<StatusOptions> & {
    /** Corner of the map; defaults to `ui.statusChips.placement`. */
    placement?: MapPlacement
    /** Replaces the "Loading" chip. */
    loading?: ReactNode
    /** Shown when the map has no layers. */
    empty?: ReactNode
  }

/** Non-blocking status chips: loading, no data for the selected time, unavailable at scale. */
export const MapStatusChips = forwardRef<HTMLDivElement, MapStatusChipsProps>(
  function MapStatusChips(
    {
      placement,
      showLoading,
      showNoData,
      showScaleUnavailable,
      loading: loadingContent,
      empty,
      className,
      ...props
    },
    ref,
  ) {
    const { ui, messages } = useMapStatic()
    const statuses = useMapRuntime((map) => map.statuses)
    const hasLayers = useMapRuntime((map) => map.layers.length > 0)
    const options: StatusOptions = {
      showLoading: showLoading ?? ui.statusChips.showLoading,
      showNoData: showNoData ?? ui.statusChips.showNoData,
      showScaleUnavailable: showScaleUnavailable ?? ui.statusChips.showScaleUnavailable,
    }
    const loading = statuses.some((item) => item.loading)
    const noData = statuses.some((item) => item.noData)
    const scaleUnavailable = statuses.some((item) => item.scaleUnavailable)
    return (
      <div
        ref={ref}
        data-slot="map-status-chips"
        data-placement={placement ?? ui.statusChips.placement}
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
        {!hasLayers && empty}
      </div>
    )
  },
)
