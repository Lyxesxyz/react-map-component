export type ClassValue = string | false | null | undefined

/** Joins class names, skipping falsy values. Swap for `clsx` + `tailwind-merge` if you use Tailwind. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}

/** The filled share of a range input's track, for the `--geo-slider-fill` token. */
export function sliderFill(
  value: string | number | readonly string[] | undefined,
  min: string | number = 0,
  max: string | number = 100,
): string | undefined {
  const [current, low, high] = [value, min, max].map(Number)
  if (!Number.isFinite(current) || !Number.isFinite(low) || !Number.isFinite(high)) return undefined
  if (high! <= low!) return '0%'
  return `${Math.min(100, Math.max(0, ((current! - low!) / (high! - low!)) * 100))}%`
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
