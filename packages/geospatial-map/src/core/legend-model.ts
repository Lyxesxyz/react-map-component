// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type {
  HeatmapLayerConfig,
  LegendEntry,
  LegendSpec,
  NormalizedLegend,
  ThematicStyleSpec,
} from '../types'
import { legendOrder, symbolRules } from './symbol-rules'

export const defaultHeatmapGradient = ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']

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
            stops: style.type === 'continuous' ? gradientStops(style) : [],
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

function gradientStops(style: Extract<ThematicStyleSpec, { type: 'continuous' }>) {
  return style.stops.map(({ value, color }) => ({ value, color }))
}

export function normalizeLegend(
  layerId: string,
  layerTitle: string,
  visible: boolean,
  style: ThematicStyleSpec | undefined,
  legend: LegendSpec | undefined,
  time?: string | null,
): NormalizedLegend | undefined {
  const resolved = legend ? { ...legend, ...(time ? legend.byTime?.[time] : {}) } : undefined
  const entries = resolved?.entries ?? (style ? legendEntriesForStyle(style) : [])
  if (entries.length === 0) return undefined
  return {
    layerId,
    title: resolved?.title ?? layerTitle,
    visible,
    entries,
    ...(resolved?.subtitle ? { subtitle: resolved.subtitle } : {}),
    ...(resolved?.units ? { units: resolved.units } : {}),
    ...(resolved?.description ? { description: resolved.description } : {}),
    ...(resolved?.sourceNote ? { sourceNote: resolved.sourceNote } : {}),
  }
}

export function normalizeHeatmapLegend(
  config: HeatmapLayerConfig,
  visible: boolean,
  time?: string | null,
): NormalizedLegend {
  const gradient = config.gradient ?? defaultHeatmapGradient
  const entries = config.legend?.entries ?? [
    {
      id: 'heatmap-ramp',
      label: '0 – 1',
      symbol: {
        kind: 'gradient' as const,
        stops: gradient.map((color, index) => ({
          value: gradient.length === 1 ? 0 : index / (gradient.length - 1),
          color,
        })),
      },
      value: [0, 1] as const,
    },
  ]
  const frame = time ? config.legend?.byTime?.[time] : undefined
  const resolved = { ...config.legend, ...frame }
  return {
    layerId: config.id,
    title: resolved.title ?? config.title,
    visible,
    entries: frame?.entries ?? entries,
    ...(resolved.subtitle ? { subtitle: resolved.subtitle } : {}),
    ...(resolved.units ? { units: resolved.units } : {}),
    ...(resolved.description ? { description: resolved.description } : {}),
    ...(resolved.sourceNote ? { sourceNote: resolved.sourceNote } : {}),
  }
}
