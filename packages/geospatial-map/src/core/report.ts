// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { ExportOptions, LegendEntry, NormalizedLegend } from '../types'
import { canvasFont, paint } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'

// The exported report around the map image: header, legend, disclaimer and attribution. The
// layout is computed once and drawn by both the PNG/JPEG renderer (canvas) and the SVG renderer,
// so the two formats always show the same text and the same legend as the screen.

export const REPORT_DEFAULT_WIDTH = 1200
export const REPORT_DEFAULT_HEIGHT = 720
const MIN_WIDTH = 320
const MIN_HEIGHT = 240
const MAX_PIXEL_RATIO = 3
const MARGIN = 24
const LEGEND_WIDTH = 280
const HEADER_HEIGHT = 92
const BARE_HEADER_HEIGHT = 36
const LEGEND_ROW = 19
const DISCLAIMER_LINE = 15
const DISCLAIMER_MAX_LINES = 6
const MAX_ATTRIBUTION_CHARS = 180

type Rect = { x: number; y: number; width: number; height: number }

/** One thing drawn on the report, in report pixels (before the pixel ratio). */
export type ReportItem =
  | {
      kind: 'text'
      x: number
      y: number
      text: string
      size: number
      weight?: number
      tone: 'foreground' | 'muted'
    }
  | { kind: 'swatch'; rect: Rect; symbol: Exclude<LegendEntry['symbol'], { kind: 'gradient' }> }
  | { kind: 'gradient'; rect: Rect; stops: Array<{ value: number; color: string }> }

export type ReportLayout = {
  width: number
  height: number
  pixelRatio: number
  /** Where the map image goes. */
  map: Rect
  /** The basemap background behind the map image. */
  mapBackground: string
  items: ReportItem[]
}

export type ReportInput = {
  options: ExportOptions
  time: string | null
  scaleLabel: string
  legends: NormalizedLegend[]
  attribution: string
  mapBackground: string
  /** Width of `text` at a font size, for wrapping the disclaimer. */
  measure?: (text: string, size: number) => number
}

/** Splits `text` into lines no wider than `maxWidth`; at most six, the last one shortened. */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (line && measure(candidate) > maxWidth) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  if (lines.length <= DISCLAIMER_MAX_LINES) return lines
  return [
    ...lines.slice(0, DISCLAIMER_MAX_LINES - 1),
    `${lines[DISCLAIMER_MAX_LINES - 1]!.slice(0, -1)}…`,
  ]
}

/** Where everything on the report goes. */
export function reportLayout(input: ReportInput): ReportLayout {
  const { options } = input
  const width = Math.max(MIN_WIDTH, Math.round(options.width ?? REPORT_DEFAULT_WIDTH))
  const height = Math.max(MIN_HEIGHT, Math.round(options.height ?? REPORT_DEFAULT_HEIGHT))
  const pixelRatio = Math.min(MAX_PIXEL_RATIO, Math.max(1, options.pixelRatio ?? 1))
  const header =
    options.title || options.subtitle || input.time || options.selectedAreaLabel
      ? HEADER_HEIGHT
      : BARE_HEADER_HEIGHT
  const legendWidth = options.includeLegend === false ? 0 : LEGEND_WIDTH
  const disclaimer = options.disclaimer?.trim()
  const measure = input.measure ?? ((text: string, size: number) => text.length * size * 0.55)
  const disclaimerLines = disclaimer
    ? wrapText(disclaimer, width - MARGIN * 2, (text) => measure(text, 11))
    : []
  const footer =
    (options.includeAttribution === false ? 12 : 38) +
    (disclaimerLines.length ? disclaimerLines.length * DISCLAIMER_LINE + 8 : 0)
  const map = { x: 0, y: header, width: width - legendWidth, height: height - header - footer }
  const items: ReportItem[] = []
  const text = (
    x: number,
    y: number,
    value: string,
    size: number,
    extra: { weight?: number; tone?: 'foreground' | 'muted' } = {},
  ) => items.push({ kind: 'text', x, y, text: value, size, tone: 'foreground', ...extra })

  if (options.title) text(MARGIN, 34, options.title, 24, { weight: 700 })
  if (options.subtitle) text(MARGIN, 56, options.subtitle, 14)
  const details = [
    input.time ? `Time: ${input.time}` : '',
    options.selectedAreaLabel ? `Selected area: ${options.selectedAreaLabel}` : '',
    input.scaleLabel,
  ].filter(Boolean)
  if (details.length) text(MARGIN, header - 12, details.join(' · '), 12)

  if (legendWidth) {
    const x = map.width + 20
    const barWidth = Math.min(120, legendWidth - 36)
    let y = header + 20
    for (const legend of input.legends.filter((item) => item.visible)) {
      text(x, y, legend.title, 14, { weight: 700 })
      y += 20
      for (const entry of legend.entries) {
        if (entry.symbol.kind === 'gradient') {
          items.push({
            kind: 'gradient',
            rect: { x, y: y - 11, width: barWidth, height: 12 },
            stops: entry.symbol.stops,
          })
          // A gradient bar is wider than a swatch: its label goes after the bar.
          text(x + barWidth + 8, y, entry.label, 12)
        } else {
          items.push({
            kind: 'swatch',
            rect: { x, y: y - 11, width: 18, height: 12 },
            symbol: entry.symbol,
          })
          text(x + 26, y, entry.label, 12)
        }
        y += LEGEND_ROW
      }
      y += 10
    }
  }

  disclaimerLines.forEach((line, index) =>
    text(MARGIN, map.y + map.height + 18 + index * DISCLAIMER_LINE, line, 11),
  )
  if (options.includeAttribution !== false && input.attribution)
    text(MARGIN, height - 14, input.attribution.slice(0, MAX_ATTRIBUTION_CHARS), 11, {
      tone: 'muted',
    })
  return { width, height, pixelRatio, map, mapBackground: input.mapBackground, items }
}

/** Fill and stroke of a legend swatch, the same in both renderers. */
function swatchPaint(
  symbol: Extract<ReportItem, { kind: 'swatch' }>['symbol'],
  theme: CanvasTheme,
): { fill: string; stroke?: string; strokeWidth?: number } {
  if (symbol.kind === 'line') return { fill: paint(symbol.color, theme) }
  return {
    fill: paint(symbol.fillColor ?? symbol.strokeColor ?? '#9ca3af', theme),
    ...(symbol.strokeColor && symbol.fillColor
      ? { stroke: paint(symbol.strokeColor, theme), strokeWidth: symbol.strokeWidth ?? 1 }
      : {}),
  }
}

const gradientOffset = (stops: Array<{ value: number }>, value: number) => {
  const min = stops[0]?.value ?? 0
  const max = stops.at(-1)?.value ?? 1
  return max === min ? 0 : (value - min) / (max - min)
}

/** The report as a canvas, with `mapImage` (already sized to `layout.map` × ratio) in place. */
export function renderReportCanvas(
  layout: ReportLayout,
  mapImage: HTMLCanvasElement,
  theme: CanvasTheme,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = layout.width * layout.pixelRatio
  canvas.height = layout.height * layout.pixelRatio
  const context = canvas.getContext('2d')!
  context.scale(layout.pixelRatio, layout.pixelRatio)
  context.fillStyle = theme.exportBackground
  context.fillRect(0, 0, layout.width, layout.height)
  const { map } = layout
  context.fillStyle = paint(layout.mapBackground, theme)
  context.fillRect(map.x, map.y, map.width, map.height)
  context.drawImage(
    mapImage,
    0,
    0,
    mapImage.width,
    mapImage.height,
    map.x,
    map.y,
    map.width,
    map.height,
  )
  for (const item of layout.items) {
    if (item.kind === 'text') {
      context.font = canvasFont(theme, item.size, item.weight)
      context.fillStyle = item.tone === 'muted' ? theme.exportMuted : theme.exportForeground
      context.fillText(item.text, item.x, item.y)
    } else if (item.kind === 'gradient') {
      const { x, y, width, height } = item.rect
      const gradient = context.createLinearGradient(x, y, x + width, y)
      for (const stop of item.stops)
        gradient.addColorStop(gradientOffset(item.stops, stop.value), paint(stop.color, theme))
      context.fillStyle = gradient
      context.fillRect(x, y, width, height)
    } else {
      const { x, y, width, height } = item.rect
      const swatch = swatchPaint(item.symbol, theme)
      context.fillStyle = swatch.fill
      context.fillRect(x, y, width, height)
      if (swatch.stroke) {
        context.strokeStyle = swatch.stroke
        context.lineWidth = swatch.strokeWidth ?? 1
        context.strokeRect(x, y, width, height)
      }
    }
  }
  return canvas
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * The report as an SVG document. `mapContent` is SVG markup in map pixels: vector features, or
 * an `<image>` of the rendered map when it has raster layers. `note` says which.
 */
export function renderReportSvg(
  layout: ReportLayout,
  mapContent: string,
  theme: CanvasTheme,
  note: string,
): string {
  const { width, height, map } = layout
  const font = `font-family="${escapeXml(theme.fontFamily)}"`
  const elements = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<metadata>${escapeXml(note)}</metadata>`,
    `<rect width="100%" height="100%" fill="${escapeXml(theme.exportBackground)}"/>`,
    `<rect x="${map.x}" y="${map.y}" width="${map.width}" height="${map.height}" fill="${escapeXml(paint(layout.mapBackground, theme))}"/>`,
    `<g clip-path="url(#map-clip)" transform="translate(${map.x} ${map.y})"><defs><clipPath id="map-clip"><rect width="${map.width}" height="${map.height}"/></clipPath></defs>${mapContent}</g>`,
  ]
  layout.items.forEach((item, index) => {
    if (item.kind === 'text') {
      const fill = item.tone === 'muted' ? theme.exportMuted : theme.exportForeground
      elements.push(
        `<text x="${item.x}" y="${item.y}" ${font} font-size="${item.size}"${item.weight ? ` font-weight="${item.weight}"` : ''} fill="${escapeXml(fill)}">${escapeXml(item.text)}</text>`,
      )
    } else if (item.kind === 'gradient') {
      const { x, y, width: w, height: h } = item.rect
      const stops = item.stops
        .map(
          (stop) =>
            `<stop offset="${gradientOffset(item.stops, stop.value)}" stop-color="${escapeXml(paint(stop.color, theme))}"/>`,
        )
        .join('')
      elements.push(
        `<defs><linearGradient id="legend-gradient-${index}">${stops}</linearGradient></defs>`,
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#legend-gradient-${index})"/>`,
      )
    } else {
      const { x, y, width: w, height: h } = item.rect
      const swatch = swatchPaint(item.symbol, theme)
      elements.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escapeXml(swatch.fill)}"${swatch.stroke ? ` stroke="${escapeXml(swatch.stroke)}" stroke-width="${swatch.strokeWidth ?? 1}"` : ''}/>`,
      )
    }
  })
  elements.push('</svg>')
  return elements.join('')
}
