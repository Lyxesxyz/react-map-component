// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { FeatureLike } from 'ol/Feature.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import RegularShape from 'ol/style/RegularShape.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import Text from 'ol/style/Text.js'
import { asArray } from 'ol/color.js'
import { MapConfigurationError } from './errors'
import { matchRule, symbolRules } from './symbol-rules'
import type { SymbolRule } from './symbol-rules'
import type { LayerTimeSpec, PointSymbol, SymbolSpec, ThematicStyleSpec, ZoomStop } from '../types'
import { canvasFont, defaultCanvasTheme, paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'

export type StyleFunction = (feature: FeatureLike) => Style | undefined

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function interpolateStops(
  stops: ZoomStop[] | undefined,
  zoom: number,
  fallback: number,
): number {
  if (!stops?.length) return fallback
  const sorted = [...stops].sort((a, b) => a.zoom - b.zoom)
  const first = sorted[0]!
  const last = sorted.at(-1)!
  if (zoom <= first.zoom) return first.value
  if (zoom >= last.zoom) return last.value
  const upperIndex = sorted.findIndex((stop) => stop.zoom >= zoom)
  const upper = sorted[upperIndex]!
  const lower = sorted[upperIndex - 1]!
  const ratio = (zoom - lower.zoom) / (upper.zoom - lower.zoom)
  return lower.value + ratio * (upper.value - lower.value)
}

/** A colour as `[r, g, b, a]`, or `undefined` when it can't be parsed here. */
function rgba(color: string): [number, number, number, number] | undefined {
  try {
    const [r = 0, g = 0, b = 0, a = 1] = asArray(color)
    return [r, g, b, a]
  } catch {
    // Named colours need a canvas to parse; without one (server, tests) the colour stays as is.
    return undefined
  }
}

const rgbaString = ([r, g, b, a]: readonly number[]) =>
  `rgba(${Math.round(r!)}, ${Math.round(g!)}, ${Math.round(b!)}, ${Math.round(a! * 1000) / 1000})`

/** The colour with its alpha multiplied by `opacity`. Works for any CSS colour the canvas parses. */
export function withOpacity(color: string, opacity: number | undefined): string {
  if (opacity === undefined || opacity >= 1) return color
  const parsed = rgba(color)
  return parsed
    ? rgbaString([parsed[0], parsed[1], parsed[2], parsed[3] * clamp(opacity, 0, 1)])
    : color
}

type ColorStop = { value: number; color: string }

/** The colour at `value` along stops sorted by value; `value` is within the stops' range. */
function interpolateColor(sorted: readonly ColorStop[], value: number, theme: CanvasTheme): string {
  const first = sorted[0]
  const last = sorted.at(-1)
  if (!first || !last) throw new MapConfigurationError('Continuous styles need at least one stop')
  if (value <= first.value) return paint(first.color, theme)
  if (value >= last.value) return paint(last.color, theme)
  const upperIndex = sorted.findIndex((stop) => stop.value >= value)
  const lower = sorted[upperIndex - 1]!
  const upper = sorted[upperIndex]!
  const from = rgba(paint(lower.color, theme))
  const to = rgba(paint(upper.color, theme))
  if (!from || !to) return paint(lower.color, theme)
  const ratio = (value - lower.value) / (upper.value - lower.value)
  return rgbaString(from.map((channel, index) => channel + ratio * (to[index]! - channel)))
}

function pointImage(
  symbol: PointSymbol,
  zoom: number,
  theme: CanvasTheme,
): CircleStyle | RegularShape {
  const radius = interpolateStops(symbol.radiusStops, zoom, symbol.radius ?? 6)
  const color = (value: string) => withOpacity(paint(value, theme), symbol.opacity)
  const fill = symbol.fillColor ? new Fill({ color: color(symbol.fillColor) }) : undefined
  const stroke = symbol.strokeColor
    ? new Stroke({ color: color(symbol.strokeColor), width: symbol.strokeWidth ?? 1 })
    : undefined
  const common = { radius, fill, stroke }
  if ((symbol.shape ?? 'circle') === 'circle') return new CircleStyle(common)
  if (symbol.shape === 'triangle') return new RegularShape({ ...common, points: 3, angle: 0 })
  if (symbol.shape === 'diamond') return new RegularShape({ ...common, points: 4, angle: 0 })
  return new RegularShape({ ...common, points: 4, angle: Math.PI / 4 })
}

function textFor(symbol: SymbolSpec, feature: FeatureLike, theme: CanvasTheme): Text | undefined {
  if (!symbol.labelField) return undefined
  const value = feature.get(symbol.labelField)
  if (value === undefined || value === null || value === '') return undefined
  return new Text({
    text: String(value),
    font: canvasFont(theme, theme.labelSize, theme.labelWeight),
    offsetY: symbol.kind === 'point' ? (symbol.radius ?? 6) + 10 : 0,
    fill: new Fill({
      color: paint(
        symbol.kind === 'line' ? symbol.color : (symbol.labelColor ?? theme.labelColor),
        theme,
      ),
    }),
    stroke: new Stroke({ color: theme.labelHalo, width: 3 }),
  })
}

/**
 * The symbol drawn for a geometry. A symbol made for another geometry type is adapted (a polygon
 * style on points draws circles, on lines draws lines), so a layer never silently draws nothing.
 */
export function symbolForGeometry(symbol: SymbolSpec, geometryType: string): SymbolSpec {
  const geometry = geometryType.includes('Point')
    ? 'point'
    : geometryType.includes('Line')
      ? 'line'
      : geometryType.includes('Polygon')
        ? 'polygon'
        : symbol.kind
  if (geometry === symbol.kind) return symbol
  const color =
    symbol.kind === 'line' ? symbol.color : (symbol.fillColor ?? symbol.strokeColor ?? '#64748b')
  const opacity = symbol.opacity === undefined ? {} : { opacity: symbol.opacity }
  const label = symbol.labelField === undefined ? {} : { labelField: symbol.labelField }
  if (geometry === 'point')
    return {
      kind: 'point',
      radius: 6,
      fillColor: color,
      ...(symbol.kind === 'polygon' && symbol.strokeColor
        ? { strokeColor: symbol.strokeColor, strokeWidth: symbol.strokeWidth ?? 1 }
        : {}),
      ...opacity,
      ...label,
    }
  if (geometry === 'line')
    return {
      kind: 'line',
      color,
      width: Math.max(2, symbol.kind === 'polygon' ? (symbol.strokeWidth ?? 0) : 0),
      ...opacity,
      ...label,
    }
  return symbol.kind === 'line'
    ? { kind: 'polygon', strokeColor: symbol.color, strokeWidth: symbol.width ?? 2, ...label }
    : {
        kind: 'polygon',
        fillColor: color,
        ...(symbol.strokeColor
          ? { strokeColor: symbol.strokeColor, strokeWidth: symbol.strokeWidth ?? 1 }
          : {}),
        ...opacity,
        ...label,
      }
}

function styleForSymbol(
  configured: SymbolSpec,
  feature: FeatureLike,
  zoom: number,
  theme: CanvasTheme,
): Style {
  const symbol = symbolForGeometry(configured, feature.getGeometry()?.getType() ?? '')
  if (symbol.kind === 'point')
    return new Style({
      image: pointImage(symbol, zoom, theme),
      text: textFor(symbol, feature, theme),
    })
  if (symbol.kind === 'line')
    return new Style({
      stroke: new Stroke({
        color: withOpacity(paint(symbol.color, theme), symbol.opacity),
        width: interpolateStops(symbol.widthStops, zoom, symbol.width ?? 2),
        lineDash: symbol.dash,
      }),
      text: textFor(symbol, feature, theme),
    })
  return new Style({
    fill: symbol.fillColor
      ? new Fill({ color: withOpacity(paint(symbol.fillColor, theme), symbol.opacity) })
      : undefined,
    stroke: symbol.strokeColor
      ? new Stroke({
          color: paint(symbol.strokeColor, theme),
          width: symbol.strokeWidth ?? 1,
          lineDash: symbol.dash,
        })
      : undefined,
    text: textFor(symbol, feature, theme),
  })
}

/** The base symbol of a ramp, filled with `color`. */
function rampSymbol(symbol: SymbolSpec, color: string): SymbolSpec {
  return symbol.kind === 'line' ? { ...symbol, color } : { ...symbol, fillColor: color }
}

/** Picks the symbol for a value: compiled once per style, called once per feature. */
export function symbolPicker(style: ThematicStyleSpec) {
  const rules = symbolRules(style)
  const stops =
    style.type === 'continuous' ? [...style.stops].sort((a, b) => a.value - b.value) : []
  return (value: unknown, theme: CanvasTheme = defaultCanvasTheme): SymbolSpec | undefined => {
    const rule: SymbolRule | undefined = rules[matchRule(rules, value)]
    if (rule?.role !== 'ramp') return rule?.symbol
    const number = clamp(Number(value), rule.domain[0], rule.domain[1])
    return rampSymbol(rule.symbol, interpolateColor(stops, number, theme))
  }
}

/** The symbol drawn for one value (see `symbolPicker` to classify many). */
export function symbolForValue(
  style: ThematicStyleSpec,
  value: unknown,
  theme: CanvasTheme = defaultCanvasTheme,
): SymbolSpec | undefined {
  return symbolPicker(style)(value, theme)
}

export function featureVisibleAtTime(
  feature: FeatureLike,
  time: string | null,
  spec?: LayerTimeSpec,
): boolean {
  if (!spec || spec.mode !== 'property' || !time) return true
  return String(feature.get(spec.fieldOrParameter ?? 'time')) === time
}

export function compileThematicStyle(
  style: ThematicStyleSpec,
  getZoom: () => number,
  getTime: () => string | null,
  time?: LayerTimeSpec,
  getTheme: () => CanvasTheme = () => defaultCanvasTheme,
): StyleFunction {
  if ('field' in style && !style.field.trim())
    throw new MapConfigurationError('Style field cannot be empty')
  if (style.type === 'continuous' && style.domain[0] >= style.domain[1])
    throw new MapConfigurationError('Continuous style domain must be ascending')
  const pick = symbolPicker(style)
  return (feature) => {
    if (!featureVisibleAtTime(feature, getTime(), time)) return undefined
    const value = 'field' in style ? feature.get(style.field) : undefined
    const theme = getTheme()
    const symbol = pick(value, theme)
    return symbol ? styleForSymbol(symbol, feature, getZoom(), theme) : undefined
  }
}

export function selectionStyleForGeometry(
  geometryType: string,
  theme: CanvasTheme = defaultCanvasTheme,
): Style {
  if (geometryType.includes('Point'))
    return new Style({
      image: new CircleStyle({
        radius: 10,
        fill: new Fill({ color: theme.selectionFill }),
        stroke: new Stroke({ color: theme.selectionStroke, width: 3 }),
      }),
    })
  if (geometryType.includes('Line'))
    return new Style({ stroke: new Stroke({ color: theme.selectionLine, width: 5 }) })
  return new Style({
    fill: new Fill({ color: theme.selectionFill }),
    stroke: new Stroke({ color: theme.selectionStroke, width: 3 }),
  })
}

const clusterStyles = new Map<string, Style>()

/** A counted bubble for a group of clustered points, sized by the count. */
export function clusterStyle(count: number, theme: CanvasTheme = defaultCanvasTheme): Style {
  const key = `${count}|${theme.clusterFill}|${theme.clusterText}|${theme.fontFamily}|${theme.labelSize}`
  let style = clusterStyles.get(key)
  if (!style) {
    if (clusterStyles.size > 500) clusterStyles.clear()
    style = new Style({
      image: new CircleStyle({
        radius: Math.min(30, 11 + Math.log2(count) * 3),
        fill: new Fill({ color: theme.clusterFill }),
        stroke: new Stroke({ color: theme.clusterText, width: 2 }),
      }),
      text: new Text({
        text: count > 999 ? `${Math.round(count / 100) / 10}k` : String(count),
        font: canvasFont(theme, theme.labelSize, 700),
        fill: new Fill({ color: theme.clusterText }),
      }),
    })
    clusterStyles.set(key, style)
  }
  return style
}
