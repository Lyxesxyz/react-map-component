import type { FeatureLike } from 'ol/Feature.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import RegularShape from 'ol/style/RegularShape.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import Text from 'ol/style/Text.js'
import { defaultContinuousSymbol } from './legend-model'
import { MapConfigurationError } from './errors'
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

/** Parses `#rrggbb` and the opaque `rgb(r, g, b)` form browsers report for resolved CSS colors. */
function parseRgb(color: string): [number, number, number] | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1]
  if (hex)
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ]
  const rgb = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/i.exec(color)
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : undefined
}

function interpolateColor(
  stops: Array<{ value: number; color: string }>,
  value: number,
  theme: CanvasTheme = defaultCanvasTheme,
): string {
  const sorted = [...stops].sort((a, b) => a.value - b.value)
  const first = sorted[0]
  const last = sorted.at(-1)
  if (!first || !last) throw new MapConfigurationError('Continuous styles need at least one stop')
  if (value <= first.value) return paint(first.color, theme)
  if (value >= last.value) return paint(last.color, theme)
  const upperIndex = sorted.findIndex((stop) => stop.value >= value)
  const lower = sorted[upperIndex - 1]!
  const upper = sorted[upperIndex]!
  const lowerRgb = parseRgb(paint(lower.color, theme))
  const upperRgb = parseRgb(paint(upper.color, theme))
  if (!lowerRgb || !upperRgb) return paint(lower.color, theme)
  const ratio = (value - lower.value) / (upper.value - lower.value)
  const rgb = lowerRgb.map((channel, index) =>
    Math.round(channel + ratio * (upperRgb[index]! - channel)),
  )
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

function pointImage(
  symbol: PointSymbol,
  zoom: number,
  theme: CanvasTheme,
): CircleStyle | RegularShape {
  const radius = interpolateStops(symbol.radiusStops, zoom, symbol.radius ?? 6)
  const fill = symbol.fillColor ? new Fill({ color: paint(symbol.fillColor, theme) }) : undefined
  const stroke = symbol.strokeColor
    ? new Stroke({ color: paint(symbol.strokeColor, theme), width: symbol.strokeWidth ?? 1 })
    : undefined
  const common = { radius, fill, stroke, opacity: symbol.opacity ?? 1 }
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
        color: paint(symbol.color, theme),
        width: interpolateStops(symbol.widthStops, zoom, symbol.width ?? 2),
        lineDash: symbol.dash,
      }),
      text: textFor(symbol, feature, theme),
    })
  return new Style({
    fill: symbol.fillColor
      ? new Fill({ color: withOpacity(paint(symbol.fillColor, theme), symbol.opacity ?? 1) })
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

function withOpacity(color: string, opacity: number): string {
  const rgb = parseRgb(color)
  return rgb && opacity < 1
    ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(opacity, 0, 1)})`
    : color
}

function continuousSymbol(
  style: Extract<ThematicStyleSpec, { type: 'continuous' }>,
  color: string,
): SymbolSpec {
  const symbol = defaultContinuousSymbol(style)
  if (symbol.kind === 'point') return { ...symbol, fillColor: color }
  if (symbol.kind === 'line') return { ...symbol, color }
  return { ...symbol, fillColor: color }
}

export function symbolForValue(
  style: ThematicStyleSpec,
  value: unknown,
  theme: CanvasTheme = defaultCanvasTheme,
): SymbolSpec | undefined {
  if (style.type === 'constant') return style.symbol
  const special = style.specialValues?.find((item) => item.value === value)
  if (special) return special.symbol
  if (style.type === 'categorical')
    return (
      style.categories.find((category) => category.value === value)?.symbol ??
      style.fallback?.symbol
    )
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return style.missing?.symbol
  if (style.type === 'graduated')
    return (
      style.classes.find(
        (item) =>
          (item.min === undefined || number >= item.min) &&
          (item.max === undefined || number < item.max),
      )?.symbol ??
      style.outOfRange?.symbol ??
      style.missing?.symbol
    )
  const domainValue =
    style.clamp === false ? number : clamp(number, style.domain[0], style.domain[1])
  if (style.clamp === false && (domainValue < style.domain[0] || domainValue > style.domain[1]))
    return style.outOfRange?.symbol ?? style.missing?.symbol
  return continuousSymbol(style, interpolateColor(style.stops, domainValue, theme))
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
  return (feature) => {
    if (!featureVisibleAtTime(feature, getTime(), time)) return undefined
    const value = 'field' in style ? feature.get(style.field) : undefined
    const theme = getTheme()
    const symbol = symbolForValue(style, value, theme)
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
