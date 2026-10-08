import {
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  afterRenderEffect,
  inject,
  signal,
} from '@angular/core'

const MARGIN = 8

/**
 * Places an absolutely positioned element (by default the calling part's host) next to a map
 * pixel: centred above it, or below when there is no room above, and kept inside its positioned
 * parent (the map stage). Writes `--geo-anchor-x` and `--geo-anchor-y`, `data-side="top|bottom"`,
 * and `data-offscreen` while the point is outside the map. `pixel() === undefined` turns it off.
 *
 * Call it in a constructor or field initializer. It runs after Angular renders, whenever the
 * signals `pixel` reads change, and when the element changes size (its content loaded, say).
 */
export function anchoredPosition(
  pixel: () => readonly [number, number] | null | undefined,
  gap: number,
  element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
): void {
  const size = signal('')
  const destroyRef = inject(DestroyRef)
  const zone = inject(NgZone)
  afterNextRender(() => {
    const Observer = element.ownerDocument.defaultView?.ResizeObserver
    if (!Observer) return
    const observer = zone.runOutsideAngular(
      () => new Observer(() => size.set(`${element.offsetWidth}x${element.offsetHeight}`)),
    )
    observer.observe(element)
    destroyRef.onDestroy(() => observer.disconnect())
  })

  afterRenderEffect(() => {
    const point = pixel()
    size()
    if (point === undefined) {
      delete element.dataset['side']
      delete element.dataset['offscreen']
      return
    }
    const view = element.ownerDocument.defaultView
    const parent = element.offsetParent as HTMLElement | null
    const parentWidth = parent?.clientWidth ?? view?.innerWidth ?? 0
    const parentHeight = parent?.clientHeight ?? view?.innerHeight ?? 0
    if (
      !point ||
      point[0] < 0 ||
      point[1] < 0 ||
      point[0] > parentWidth ||
      point[1] > parentHeight
    ) {
      element.dataset['offscreen'] = ''
      return
    }
    delete element.dataset['offscreen']
    const width = element.offsetWidth
    const height = element.offsetHeight
    const below = point[1] - gap - height < MARGIN
    const left = Math.min(
      Math.max(MARGIN, point[0] - width / 2),
      Math.max(MARGIN, parentWidth - width - MARGIN),
    )
    const top = below ? point[1] + gap : point[1] - gap - height
    element.style.setProperty('--geo-anchor-x', `${Math.round(left)}px`)
    element.style.setProperty('--geo-anchor-y', `${Math.round(top)}px`)
    element.dataset['side'] = below ? 'bottom' : 'top'
  })
}
