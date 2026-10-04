'use client'

import type { RefObject } from 'react'
import { useIsomorphicLayoutEffect } from './hooks'

const MARGIN = 8

/**
 * Places an absolutely positioned element next to a map pixel: centred above it, or below when
 * there is no room above, and kept inside its positioned parent (the map stage). Writes
 * `--geo-anchor-x` and `--geo-anchor-y`, `data-side="top|bottom"`, and
 * `data-offscreen` while the point is outside the map. `pixel === undefined` turns it off.
 */
export function useAnchoredPosition(
  ref: RefObject<HTMLElement | null>,
  pixel: readonly [number, number] | null | undefined,
  gap: number,
): void {
  useIsomorphicLayoutEffect(() => {
    const element = ref.current
    if (!element || pixel === undefined) return
    const parent = element.offsetParent as HTMLElement | null
    const parentWidth = parent?.clientWidth ?? window.innerWidth
    const parentHeight = parent?.clientHeight ?? window.innerHeight
    if (
      !pixel ||
      pixel[0] < 0 ||
      pixel[1] < 0 ||
      pixel[0] > parentWidth ||
      pixel[1] > parentHeight
    ) {
      element.dataset.offscreen = ''
      return
    }
    delete element.dataset.offscreen
    const width = element.offsetWidth
    const height = element.offsetHeight
    const below = pixel[1] - gap - height < MARGIN
    const left = Math.min(
      Math.max(MARGIN, pixel[0] - width / 2),
      Math.max(MARGIN, parentWidth - width - MARGIN),
    )
    const top = below ? pixel[1] + gap : pixel[1] - gap - height
    element.style.setProperty('--geo-anchor-x', `${Math.round(left)}px`)
    element.style.setProperty('--geo-anchor-y', `${Math.round(top)}px`)
    element.dataset.side = below ? 'bottom' : 'top'
  })
}
