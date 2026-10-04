'use client'

import { forwardRef, useRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { sameSelection } from './core/layers/common'
import { useMergedRef } from './hooks'
import { useAnchoredPosition } from './map-anchor'
import { useHoveredFeature, useMapPixel, useMapRuntime, useMapStatic } from './map-context'
import { featureLabel } from './map-state'
import type { FeatureEvent } from './types'
import { cn } from './utils'

export type MapTooltipProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  /** Feature properties to try, in order; the first one present is shown. Defaults to `ui.tooltip.fields`. */
  fields?: string[]
  /** Custom content for the hovered feature. Return `null` to show nothing for that feature. */
  children?: ((feature: FeatureEvent) => ReactNode) | undefined
}

/**
 * A small label that follows the pointer over selectable features. By default it shows the
 * feature's `name` (or `title`, or `label`) property. Mouse and pen only: keyboard and screen
 * reader users get the same information from selection and the popup.
 */
export const MapTooltip = forwardRef<HTMLDivElement, MapTooltipProps>(function MapTooltip(
  { fields, className, children, ...props },
  forwardedRef,
) {
  const { ui } = useMapStatic()
  const selection = useMapRuntime((map) => map.state.selection)
  const feature = useHoveredFeature()
  const pixel = useMapPixel(feature?.coordinate)
  const ref = useRef<HTMLDivElement>(null)
  const mergedRef = useMergedRef(ref, forwardedRef)
  useAnchoredPosition(ref, feature ? pixel : undefined, 12)
  // The selected feature already shows its details in the popup.
  if (!feature || sameSelection(selection, feature)) return null
  const content: ReactNode = children
    ? children(feature)
    : featureLabel(feature, fields ?? ui.tooltip.fields)
  if (content === null || content === undefined || content === '') return null
  return (
    <div
      ref={mergedRef}
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
})
