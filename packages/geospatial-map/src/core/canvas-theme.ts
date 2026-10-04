// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

// Colors and font used where CSS cannot reach: the OpenLayers canvas (labels, selection
// highlight) and exported PNG/JPEG/SVG reports. They are read from the `--geo-*` tokens on
// the map element, so the stylesheet stays the single place to change them.

export type CanvasTheme = {
  fontFamily: string
  /** Map label and cluster count size in pixels (`--geo-label-size`). */
  labelSize: number
  /** Map label weight (`--geo-label-weight`). */
  labelWeight: string
  labelColor: string
  labelHalo: string
  selectionFill: string
  selectionStroke: string
  selectionLine: string
  exportBackground: string
  exportForeground: string
  exportMuted: string
  clusterFill: string
  clusterText: string
  /** Concrete values for the `var(--…)` colors used in layer styles and basemap backgrounds. */
  colors: Record<string, string>
}

export const defaultCanvasTheme: CanvasTheme = {
  fontFamily: 'system-ui, sans-serif',
  labelSize: 12,
  labelWeight: '500',
  labelColor: '#172033',
  labelHalo: '#ffffff',
  selectionFill: 'rgba(255, 196, 0, 0.35)',
  selectionStroke: '#111827',
  selectionLine: '#ffc400',
  exportBackground: '#ffffff',
  exportForeground: '#172033',
  exportMuted: '#4b5563',
  clusterFill: '#0f766e',
  clusterText: '#ffffff',
  colors: {},
}

/** Whether a configured color needs the CSS cascade to resolve (`var(--geo-basemap-land)`). */
export function isCssColor(color: string): boolean {
  return color.includes('var(')
}

/** Every `var(…)` color string in configuration values. Inline features and rows are skipped. */
export function collectCssColors(...values: unknown[]): string[] {
  const found = new Set<string>()
  JSON.stringify(values, (key, value: unknown) => {
    if ((key === 'features' || key === 'rows') && Array.isArray(value)) return undefined
    if (typeof value === 'string' && isCssColor(value)) found.add(value)
    return value
  })
  return [...found]
}

/** A color the canvas can draw: `var()` colors are looked up in the resolved theme. */
export function paint(color: string, theme: CanvasTheme): string
export function paint(color: string | undefined, theme: CanvasTheme): string | undefined
export function paint(color: string | undefined, theme: CanvasTheme): string | undefined {
  if (color === undefined || !isCssColor(color)) return color
  return theme.colors[color] ?? 'transparent'
}

// Each token is resolved through a different color property of one hidden probe, so a single
// style read resolves `var()`, `oklch()`, and `color-mix()` values to concrete colors.
const colorTokens = [
  ['labelColor', '--geo-label-color', 'color'],
  ['labelHalo', '--geo-label-halo', 'background-color'],
  ['selectionFill', '--geo-selection-fill', 'border-top-color'],
  ['selectionStroke', '--geo-selection-stroke', 'border-right-color'],
  ['selectionLine', '--geo-selection-line', 'border-bottom-color'],
  ['exportBackground', '--geo-export-background', 'border-left-color'],
  ['exportForeground', '--geo-export-foreground', 'outline-color'],
  ['exportMuted', '--geo-export-muted', 'text-decoration-color'],
  ['clusterFill', '--geo-cluster-fill', 'column-rule-color', 'var(--geo-primary, #0f766e)'],
  ['clusterText', '--geo-cluster-text', 'caret-color', 'var(--geo-primary-foreground, #ffffff)'],
] as const satisfies ReadonlyArray<
  readonly [
    Exclude<keyof CanvasTheme, 'fontFamily' | 'labelSize' | 'labelWeight' | 'colors'>,
    string,
    string,
    string?,
  ]
>

/**
 * Resolves the canvas theme from the CSS tokens visible at `element` (browser only), plus any
 * `var(--…)` colors listed in `cssColors`.
 */
export function readCanvasTheme(
  element: HTMLElement | null | undefined,
  cssColors: string[] = [],
): CanvasTheme {
  if (!element?.isConnected || typeof getComputedStyle !== 'function') return defaultCanvasTheme
  const probe = document.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    'border-style:solid',
    'outline-style:solid',
    'font-size:var(--geo-label-size, 12px)',
    'font-weight:var(--geo-label-weight, 500)',
    ...colorTokens.map(
      ([key, token, property, fallback]) =>
        `${property}:var(${token}, ${fallback ?? defaultCanvasTheme[key]})`,
    ),
  ].join(';')
  element.appendChild(probe)
  try {
    const computed = getComputedStyle(probe)
    const theme: CanvasTheme = {
      ...defaultCanvasTheme,
      fontFamily: computed.fontFamily || defaultCanvasTheme.fontFamily,
      labelSize: Number.parseFloat(computed.fontSize) || defaultCanvasTheme.labelSize,
      labelWeight: computed.fontWeight || defaultCanvasTheme.labelWeight,
    }
    for (const [key, , property] of colorTokens)
      theme[key] = computed.getPropertyValue(property) || defaultCanvasTheme[key]
    // `background-color` is not inherited, so an undefined variable resolves to transparent
    // rather than to the parent's color.
    const colors: Record<string, string> = {}
    for (const color of cssColors) {
      probe.style.backgroundColor = ''
      probe.style.backgroundColor = color
      colors[color] = getComputedStyle(probe).backgroundColor || 'transparent'
    }
    theme.colors = colors
    return theme
  } finally {
    probe.remove()
  }
}

/** A CSS `font` shorthand for canvas text. */
export function canvasFont(theme: CanvasTheme, size: number, weight: number | string = 'normal') {
  return `${weight} ${size}px ${theme.fontFamily}`
}

/**
 * Calls `onChange` when the tokens visible to the map may have changed: a `class`,
 * `data-theme` or `style` change on the map or any element above it (a theme class on a
 * wrapper, `.dark` on `<html>`), or a change of the system color scheme. Canvas colors and
 * label fonts come from CSS tokens, so they are re-read then even if the host does not
 * re-render the map.
 */
export function watchColorScheme(target: HTMLElement, onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined
  let frame: number | undefined
  const schedule = () => {
    if (frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      onChange()
    })
  }
  const observer =
    typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(schedule)
  for (let element: HTMLElement | null = target; element; element = element.parentElement)
    observer?.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    })
  const media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined
  media?.addEventListener('change', schedule)
  return () => {
    observer?.disconnect()
    media?.removeEventListener('change', schedule)
    if (frame !== undefined) cancelAnimationFrame(frame)
  }
}
