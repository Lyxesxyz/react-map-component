export type ClassValue = string | false | null | undefined

/** Joins class names, skipping falsy values. Swap for `clsx` + `tailwind-merge` if you use Tailwind. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Makes a string safe to use inside a DOM id. */
export function safeId(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9_-]/g, '-')
}

/** Saves a blob through a temporary link (browser only). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Merges explicitly passed props over configured defaults, ignoring `undefined` props. */
export function withDefaults<T extends object>(
  defaults: T,
  overrides: { [K in keyof T]?: T[K] | undefined },
): T {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const value = overrides[key]
    if (value !== undefined) result[key] = value as T[keyof T]
  }
  return result
}

/** Runs a default action after a caller's handler unless it called `event.preventDefault()`. */
export function composeHandler<E extends { defaultPrevented: boolean }>(
  handler: ((event: E) => void) | undefined,
  fallback: (event: E) => void,
): (event: E) => void {
  return (event) => {
    handler?.(event)
    if (!event.defaultPrevented) fallback(event)
  }
}

const shownWarnings = new Set<string>()

/** Logs an integration hint once per page; it never throws or changes behavior. */
export function warnOnce(key: string, message: string): void {
  if (shownWarnings.has(key)) return
  shownWarnings.add(key)
  console.warn(`[geospatial-map] ${message}`)
}
