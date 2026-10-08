// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated. This file is identical
// in the React and Angular versions of the map.

import { asArray } from 'ol/color.js'
import type { PointSymbol, SymbolSpec, ThematicStyleSpec, ZoomStop } from '../types'
import { defaultCanvasTheme, paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import { matchRule, symbolRules } from './symbol-rules'

// Which symbol draws a feature, and at what size: shared by the canvas renderer, the GPU
// renderer and the SVG export, so they agree. No OpenLayers styles here.

/** Point radius when a symbol sets none. */
export const DEFAULT_POINT_RADIUS = 6
/** Line width when a symbol sets none. */
const DEFAULT_LINE_WIDTH = 2

/** The selection highlight, drawn by every renderer. */
export const SELECTION = { pointRadius: 10, strokeWidth: 3, lineWidth: 5 } as const

/**
 * Point shapes other than the circle, as regular polygons: the number of corners and the
 * rotation of the first corner from straight up (OpenLayers' `RegularShape`).
 */
export const POINT_SHAPES = {
  triangle: { points: 3, angle: 0 },
  square: { points: 4, angle: Math.PI / 4 },
  diamond: { points: 4, angle: 0 },
} as const

const sortedStops = new WeakMap<readonly ZoomStop[], readonly ZoomStop[]>()

/** The value of zoom-dependent `stops` at `zoom`, or `fallback` without stops. */
export function interpolateStops(
  stops: readonly ZoomStop[] | undefined,
  zoom: number,
  fallback: number,
): number {
  if (!stops?.length) return fallback
  let sorted = sortedStops.get(stops)
  if (!sorted) {
    sorted = [...stops].sort((a, b) => a.zoom - b.zoom)
    sortedStops.set(stops, sorted)
  }
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

/** A point symbol's radius at `zoom`. */
export function pointRadius(symbol: PointSymbol, zoom: number): number {
  return interpolateStops(symbol.radiusStops, zoom, symbol.radius ?? DEFAULT_POINT_RADIUS)
}

/** A line symbol's width at `zoom`. */
export function lineWidth(symbol: Extract<SymbolSpec, { kind: 'line' }>, zoom: number): number {
  return interpolateStops(symbol.widthStops, zoom, symbol.width ?? DEFAULT_LINE_WIDTH)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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
  const first = sorted[0]!
  const last = sorted.at(-1)!
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

/** The kind of symbol that draws a geometry type (`'MultiPolygon'` → `'polygon'`). */
export function geometryKind(geometryType: string): SymbolSpec['kind'] | undefined {
  if (geometryType.includes('Point')) return 'point'
  if (geometryType.includes('Line')) return 'line'
  if (geometryType.includes('Polygon')) return 'polygon'
  return undefined
}

/**
 * The symbol drawn for a geometry. A symbol made for another geometry type is adapted (a polygon
 * style on points draws circles, on lines draws lines), so a layer never silently draws nothing.
 */
export function symbolForGeometry(symbol: SymbolSpec, geometryType: string): SymbolSpec {
  const geometry = geometryKind(geometryType) ?? symbol.kind
  if (geometry === symbol.kind) return symbol
  const color =
    symbol.kind === 'line' ? symbol.color : (symbol.fillColor ?? symbol.strokeColor ?? '#64748b')
  const opacity = symbol.opacity === undefined ? {} : { opacity: symbol.opacity }
  const label = symbol.labelField === undefined ? {} : { labelField: symbol.labelField }
  if (geometry === 'point')
    return {
      kind: 'point',
      radius: DEFAULT_POINT_RADIUS,
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
      width: Math.max(
        DEFAULT_LINE_WIDTH,
        symbol.kind === 'polygon' ? (symbol.strokeWidth ?? 0) : 0,
      ),
      ...opacity,
      ...label,
    }
  return symbol.kind === 'line'
    ? {
        kind: 'polygon',
        strokeColor: symbol.color,
        strokeWidth: symbol.width ?? DEFAULT_LINE_WIDTH,
        ...opacity,
        ...label,
      }
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

/** Picks the symbol for a value: compiled once per style, called once per feature. */
export function symbolPicker(style: ThematicStyleSpec) {
  const rules = symbolRules(style)
  const stops =
    style.type === 'continuous' ? [...style.stops].sort((a, b) => a.value - b.value) : []
  return (value: unknown, theme: CanvasTheme = defaultCanvasTheme): SymbolSpec | undefined => {
    const rule = rules[matchRule(rules, value)]
    if (rule?.role !== 'ramp') return rule?.symbol
    const color = interpolateColor(stops, clamp(Number(value), ...rule.domain), theme)
    return rule.symbol.kind === 'line'
      ? { ...rule.symbol, color }
      : { ...rule.symbol, fillColor: color }
  }
}

/** The value a style classifies a feature by. */
export function styleValue(style: ThematicStyleSpec, feature: { get(key: string): unknown }) {
  return 'field' in style ? feature.get(style.field) : undefined
}
