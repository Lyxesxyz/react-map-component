// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import {
  HostAttributeToken,
  booleanAttribute,
  InjectionToken,
  computed,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core'
import type { Signal } from '@angular/core'

// Small signal helpers shared by the engine and the parts.

const UNIQUE_IDS = new InjectionToken<{ next: number }>('geospatial-map ids', {
  providedIn: 'root',
  factory: () => ({ next: 0 }),
})

/**
 * A DOM id unique in this app (`<prefix>-<n>`), the Angular form of React's `useId`. Call it in
 * an injection context. The counter belongs to the app, so a server render and the browser
 * count alike; ids only link ARIA attributes, and the browser re-applies them after hydration.
 */
export function injectUniqueId(prefix: string): string {
  return `${prefix}-${++inject(UNIQUE_IDS).next}`
}

/**
 * The `transform` of a boolean input whose `undefined` means "use the config's default"
 * (`<geo-map-attribution compact>` is `true`, no attribute is `undefined`).
 */
export function optionalBooleanAttribute(value: unknown): boolean | undefined {
  return value === undefined ? undefined : booleanAttribute(value)
}

/** A value the parent may control (see `controllableSignal`). */
export type ControllableSignal<T> = {
  /** The parent's value when it gives one, otherwise our own. */
  readonly value: Signal<T>
  /** Updates our own value when uncontrolled, and always tells `onChange`. */
  set(next: T): void
}

/**
 * A value the parent may control: `value()` when it is not `undefined`, otherwise state of our
 * own that starts from `initial()` (again whenever `resetKey()` changes). The Angular form of
 * React's `useControllableState`; pair an input with an output (`[(open)]`) to use it.
 */
export function controllableSignal<T>(options: {
  value: () => T | undefined
  initial: () => T
  onChange?: (value: T) => void
  resetKey?: () => string
}): ControllableSignal<T> {
  const own = linkedSignal({
    source: () => options.resetKey?.() ?? '',
    computation: () => untracked(options.initial),
  })
  const value = computed(() => {
    const controlled = options.value()
    return controlled === undefined ? own() : controlled
  })
  return {
    value,
    set: (next) => {
      if (untracked(options.value) === undefined) own.set(next)
      options.onChange?.(next)
    },
  }
}

/**
 * The consumer's static attribute on the part's host (`<geo-map-legend aria-label="Key">`), or
 * `null`. Call it in a field initializer. A host binding beats a static attribute, so a part that
 * binds `[attr.aria-label]` or `[attr.role]` binds `consumer ?? own` to let the consumer's value
 * win, as React's `{ ...props }` does.
 */
export function injectHostAttribute(name: string): string | null {
  return inject(new HostAttributeToken(name), { optional: true })
}

/** A host `[style]` map: a value of `null` removes the property. */
export type StyleMap = Record<string, string | null>

/** Parses a static `style` attribute (`"color: red; --geo-x: 2px"`) into a style map. */
export function parseStyle(style: string | null | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  for (const declaration of (style ?? '').split(';')) {
    const colon = declaration.indexOf(':')
    if (colon > 0) map[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim()
  }
  return map
}

/**
 * The single `[style]` host binding of a map part (call it in a field initializer):
 * `{ ...own(), ...the consumer's static style, display: none while hidden }`.
 *
 * A host `[style]` map beats the consumer's static `style` attribute and owns every key it has
 * set, so it re-emits the consumer's declarations itself: they win over the part's own values,
 * as in React (`{ ...partStyle, ...style }`), and come back after the part was hidden. Never bind
 * `[style.display]` on a part for hiding: a consumer's static `display` would beat it.
 */
export function partHostStyle(
  hidden: () => boolean = () => false,
  own: () => StyleMap = () => ({}),
): Signal<StyleMap> {
  const consumer = parseStyle(inject(new HostAttributeToken('style'), { optional: true }))
  return computed(() => ({ ...own(), ...consumer, ...(hidden() ? { display: 'none' } : {}) }))
}
