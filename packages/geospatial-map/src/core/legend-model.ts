// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { LegendEntry, MapLayerConfig, NormalizedLegend, ThematicStyleSpec } from '../types'
import { symbolRules } from './symbol-rules'
import type { SymbolRule } from './symbol-rules'

// A layer's legend: its hand-written entries, or rows derived from the rules that draw it.

export const defaultHeatmapGradient = ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']

const legendRank: Record<SymbolRule['role'], number> = {
  constant: 0,
  category: 0,
  class: 0,
  ramp: 0,
  fallback: 1,
  missing: 1,
  outOfRange: 2,
  special: 3,
}

/** The rules in legend order: the main classes first, then the catch-alls, then special values. */
function legendOrder(rules: readonly SymbolRule[]): SymbolRule[] {
  return [...rules].sort((left, right) => legendRank[left.role] - legendRank[right.role])
}

/** Legend rows for a thematic style, from the same rules the renderers use. */
export function legendEntriesForStyle(style: ThematicStyleSpec): LegendEntry[] {
  return legendOrder(symbolRules(style)).map((rule) => {
    const base = { id: rule.id, label: rule.label }
    switch (rule.role) {
      case 'ramp':
        return {
          ...base,
          symbol: {
            kind: 'gradient',
            stops:
              style.type === 'continuous'
                ? style.stops.map(({ value, color }) => ({ value, color }))
                : [],
          },
          value: rule.domain,
        }
      case 'special':
        return { ...base, symbol: rule.symbol, value: rule.value ?? 'null' }
      case 'category':
        return { ...base, symbol: rule.symbol, value: rule.value }
      case 'class':
        return {
          ...base,
          symbol: rule.symbol,
          ...(rule.min === undefined && rule.max === undefined
            ? {}
            : {
                value: [rule.min ?? Number.NEGATIVE_INFINITY, rule.max ?? Number.POSITIVE_INFINITY],
              }),
        }
      default:
        return { ...base, symbol: rule.symbol }
    }
  })
}

/** A heatmap's legend row: its colour ramp from no to full weight. */
function heatmapEntries(gradient: string[]): LegendEntry[] {
  return [
    {
      id: 'heatmap-ramp',
      label: '0 – 1',
      symbol: {
        kind: 'gradient',
        stops: gradient.map((color, index) => ({
          value: gradient.length === 1 ? 0 : index / (gradient.length - 1),
          color,
        })),
      },
      value: [0, 1],
    },
  ]
}

/**
 * A layer's legend at `time`: the frame's `legend.byTime` text and entries over the layer's
 * `legend`, entries derived from its style (or heatmap ramp) when none are written. `undefined`
 * for a layer with nothing to show (an image layer without entries).
 */
export function normalizeLegend(
  config: MapLayerConfig,
  visible: boolean,
  time: string | null,
): NormalizedLegend | undefined {
  const legend = config.legend
  const resolved = { ...legend, ...(time ? legend?.byTime?.[time] : undefined) }
  const derived =
    config.kind === 'heatmap'
      ? heatmapEntries(config.gradient ?? defaultHeatmapGradient)
      : 'style' in config && config.style
        ? legendEntriesForStyle(config.style)
        : []
  const entries = resolved.entries ?? derived
  if (!entries.length) return undefined
  return {
    layerId: config.id,
    title: resolved.title ?? config.title,
    visible,
    entries,
    ...(resolved.subtitle ? { subtitle: resolved.subtitle } : {}),
    ...(resolved.units ? { units: resolved.units } : {}),
    ...(resolved.description ? { description: resolved.description } : {}),
    ...(resolved.sourceNote ? { sourceNote: resolved.sourceNote } : {}),
  }
}
