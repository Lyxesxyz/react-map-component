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
import { injectMapActions, injectMapRuntime, injectMapStatic } from './map-context'
import { MapErrorTemplate } from './map-templates'
import { ShapeAlert, ShapeButton } from './shapes'
import { optionalBooleanAttribute, partHostStyle } from './signals'
import type { MapErrorContext } from './component-types'
import type { MapPlacement } from './types'

/**
 * The latest runtime error (a layer that failed to load, an export, location). Its message is
 * replaced by a `<ng-template geoMapError let-error let-dismiss="dismiss">` or by static
 * projected content. Hidden (with no classes or ARIA) while there is no error.
 */
@Component({
  selector: 'geo-map-error-alert',
  imports: [NgTemplateOutlet, ShapeButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeAlert],
  host: {
    '[class.geo-error-alert]': '!hidden()',
    '[attr.data-slot]': 'hidden() ? null : "map-error-alert"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.errorAlert.placement)',
    '[attr.data-code]': 'code()',
    '[style]': 'hostStyle()',
  },
  template: `
    <ng-content select="ng-template" />
    @if (context(); as context) {
      @if (contentTemplate(); as content) {
        <ng-container *ngTemplateOutlet="content; context: context" />
      } @else {
        <ng-content
          ><span class="geo-alert-message">{{ context.error.message }}</span></ng-content
        >
      }
      @if ((dismissible() ?? map().ui.errorAlert.dismissible) && context.error.recoverable) {
        <button
          geoShapeButton
          class="geo-alert-dismiss"
          [textContent]="map().messages.dismiss"
          (click)="context.dismiss()"
        ></button>
      }
    }
  `,
})
export class MapErrorAlert {
  /** Corner of the map; defaults to `ui.errorAlert.placement`. */
  readonly placement = input<MapPlacement>()
  /** Show a dismiss button for recoverable errors; defaults to `ui.errorAlert.dismissible`. */
  readonly dismissible = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Replaces the error message when no `geoMapError` template is inside. */
  readonly template = input<TemplateRef<MapErrorContext>>()

  protected readonly map = injectMapStatic()
  readonly #actions = injectMapActions()
  readonly #error = injectMapRuntime((map) => map.error)
  private readonly ownTemplate = contentChild(MapErrorTemplate)
  protected readonly hidden = computed(() => !this.#error())
  protected readonly code = computed(() => this.#error()?.code ?? null)
  protected readonly contentTemplate = computed(
    () => this.ownTemplate()?.template ?? this.template(),
  )
  protected readonly context = computed<MapErrorContext | null>(() => {
    const error = this.#error()
    return error ? { $implicit: error, error, dismiss: this.#actions.dismissError } : null
  })
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeAlert, { self: true }).hideWhen(() => this.hidden())
  }
}
