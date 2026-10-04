// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type Geometry from 'ol/geom/Geometry.js'
import type { MapSelection, SymbolSpec } from '../types'
import { paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import type { SvgVectorLayer } from './layer-registry'
import { featureIdOf } from './layers/common'
import { escapeXml } from './report'
import { featureVisibleAtTime, symbolForGeometry, symbolPicker } from './style-compiler'

// Vector features as SVG markup, with the symbols the canvas draws them with (the same rules,
// geometry adaptation and selection highlight), for vector-native SVG exports.

type Point = readonly [number, number]

export type SvgFeatureOptions = {
  layers: SvgVectorLayer[]
  time: string | null
  selection: MapSelection | null
  /** Map coordinate to export pixel (times the pixel ratio). */
  coordinateToPixel: (coordinate: number[]) => number[] | null
  pixelRatio: number
  theme: CanvasTheme
}

/** Every visible feature of `layers` as SVG elements, in map pixels. */
export function vectorFeaturesSvg(options: SvgFeatureOptions): string {
  const { theme, selection } = options
  const elements: string[] = []
  for (const { config, features } of options.layers) {
    const pick = symbolPicker(config.style)
    const field = 'field' in config.style ? config.style.field : undefined
    for (const feature of features) {
      const geometry = feature.getGeometry()
      if (!geometry || !featureVisibleAtTime(feature, options.time, config.time)) continue
      const symbol = pick(field ? feature.get(field) : undefined, theme)
      if (!symbol) continue
      const selected =
        selection?.layerId === config.id &&
        featureIdOf(feature, config.featureIdField) === selection.featureId
      elements.push(
        ...geometryElements(
          geometry,
          symbolForGeometry(symbol, geometry.getType()),
          options,
          selected,
        ),
      )
    }
  }
  return elements.join('')
}

function geometryElements(
  geometry: Geometry,
  symbol: SymbolSpec,
  options: SvgFeatureOptions,
  selected: boolean,
): string[] {
  const coordinates = (geometry as Geometry & { getCoordinates(): unknown }).getCoordinates()
  const project = (coordinate: number[]): Point | undefined => {
    const pixel = options.coordinateToPixel(coordinate)
    return pixel ? [pixel[0]! / options.pixelRatio, pixel[1]! / options.pixelRatio] : undefined
  }
  const style = attributes(symbol, options.theme, selected)
  const type = geometry.getType()
  if (type === 'Point') {
    const point = project(coordinates as number[])
    return point ? [pointElement(point, symbol, style)] : []
  }
  if (type === 'MultiPoint')
    return (coordinates as number[][]).flatMap((coordinate) => {
      const point = project(coordinate)
      return point ? [pointElement(point, symbol, style)] : []
    })
  const polygon = type.includes('Polygon')
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

function pointElement(point: Point, symbol: SymbolSpec, style: string): string {
  const radius = symbol.kind === 'point' ? (symbol.radius ?? 6) : 6
  const shape = symbol.kind === 'point' ? symbol.shape : undefined
  if (shape === 'square')
    return `<rect x="${point[0] - radius}" y="${point[1] - radius}" width="${radius * 2}" height="${radius * 2}" ${style}/>`
  if (shape === 'triangle' || shape === 'diamond') {
    const count = shape === 'triangle' ? 3 : 4
    const points = Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
      return `${point[0] + Math.cos(angle) * radius},${point[1] + Math.sin(angle) * radius}`
    }).join(' ')
    return `<polygon points="${points}" ${style}/>`
  }
  return `<circle cx="${point[0]}" cy="${point[1]}" r="${radius}" ${style}/>`
}

/** Paint attributes matching the canvas: polygon opacity is the fill's, others the symbol's. */
function attributes(symbol: SymbolSpec, theme: CanvasTheme, selected: boolean): string {
  if (selected)
    return `fill="${escapeXml(theme.selectionFill)}" stroke="${escapeXml(theme.selectionStroke)}" stroke-width="3"`
  const opacity = symbol.opacity ?? 1
  const dash = symbol.kind === 'point' ? undefined : symbol.dash
  const dashAttribute = dash ? ` stroke-dasharray="${dash.join(' ')}"` : ''
  if (symbol.kind === 'line')
    return `fill="none" stroke="${escapeXml(paint(symbol.color, theme))}" stroke-width="${symbol.width ?? 2}" opacity="${opacity}"${dashAttribute}`
  const fill = `fill="${escapeXml(paint(symbol.fillColor, theme) ?? 'none')}"`
  const stroke = symbol.strokeColor
    ? ` stroke="${escapeXml(paint(symbol.strokeColor, theme))}" stroke-width="${symbol.strokeWidth ?? 1}"`
    : ''
  const alpha = symbol.kind === 'polygon' ? 'fill-opacity' : 'opacity'
  return `${fill}${stroke} ${alpha}="${opacity}"${dashAttribute}`
}
