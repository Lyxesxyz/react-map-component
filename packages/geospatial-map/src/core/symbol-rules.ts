// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { LegendClass, SymbolSpec, ThematicStyleSpec } from '../types'

// One list of rules per thematic style. The canvas renderer, the GPU renderer and the legend all
// read it, so a value always gets the same symbol everywhere. No OpenLayers imports.

type Matchable = string | number | boolean | null

type RuleBase = { id: string; label: string; symbol: SymbolSpec }

/** One way a thematic style draws features. */
export type SymbolRule = RuleBase &
  (
    | { role: 'constant' }
    /** An exact value, matched before anything else. */
    | { role: 'special'; value: Matchable }
    | { role: 'category'; value: string | number | boolean }
    /** Values no category matches. */
    | { role: 'fallback' }
    /** Values that aren't numbers (absent, empty, text). */
    | { role: 'missing' }
    | { role: 'class'; min?: number; max?: number }
    /** The continuous colour ramp; `symbol` is the base symbol the colour is applied to. */
    | { role: 'ramp'; domain: readonly [number, number]; clamp: boolean }
    /** Numbers no class (or, unclamped, the ramp's domain) covers. */
    | { role: 'outOfRange' }
  )

const fallbackPolygon: SymbolSpec = {
  kind: 'polygon',
  fillColor: '#d9e7f2',
  strokeColor: '#ffffff',
  strokeWidth: 0.75,
}

/** The symbol a continuous style colours: its own `symbol`, or a plain polygon. */
export function defaultContinuousSymbol(style: ThematicStyleSpec): SymbolSpec {
  return style.type === 'continuous' ? (style.symbol ?? fallbackPolygon) : fallbackPolygon
}

function catchAll(item: LegendClass, id: string): RuleBase {
  return { id: item.id ?? id, label: item.label, symbol: item.symbol }
}

/** A style's rules in matching order: the first rule that matches a value draws it. */
export function symbolRules(style: ThematicStyleSpec): SymbolRule[] {
  if (style.type === 'constant')
    return [{ role: 'constant', id: 'default', label: 'Features', symbol: style.symbol }]
  const rules: SymbolRule[] = (style.specialValues ?? []).map((item, index) => ({
    role: 'special',
    id: item.id ?? `special-${index}`,
    label: item.label,
    symbol: item.symbol,
    value: item.value,
  }))
  if (style.type === 'categorical') {
    style.categories.forEach((item, index) =>
      rules.push({
        role: 'category',
        id: item.id ?? `category-${index}`,
        label: item.label,
        symbol: item.symbol,
        value: item.value,
      }),
    )
    if (style.fallback) rules.push({ role: 'fallback', ...catchAll(style.fallback, 'other') })
    return rules
  }
  if (style.missing) rules.push({ role: 'missing', ...catchAll(style.missing, 'missing') })
  if (style.type === 'graduated')
    style.classes.forEach((item, index) =>
      rules.push({
        role: 'class',
        id: item.id ?? `class-${index}`,
        label: item.label,
        symbol: item.symbol,
        ...(item.min === undefined ? {} : { min: item.min }),
        ...(item.max === undefined ? {} : { max: item.max }),
      }),
    )
  else
    rules.push({
      role: 'ramp',
      id: 'continuous-ramp',
      label: `${style.domain[0]} – ${style.domain[1]}`,
      symbol: defaultContinuousSymbol(style),
      domain: style.domain,
      clamp: style.clamp !== false,
    })
  if (style.outOfRange)
    rules.push({ role: 'outOfRange', ...catchAll(style.outOfRange, 'out-of-range') })
  return rules
}

/** A property value as a number, or `undefined` when it isn't one (absent, empty, text, NaN). */
export function numericValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean')
    return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

/** The index of the rule that draws `value`, or -1 when no rule does (the feature is hidden). */
export function matchRule(rules: readonly SymbolRule[], value: unknown): number {
  const number = numericValue(value)
  return rules.findIndex((rule) => {
    switch (rule.role) {
      case 'constant':
      case 'fallback':
        return true
      case 'special':
        return rule.value === value || (rule.value === null && value === undefined)
      case 'category':
        return rule.value === value
      case 'missing':
        return number === undefined
      case 'class':
        return (
          number !== undefined &&
          (rule.min === undefined || number >= rule.min) &&
          (rule.max === undefined || number < rule.max)
        )
      case 'ramp':
        return (
          number !== undefined &&
          (rule.clamp || (number >= rule.domain[0] && number <= rule.domain[1]))
        )
      case 'outOfRange':
        return number !== undefined
    }
  })
}

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
export function legendOrder(rules: readonly SymbolRule[]): SymbolRule[] {
  return [...rules].sort((left, right) => legendRank[left.role] - legendRank[right.role])
}
