import { NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core'
import type { TemplateRef } from '@angular/core'
import { anchoredPosition } from './map-anchor'
import { injectMapActions, injectMapPixel, injectMapRuntime, injectMapStatic } from './map-context'
import { MapIconView } from './map-icon'
import { featureLabel } from './map-state'
import { MapPopupTemplate } from './map-templates'
import { ShapeCard, ShapeIconButton } from './shapes'
import { injectHostAttribute, partHostStyle } from './signals'
import type { MapPopupContext } from './component-types'
import type { MapPlacement } from './types'

/**
 * Dialog shown while a feature is selected (by a click, or by `state.selection`). Its content
 * is a `<ng-template geoMapPopup let-feature let-close="close">`, static projected content, or
 * by default the feature's properties. Hidden (with no classes or ARIA) while nothing is selected.
 */
@Component({
  selector: 'geo-map-popup',
  imports: [NgTemplateOutlet, MapIconView, ShapeIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeCard],
  host: {
    '[class.geo-popup]': '!hidden()',
    '[attr.data-slot]': 'hidden() ? null : "map-popup"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.popup.placement)',
    '[attr.data-anchor]': 'hidden() ? null : (anchored() ? "feature" : "corner")',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "dialog")',
    '[attr.aria-label]':
      'hidden() ? null : (consumerLabel ?? map().messages.selectedFeatureDetails)',
    '[style]': 'hostStyle()',
  },
  template: `
    @if (context(); as context) {
      <button
        geoShapeIconButton
        class="geo-popup-close"
        [label]="map().messages.closeFeatureDetails"
        (click)="context.close()"
      >
        <geo-map-icon [icon]="map().icons.Close" />
      </button>
      @if (contentTemplate(); as content) {
        <ng-container *ngTemplateOutlet="content; context: context" />
      } @else {
        <ng-content>
          <h2 class="geo-popup-title">{{ title() }}</h2>
          <dl class="geo-popup-fields">
            @for (field of fields(); track field.name) {
              <div class="geo-popup-field">
                <dt class="geo-popup-field-name">{{ field.name }}</dt>
                <dd class="geo-popup-field-value">{{ field.value }}</dd>
              </div>
            }
          </dl>
        </ng-content>
      }
    }
  `,
})
export class MapPopup {
  /** Corner of the map; defaults to `ui.popup.placement`. */
  readonly placement = input<MapPlacement>()
  /**
   * `'feature'` opens the popup next to the clicked point and keeps it there while the map
   * moves; `'corner'` uses `placement`. Defaults to `ui.popup.anchor` (`'corner'`).
   */
  readonly anchor = input<'corner' | 'feature'>()
  /** Content for the selected feature when no `geoMapPopup` template is inside (`<geo-map>` passes its own). */
  readonly template = input<TemplateRef<MapPopupContext>>()

  protected readonly map = injectMapStatic()
  /** A static `role` or `aria-label` on the element replaces the default (while shown). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #actions = injectMapActions()
  readonly #state = injectMapRuntime((map) => map.state)
  readonly #feature = injectMapRuntime((map) => map.selectedFeature)
  private readonly ownTemplate = contentChild(MapPopupTemplate)
  protected readonly hidden = computed(() => !this.#feature())
  protected readonly anchored = computed(
    () => (this.anchor() ?? this.map().ui.popup.anchor) === 'feature',
  )
  protected readonly contentTemplate = computed(
    () => this.ownTemplate()?.template ?? this.template(),
  )
  protected readonly context = computed<MapPopupContext | null>(() => {
    const feature = this.#feature()
    if (!feature) return null
    const actions = this.#actions
    return {
      $implicit: feature,
      feature,
      close: actions.clearSelection,
      state: this.#state(),
      actions,
    }
  })
  protected readonly title = computed(() => {
    const feature = this.#feature()
    return feature ? (featureLabel(feature, this.map().ui.tooltip.fields) ?? feature.featureId) : ''
  })
  protected readonly fields = computed(() =>
    Object.entries(this.#feature()?.properties ?? {}).map(([name, value]) => ({
      name,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    })),
  )
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeCard, { self: true }).hideWhen(() => this.hidden())
    const pixel = injectMapPixel(() =>
      this.anchored() ? (this.#feature()?.coordinate ?? null) : null,
    )
    anchoredPosition(() => (this.context() && this.anchored() ? pixel() : undefined), 14)
  }
}
