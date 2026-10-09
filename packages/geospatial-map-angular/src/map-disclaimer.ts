import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  InjectionToken,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import type { WritableSignal } from '@angular/core'
import { injectMapStatic } from './map-context'
import { ShapeButton } from './shapes'
import {
  controllableSignal,
  injectUniqueId,
  optionalBooleanAttribute,
  partHostStyle,
} from './signals'

/** Whether a disclaimer shows its fallback text (`ui.disclaimer.text`): nothing was projected. */
const USES_FALLBACK = new InjectionToken<WritableSignal<boolean>>('geo-map-disclaimer fallback')

/**
 * Marks the disclaimer's fallback text. Angular creates it only when nothing is projected, and
 * before the part's host bindings are read, so the part knows whether it has text to show.
 */
@Directive({ selector: 'ng-container[geoMapDisclaimerFallback]' })
class MapDisclaimerFallback {
  constructor() {
    inject(USES_FALLBACK).set(true)
  }
}

/**
 * A disclaimer button in a bottom corner of the map. Clicking it expands the text across the
 * bottom of the map; clicking the heading (or pressing Escape) collapses it again. The text is
 * the projected content (links and formatting are allowed), or `ui.disclaimer.text`. Hidden (with
 * no classes or data attributes) while there is neither.
 *
 * ```html
 * <geo-map-disclaimer>Boundaries do not imply official endorsement.</geo-map-disclaimer>
 * ```
 */
@Component({
  selector: 'geo-map-disclaimer',
  imports: [MapDisclaimerFallback, ShapeButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: USES_FALLBACK, useFactory: () => signal(false) }],
  host: {
    '[class.geo-disclaimer]': '!hidden()',
    '[attr.data-slot]': 'hidden() ? null : "map-disclaimer"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.disclaimer.placement)',
    '[attr.data-open]': '!hidden() && isOpen() ? "" : null',
    // `title` is the heading (an input), not the element's tooltip, as in React.
    '[attr.title]': 'null',
    '[style]': 'hostStyle()',
    '(keydown)': 'keydown($event)',
  },
  // One button in both states, so keyboard focus stays on it when the text opens or closes. The
  // text's span stays while hidden (empty, without attributes): it holds the projected content.
  template: `
    @if (!hidden()) {
      <button
        geoShapeButton
        class="geo-disclaimer-toggle"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-controls]="textId"
        [textContent]="heading()"
        (click)="toggle()"
      ></button>
    }
    <span
      [attr.id]="hidden() ? null : textId"
      [class.geo-disclaimer-text]="!hidden()"
      [attr.hidden]="hidden() || isOpen() ? null : ''"
      ><ng-content
        ><ng-container geoMapDisclaimerFallback />{{ map().ui.disclaimer.text }}</ng-content
      ></span
    >
  `,
})
export class MapDisclaimer {
  /** Button label and heading; defaults to `ui.disclaimer.title`, then "Disclaimer". */
  readonly title = input<string>()
  /** Bottom corner of the button; defaults to `ui.disclaimer.placement`. */
  readonly placement = input<'bottom-left' | 'bottom-right'>()
  /** Start expanded; defaults to `ui.disclaimer.defaultOpen`. */
  readonly defaultOpen = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Controlled expanded state, with `openChange` (`[(open)]`). */
  readonly open = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** The new expanded state, when the user opens or closes the text. */
  readonly openChange = output<boolean>()

  protected readonly map = injectMapStatic()
  readonly #usesFallback = inject(USES_FALLBACK)
  readonly #open = controllableSignal({
    value: () => this.open(),
    initial: () => this.defaultOpen() ?? this.map().ui.disclaimer.defaultOpen,
    onChange: (open) => this.openChange.emit(open),
  })
  protected readonly isOpen = this.#open.value
  protected readonly textId = `${injectUniqueId('geo-disclaimer')}-text`
  protected readonly hidden = computed(() => this.#usesFallback() && !this.map().ui.disclaimer.text)
  protected readonly heading = computed(
    () => this.title() ?? (this.map().ui.disclaimer.title || this.map().messages.disclaimer),
  )
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  protected toggle(): void {
    this.#open.set(!this.isOpen())
  }

  protected keydown(event: KeyboardEvent): void {
    if (this.isOpen() && event.key === 'Escape') {
      event.stopPropagation()
      this.#open.set(false)
    }
  }
}
