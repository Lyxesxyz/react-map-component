/** What a built-in control button does when it is clicked. */
export type MapButtonAction =
  'zoomIn' | 'zoomOut' | 'resetZoom' | 'locate' | 'layers' | 'settings' | 'fit' | 'fullscreen'

/**
 * Emitted by a built-in button's `beforeAction` output, synchronously, before the action runs:
 * call `preventDefault()` to skip it (React's "`onClick` calls `event.preventDefault()`").
 *
 * ```html
 * <button geoMapZoomIn (beforeAction)="confirmZoom($event)"></button>
 * ```
 *
 * A template `(click)` runs after the button's own handler, so it can't cancel the action.
 */
export class MapActionEvent<A extends string = string> {
  #prevented = false

  constructor(
    /** The action that is about to run. */
    readonly action: A,
    /** The DOM event that triggered it. */
    readonly source: Event,
  ) {}

  /** Whether `preventDefault()` was called. */
  get defaultPrevented(): boolean {
    return this.#prevented
  }

  /** Skips the built-in action. */
  preventDefault(): void {
    this.#prevented = true
  }
}
