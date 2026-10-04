'use client'

import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, MouseEvent } from 'react'
import { useMapStatic } from './map-context'
import { ShapeButton } from './shapes'
import type { MapPlacement, ZoomTarget } from './types'
import { cn } from './utils'

export type MapBreadcrumbsProps = ComponentPropsWithoutRef<'nav'> & {
  /** Corner of the map; defaults to `ui.breadcrumbs.placement`. */
  placement?: MapPlacement
  /** Ids of `data.zoomTargets`, widest first; defaults to `ui.breadcrumbs.targets`. */
  targets?: string[]
  /** Runs before zooming to the target; call `event.preventDefault()` to skip the zoom. */
  onTargetClick?: (target: ZoomTarget, event: MouseEvent<HTMLButtonElement>) => void
}

/** A path of zoom targets (for example World › Africa › Kenya) that zooms on click. */
export const MapBreadcrumbs = forwardRef<HTMLElement, MapBreadcrumbsProps>(function MapBreadcrumbs(
  { placement, targets, onTargetClick, className, ...props },
  ref,
) {
  const { config, ui, messages, actions } = useMapStatic()
  const byId = new Map((config.data.zoomTargets ?? []).map((target) => [target.id, target]))
  const path = (targets ?? ui.breadcrumbs.targets).flatMap((id) => byId.get(id) ?? [])
  if (!path.length) return null
  return (
    <nav
      ref={ref}
      data-slot="map-breadcrumbs"
      data-placement={placement ?? ui.breadcrumbs.placement}
      aria-label={messages.geographicHierarchy}
      {...props}
      className={cn('geo-breadcrumbs', className)}
    >
      {path.map((target, index) => (
        <span key={target.id} className="geo-breadcrumb">
          {index > 0 && (
            <span className="geo-breadcrumb-separator" aria-hidden="true">
              ›
            </span>
          )}
          <ShapeButton
            className="geo-breadcrumb-button"
            onClick={(event) => {
              onTargetClick?.(target, event)
              if (!event.defaultPrevented) actions.fitZoomTarget(target.id)
            }}
          >
            {target.label}
          </ShapeButton>
        </span>
      ))}
    </nav>
  )
})
