import type { JsonValue, StyleLayerSelection, StyleOverride } from '../types'

// Mapbox GL style documents (the format of ArcGIS vector tile styles): choosing which style
// layers a map layer draws, and applying simple overrides (colour, width, visibility).

export type StyleLayer = {
  id: string
  type: string
  'source-layer'?: string
  paint?: Record<string, JsonValue>
  layout?: Record<string, JsonValue>
  [key: string]: unknown
}

export type StyleDocument = {
  version?: number
  sources?: Record<string, { type?: string; url?: string }>
  layers: StyleLayer[]
  [key: string]: unknown
}

const documents = new Map<string, Promise<StyleDocument>>()

/** Fetches a style document once per page. */
export function loadStyleDocument(url: string): Promise<StyleDocument> {
  let pending = documents.get(url)
  if (!pending) {
    pending = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
      const style = (await response.json()) as StyleDocument
      if (!Array.isArray(style.layers)) throw new Error(`${url} is not a vector tile style`)
      return style
    })
    pending.catch(() => documents.delete(url))
    documents.set(url, pending)
  }
  return pending
}

/** Case-insensitive match of a style layer id against an id or a `*` pattern. */
export function matchesPattern(id: string, pattern: string): boolean {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${source}$`, 'i').test(id)
}

/** Text labels and boundary lines: what should stay readable above data layers. */
export function isReferenceLayer(layer: StyleLayer): boolean {
  if (layer.type === 'symbol') return true
  return (
    layer.type === 'line' &&
    /bound|admin|border/i.test(`${layer.id} ${layer['source-layer'] ?? ''}`)
  )
}

function selected(layer: StyleLayer, selection: StyleLayerSelection | undefined): boolean {
  if (!selection) return true
  if (selection === 'reference') return isReferenceLayer(layer)
  if (selection === 'base') return !isReferenceLayer(layer)
  return selection.some((pattern) => matchesPattern(layer.id, pattern))
}

const paintKeys: Record<string, Partial<Record<'color' | 'width' | 'opacity', string>>> = {
  line: { color: 'line-color', width: 'line-width', opacity: 'line-opacity' },
  fill: { color: 'fill-color', opacity: 'fill-opacity' },
  symbol: { color: 'text-color', opacity: 'text-opacity' },
  background: { color: 'background-color', opacity: 'background-opacity' },
  circle: { color: 'circle-color', width: 'circle-stroke-width', opacity: 'circle-opacity' },
  'fill-extrusion': { color: 'fill-extrusion-color', opacity: 'fill-extrusion-opacity' },
}

function overridden(
  layer: StyleLayer,
  override: StyleOverride,
  color: (value: string) => string,
): StyleLayer {
  const keys = paintKeys[layer.type] ?? {}
  const paint: Record<string, JsonValue> = { ...layer.paint }
  if (override.color !== undefined && keys.color) paint[keys.color] = color(override.color)
  if (override.width !== undefined && keys.width) paint[keys.width] = override.width
  if (override.opacity !== undefined && keys.opacity) paint[keys.opacity] = override.opacity
  const layout: Record<string, JsonValue> = { ...layer.layout, ...override.layout }
  if (override.visible !== undefined) layout['visibility'] = override.visible ? 'visible' : 'none'
  return { ...layer, paint: { ...paint, ...override.paint }, layout }
}

export type PreparedStyle = {
  style: StyleDocument
  /** Overrides whose pattern matched no layer of the whole style. */
  unmatched: string[]
}

/**
 * A copy of `style` with only the selected layers, and the overrides applied in order.
 * `color` turns `var(--token)` colours into concrete ones.
 */
export function prepareStyle(
  style: StyleDocument,
  selection: StyleLayerSelection | undefined,
  overrides: StyleOverride[] = [],
  color: (value: string) => string = (value) => value,
): PreparedStyle {
  const unmatched = overrides
    .filter((override) => !style.layers.some((layer) => matchesPattern(layer.id, override.layers)))
    .map((override) => override.layers)
  const layers = style.layers
    .filter((layer) => selected(layer, selection))
    .map((layer) =>
      overrides.reduce(
        (current, override) =>
          matchesPattern(current.id, override.layers)
            ? overridden(current, override, color)
            : current,
        layer,
      ),
    )
  return { style: { ...style, layers }, unmatched }
}
