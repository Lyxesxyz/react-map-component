'use client'

import { forwardRef, useId } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useControllableState } from './hooks'
import { useMapStatic } from './map-context'
import { ShapeButton } from './shapes'
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
export const MapDisclaimer = forwardRef<HTMLDivElement, MapDisclaimerProps>(function MapDisclaimer(
  {
    children,
    title,
    placement,
    defaultOpen,
    open: controlledOpen,
    onOpenChange,
    className,
    ...props
  },
  ref,
) {
  const { ui, messages } = useMapStatic()
  const [open, setOpen] = useControllableState(
    controlledOpen,
    () => defaultOpen ?? ui.disclaimer.defaultOpen,
    onOpenChange,
  )
  const textId = `${safeId(useId())}-disclaimer`
  const content = children ?? ui.disclaimer.text
  if (content === undefined || content === null || content === '') return null
  const heading = title ?? (ui.disclaimer.title || messages.disclaimer)
  // One button in both states, so keyboard focus stays on it when the text opens or closes.
  return (
    <div
      ref={ref}
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
      <ShapeButton
        className="geo-disclaimer-toggle"
        aria-expanded={open}
        aria-controls={textId}
        onClick={(event) => {
          // Safari doesn't focus a button it clicks: focus it, so Escape closes the text there too.
          event.currentTarget.focus()
          setOpen(!open)
        }}
      >
        {heading}
      </ShapeButton>
      <span id={textId} className="geo-disclaimer-text" hidden={!open}>
        {content}
      </span>
    </div>
  )
})
