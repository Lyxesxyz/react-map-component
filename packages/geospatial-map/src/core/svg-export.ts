// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type Feature from 'ol/Feature.js'
import type Geometry from 'ol/geom/Geometry.js'
import type { ExportOptions, MapSelection, SymbolSpec } from '../types'
import type { SvgVectorLayer } from './layer-factory'
import { symbolForValue } from './style-compiler'
import { paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'

type Point = readonly [number, number]

export function composeVectorSvg(options: {
  width: number
  height: number
  headerHeight: number
  legendWidth: number
  attributionHeight: number
  disclaimerLines?: string[]
  pixelRatio: number
  report: ExportOptions
  time: string | null
  selection: MapSelection | null
  layers: SvgVectorLayer[]
  backgroundColor: string
  coordinateToPixel: (coordinate: number[]) => number[] | null
  attribution: string
  scaleLabel: string
  theme: CanvasTheme
}): string {
  const { theme } = options
  const font = `font-family="${escapeXml(theme.fontFamily)}"`
  const mapWidth = options.width - options.legendWidth
  const mapHeight = options.height - options.headerHeight - options.attributionHeight
  const elements: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">`,
    '<metadata>vector-native: all visible geographic layers are serialized as SVG</metadata>',
    `<rect width="100%" height="100%" fill="${escapeXml(theme.exportBackground)}"/>`,
    `<rect x="0" y="${options.headerHeight}" width="${mapWidth}" height="${mapHeight}" fill="${escapeXml(paint(options.backgroundColor, theme))}"/>`,
    `<g clip-path="url(#map-clip)" transform="translate(0 ${options.headerHeight})"><defs><clipPath id="map-clip"><rect width="${mapWidth}" height="${mapHeight}"/></clipPath></defs>`,
  ]
  for (const layer of options.layers) {
    for (const feature of layer.features) {
      const geometry = feature.getGeometry()
      if (!geometry || !visibleAtTime(feature, layer.config, options.time)) continue
      const id =
        feature.getId() ??
        (layer.config.featureIdField ? feature.get(layer.config.featureIdField) : undefined)
      const selected =
        options.selection?.layerId === layer.config.id && String(id) === options.selection.featureId
      const value =
        'field' in layer.config.style ? feature.get(layer.config.style.field) : undefined
      const symbol = symbolForValue(layer.config.style, value, theme)
      if (!symbol) continue
      elements.push(
        ...geometryElements(
          geometry,
          symbol,
          options.coordinateToPixel,
          options.pixelRatio,
          theme,
          selected,
        ),
      )
    }
  }
  elements.push('</g>')
  if (options.report.title)
    elements.push(
      `<text x="24" y="34" ${font} font-size="24" font-weight="700" fill="${escapeXml(theme.exportForeground)}">${escapeXml(options.report.title)}</text>`,
    )
  if (options.report.subtitle)
    elements.push(
      `<text x="24" y="56" ${font} font-size="14" fill="${escapeXml(theme.exportForeground)}">${escapeXml(options.report.subtitle)}</text>`,
    )
  const details = [
    options.time ? `Time: ${options.time}` : '',
    options.report.selectedAreaLabel ? `Selected area: ${options.report.selectedAreaLabel}` : '',
    options.scaleLabel,
  ].filter(Boolean)
  if (details.length)
    elements.push(
      `<text x="24" y="${options.headerHeight - 12}" ${font} font-size="12" fill="${escapeXml(theme.exportForeground)}">${escapeXml(details.join(' · '))}</text>`,
    )
  if (options.legendWidth)
    elements.push(
      ...legendElements(options.layers, mapWidth + 20, options.headerHeight + 20, theme, font),
    )
  options.disclaimerLines?.forEach((line, index) =>
    elements.push(
      `<text x="24" y="${options.headerHeight + mapHeight + 18 + index * 15}" ${font} font-size="11" fill="${escapeXml(theme.exportForeground)}">${escapeXml(line)}</text>`,
    ),
  )
  if (options.report.includeAttribution !== false)
    elements.push(
      `<text x="24" y="${options.height - 14}" ${font} font-size="11" fill="${escapeXml(theme.exportMuted)}">${escapeXml(options.attribution.slice(0, 180))}</text>`,
    )
  elements.push('</svg>')
  return elements.join('')
}

function geometryElements(
  geometry: Geometry,
  symbol: SymbolSpec,
  toPixel: (coordinate: number[]) => number[] | null,
  ratio: number,
  theme: CanvasTheme,
  selected: boolean,
): string[] {
  const coordinates = (geometry as Geometry & { getCoordinates(): unknown }).getCoordinates()
  const project = (coordinate: number[]): Point | undefined => {
    const pixel = toPixel(coordinate)
    return pixel ? [pixel[0]! / ratio, pixel[1]! / ratio] : undefined
  }
  const style = attributes(symbol, theme, selected)
  if (geometry.getType() === 'Point') {
    const point = project(coordinates as number[])
    return point ? [pointElement(point, symbol, style)] : []
  }
  if (geometry.getType() === 'MultiPoint')
    return (coordinates as number[][])
      .map(project)
      .filter(Boolean)
      .map((point) => pointElement(point!, symbol, style))
  const lines = normalizeLines(geometry.getType(), coordinates)
  return lines.map((line) => {
    const path = line
      .map(project)
      .filter(Boolean)
      .map((point, index) => `${index ? 'L' : 'M'}${point![0].toFixed(2)} ${point![1].toFixed(2)}`)
      .join(' ')
    return `<path d="${path}${geometry.getType().includes('Polygon') ? ' Z' : ''}" ${style}${geometry.getType().includes('Polygon') ? ' fill-rule="evenodd"' : ''}/>`
  })
}

function normalizeLines(type: string, coordinates: unknown): number[][][] {
  if (type === 'LineString') return [coordinates as number[][]]
  if (type === 'MultiLineString' || type === 'Polygon') return coordinates as number[][][]
  if (type === 'MultiPolygon') return (coordinates as number[][][][]).flat()
  return []
}

function pointElement(point: Point, symbol: SymbolSpec, style: string): string {
  const radius = symbol.kind === 'point' ? (symbol.radius ?? 6) : 6
  if (symbol.kind === 'point' && symbol.shape === 'square')
    return `<rect x="${point[0] - radius}" y="${point[1] - radius}" width="${radius * 2}" height="${radius * 2}" ${style}/>`
  if (symbol.kind === 'point' && (symbol.shape === 'triangle' || symbol.shape === 'diamond')) {
    const count = symbol.shape === 'triangle' ? 3 : 4
    const points = Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
      return `${point[0] + Math.cos(angle) * radius},${point[1] + Math.sin(angle) * radius}`
    }).join(' ')
    return `<polygon points="${points}" ${style}/>`
  }
  return `<circle cx="${point[0]}" cy="${point[1]}" r="${radius}" ${style}/>`
}

function attributes(symbol: SymbolSpec, theme: CanvasTheme, selected = false): string {
  if (selected)
    return `fill="${escapeXml(theme.selectionFill)}" stroke="${escapeXml(theme.selectionStroke)}" stroke-width="3"`
  if (symbol.kind === 'line')
    return `fill="none" stroke="${escapeXml(paint(symbol.color, theme))}" stroke-width="${symbol.width ?? 2}" opacity="${symbol.opacity ?? 1}"${symbol.dash ? ` stroke-dasharray="${symbol.dash.join(' ')}"` : ''}`
  const dash = symbol.kind === 'polygon' ? symbol.dash : undefined
  return `fill="${escapeXml(paint(symbol.fillColor, theme) ?? 'none')}" stroke="${escapeXml(paint(symbol.strokeColor, theme) ?? 'none')}" stroke-width="${symbol.strokeWidth ?? 0}" opacity="${symbol.opacity ?? 1}"${dash ? ` stroke-dasharray="${dash.join(' ')}"` : ''}`
}

function visibleAtTime(
  feature: Feature,
  config: SvgVectorLayer['config'],
  time: string | null,
): boolean {
  if (!config.time || config.time.mode !== 'property' || !time) return true
  return String(feature.get(config.time.fieldOrParameter ?? 'time')) === time
}

function legendElements(
  layers: SvgVectorLayer[],
  x: number,
  startY: number,
  theme: CanvasTheme,
  font: string,
): string[] {
  const result: string[] = []
  let y = startY
  for (const layer of layers.filter((item) => item.config.role !== 'basemap')) {
    result.push(
      `<text x="${x}" y="${y}" ${font} font-size="14" font-weight="700" fill="${escapeXml(theme.exportForeground)}">${escapeXml(layer.config.legend?.title ?? layer.config.title)}</text>`,
    )
    y += 20
    const style = layer.config.style
    const entries =
      style.type === 'constant'
        ? [{ label: 'Features', symbol: style.symbol }]
        : style.type === 'categorical'
          ? style.categories
          : style.type === 'graduated'
            ? style.classes
            : [
                {
                  label: `${style.domain[0]} – ${style.domain[1]}`,
                  symbol: style.symbol ?? {
                    kind: 'polygon' as const,
                    fillColor: style.stops[0]?.color ?? '#9ca3af',
                  },
                },
              ]
    for (const entry of entries) {
      result.push(
        `<rect x="${x}" y="${y - 11}" width="18" height="12" ${attributes(entry.symbol, theme)}/><text x="${x + 26}" y="${y}" ${font} font-size="12" fill="${escapeXml(theme.exportForeground)}">${escapeXml(entry.label)}</text>`,
      )
      y += 19
    }
    y += 10
  }
  return result
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
