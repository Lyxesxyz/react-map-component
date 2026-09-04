import type {
  LegendEntry,
  LegendSpec,
  NormalizedLegend,
  SymbolSpec,
  ThematicStyleSpec,
} from '../types.js'

const fallbackPolygon: SymbolSpec = {
  kind: 'polygon',
  fillColor: '#d9e7f2',
  strokeColor: '#ffffff',
  strokeWidth: 0.75,
}

export function legendEntriesForStyle(style: ThematicStyleSpec): LegendEntry[] {
  if (style.type === 'constant') return [{ id: 'default', label: 'Features', symbol: style.symbol }]
  if (style.type === 'categorical') {
    const entries = style.categories.map((item, index) => ({
      id: item.id ?? `category-${index}`,
      label: item.label,
      symbol: item.symbol,
      value: item.value,
    }))
    if (style.fallback)
      entries.push({
        id: style.fallback.id ?? 'other',
        label: style.fallback.label,
        symbol: style.fallback.symbol,
        value: 'other',
      })
    for (const [index, item] of (style.specialValues ?? []).entries())
      entries.push({
        id: item.id ?? `special-${index}`,
        label: item.label,
        symbol: item.symbol,
        value: item.value ?? 'null',
      })
    return entries
  }
  if (style.type === 'graduated') {
    const entries: LegendEntry[] = style.classes.map((item, index) => ({
      id: item.id ?? `class-${index}`,
      label: item.label,
      symbol: item.symbol,
      ...(item.min === undefined && item.max === undefined
        ? {}
        : { value: [item.min ?? Number.NEGATIVE_INFINITY, item.max ?? Number.POSITIVE_INFINITY] }),
    }))
    if (style.missing)
      entries.push({
        id: style.missing.id ?? 'missing',
        label: style.missing.label,
        symbol: style.missing.symbol,
        value: 'missing',
      })
    if (style.outOfRange)
      entries.push({
        id: style.outOfRange.id ?? 'out-of-range',
        label: style.outOfRange.label,
        symbol: style.outOfRange.symbol,
        value: 'out-of-range',
      })
    for (const [index, item] of (style.specialValues ?? []).entries())
      entries.push({
        id: item.id ?? `special-${index}`,
        label: item.label,
        symbol: item.symbol,
        value: item.value ?? 'null',
      })
    return entries
  }
  const entries: LegendEntry[] = [
    {
      id: 'continuous-ramp',
      label: `${style.domain[0]} – ${style.domain[1]}`,
      symbol: {
        kind: 'gradient',
        stops: style.stops.map(({ value, color }) => ({ value, color })),
      },
      value: style.domain,
    },
  ]
  if (style.missing)
    entries.push({
      id: style.missing.id ?? 'missing',
      label: style.missing.label,
      symbol: style.missing.symbol,
      value: 'missing',
    })
  if (style.outOfRange)
    entries.push({
      id: style.outOfRange.id ?? 'out-of-range',
      label: style.outOfRange.label,
      symbol: style.outOfRange.symbol,
      value: 'out-of-range',
    })
  for (const [index, item] of (style.specialValues ?? []).entries())
    entries.push({
      id: item.id ?? `special-${index}`,
      label: item.label,
      symbol: item.symbol,
      value: item.value ?? 'null',
    })
  return entries
}

export function normalizeLegend(
  layerId: string,
  layerTitle: string,
  visible: boolean,
  style: ThematicStyleSpec | undefined,
  legend: LegendSpec | undefined,
): NormalizedLegend | undefined {
  const entries = legend?.entries ?? (style ? legendEntriesForStyle(style) : [])
  if (entries.length === 0) return undefined
  return {
    layerId,
    title: legend?.title ?? layerTitle,
    visible,
    entries,
    ...(legend?.subtitle ? { subtitle: legend.subtitle } : {}),
    ...(legend?.units ? { units: legend.units } : {}),
    ...(legend?.description ? { description: legend.description } : {}),
    ...(legend?.sourceNote ? { sourceNote: legend.sourceNote } : {}),
  }
}

export function defaultContinuousSymbol(style: ThematicStyleSpec): SymbolSpec {
  return style.type === 'continuous' ? (style.symbol ?? fallbackPolygon) : fallbackPolygon
}
