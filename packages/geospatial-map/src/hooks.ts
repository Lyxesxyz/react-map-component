'use client'

// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { Dispatch, Ref, RefCallback, SetStateAction } from 'react'

// Small React helpers shared by the engine and the parts.

/** `useLayoutEffect` in the browser, `useEffect` during server rendering (avoids the SSR warning). */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * State that starts over from `initial()` whenever `key` changes, in the same render (React's
 * "adjusting state when a prop changes" pattern, without an effect).
 */
export function useResettableState<T>(
  key: string,
  initial: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [entry, setEntry] = useState(() => ({ key, value: initial() }))
  let current = entry
  if (entry.key !== key) {
    current = { key, value: initial() }
    setEntry(current)
  }
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) =>
      setEntry((previous) => ({
        key: previous.key,
        value: typeof action === 'function' ? (action as (value: T) => T)(previous.value) : action,
      })),
    [],
  )
  return [current.value, setValue]
}

/**
 * A value the parent may control: `value` when it is not `undefined`, otherwise state of our own
 * that starts from `initial()` (again whenever `resetKey` changes). Setting it updates our own
 * state when uncontrolled, and always tells `onChange`.
 */
export function useControllableState<T>(
  value: T | undefined,
  initial: () => T,
  onChange: ((value: T) => void) | undefined,
  resetKey = '',
): [T, (next: T) => void] {
  const [own, setOwn] = useResettableState(resetKey, initial)
  const controlled = value !== undefined
  const set = (next: T) => {
    if (!controlled) setOwn(next)
    onChange?.(next)
  }
  return [controlled ? value : own, set]
}

function assignRef<T>(ref: Ref<T> | undefined, element: T | null): void {
  if (typeof ref === 'function') ref(element)
  else if (ref) ref.current = element
}

/** One callback ref that sets both refs (a part's own, and the one passed to it). */
export function useMergedRef<T>(
  first: Ref<T> | undefined,
  second: Ref<T> | undefined,
): RefCallback<T> {
  return useCallback(
    (element: T | null) => {
      assignRef(first, element)
      assignRef(second, element)
    },
    [first, second],
  )
}
