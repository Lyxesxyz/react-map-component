'use client'

// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

// Small React helpers shared by the engine and the parts.

/** `useLayoutEffect` in the browser, `useEffect` during server rendering (avoids the SSR warning). */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** A ref that always holds the latest committed value, for stable callbacks to read. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  useIsomorphicLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

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
