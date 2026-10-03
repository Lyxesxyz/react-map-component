'use client'

import type { ComponentPropsWithoutRef, MouseEvent } from 'react'
import { useMap } from './map-context'
import { ShapeButton } from './shapes'
import type { HierarchyItem, MapPlacement } from './types'
import { cn } from './utils'

export type MapBreadcrumbsProps = ComponentPropsWithoutRef<'nav'> & {
  /** Corner of the map; defaults to `ui.hierarchy.placement`. */
  placement?: MapPlacement
  /** Hierarchy to show; defaults to `config.data.hierarchy`. */
  items?: HierarchyItem[]
  /** Runs before zooming to the item; call `event.preventDefault()` to skip the zoom. */
  onItemClick?: (item: HierarchyItem, event: MouseEvent<HTMLButtonElement>) => void
}

/** Geographic hierarchy (for example World › Region › Country) that zooms on click. */
export function MapBreadcrumbs({
  placement,
  items,
  onItemClick,
  className,
  ...props
}: MapBreadcrumbsProps) {
  const { config, ui, messages, actions } = useMap()
  const hierarchy = items ?? config.data.hierarchy ?? []
  if (!hierarchy.length) return null
  return (
    <nav
      data-slot="map-breadcrumbs"
      data-placement={placement ?? ui.hierarchy.placement}
      aria-label={messages.geographicHierarchy}
      {...props}
      className={cn('geo-breadcrumbs', className)}
    >
      {hierarchy.map((item, index) => (
        <span key={item.id} className="geo-breadcrumb">
          {index > 0 && (
            <span className="geo-breadcrumb-separator" aria-hidden="true">
              ›
            </span>
          )}
          <ShapeButton
            className="geo-breadcrumb-button"
            onClick={(event) => {
              onItemClick?.(item, event)
              if (!event.defaultPrevented && item.targetId) actions.fitZoomTarget(item.targetId)
            }}
          >
            {item.label}
          </ShapeButton>
        </span>
      ))}
    </nav>
  )
}
