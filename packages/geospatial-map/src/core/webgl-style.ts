// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { EncodedExpression } from 'ol/expr/expression.js'
import type { FlatStyle, Rule } from 'ol/style/flat.js'
import type { GeoJsonLayerConfig, PointSymbol, SymbolSpec, ThematicStyleSpec } from '../types'
import { paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import { defaultContinuousSymbol } from './legend-model'

// Translates a point layer's thematic style into an OpenLayers WebGL ("flat") style, so large
// point datasets are drawn by the GPU. No OpenLayers runtime imports: safe to use in validation.
// Avoid the `has` operator here: in OpenLayers 10 it stops the GPU from reading the property.

/** With `renderer: 'auto'`, point layers with at least this many features use the GPU. */
export const WEBGL_AUTO_THRESHOLD = 5000

type Value = string | number | boolean | null

function symbolsOf(style: ThematicStyleSpec): SymbolSpec[] {
  const special =
    style.type === 'constant' ? [] : (style.specialValues ?? []).map((item) => item.symbol)
  if (style.type === 'constant') return [style.symbol]
  if (style.type === 'categorical')
    return [
      ...special,
      ...style.categories.map((item) => item.symbol),
      ...(style.fallback ? [style.fallback.symbol] : []),
    ]
  const extra = [style.missing?.symbol, style.outOfRange?.symbol].filter(Boolean) as SymbolSpec[]
  if (style.type === 'graduated')
    return [...special, ...style.classes.map((item) => item.symbol), ...extra]
  return [...special, defaultContinuousSymbol(style), ...extra]
}

function specialValues(style: ThematicStyleSpec): Value[] {
  return style.type === 'constant' ? [] : (style.specialValues ?? []).map((item) => item.value)
}

/** Why the GPU renderer cannot draw this layer, or `undefined` when it can. */
export function webglUnsupportedReason(config: GeoJsonLayerConfig): string | undefined {
  if (config.cluster) return 'clustered layers are drawn by the canvas renderer'
  if (config.time?.mode === 'property')
    return 'filtering features by a time property needs the canvas renderer'
  const style = config.style
  const symbols = symbolsOf(style)
  if (symbols.some((symbol) => symbol.kind !== 'point'))
    return 'the GPU renderer draws point symbols only'
  if (symbols.some((symbol) => symbol.labelField)) return 'labels need the canvas renderer'
  const values = [
    ...specialValues(style),
    ...(style.type === 'categorical' ? style.categories.map((item) => item.value) : []),
  ]
  if (values.some((value) => typeof value !== 'string' && typeof value !== 'number'))
    return 'the GPU renderer matches string and number values only'
  if (style.type === 'continuous' && style.clamp === false)
    return 'unclamped continuous styles need the canvas renderer'
  return undefined
}

const any = (filters: EncodedExpression[]): EncodedExpression =>
  filters.length === 1 ? filters[0]! : ['any', ...filters]
const all = (filters: EncodedExpression[]): EncodedExpression =>
  filters.length === 1 ? filters[0]! : ['all', ...filters]

function pointStyle(symbol: PointSymbol, theme: CanvasTheme, fill?: EncodedExpression): FlatStyle {
  const radius: EncodedExpression = symbol.radiusStops?.length
    ? [
        'interpolate',
        ['linear'],
        ['zoom'],
        ...[...symbol.radiusStops]
          .sort((left, right) => left.zoom - right.zoom)
          .flatMap((stop) => [stop.zoom, stop.value]),
      ]
    : (symbol.radius ?? 6)
  const fillColor = fill ?? (symbol.fillColor ? paint(symbol.fillColor, theme) : undefined)
  const strokeColor = symbol.strokeColor ? paint(symbol.strokeColor, theme) : undefined
  const shape = symbol.shape ?? 'circle'
  const prefix = shape === 'circle' ? 'circle' : 'shape'
  const style: FlatStyle = {
    [`${prefix}-radius`]: radius,
    [`${prefix}-opacity`]: symbol.opacity ?? 1,
    ...(fillColor === undefined ? {} : { [`${prefix}-fill-color`]: fillColor }),
    ...(strokeColor === undefined
      ? {}
      : {
          [`${prefix}-stroke-color`]: strokeColor,
          [`${prefix}-stroke-width`]: symbol.strokeWidth ?? 1,
        }),
  }
  if (shape === 'triangle') return { ...style, 'shape-points': 3, 'shape-angle': 0 }
  if (shape === 'square') return { ...style, 'shape-points': 4, 'shape-angle': Math.PI / 4 }
  if (shape === 'diamond') return { ...style, 'shape-points': 4, 'shape-angle': 0 }
  return style
}

function symbolRule(symbol: SymbolSpec, theme: CanvasTheme, filter?: EncodedExpression): Rule {
  return {
    ...(filter === undefined ? {} : { filter }),
    style: pointStyle(symbol as PointSymbol, theme),
  }
}

/**
 * The WebGL style for a point layer. The `selectedId` style variable highlights the selected
 * feature; set it with `layer.updateStyleVariables({ selectedId })`.
 */
export function compileWebglStyle(config: GeoJsonLayerConfig, theme: CanvasTheme): Rule[] {
  const style = config.style
  const rules: Rule[] = []
  const field = 'field' in style ? style.field : ''
  const equals = (value: Value): EncodedExpression => ['==', ['get', field], value as string]
  const specials = style.type === 'constant' ? [] : (style.specialValues ?? [])
  for (const item of specials) rules.push(symbolRule(item.symbol, theme, equals(item.value)))
  const notSpecial: EncodedExpression[] = specials.length
    ? [['!', any(specials.map((item) => equals(item.value)))]]
    : []
  if (style.type === 'constant') rules.push(symbolRule(style.symbol, theme))
  else if (style.type === 'categorical') {
    for (const category of style.categories)
      rules.push(symbolRule(category.symbol, theme, all([...notSpecial, equals(category.value)])))
    if (style.fallback)
      rules.push({ else: true, style: pointStyle(style.fallback.symbol as PointSymbol, theme) })
  } else if (style.type === 'graduated') {
    for (const item of style.classes) {
      const range: EncodedExpression[] = [
        ...(item.min === undefined ? [] : [['>=', ['get', field], item.min] as EncodedExpression]),
        ...(item.max === undefined ? [] : [['<', ['get', field], item.max] as EncodedExpression]),
      ]
      const filters = [...notSpecial, ...range]
      rules.push(symbolRule(item.symbol, theme, filters.length ? all(filters) : undefined))
    }
    const rest = style.outOfRange ?? style.missing
    if (rest) rules.push({ else: true, style: pointStyle(rest.symbol as PointSymbol, theme) })
  } else {
    const stops = [...style.stops].sort((left, right) => left.value - right.value)
    const color: EncodedExpression = [
      'interpolate',
      ['linear'],
      ['get', field],
      ...stops.flatMap((stop) => [stop.value, paint(stop.color, theme)]),
    ]
    const symbol = defaultContinuousSymbol(style) as PointSymbol
    rules.push({
      ...(notSpecial.length ? { filter: all(notSpecial) } : {}),
      style: pointStyle(symbol, theme, color),
    })
    if (style.missing)
      rules.push({ else: true, style: pointStyle(style.missing.symbol as PointSymbol, theme) })
  }
  rules.push({
    filter: ['==', ['id'], ['var', 'selectedId']],
    style: {
      'circle-radius': 10,
      'circle-fill-color': theme.selectionFill,
      'circle-stroke-color': theme.selectionStroke,
      'circle-stroke-width': 3,
    },
  })
  return rules
}
