import type { MapTheme, MapThemeToken } from './types'

// The stylesheet (`geospatial-map.css`) is the source of truth for the look of the map.
// `config.theme` overrides a few tokens for one map: each key is a token name, written inline
// on the map root as the `--geo-*` custom property of the same name.

/** Every token `config.theme` can set. */
export const mapThemeTokenNames = [
  'fontFamily',
  'foreground',
  'background',
  'muted',
  'mutedForeground',
  'border',
  'overlay',
  'primary',
  'primaryForeground',
  'primaryHover',
  'destructive',
  'ring',
  'stage',
  'radius',
  'shadow',
  'controlSize',
] as const satisfies readonly MapThemeToken[]

/** The CSS custom property of a token: `mutedForeground` → `--geo-muted-foreground`. */
export function themeVariable(token: MapThemeToken): `--geo-${string}` {
  return `--geo-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

/** Inline style with the tokens that were set. */
export function mapThemeStyle(theme: MapTheme | undefined): Record<string, string> {
  const style: Record<string, string> = {}
  for (const token of mapThemeTokenNames) {
    const value = theme?.[token]
    if (value !== undefined) style[themeVariable(token)] = value
  }
  return style
}
