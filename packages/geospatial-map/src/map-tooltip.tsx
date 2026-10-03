'use client'

import { useContext, useRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useAnchoredPosition } from './map-anchor'
import { MapRuntimeContext, useHoveredFeature, useMapPixel, useMapStatic } from './map-context'
import type { FeatureEvent } from './types'
import { cn } from './utils'

export type MapTooltipProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  /** Feature properties to try, in order; the first one present is shown. Defaults to `ui.tooltip.fields`. */
  fields?: string[]
  /** Custom content for the hovered feature. Return `null` to show nothing for that feature. */
  children?: (feature: FeatureEvent) => ReactNode
}

/**
 * A small label that follows the pointer over selectable features. By default it shows the
 * feature's `name` (or `title`, or `label`) property. Mouse and pen only: keyboard and screen
 * reader users get the same information from selection and the popup.
 */
export function MapTooltip({ fields, className, children, ...props }: MapTooltipProps) {
  const { ui } = useMapStatic()
  const feature = useHoveredFeature()
  const pixel = useMapPixel(feature?.coordinate)
  const ref = useRef<HTMLDivElement>(null)
  useAnchoredPosition(ref, feature ? pixel : undefined, 12)
  const selected = useContext(MapRuntimeContext)?.selectedFeature
  // The selected feature already shows its details in the popup.
  if (
    !feature ||
    (selected?.layerId === feature.layerId && selected.featureId === feature.featureId)
  )
    return null
  let content: ReactNode
  if (children) content = children(feature)
  else {
    const field = (fields ?? ui.tooltip.fields).find(
      (name) => feature.properties[name] !== undefined && feature.properties[name] !== null,
    )
    content = field === undefined ? null : String(feature.properties[field])
  }
  if (content === null || content === undefined || content === '') return null
  return (
    <div
      ref={ref}
      data-slot="map-tooltip"
      // The popup and selection announcements carry the same information for assistive
      // technology; announcing every hover would be noise.
      aria-hidden="true"
      {...props}
      className={cn('geo-tooltip', className)}
    >
      {content}
    </div>
  )
}
