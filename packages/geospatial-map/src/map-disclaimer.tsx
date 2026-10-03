'use client'

import { useId, useState } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMapStatic } from './map-context'
import { cn, safeId } from './utils'

export type MapDisclaimerProps = Omit<ComponentPropsWithoutRef<'div'>, 'title' | 'children'> & {
  /** The disclaimer; defaults to `ui.disclaimer.text`. Links and formatting are allowed. */
  children?: ReactNode
  /** Button label and heading; defaults to `ui.disclaimer.title`, then "Disclaimer". */
  title?: ReactNode
  /** Bottom corner of the button; defaults to `ui.disclaimer.placement`. */
  placement?: 'bottom-left' | 'bottom-right'
  /** Start expanded; defaults to `ui.disclaimer.defaultOpen`. */
  defaultOpen?: boolean
  /** Controlled expanded state, with `onOpenChange`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * A disclaimer button in a bottom corner of the map. Clicking it expands the text across the
 * bottom of the map; clicking the heading (or pressing Escape) collapses it again.
 *
 * ```tsx
 * <MapDisclaimer>Boundaries do not imply official endorsement.</MapDisclaimer>
 * ```
 */
export function MapDisclaimer({
  children,
  title,
  placement,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
  className,
  ...props
}: MapDisclaimerProps) {
  const { ui, messages } = useMapStatic()
  const [ownOpen, setOwnOpen] = useState(defaultOpen ?? ui.disclaimer.defaultOpen)
  const open = controlledOpen ?? ownOpen
  const textId = `${safeId(useId())}-disclaimer`
  const content = children ?? ui.disclaimer.text
  if (content === undefined || content === null || content === '') return null
  const heading = title ?? (ui.disclaimer.title || messages.disclaimer)
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }
  // One button in both states, so keyboard focus stays on it when the text opens or closes.
  return (
    <div
      data-slot="map-disclaimer"
      data-placement={placement ?? ui.disclaimer.placement}
      data-open={open ? '' : undefined}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.stopPropagation()
          setOpen(false)
        }
      }}
      {...props}
      className={cn('geo-disclaimer', className)}
    >
      <button
        type="button"
        className="geo-disclaimer-toggle"
        aria-expanded={open}
        aria-controls={textId}
        onClick={() => setOpen(!open)}
      >
        {heading}
      </button>
      <span id={textId} className="geo-disclaimer-text" hidden={!open}>
        {content}
      </span>
    </div>
  )
}
