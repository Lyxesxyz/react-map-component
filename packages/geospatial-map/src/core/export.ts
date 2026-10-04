// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type OlMap from 'ol/Map.js'
import type {
  BasemapConfig,
  ExportOptions,
  MapSelection,
  MapViewState,
  NormalizedLegend,
} from '../types'
import { canvasFont } from './canvas-theme'
import type { CanvasTheme } from './canvas-theme'
import { asMapError, mapError, MapErrorException } from './errors'
import type { LayerRegistry } from './layer-registry'
import { projectionLabel } from './projections'
import { renderReportCanvas, renderReportSvg, reportLayout } from './report'
import { vectorFeaturesSvg } from './svg-export'
import { backgroundOf } from './validation'

// Exports the map as a PNG, JPEG or SVG report: waits for the visible layers, renders the map at
// the export size (keeping the area visible on screen), and places it in the report layout.

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_QUALITY = 0.92
const POLL_MS = 25

/** What an export reads from the map. */
export type ExportContext = {
  map: OlMap
  target: HTMLElement
  theme: CanvasTheme
  time: string | null
  selection: MapSelection | null
  view: MapViewState
  basemap: BasemapConfig
  legends: NormalizedLegend[]
  attribution: string
  layers: Pick<
    LayerRegistry,
    'getVisibleNonExportableLayerIds' | 'getVisibleRequiredStatuses' | 'getVisibleVectorLayers'
  >
  /** While the export resizes the map, its view moves are not the user's. */
  setExporting(exporting: boolean): void
}

const timeout = (message: string) =>
  new MapErrorException(mapError('EXPORT_TIMEOUT', message, true))

const isSecurityError = (cause: unknown) =>
  cause instanceof DOMException && cause.name === 'SecurityError'

const corsBlocked = (cause?: unknown) =>
  new MapErrorException(
    mapError(
      'EXPORT_CORS_BLOCKED',
      'A visible layer blocks export: its images come from a server without CORS access',
      true,
      undefined,
      cause,
    ),
  )

/** Resolves once every visible required layer has loaded and the frame is drawn. */
async function waitUntilDrawn(context: ExportContext, timeoutMs: number): Promise<void> {
  const started = performance.now()
  const required = () => context.layers.getVisibleRequiredStatuses()
  while (required().some((status) => status.loading)) {
    if (performance.now() - started >= timeoutMs)
      throw timeout('Export timed out waiting for required layers to load')
    await new Promise((resolve) => window.setTimeout(resolve, POLL_MS))
  }
  const failed = required().find((status) => status.error)
  if (failed?.error) throw new MapErrorException(failed.error)
  await document.fonts?.ready
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(timeout('Export timed out waiting for the map to draw')),
      Math.max(1, timeoutMs - (performance.now() - started)),
    )
    context.map.once('rendercomplete', () => {
      window.clearTimeout(timer)
      resolve()
    })
    context.map.renderSync()
  })
}

/** The map's layer canvases composited into one canvas of `width` × `height` pixels. */
function compositeMapCanvas(target: HTMLElement, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  for (const layer of target.querySelectorAll<HTMLCanvasElement>(
    '.ol-layer canvas, canvas.ol-layer',
  )) {
    if (!layer.width) continue
    context.globalAlpha = Number(layer.parentElement?.style.opacity || layer.style.opacity || 1)
    const matrix = /^matrix\(([^)]+)\)$/.exec(layer.style.transform)?.[1]?.split(',').map(Number)
    if (matrix?.length === 6)
      context.setTransform(...(matrix as [number, number, number, number, number, number]))
    else context.setTransform(1, 0, 0, 1, 0, 0)
    context.drawImage(layer, 0, 0)
  }
  return canvas
}

function encode(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                new MapErrorException(
                  mapError('EXPORT_FAILED', 'The browser could not encode the image', true),
                ),
              ),
        format,
        quality,
      )
    } catch (cause) {
      reject(isSecurityError(cause) ? corsBlocked(cause) : cause)
    }
  })
}

async function render(context: ExportContext, options: ExportOptions): Promise<Blob> {
  const { map, theme } = context
  const nonExportable = context.layers.getVisibleNonExportableLayerIds()
  if (context.basemap.exportable === false || nonExportable.length) {
    const layerId =
      nonExportable[0] ?? context.basemap.layers.find((layer) => layer.exportable === false)?.id
    throw new MapErrorException(
      mapError(
        'EXPORT_CORS_BLOCKED',
        `Visible layer ${layerId ?? context.basemap.title} is not exportable. Configure anonymous CORS access or choose an exportable source.`,
        true,
        layerId,
      ),
    )
  }
  const measure = document.createElement('canvas').getContext('2d')
  const layout = reportLayout({
    options,
    time: context.time,
    scaleLabel: `Scale: zoom ${context.view.zoom.toFixed(2)} · ${projectionLabel(context.view.projection)}`,
    legends: context.legends,
    attribution: context.attribution,
    mapBackground: backgroundOf(context.basemap),
    ...(measure
      ? {
          measure: (text: string, size: number) => {
            measure.font = canvasFont(theme, size)
            return measure.measureText(text).width
          },
        }
      : {}),
  })
  const ratio = layout.pixelRatio
  const size = [layout.map.width * ratio, layout.map.height * ratio]
  const view = map.getView()
  const screenSize = map.getSize()
  const screenResolution = view.getResolution()
  context.setExporting(true)
  map.setSize(size)
  // Keep the area visible on screen: the export frame has another size and shape.
  if (screenResolution && screenSize)
    view.setResolution(
      screenResolution * Math.max(screenSize[0]! / size[0]!, screenSize[1]! / size[1]!),
    )
  try {
    await waitUntilDrawn(context, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    if (options.format === 'image/svg+xml') {
      const vectorLayers = context.layers.getVisibleVectorLayers()
      const content = vectorLayers
        ? vectorFeaturesSvg({
            layers: vectorLayers,
            time: context.time,
            selection: context.selection,
            coordinateToPixel: (coordinate) => map.getPixelFromCoordinate(coordinate),
            pixelRatio: ratio,
            theme,
          })
        : rasterImage(compositeMapCanvas(context.target, size[0]!, size[1]!), layout.map)
      const note = vectorLayers
        ? 'vector-native: all visible geographic layers are serialized as SVG'
        : 'svg-wrapper: map content is rasterized'
      return new Blob([renderReportSvg(layout, content, theme, note)], { type: 'image/svg+xml' })
    }
    const report = renderReportCanvas(
      layout,
      compositeMapCanvas(context.target, size[0]!, size[1]!),
      theme,
    )
    return await encode(report, options.format, options.quality ?? DEFAULT_QUALITY)
  } finally {
    if (screenSize) map.setSize(screenSize)
    if (screenResolution) view.setResolution(screenResolution)
    map.renderSync()
    context.setExporting(false)
  }
}

/** The rendered map as an SVG `<image>`; throws `EXPORT_CORS_BLOCKED` for a tainted canvas. */
function rasterImage(canvas: HTMLCanvasElement, rect: { width: number; height: number }): string {
  let href: string
  try {
    href = canvas.toDataURL('image/png')
  } catch (cause) {
    throw isSecurityError(cause) ? corsBlocked(cause) : cause
  }
  return `<image href="${href}" width="${rect.width}" height="${rect.height}"/>`
}

/**
 * The map as an image. Fails with a `MapErrorException` whose code says why:
 * `EXPORT_CORS_BLOCKED`, `EXPORT_TIMEOUT`, a layer's `SOURCE_LOAD_FAILED`, or `EXPORT_FAILED`.
 */
export async function exportMapImage(
  context: ExportContext,
  options: ExportOptions,
): Promise<Blob> {
  try {
    return await render(context, options)
  } catch (cause) {
    throw cause instanceof MapErrorException
      ? cause
      : new MapErrorException(asMapError(cause, 'EXPORT_FAILED'))
  }
}
