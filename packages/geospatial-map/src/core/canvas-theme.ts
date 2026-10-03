// Colors and font used where CSS cannot reach: the OpenLayers canvas (labels, selection
// highlight) and exported PNG/JPEG/SVG reports. They are read from the `--geo-*` tokens on
// the map element, so the stylesheet stays the single place to change them.

export type CanvasTheme = {
  fontFamily: string
  labelColor: string
  labelHalo: string
  selectionFill: string
  selectionStroke: string
  selectionLine: string
  exportBackground: string
  exportForeground: string
  exportMuted: string
}

export const defaultCanvasTheme: CanvasTheme = {
  fontFamily: 'system-ui, sans-serif',
  labelColor: '#172033',
  labelHalo: '#ffffff',
  selectionFill: 'rgba(255, 196, 0, 0.35)',
  selectionStroke: '#111827',
  selectionLine: '#ffc400',
  exportBackground: '#ffffff',
  exportForeground: '#172033',
  exportMuted: '#4b5563',
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
] as const

/** Resolves the canvas theme from the CSS tokens visible at `element` (browser only). */
export function readCanvasTheme(element: HTMLElement | null | undefined): CanvasTheme {
  if (!element?.isConnected || typeof getComputedStyle !== 'function') return defaultCanvasTheme
  const probe = document.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    'border-style:solid',
    'outline-style:solid',
    ...colorTokens.map(
      ([key, token, property]) => `${property}:var(${token}, ${defaultCanvasTheme[key]})`,
    ),
  ].join(';')
  element.appendChild(probe)
  try {
    const computed = getComputedStyle(probe)
    const theme: CanvasTheme = {
      ...defaultCanvasTheme,
      fontFamily: computed.fontFamily || defaultCanvasTheme.fontFamily,
    }
    for (const [key, , property] of colorTokens)
      theme[key] = computed.getPropertyValue(property) || defaultCanvasTheme[key]
    return theme
  } finally {
    probe.remove()
  }
}

/** A CSS `font` shorthand for canvas text. */
export function canvasFont(theme: CanvasTheme, size: number, weight: number | 'normal' = 'normal') {
  return `${weight} ${size}px ${theme.fontFamily}`
}
