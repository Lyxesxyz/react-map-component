// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import Value from 'typebox/value'
import type { ConfigIssue, ConfigValidationResult, MapConfig, MapConfigInput } from '../types'
import { webglUnsupportedReason } from '../core/webgl-style'
import { legacyIssues } from './legacy'
import { normalizeMapConfig } from './normalize'
import { mapConfigSchema } from './schema'

// `validateMapConfig`: the schema first, then the rules below, each a small function returning
// the problems it finds with a JSON-pointer path.

type Rule = (config: MapConfig) => ConfigIssue[]

const issue = (path: string, code: string, message: string): ConfigIssue => ({
  path,
  code,
  message,
})

function duplicates(values: string[], path: string): ConfigIssue[] {
  const seen = new Set<string>()
  return values.flatMap((value, index) => {
    const repeated = seen.has(value)
    seen.add(value)
    return repeated ? [issue(`${path}/${index}/id`, 'duplicate', `Duplicate ID: ${value}`)] : []
  })
}

const rules: Rule[] = [
  // Ids are unique where they are looked up.
  ({ data, ui }) => [
    ...duplicates(
      data.layers.map((item) => item.id),
      '/data/layers',
    ),
    ...duplicates(
      data.basemaps.map((item) => item.id),
      '/data/basemaps',
    ),
    ...data.basemaps.flatMap((basemap, index) =>
      duplicates(
        basemap.layers.map((item) => item.id),
        `/data/basemaps/${index}/layers`,
      ),
    ),
    ...duplicates(
      (data.zoomTargets ?? []).map((item) => item.id),
      '/data/zoomTargets',
    ),
    ...duplicates(ui.controls?.groups?.map((item) => item.id) ?? [], '/ui/controls/groups'),
  ],

  // References point at things that exist.
  ({ data, initialState, ui }) => {
    const targets = new Set((data.zoomTargets ?? []).map((item) => item.id))
    const layers = new Set(data.layers.map((item) => item.id))
    const times = new Set(data.layers.flatMap((item) => item.time?.available ?? []))
    return [
      ...(data.zoomTargets ?? []).flatMap((target, index) =>
        target.parentId && !targets.has(target.parentId)
          ? [
              issue(
                `/data/zoomTargets/${index}/parentId`,
                'unknown',
                'Parent zoom target does not exist',
              ),
            ]
          : [],
      ),
      ...(data.hierarchy ?? []).flatMap((item, index) =>
        item.targetId && !targets.has(item.targetId)
          ? [
              issue(
                `/data/hierarchy/${index}/targetId`,
                'unknown',
                'Hierarchy item references an unknown zoom target',
              ),
            ]
          : [],
      ),
      ...(ui.layerPanel?.defaultExpandedLayerIds ?? []).flatMap((id, index) =>
        layers.has(id)
          ? []
          : [
              issue(
                `/ui/layerPanel/defaultExpandedLayerIds/${index}`,
                'unknown',
                'Expanded layer does not exist',
              ),
            ],
      ),
      ...Object.keys(initialState.layers).flatMap((id) =>
        layers.has(id)
          ? []
          : [
              issue(
                `/initialState/layers/${id}`,
                'unknown',
                'Layer state references an unknown layer',
              ),
            ],
      ),
      ...(initialState.time && !times.has(initialState.time)
        ? [issue('/initialState/time', 'unknown', 'Initial time is not available in any layer')]
        : []),
    ]
  },

  // Basemaps support the starting projection. A basemap of ArcGIS layers declares none: it is
  // read from the service when the map loads.
  ({ data, initialState }) => {
    const found: ConfigIssue[] = []
    data.basemaps.forEach((basemap, index) => {
      if (
        !basemap.supportedProjections.length &&
        !basemap.layers.some((layer) => layer.kind === 'arcgis-vector-tiles')
      )
        found.push(
          issue(
            `/data/basemaps/${index}/supportedProjections`,
            'required',
            'List at least one projection the basemap supports',
          ),
        )
    })
    const active = data.basemaps.find((item) => item.id === initialState.activeBasemapId)
    if (initialState.activeBasemapId && !active)
      found.push(issue('/initialState/activeBasemapId', 'unknown', 'Active basemap does not exist'))
    if (
      active?.supportedProjections.length &&
      !active.supportedProjections.includes(initialState.view.projection)
    )
      found.push(
        issue(
          '/initialState/activeBasemapId',
          'projection',
          'Active basemap does not support the initial projection',
        ),
      )
    return found
  },

  // Layer settings the renderer can't honour.
  ({ data }) =>
    data.layers.flatMap((layer, index) => {
      const path = `/data/layers/${index}`
      const found: ConfigIssue[] = []
      if (layer.kind === 'geojson' && layer.renderer === 'webgl') {
        const reason = webglUnsupportedReason(layer)
        if (reason)
          found.push(
            issue(
              `${path}/renderer`,
              'unsupported',
              `renderer 'webgl' is not available for this layer: ${reason}`,
            ),
          )
      }
      if (layer.kind !== 'heatmap') return found
      if (layer.selectable)
        found.push(
          issue(
            `${path}/selectable`,
            'unsupported',
            'Heatmap layers are aggregate and cannot be selectable',
          ),
        )
      if (layer.time?.mode === 'wms-parameter')
        found.push(
          issue(
            `${path}/time/mode`,
            'unsupported',
            'Heatmap layers do not support WMS parameter time mode',
          ),
        )
      for (const key of ['radiusStops', 'blurStops'] as const) {
        const stops = layer[key] ?? []
        if (stops.some((stop, at) => at > 0 && stop.zoom <= stops[at - 1]!.zoom))
          found.push(
            issue(`${path}/${key}`, 'order', 'Heatmap zoom stops must be strictly ascending'),
          )
      }
      return found
    }),

  // Defaults are among the choices offered.
  ({ ui, export: exportConfig, view }) => [
    ...(ui.time?.defaultSpeedMs &&
    ui.time.speedsMs &&
    !ui.time.speedsMs.includes(ui.time.defaultSpeedMs)
      ? [
          issue(
            '/ui/time/defaultSpeedMs',
            'reference',
            'Default playback speed must be included in speedsMs',
          ),
        ]
      : []),
    ...(exportConfig?.defaultFormat &&
    exportConfig.formats &&
    !exportConfig.formats.includes(exportConfig.defaultFormat)
      ? [
          issue(
            '/export/defaultFormat',
            'reference',
            'Default export format must be included in formats',
          ),
        ]
      : []),
    ...(view.minZoom !== undefined && view.maxZoom !== undefined && view.minZoom > view.maxZoom
      ? [issue('/view/minZoom', 'order', 'minZoom cannot be greater than maxZoom')]
      : []),
  ],
]

function looksLikeConfigInput(input: unknown): input is MapConfigInput {
  const data = (input as { data?: unknown } | null)?.data
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { layers?: unknown }).layers)
  )
}

/**
 * Checks a configuration from JSON (a CMS, an API, a file) before rendering: the short or the
 * complete form. On success, `config` is the complete configuration to render.
 */
export function validateMapConfig(input: unknown): ConfigValidationResult {
  const legacy = legacyIssues(input)
  if (legacy.length) return { success: false, issues: legacy }
  let config: unknown = input
  if (looksLikeConfigInput(input)) {
    try {
      config = normalizeMapConfig(input)
    } catch (cause) {
      return {
        success: false,
        issues: [
          issue(
            '/',
            'invalid',
            `The configuration could not be completed: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
        ],
      }
    }
  }
  const errors = [...Value.Errors(mapConfigSchema, config)]
  if (errors.length)
    return {
      success: false,
      issues: errors.map((error) => issue(error.instancePath || '/', error.keyword, error.message)),
    }
  const issues = rules.flatMap((rule) => rule(config as MapConfig))
  return issues.length ? { success: false, issues } : { success: true, config: config as MapConfig }
}
