// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { EncodedExpression } from 'ol/expr/expression.js'
import type { FlatStyle, Rule } from 'ol/style/flat.js'
import type { GeoJsonLayerConfig, PointSymbol, ThematicStyleSpec } from '../types'
import { paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import { matchRule, symbolRules } from './symbol-rules'

// Translates a point layer's thematic style into an OpenLayers WebGL ("flat") style, so large
// point datasets are drawn by the GPU. No OpenLayers runtime imports: safe to use in validation.
//
// Which rule draws a feature is decided on the CPU by `matchRule`, the function the canvas
// renderer uses, and stored on the feature (`RULE_PROPERTY`); the GPU style only looks the rule
// up. So both renderers always agree, including for absent and out-of-range values.

/** With `renderer: 'auto'`, point layers with at least this many features use the GPU. */
export const WEBGL_AUTO_THRESHOLD = 5000

/** The feature property holding the index of the rule that draws it. Hidden from popups. */
export const RULE_PROPERTY = 'geoSymbolRule'

/** Why the GPU renderer cannot draw this layer, or `undefined` when it can. */
export function webglUnsupportedReason(config: GeoJsonLayerConfig): string | undefined {
  if (config.cluster) return 'clustered layers are drawn by the canvas renderer'
  if (config.time?.mode === 'property')
    return 'filtering features by a time property needs the canvas renderer'
  const symbols = symbolRules(config.style).map((rule) => rule.symbol)
  if (symbols.some((symbol) => symbol.kind !== 'point'))
    return 'the GPU renderer draws point symbols only'
  if (symbols.some((symbol) => symbol.labelField)) return 'labels need the canvas renderer'
  return undefined
}

/**
 * Returns a function that stores, on each feature, the rule the GPU style draws it with. Call it
 * for every feature before the GPU layer reads it, and again when its property changes.
 */
export function ruleStamper(style: ThematicStyleSpec) {
  const rules = symbolRules(style)
  const field = 'field' in style ? style.field : undefined
  return (feature: {
    get(key: string): unknown
    set(key: string, value: unknown, silent?: boolean): void
  }) => feature.set(RULE_PROPERTY, matchRule(rules, field ? feature.get(field) : undefined), true)
}

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

/**
 * The WebGL style for a point layer whose features were stamped by `ruleStamper`. The
 * `selectedId` style variable highlights the selected feature; set it with
 * `layer.updateStyleVariables({ selectedId })`.
 */
export function compileWebglStyle(config: GeoJsonLayerConfig, theme: CanvasTheme): Rule[] {
  const style = config.style
  const rules: Rule[] = symbolRules(style).map((rule, index) => {
    const ramp: EncodedExpression | undefined =
      rule.role === 'ramp' && style.type === 'continuous'
        ? [
            'interpolate',
            ['linear'],
            ['get', style.field],
            ...[...style.stops]
              .sort((left, right) => left.value - right.value)
              .flatMap((stop) => [stop.value, paint(stop.color, theme)]),
          ]
        : undefined
    return {
      filter: ['==', ['get', RULE_PROPERTY], index],
      style: pointStyle(rule.symbol as PointSymbol, theme, ramp),
    }
  })
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
