import type { PolygonSymbol, ThematicStyleSpec } from '../types.js'

export const accessiblePalettes = {
  blue: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  blueOrange: ['#2166ac', '#67a9cf', '#f7f7f7', '#ef8a62', '#b2182b'],
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
} as const

export type PaletteId = keyof typeof accessiblePalettes
export type ClassificationMethod = 'equal-interval' | 'quantile'
export type SymbologyControlPolicy = {
  palettes?: PaletteId[]
  methods?: ClassificationMethod[]
  classCounts?: number[]
  editableRange?: boolean
}

export function createClassifiedPolygonStyle(options: {
  field: string
  values: number[]
  palette: PaletteId
  method: ClassificationMethod
  classCount: number
  range?: readonly [number, number]
  symbol?: Omit<PolygonSymbol, 'kind' | 'fillColor'>
}): ThematicStyleSpec {
  const finite = options.values.filter(Number.isFinite).sort((a, b) => a - b)
  const domain = options.range ?? ([finite[0] ?? 0, finite.at(-1) ?? 1] as const)
  const count = Math.min(
    accessiblePalettes[options.palette].length,
    Math.max(2, Math.round(options.classCount)),
  )
  const colors = accessiblePalettes[options.palette]
  const boundaries = Array.from({ length: count + 1 }, (_, index) => {
    if (index === 0) return domain[0]
    if (index === count) return domain[1]
    if (options.method === 'equal-interval')
      return domain[0] + ((domain[1] - domain[0]) * index) / count
    const position = Math.min(finite.length - 1, Math.floor((finite.length * index) / count))
    return finite[Math.max(0, position)] ?? domain[0]
  })
  return {
    type: 'graduated',
    field: options.field,
    classes: Array.from({ length: count }, (_, index) => ({
      id: `class-${index + 1}`,
      label: `${format(boundaries[index]!)} – ${format(boundaries[index + 1]!)}`,
      min: boundaries[index]!,
      max:
        index === count - 1
          ? domain[1] + Math.max(Number.EPSILON, Math.abs(domain[1]) * Number.EPSILON * 2)
          : boundaries[index + 1]!,
      symbol: {
        kind: 'polygon',
        fillColor: colors[Math.round((index * (colors.length - 1)) / (count - 1))]!,
        strokeColor: '#ffffff',
        strokeWidth: 0.75,
        ...options.symbol,
      },
    })),
    missing: {
      label: 'No data',
      symbol: { kind: 'polygon', fillColor: '#d1d5db', strokeColor: '#ffffff' },
    },
    outOfRange: {
      label: 'Outside configured range',
      symbol: {
        kind: 'polygon',
        fillColor: '#ffffff',
        strokeColor: '#4b5563',
        dash: [3, 3],
      },
    },
  }
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
