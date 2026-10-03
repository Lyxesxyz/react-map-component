import { useEffect, useLayoutEffect, useRef } from 'react'

export type ClassValue = string | false | null | undefined

/** Joins class names, skipping falsy values. Swap for `clsx` + `tailwind-merge` if you use Tailwind. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}

/** `useLayoutEffect` in the browser, `useEffect` during server rendering (avoids the SSR warning). */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Keeps a ref pointing at the latest committed value, for use inside stable callbacks. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  useIsomorphicLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

/** Makes a string safe to use inside a DOM id. */
export function safeId(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9_-]/g, '-')
}
