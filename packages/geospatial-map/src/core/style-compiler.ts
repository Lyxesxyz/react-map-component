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
import { canvasFont, defaultCanvasTheme } from './canvas-theme'
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

function parseHex(color: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(color)
  if (!match?.[1]) return undefined
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ]
}

function interpolateColor(stops: Array<{ value: number; color: string }>, value: number): string {
  const sorted = [...stops].sort((a, b) => a.value - b.value)
  const first = sorted[0]
  const last = sorted.at(-1)
  if (!first || !last) throw new MapConfigurationError('Continuous styles need at least one stop')
  if (value <= first.value) return first.color
  if (value >= last.value) return last.color
  const upperIndex = sorted.findIndex((stop) => stop.value >= value)
  const lower = sorted[upperIndex - 1]!
  const upper = sorted[upperIndex]!
  const lowerRgb = parseHex(lower.color)
  const upperRgb = parseHex(upper.color)
  if (!lowerRgb || !upperRgb) return lower.color
  const ratio = (value - lower.value) / (upper.value - lower.value)
  const rgb = lowerRgb.map((channel, index) =>
    Math.round(channel + ratio * (upperRgb[index]! - channel)),
  )
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

function pointImage(symbol: PointSymbol, zoom: number): CircleStyle | RegularShape {
  const radius = interpolateStops(symbol.radiusStops, zoom, symbol.radius ?? 6)
  const fill = symbol.fillColor ? new Fill({ color: symbol.fillColor }) : undefined
  const stroke = symbol.strokeColor
    ? new Stroke({ color: symbol.strokeColor, width: symbol.strokeWidth ?? 1 })
    : undefined
  const common = { radius, fill, stroke, opacity: symbol.opacity ?? 1 }
  if ((symbol.shape ?? 'circle') === 'circle') return new CircleStyle(common)
  if (symbol.shape === 'triangle') return new RegularShape({ ...common, points: 3, angle: 0 })
  if (symbol.shape === 'diamond')
    return new RegularShape({ ...common, points: 4, angle: Math.PI / 4 })
  return new RegularShape({ ...common, points: 4, angle: Math.PI / 4 })
}

function textFor(symbol: SymbolSpec, feature: FeatureLike, theme: CanvasTheme): Text | undefined {
  if (!symbol.labelField) return undefined
  const value = feature.get(symbol.labelField)
  if (value === undefined || value === null || value === '') return undefined
  return new Text({
    text: String(value),
    font: canvasFont(theme, 12, 500),
    offsetY: symbol.kind === 'point' ? (symbol.radius ?? 6) + 10 : 0,
    fill: new Fill({
      color: symbol.kind === 'line' ? symbol.color : (symbol.labelColor ?? theme.labelColor),
    }),
    stroke: new Stroke({ color: theme.labelHalo, width: 3 }),
  })
}

function styleForSymbol(
  symbol: SymbolSpec,
  feature: FeatureLike,
  zoom: number,
  theme: CanvasTheme,
): Style {
  if (symbol.kind === 'point')
    return new Style({ image: pointImage(symbol, zoom), text: textFor(symbol, feature, theme) })
  if (symbol.kind === 'line')
    return new Style({
      stroke: new Stroke({
        color: symbol.color,
        width: interpolateStops(symbol.widthStops, zoom, symbol.width ?? 2),
        lineDash: symbol.dash,
      }),
      text: textFor(symbol, feature, theme),
    })
  return new Style({
    fill: symbol.fillColor
      ? new Fill({ color: withOpacity(symbol.fillColor, symbol.opacity ?? 1) })
      : undefined,
    stroke: symbol.strokeColor
      ? new Stroke({
          color: symbol.strokeColor,
          width: symbol.strokeWidth ?? 1,
          lineDash: symbol.dash,
        })
      : undefined,
    text: textFor(symbol, feature, theme),
  })
}

function withOpacity(color: string, opacity: number): string {
  const rgb = parseHex(color)
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

export function symbolForValue(style: ThematicStyleSpec, value: unknown): SymbolSpec | undefined {
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
  return continuousSymbol(style, interpolateColor(style.stops, domainValue))
}

function featureVisibleAtTime(
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
    const symbol = symbolForValue(style, value)
    return symbol ? styleForSymbol(symbol, feature, getZoom(), getTheme()) : undefined
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
