// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import {
  DestroyRef,
  InjectionToken,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core'
import type { Signal } from '@angular/core'
import { MAP_ICONS } from './icons'
import type { MapContextValue, MapIcons, MapStaticValue } from './component-types'
import type { FeatureEvent, LonLat, MapActions, MapRuntime, MapSlotContext } from './types'

// What the parts read. `<geo-map-root>` and `<geo-map>` provide MAP_CONTEXT; parts inject it
// through the functions below, never the root class, so a test can provide a fake context. The
// static value only changes with the configuration, so parts that only read the configuration
// or send commands don't update while the map moves. The live data is a signal:
// `injectMapRuntime(select)` updates a part only when what it selects changes.

/** What MAP_CONTEXT holds. */
export type MapContext = {
  /** Configuration, UI policy, messages, actions and icons (never `null`, see `MapStaticValue`). */
  readonly staticValue: Signal<MapStaticValue>
  /** The live map data. */
  readonly runtime: Signal<MapRuntime>
  /** Every map action, stable for the life of the map. */
  readonly actions: MapActions
}

/** Provided by `<geo-map-root>` and `<geo-map>` for the parts inside them. */
export const MAP_CONTEXT = new InjectionToken<MapContext>('MAP_CONTEXT')

function missingRoot(name: string): never {
  throw new Error(`${name} must be used inside <geo-map-root> or <geo-map>.`)
}

function mapContext(name: string): MapContext {
  return inject(MAP_CONTEXT, { optional: true }) ?? missingRoot(name)
}

/** Configuration, UI policy, messages, actions and icons; doesn't change while the map moves. */
export function injectMapStatic(): Signal<MapStaticValue> {
  return mapContext('injectMapStatic()').staticValue
}

/** Stable map actions; a part using only these doesn't update when the map moves. */
export function injectMapActions(): MapActions {
  return mapContext('injectMapActions()').actions
}

/**
 * The map's icons by name, for custom parts that should match the built-in ones. Outside a map,
 * the app's icons (`icons.ts` and `provideMapIcons()`).
 */
export function injectMapIcons(): Signal<MapIcons> {
  const context = inject(MAP_CONTEXT, { optional: true })
  if (context) return computed(() => context.staticValue().icons)
  return signal(inject(MAP_ICONS)).asReadonly()
}

/**
 * One piece of the live map data: `injectMapRuntime((map) => map.statuses)`. The signal changes
 * only when that piece changes, so select a field and derive from it with `computed`.
 */
export function injectMapRuntime<T>(
  select: (runtime: MapRuntime) => T,
  options: { equal?: (left: T, right: T) => boolean } = {},
): Signal<T> {
  const { runtime } = mapContext('injectMapRuntime()')
  return computed(() => select(runtime()), options)
}

/** Everything at once: configuration, live map data, and actions. Changes on every change. */
export function injectMap(): Signal<MapContextValue> {
  const context = mapContext('injectMap()')
  return computed(() => ({ ...context.staticValue(), ...context.runtime() }))
}

/** The `{ state, actions }` object passed to templates. */
export function injectSlotContext(): Signal<MapSlotContext> {
  const context = mapContext('injectSlotContext()')
  const state = computed(() => context.runtime().state)
  return computed(() => ({ state: state(), actions: context.actions }))
}

const samePoint = (left: LonLat | null, right: LonLat | null) =>
  left === right || (!!left && !!right && left[0] === right[0] && left[1] === right[1])

/**
 * Pixel position of `lonLat()` inside the map stage, kept up to date while the map pans and
 * zooms. `null` when `lonLat()` is `null` or the map has not laid out yet. Use it to place your
 * own HTML on the map (markers, labels, callouts): position it absolutely with `left`/`top`
 * inside a part. It follows the map's frames, and stops when the calling component is destroyed.
 */
export function injectMapPixel(
  lonLat: () => LonLat | null | undefined,
): Signal<[number, number] | null> {
  const actions = mapContext('injectMapPixel()').actions
  const point = computed(
    () => {
      const value = lonLat()
      return value ? ([value[0], value[1]] as const) : null
    },
    { equal: samePoint },
  )
  const keyOf = (value: LonLat | null) => {
    if (!value) return ''
    const pixel = actions.pixelAt(value)
    return pixel ? `${Math.round(pixel[0])},${Math.round(pixel[1])}` : ''
  }
  // Starts over when the point changes; each drawn frame writes it only when the pixel moved.
  const key = linkedSignal(() => keyOf(point()))
  const stop = actions.onRender(() => key.set(keyOf(untracked(point))))
  inject(DestroyRef).onDestroy(stop)
  return computed(() => {
    const value = key()
    if (!value) return null
    const [x, y] = value.split(',').map(Number)
    return [x!, y!]
  })
}

/** The selectable feature under the pointer, or `null`. Updates only the calling component. */
export function injectHoveredFeature(): Signal<FeatureEvent | null> {
  const actions = mapContext('injectHoveredFeature()').actions
  const hovered = signal(actions.getHoveredFeature())
  const stop = actions.onHoverChange(() => hovered.set(actions.getHoveredFeature()))
  inject(DestroyRef).onDestroy(stop)
  return hovered.asReadonly()
}
