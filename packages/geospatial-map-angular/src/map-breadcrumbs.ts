import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { MapActionEvent } from './map-action-event'
import { injectMapActions, injectMapStatic } from './map-context'
import { ShapeButton } from './shapes'
import { injectHostAttribute, partHostStyle } from './signals'
import type { MapPlacement, ZoomTarget } from './types'

/**
 * Emitted by `(targetClick)` on `<geo-map-breadcrumbs>`, synchronously, before the map zooms to
 * `target`: call `preventDefault()` to skip the zoom (React's `onTargetClick(target, event)`).
 *
 * ```html
 * <geo-map-breadcrumbs (targetClick)="open($event.target.id); $event.preventDefault()" />
 * ```
 */
export class MapTargetClickEvent extends MapActionEvent<'fitZoomTarget'> {
  /** The DOM click on the breadcrumb's button. */
  declare readonly source: MouseEvent

  constructor(
    /** The zoom target of the clicked breadcrumb. */
    readonly target: ZoomTarget,
    source: MouseEvent,
  ) {
    super('fitZoomTarget', source)
  }
}

/**
 * A path of zoom targets (for example World › Africa › Kenya) that zooms on click. Hidden (with
 * no classes or ARIA) while none of `targets` names a zoom target.
 */
@Component({
  selector: 'geo-map-breadcrumbs',
  imports: [ShapeButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // The host is React's <nav>: the navigation landmark is its role.
    '[class.geo-breadcrumbs]': '!hidden()',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "navigation")',
    '[attr.data-slot]': 'hidden() ? null : "map-breadcrumbs"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.breadcrumbs.placement)',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? map().messages.geographicHierarchy)',
    '[style]': 'hostStyle()',
  },
  template: `
    @for (target of path(); track target.id; let index = $index) {
      <span class="geo-breadcrumb">
        @if (index > 0) {
          <span class="geo-breadcrumb-separator" aria-hidden="true">›</span>
        }
        <button
          geoShapeButton
          class="geo-breadcrumb-button"
          [textContent]="target.label"
          (click)="select(target, $event)"
        ></button>
      </span>
    }
  `,
})
export class MapBreadcrumbs {
  /** Corner of the map; defaults to `ui.breadcrumbs.placement`. */
  readonly placement = input<MapPlacement>()
  /** Ids of `data.zoomTargets`, widest first; defaults to `ui.breadcrumbs.targets`. */
  readonly targets = input<readonly string[]>()
  /** Emitted before zooming to the target; `preventDefault()` skips the zoom. */
  readonly targetClick = output<MapTargetClickEvent>()

  protected readonly map = injectMapStatic()
  readonly #actions = injectMapActions()
  /** A static `role` or `aria-label` on the element replaces the default (while shown). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  protected readonly path = computed(() => {
    const { config, ui } = this.map()
    const byId = new Map((config.data.zoomTargets ?? []).map((target) => [target.id, target]))
    return (this.targets() ?? ui.breadcrumbs.targets).flatMap((id) => byId.get(id) ?? [])
  })
  protected readonly hidden = computed(() => !this.path().length)
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  protected select(target: ZoomTarget, event: MouseEvent): void {
    const click = new MapTargetClickEvent(target, event)
    this.targetClick.emit(click)
    if (!click.defaultPrevented && !event.defaultPrevented) this.#actions.fitZoomTarget(target.id)
  }
}
