// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type Geometry from 'ol/geom/Geometry.js'
import type { MapSelection, SymbolSpec } from '../types'
import { paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import type { SvgVectorLayer } from './layer-registry'
import { isSelected } from './layers/common'
import { escapeXml } from './report'
import {
  DEFAULT_POINT_RADIUS,
  geometryKind,
  lineWidth,
  POINT_SHAPES,
  pointRadius,
  SELECTION,
  styleValue,
  symbolForGeometry,
  symbolPicker,
} from './symbols'
import { frameFilter } from './time'

// Vector features as SVG markup, drawn as the canvas draws them: the same symbol rules, geometry
// adaptation, sizes at the current zoom, layer opacity and selection highlight.

type Point = readonly [number, number]

export type SvgFeatureOptions = {
  /** The layers in drawing order (bottom first). */
  layers: SvgVectorLayer[]
  time: string | null
  zoom: number
  selection: MapSelection | null
  /** Map coordinate to export pixel (times the pixel ratio). */
  coordinateToPixel: (coordinate: number[]) => number[] | null
  pixelRatio: number
  theme: CanvasTheme
}

/** How one geometry is drawn: its symbol, or the selection highlight. */
type Look = { symbol: SymbolSpec; selected: boolean }

/** Every visible feature of `layers` as SVG elements, in map pixels. */
export function vectorFeaturesSvg(options: SvgFeatureOptions): string {
  return options.layers
    .map(({ config, features, opacity }) => {
      const pick = symbolPicker(config.style)
      const include = frameFilter(config, () => options.time)
      const elements: string[] = []
      for (const feature of features) {
        const geometry = feature.getGeometry()
        if (!geometry || (include && !include(feature))) continue
        const symbol = pick(styleValue(config.style, feature), options.theme)
        if (!symbol) continue
        elements.push(
          ...geometryElements(geometry, options, {
            symbol: symbolForGeometry(symbol, geometry.getType()),
            selected: isSelected(config, feature, options.selection),
          }),
        )
      }
      if (!elements.length) return ''
      return opacity < 1 ? `<g opacity="${opacity}">${elements.join('')}</g>` : elements.join('')
    })
    .join('')
}

function geometryElements(geometry: Geometry, options: SvgFeatureOptions, look: Look): string[] {
  const coordinates = (geometry as Geometry & { getCoordinates(): unknown }).getCoordinates()
  const project = (coordinate: number[]): Point | undefined => {
    const pixel = options.coordinateToPixel(coordinate)
    return pixel ? [pixel[0]! / options.pixelRatio, pixel[1]! / options.pixelRatio] : undefined
  }
  const style = attributes(look, options)
  const type = geometry.getType()
  const points =
    type === 'Point'
      ? [coordinates as number[]]
      : type === 'MultiPoint'
        ? (coordinates as number[][])
        : undefined
  if (points)
    return points.flatMap((coordinate) => {
      const point = project(coordinate)
      return point ? [pointElement(point, look, options.zoom, style)] : []
    })
  const polygon = geometryKind(type) === 'polygon'
  return rings(type, coordinates).map((line) => {
    const path = line
      .map(project)
      .filter((point): point is Point => point !== undefined)
      .map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
      .join(' ')
    return `<path d="${path}${polygon ? ' Z' : ''}" ${style}${polygon ? ' fill-rule="evenodd"' : ''}/>`
  })
}

function rings(type: string, coordinates: unknown): number[][][] {
  if (type === 'LineString') return [coordinates as number[][]]
  if (type === 'MultiLineString' || type === 'Polygon') return coordinates as number[][][]
  if (type === 'MultiPolygon') return (coordinates as number[][][][]).flat()
  return []
}

/** A point marker: a circle, or the regular polygon the canvas draws for the shape. */
function pointElement(point: Point, { symbol, selected }: Look, zoom: number, style: string) {
  const shape = !selected && symbol.kind === 'point' ? (symbol.shape ?? 'circle') : 'circle'
  const radius = selected
    ? SELECTION.pointRadius
    : symbol.kind === 'point'
      ? pointRadius(symbol, zoom)
      : DEFAULT_POINT_RADIUS
  if (shape === 'circle')
    return `<circle cx="${point[0]}" cy="${point[1]}" r="${radius}" ${style}/>`
  const { points, angle } = POINT_SHAPES[shape]
  const corners = Array.from({ length: points }, (_, index) => {
    const turn = angle + (Math.PI * 2 * index) / points
    const x = point[0] + Math.sin(turn) * radius
    const y = point[1] - Math.cos(turn) * radius
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return `<polygon points="${corners.join(' ')}" ${style}/>`
}

/** Paint attributes matching the canvas: a polygon's opacity is its fill's, unless unfilled. */
function attributes({ symbol, selected }: Look, { theme, zoom }: SvgFeatureOptions): string {
  const color = (value: string) => escapeXml(paint(value, theme))
  if (selected) {
    if (symbol.kind === 'line')
      return `fill="none" stroke="${color(theme.selectionLine)}" stroke-width="${SELECTION.lineWidth}"`
    return `fill="${color(theme.selectionFill)}" stroke="${color(theme.selectionStroke)}" stroke-width="${SELECTION.strokeWidth}"`
  }
  const opacity = symbol.opacity ?? 1
  const dash = symbol.kind === 'point' ? undefined : symbol.dash
  const dashAttribute = dash ? ` stroke-dasharray="${dash.join(' ')}"` : ''
  if (symbol.kind === 'line')
    return `fill="none" stroke="${color(symbol.color)}" stroke-width="${lineWidth(symbol, zoom)}" opacity="${opacity}"${dashAttribute}`
  const fill = `fill="${symbol.fillColor ? color(symbol.fillColor) : 'none'}"`
  const stroke = symbol.strokeColor
    ? ` stroke="${color(symbol.strokeColor)}" stroke-width="${symbol.strokeWidth ?? 1}"`
    : ''
  const alpha =
    symbol.kind === 'point' ? 'opacity' : symbol.fillColor ? 'fill-opacity' : 'stroke-opacity'
  return `${fill}${stroke} ${alpha}="${opacity}"${dashAttribute}`
}
