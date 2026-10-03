'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { useMap } from './map-context'
import { formatMapMessage } from './messages'
import type { MapPlacement } from './types'
import { cn } from './utils'

export type MapAttributionProps = ComponentPropsWithoutRef<'footer'> & {
  /** Corner of the map; defaults to `ui.attribution.placement`. */
  placement?: MapPlacement
  /** Smaller single-line presentation; defaults to `ui.attribution.compact`. */
  compact?: boolean
}

/** Source attribution for the active basemap and layers. Keep it visible when sources require it. */
export function MapAttribution({ placement, compact, className, ...props }: MapAttributionProps) {
  const { ui, messages, attributions } = useMap()
  const isCompact = compact ?? ui.attribution.compact
  return (
    <footer
      data-slot="map-attribution"
      data-placement={placement ?? ui.attribution.placement}
      data-compact={isCompact ? '' : undefined}
      aria-label={messages.attribution}
      {...props}
      className={cn('geo-attribution', isCompact && 'geo-attribution-compact', className)}
    >
      {attributions.map((item, index) => (
        <span key={`${item.label}-${index}`} className="geo-attribution-item">
          {index > 0 && ' · '}
          {item.url ? (
            <a className="geo-attribution-link" href={item.url} target="_blank" rel="noreferrer">
              {item.label}
            </a>
          ) : (
            item.label
          )}
          {item.version ? ` ${item.version}` : ''}
          {item.authority ? ` · ${item.authority}` : ''}
          {item.publishedAt
            ? ` · ${formatMapMessage(messages.publishedOn, { date: item.publishedAt })}`
            : ''}
          {item.official === false ? ` ${messages.nonOfficial}` : ''}
          {item.usageRestrictions ? ` · ${item.usageRestrictions}` : ''}
        </span>
      ))}
    </footer>
  )
}
