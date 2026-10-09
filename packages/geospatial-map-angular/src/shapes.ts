import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core'
import { injectHostAttribute, optionalBooleanAttribute, partHostStyle } from './signals'
import type { StyleMap } from './signals'
import { sliderFill } from './utils'

// "Shapes" are the small UI primitives every map part is built from. This is the one file to
// edit if you want the map to use your design system: keep the exported names, selectors,
// inputs and outputs, and replace the bodies (for example `hostDirectives: [HlmButton]` from
// spartan/ui, Material's button attributes, or a `<mat-select>` template). Parts use the
// buttons, select, slider and switch in their templates, and apply ShapeCard and ShapeAlert to
// their own host through `hostDirectives`.

/** Lets the part a shape is a host directive of hide it: see `hideWhen`. */
@Directive()
export abstract class PartShape {
  readonly #hidden = signal<() => boolean>(() => false)
  protected readonly shown = computed(() => !this.#hidden()())

  /**
   * Called by a part that applies this shape to its host and has nothing to show (where React
   * renders nothing): the shape drops its class and role while `hidden()` is true.
   */
  hideWhen(hidden: () => boolean): void {
    this.#hidden.set(hidden)
  }
}

/** `<button geoShapeButton>`: a text button. `type` defaults to `button`. */
@Directive({
  selector: 'button[geoShapeButton]',
  host: { class: 'geo-shape-button', 'data-slot': 'button', '[attr.type]': 'type()' },
})
export class ShapeButton {
  readonly type = input<'button' | 'submit' | 'reset'>('button')
}

/** `<button geoShapeIconButton [label]="…">`: an icon button; `label` is its name and tooltip. */
@Directive({
  selector: 'button[geoShapeIconButton]',
  hostDirectives: [{ directive: ShapeButton, inputs: ['type'] }],
  host: {
    class: 'geo-shape-icon-button',
    'data-slot': 'icon-button',
    '[attr.aria-label]': 'consumerLabel ?? label()',
    '[attr.title]': 'label()',
  },
})
export class ShapeIconButton {
  /** Accessible name; also shown as the native tooltip. */
  readonly label = input.required<string>()
  /** A static `aria-label` on the element replaces `label` as the accessible name. */
  protected readonly consumerLabel = injectHostAttribute('aria-label')
}

/** One `<option>` of a ShapeSelect. */
export type ShapeSelectOption = { value: string; label: string; disabled?: boolean }

/**
 * `<geo-shape-select [options]="…" [value]="…" (valueChange)="…">`: a native select without the
 * browser's arrow; the wrapper draws a chevron you can restyle. With `value` it is controlled
 * (it shows `value` again when the change isn't taken); without it, it keeps the user's choice.
 * The chosen option also gets the `selected` attribute, so a server render shows it (as React's).
 */
@Component({
  selector: 'geo-shape-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <span class="geo-shape-select-wrap">
      <select
        #select
        data-slot="select"
        class="geo-shape-select"
        [attr.id]="selectId() ?? null"
        [attr.aria-label]="ariaLabel() ?? null"
        [disabled]="disabled()"
        (change)="changed(select)"
      >
        @for (option of options(); track option.value) {
          <option
            [value]="option.value"
            [disabled]="option.disabled ?? false"
            [attr.selected]="option.value === current() ? '' : null"
            [selected]="option.value === current()"
            [textContent]="option.label"
          ></option>
        }
      </select>
    </span>
  `,
})
export class ShapeSelect {
  readonly options = input.required<readonly ShapeSelectOption[]>()
  /** The selected value; omit to let the select keep the user's choice. */
  readonly value = input<string>()
  readonly ariaLabel = input<string>()
  /** The select's `id`, for a `<label for>`. */
  readonly selectId = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly valueChange = output<string>()

  protected readonly current = linkedSignal<
    { value: string | undefined; options: readonly ShapeSelectOption[] },
    string
  >({
    source: () => ({ value: this.value(), options: this.options() }),
    computation: ({ value, options }, previous) => {
      if (value !== undefined) return value
      // Uncontrolled: new options keep the user's choice while it is offered (a native select's).
      const chosen = previous?.value
      if (chosen !== undefined && options.some((option) => option.value === chosen)) return chosen
      return options[0]?.value ?? ''
    },
  })
  readonly #injector = inject(Injector)

  protected changed(select: HTMLSelectElement): void {
    const next = select.value
    if (this.value() === undefined) this.current.set(next)
    this.valueChange.emit(next)
    // Controlled: show the value the parent has after this change (React's controlled select).
    afterNextRender(
      () => {
        const value = this.value()
        if (value !== undefined && select.value !== value) select.value = value
      },
      { injector: this.#injector },
    )
  }
}

/**
 * `<input type="range" geoShapeSlider [value]="…" (valueChange)="…">`: a range input drawn from
 * the `--geo-slider-*` tokens. Writes the filled share of the track as `--geo-slider-fill`. With
 * `value` it is controlled (it shows `value` again when the change isn't taken).
 */
@Directive({
  selector: 'input[type=range][geoShapeSlider]',
  host: {
    class: 'geo-shape-slider',
    'data-slot': 'slider',
    '[attr.min]': 'min() ?? null',
    '[attr.max]': 'max() ?? null',
    '[attr.step]': 'step() ?? null',
    '[value]': 'value() ?? ""',
    '[style]': 'hostStyle()',
    '(input)': 'changed()',
  },
})
export class ShapeSlider {
  readonly value = input<number | string>()
  readonly min = input<number | string>()
  readonly max = input<number | string>()
  readonly step = input<number | string>()
  /** The new value while the thumb moves. */
  readonly valueChange = output<number>()

  readonly #element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement
  /** Uncontrolled sliders repaint their fill from what was dragged. */
  readonly #dragged = linkedSignal<number | string | undefined, string | undefined>({
    source: this.value,
    computation: () => undefined,
  })
  protected readonly hostStyle = partHostStyle(
    () => false,
    (): StyleMap => {
      const fill = sliderFill(this.value() ?? this.#dragged(), this.min(), this.max())
      return fill ? { '--geo-slider-fill': fill } : {}
    },
  )

  readonly #injector = inject(Injector)

  protected changed(): void {
    if (this.value() === undefined) this.#dragged.set(this.#element.value)
    this.valueChange.emit(Number(this.#element.value))
    // Controlled: show the value the parent has after this change (React's controlled input).
    afterNextRender(
      () => {
        const value = this.value()
        if (value !== undefined && this.#element.value !== String(value))
          this.#element.value = String(value)
      },
      { injector: this.#injector },
    )
  }
}

/**
 * `<label geoShapeSwitch [label]="…" [(checked)]="…">`: a checkbox drawn as a switch, with its
 * label. The label element is the host, so a click anywhere on it toggles the switch. With
 * `checked` it is controlled (it shows `checked` again when the change isn't taken); without
 * it, it keeps the user's choice.
 */
@Component({
  selector: 'label[geoShapeSwitch]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'geo-shape-switch', 'data-slot': 'switch' },
  template: `
    <input
      type="checkbox"
      class="geo-shape-switch-input"
      [checked]="current()"
      [disabled]="disabled()"
      (change)="toggle(checkbox)"
      #checkbox
    />
    <span class="geo-shape-switch-track" aria-hidden="true"></span>
    <span class="geo-shape-switch-label">{{ label() }}</span>
  `,
})
export class ShapeSwitch {
  readonly label = input.required<string>()
  /** Whether the switch is on; omit to let the switch keep the user's choice. */
  readonly checked = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The new state, when the user toggles the switch. */
  readonly checkedChange = output<boolean>()

  protected readonly current = linkedSignal(() => this.checked() ?? false)
  readonly #injector = inject(Injector)

  protected toggle(checkbox: HTMLInputElement): void {
    const next = checkbox.checked
    if (this.checked() === undefined) this.current.set(next)
    this.checkedChange.emit(next)
    // Controlled: show the value the parent has after this change (React's controlled checkbox).
    afterNextRender(
      () => {
        const value = this.checked()
        if (value !== undefined && checkbox.checked !== value) checkbox.checked = value
      },
      { injector: this.#injector },
    )
  }
}

/** `[geoShapeCard]`: a floating surface (panels, legend, popup). */
@Directive({
  selector: '[geoShapeCard]',
  host: { 'data-slot': 'card', '[class.geo-shape-card]': 'shown()' },
})
export class ShapeCard extends PartShape {}

/** `[geoShapeAlert]`: an alert surface with `role="alert"`. */
@Directive({
  selector: '[geoShapeAlert]',
  host: {
    'data-slot': 'alert',
    '[class.geo-shape-alert]': 'shown()',
    '[attr.role]': 'shown() ? (consumerRole ?? "alert") : null',
  },
})
export class ShapeAlert extends PartShape {
  /** A static `role` on the element replaces `alert`. */
  protected readonly consumerRole = injectHostAttribute('role')
}

/** `[geoShapeLabel]`: a form label (the settings fields apply it to their own host). */
@Directive({
  selector: '[geoShapeLabel]',
  host: {
    '[class.geo-shape-label]': 'shown()',
    '[attr.data-slot]': 'shown() ? (consumerSlot ?? "label") : null',
  },
})
export class ShapeLabel extends PartShape {
  /** A static `data-slot` on the element replaces the shape's own. */
  protected readonly consumerSlot = injectHostAttribute('data-slot')
}

/** `[geoShapeBadge]`: a small status label. */
@Directive({
  selector: '[geoShapeBadge]',
  host: { class: 'geo-shape-badge', 'data-slot': 'badge' },
})
export class ShapeBadge {}
