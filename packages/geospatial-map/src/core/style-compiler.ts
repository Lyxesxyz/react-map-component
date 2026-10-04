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
import type { PointSymbol, SymbolSpec, ThematicStyleSpec } from '../types'
import { canvasFont, defaultCanvasTheme, paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import {
  geometryKind,
  lineWidth,
  POINT_SHAPES,
  pointRadius,
  SELECTION,
  styleValue,
  symbolForGeometry,
  symbolPicker,
  withOpacity,
} from './symbols'

// Thematic styles as OpenLayers canvas styles (the symbol choice itself is in `symbols.ts`).

export type StyleFunction = (feature: FeatureLike) => Style | undefined

/** What a style reads while drawing: the current zoom (for size stops) and colours. */
export type StyleEnvironment = { readonly zoom: number; readonly theme: CanvasTheme }

function pointImage(symbol: PointSymbol, zoom: number, theme: CanvasTheme) {
  const color = (value: string) => withOpacity(paint(value, theme), symbol.opacity)
  const options = {
    radius: pointRadius(symbol, zoom),
    fill: symbol.fillColor ? new Fill({ color: color(symbol.fillColor) }) : undefined,
    stroke: symbol.strokeColor
      ? new Stroke({ color: color(symbol.strokeColor), width: symbol.strokeWidth ?? 1 })
      : undefined,
  }
  const shape = symbol.shape ?? 'circle'
  return shape === 'circle'
    ? new CircleStyle(options)
    : new RegularShape({ ...options, ...POINT_SHAPES[shape] })
}

function textFor(
  symbol: SymbolSpec,
  feature: FeatureLike,
  zoom: number,
  theme: CanvasTheme,
): Text | undefined {
  if (!symbol.labelField) return undefined
  const value = feature.get(symbol.labelField)
  if (value === undefined || value === null || value === '') return undefined
  return new Text({
    text: String(value),
    font: canvasFont(theme, theme.labelSize, theme.labelWeight),
    offsetY: symbol.kind === 'point' ? pointRadius(symbol, zoom) + 10 : 0,
    fill: new Fill({
      color: paint(
        symbol.kind === 'line' ? symbol.color : (symbol.labelColor ?? theme.labelColor),
        theme,
      ),
    }),
    stroke: new Stroke({ color: theme.labelHalo, width: 3 }),
  })
}

function styleForSymbol(
  configured: SymbolSpec,
  feature: FeatureLike,
  zoom: number,
  theme: CanvasTheme,
): Style {
  const symbol = symbolForGeometry(configured, feature.getGeometry()?.getType() ?? '')
  const text = textFor(symbol, feature, zoom, theme)
  if (symbol.kind === 'point') return new Style({ image: pointImage(symbol, zoom, theme), text })
  if (symbol.kind === 'line')
    return new Style({
      stroke: new Stroke({
        color: withOpacity(paint(symbol.color, theme), symbol.opacity),
        width: lineWidth(symbol, zoom),
        lineDash: symbol.dash,
      }),
      text,
    })
  // A polygon's opacity is its fill's; an outline without a fill takes it instead.
  return new Style({
    fill: symbol.fillColor
      ? new Fill({ color: withOpacity(paint(symbol.fillColor, theme), symbol.opacity) })
      : undefined,
    stroke: symbol.strokeColor
      ? new Stroke({
          color: withOpacity(
            paint(symbol.strokeColor, theme),
            symbol.fillColor ? undefined : symbol.opacity,
          ),
          width: symbol.strokeWidth ?? 1,
          lineDash: symbol.dash,
        })
      : undefined,
    text,
  })
}

/**
 * The canvas style function of a thematic style. `include` leaves features out (those of
 * another time frame).
 */
export function compileThematicStyle(
  style: ThematicStyleSpec,
  env: StyleEnvironment,
  include?: (feature: FeatureLike) => boolean,
): StyleFunction {
  const pick = symbolPicker(style)
  return (feature) => {
    if (include && !include(feature)) return undefined
    const symbol = pick(styleValue(style, feature), env.theme)
    return symbol ? styleForSymbol(symbol, feature, env.zoom, env.theme) : undefined
  }
}

/** The highlight of a selected feature. */
export function selectionStyle(geometryType: string, theme: CanvasTheme = defaultCanvasTheme) {
  const stroke = new Stroke({ color: theme.selectionStroke, width: SELECTION.strokeWidth })
  const fill = new Fill({ color: theme.selectionFill })
  switch (geometryKind(geometryType)) {
    case 'point':
      return new Style({ image: new CircleStyle({ radius: SELECTION.pointRadius, fill, stroke }) })
    case 'line':
      return new Style({
        stroke: new Stroke({ color: theme.selectionLine, width: SELECTION.lineWidth }),
      })
    default:
      return new Style({ fill, stroke })
  }
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
