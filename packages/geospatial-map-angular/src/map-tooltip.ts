import { NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterEveryRender,
  computed,
  contentChild,
  inject,
  input,
  signal,
} from '@angular/core'
import type { TemplateRef } from '@angular/core'
import { sameSelection } from './core/layers/common'
import { anchoredPosition } from './map-anchor'
import {
  injectHoveredFeature,
  injectMapPixel,
  injectMapRuntime,
  injectMapStatic,
} from './map-context'
import { featureLabel } from './map-state'
import { MapTooltipTemplate } from './map-templates'
import { partHostStyle } from './signals'
import type { MapTooltipContext } from './component-types'

/**
 * A small label that follows the pointer over selectable features. By default it shows the
 * feature's `name` (or `title`, or `label`) property; a `<ng-template geoMapTooltip let-feature>`
 * replaces it; for a feature the template draws nothing for (an `@if` around its content), no
 * tooltip shows, as when React's slot returns `null`. Mouse and pen only: keyboard and screen
 * reader users get the same information from selection and the popup. Hidden (with no classes or
 * ARIA) while there is nothing to show.
 */
@Component({
  selector: 'geo-map-tooltip',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.geo-tooltip]': '!hidden()',
    '[attr.data-slot]': 'hidden() ? null : "map-tooltip"',
    // The popup and selection announcements carry the same information for assistive
    // technology; announcing every hover would be noise.
    '[attr.aria-hidden]': 'hidden() ? null : "true"',
    '[style]': 'hostStyle()',
  },
  template: `
    @if (context(); as context) {
      @if (contentTemplate(); as content) {
        <ng-container *ngTemplateOutlet="content; context: context" />
      } @else {
        <ng-container>{{ label() }}</ng-container>
      }
    }
  `,
})
export class MapTooltip {
  /** Feature properties to try, in order; the first one present is shown. Defaults to `ui.tooltip.fields`. */
  readonly fields = input<string[]>()
  /** Content for the hovered feature when no `geoMapTooltip` template is inside (`<geo-map>` passes its own). */
  readonly template = input<TemplateRef<MapTooltipContext>>()

  protected readonly map = injectMapStatic()
  readonly #selection = injectMapRuntime((map) => map.state.selection)
  readonly #feature = injectHoveredFeature()
  private readonly ownTemplate = contentChild(MapTooltipTemplate)
  protected readonly contentTemplate = computed(
    () => this.ownTemplate()?.template ?? this.template(),
  )
  protected readonly label = computed(() => {
    const feature = this.#feature()
    return feature
      ? (featureLabel(feature, this.fields() ?? this.map().ui.tooltip.fields) ?? '')
      : ''
  })
  protected readonly context = computed<MapTooltipContext | null>(() => {
    const feature = this.#feature()
    // The selected feature already shows its details in the popup.
    if (!feature || sameSelection(this.#selection(), feature)) return null
    if (!this.contentTemplate() && !this.label()) return null
    return { $implicit: feature, feature }
  })
  /** The template drew nothing for the hovered feature: no element and no text. */
  readonly #empty = signal(false)
  protected readonly hidden = computed(() => !this.context() || this.#empty())
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    // Checked after every render: what a template draws can change with more than the feature.
    // A change re-renders before the browser paints, so an empty tooltip never shows.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
    afterEveryRender(() => {
      const drawn = host.childElementCount > 0 || Boolean(host.textContent?.trim())
      this.#empty.set(this.context() !== null && !drawn)
    })
    const pixel = injectMapPixel(() => this.#feature()?.coordinate)
    anchoredPosition(() => (this.hidden() ? undefined : pixel()), 12)
  }
}
