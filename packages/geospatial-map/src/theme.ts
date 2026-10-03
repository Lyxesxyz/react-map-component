import type { MapThemeTokens } from './types'

// The stylesheet (`geospatial-map.css`) is the source of truth for the look of the map.
// `config.theme` is the JSON-safe way to override a few tokens per map: each key below maps to
// one CSS custom property, and only the keys you set are written inline on the map root.

type ThemeColorKey = Exclude<keyof MapThemeTokens, 'density'>

/** CSS custom property written for each JSON theme key. */
export const mapThemeVariables: Record<ThemeColorKey, `--geo-${string}`> = {
  fontFamily: '--geo-font-family',
  textColor: '--geo-foreground',
  mutedColor: '--geo-muted-foreground',
  borderColor: '--geo-border',
  surfaceColor: '--geo-background',
  softSurfaceColor: '--geo-muted',
  glassColor: '--geo-overlay',
  accentColor: '--geo-primary',
  accentHoverColor: '--geo-primary-hover',
  dangerColor: '--geo-destructive',
  focusColor: '--geo-ring',
  radius: '--geo-radius',
  shadow: '--geo-shadow',
  controlSize: '--geo-control-size',
}

/** Light-theme defaults, mirroring the `:root` tokens in `geospatial-map.css`. */
export const defaultMapTheme: MapThemeTokens = {
  fontFamily: 'inherit',
  textColor: '#18181b',
  mutedColor: '#71717a',
  borderColor: 'rgba(24, 24, 27, 0.14)',
  surfaceColor: '#ffffff',
  softSurfaceColor: '#f4f4f5',
  glassColor: 'rgba(255, 255, 255, 0.94)',
  accentColor: '#0f766e',
  accentHoverColor: '#115e59',
  dangerColor: '#a61b1b',
  focusColor: 'rgba(20, 108, 117, 0.35)',
  radius: '12px',
  shadow: '0 12px 32px rgba(24, 24, 27, 0.12), 0 2px 5px rgba(24, 24, 27, 0.08)',
  controlSize: '42px',
  density: 'comfortable',
}

/** Inline style containing only the theme keys that were explicitly configured. */
export function mapThemeStyle(theme: Partial<MapThemeTokens> | undefined): Record<string, string> {
  const style: Record<string, string> = {}
  if (!theme) return style
  for (const key of Object.keys(mapThemeVariables) as ThemeColorKey[]) {
    const value = theme[key]
    if (value !== undefined) style[mapThemeVariables[key]] = value
  }
  return style
}

/** Resolves partial consumer theme overrides against package defaults. */
export function resolveMapTheme(theme: Partial<MapThemeTokens> | undefined): MapThemeTokens {
  return { ...defaultMapTheme, ...theme }
}
