// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import Value from 'typebox/value'
import type {
  BasemapConfig,
  ConfigIssue,
  ConfigValidationResult,
  MapConfig,
  MapConfigInput,
  MapLayerConfig,
  ThematicStyleSpec,
} from '../types'
import { timeMode } from '../core/time'
import { webglUnsupportedReason } from '../core/webgl-style'
import { legacyIssues } from './legacy'
import { layerTimes, normalizeMapConfig } from './normalize'
import { mapConfigSchema } from './schema'

// `validateMapConfig`: the schema first, then the rules below, each a small function returning
// the problems it finds with a JSON-pointer path. The renderer checks layers and basemaps with
// the same rules (`layerIssues`, `basemapIssues`) when it is given a configuration directly.

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

const blank = (value: string) => !value.trim()

function styleIssues(style: ThematicStyleSpec | undefined, path: string): ConfigIssue[] {
  if (!style) return []
  const found: ConfigIssue[] = []
  if ('field' in style && blank(style.field))
    found.push(issue(`${path}/field`, 'required', 'The style needs a field'))
  if (style.type === 'continuous' && style.domain[0] >= style.domain[1])
    found.push(issue(`${path}/domain`, 'order', 'The domain must go from low to high'))
  return found
}

/** What is wrong with one layer the renderer would otherwise fail on, or draw wrongly. */
function layerIssue(layer: MapLayerConfig, path: string): ConfigIssue[] {
  const found: ConfigIssue[] = []
  if (blank(layer.id)) found.push(issue(`${path}/id`, 'required', 'Layer ids cannot be blank'))
  if (blank(layer.title))
    found.push(issue(`${path}/title`, 'required', `Layer ${layer.id} needs a title`))
  if ('style' in layer) found.push(...styleIssues(layer.style, `${path}/style`))
  if ('time' in layer && layer.time && !timeMode(layer))
    found.push(
      issue(
        `${path}/url`,
        'time',
        `Layer ${layer.id} has time frames, so its URL needs a {time} placeholder`,
      ),
    )
  switch (layer.kind) {
    case 'geojson': {
      const reason = layer.renderer === 'webgl' ? webglUnsupportedReason(layer) : undefined
      if (reason)
        found.push(
          issue(
            `${path}/renderer`,
            'unsupported',
            `renderer 'webgl' is not available for this layer: ${reason}`,
          ),
        )
      break
    }
    case 'heatmap':
      for (const key of ['radiusStops', 'blurStops'] as const) {
        const stops = layer[key] ?? []
        if (stops.some((stop, at) => at > 0 && stop.zoom <= stops[at - 1]!.zoom))
          found.push(
            issue(`${path}/${key}`, 'order', 'Heatmap zoom stops must be strictly ascending'),
          )
      }
      break
    case 'mvt':
      if (!layer.style && !layer.mapboxStyle)
        found.push(
          issue(`${path}/style`, 'required', `Layer ${layer.id} needs a style or a mapboxStyle`),
        )
      if (layer.selectable && !layer.featureIdField)
        found.push(
          issue(
            `${path}/featureIdField`,
            'required',
            `Selectable layer ${layer.id} needs featureIdField: tiles have no feature ids`,
          ),
        )
      if (
        layer.sourceProjectionDefinition &&
        layer.sourceProjectionDefinition.code !== layer.sourceProjection
      )
        found.push(
          issue(
            `${path}/sourceProjectionDefinition/code`,
            'reference',
            `The projection definition of ${layer.id} must be for its sourceProjection`,
          ),
        )
      break
    case 'wmts':
      if (layer.tileGrid.resolutions.length !== layer.tileGrid.matrixIds.length)
        found.push(
          issue(
            `${path}/tileGrid/matrixIds`,
            'reference',
            `Layer ${layer.id} needs one matrix id per resolution`,
          ),
        )
      break
  }
  return found
}

/** Problems in a list of layers (yours, or a basemap's), with paths under `path`. */
export function layerIssues(layers: MapLayerConfig[], path: string): ConfigIssue[] {
  return [
    ...duplicates(
      layers.map((layer) => layer.id),
      path,
    ),
    ...layers.flatMap((layer, index) => layerIssue(layer, `${path}/${index}`)),
  ]
}

/**
 * Problems in the basemaps. A basemap of ArcGIS layers may list no projections: they are read
 * from the service when the map loads.
 */
export function basemapIssues(basemaps: BasemapConfig[], path: string): ConfigIssue[] {
  return [
    ...duplicates(
      basemaps.map((basemap) => basemap.id),
      path,
    ),
    ...basemaps.flatMap((basemap, index) => [
      ...(blank(basemap.id) || blank(basemap.title)
        ? [issue(`${path}/${index}`, 'required', 'Basemaps need an id and a title')]
        : []),
      ...(!basemap.supportedProjections.length &&
      !basemap.layers.some((layer) => layer.kind === 'arcgis-vector-tiles')
        ? [
            issue(
              `${path}/${index}/supportedProjections`,
              'required',
              'List at least one projection the basemap supports',
            ),
          ]
        : []),
      ...layerIssues(basemap.layers, `${path}/${index}/layers`),
    ]),
  ]
}

type Rule = (config: MapConfig) => ConfigIssue[]

const rules: Rule[] = [
  ({ data }) => [
    ...layerIssues(data.layers, '/data/layers'),
    ...basemapIssues(data.basemaps, '/data/basemaps'),
  ],

  // Ids are unique where they are looked up.
  ({ data, ui }) => [
    ...duplicates(
      (data.zoomTargets ?? []).map((item) => item.id),
      '/data/zoomTargets',
    ),
    ...duplicates(ui.controls?.groups?.map((item) => item.id) ?? [], '/ui/controls/groups'),
  ],

  // References point at things that exist.
  ({ data, initialState, ui }) => {
    const targets = new Set((data.zoomTargets ?? []).map((item) => item.id))
    const layers = new Map(data.layers.map((layer) => [layer.id, layer]))
    const unknown = (path: string, message: string) => [issue(path, 'unknown', message)]
    const selected = initialState.selection && layers.get(initialState.selection.layerId)
    return [
      ...(ui.breadcrumbs?.targets ?? []).flatMap((id, index) =>
        targets.has(id)
          ? []
          : unknown(`/ui/breadcrumbs/targets/${index}`, `There is no zoom target "${id}"`),
      ),
      ...(ui.layerPanel?.defaultExpandedLayerIds ?? []).flatMap((id, index) =>
        layers.has(id)
          ? []
          : unknown(`/ui/layerPanel/defaultExpandedLayerIds/${index}`, `There is no layer "${id}"`),
      ),
      ...Object.keys(initialState.layers).flatMap((id) =>
        layers.has(id) ? [] : unknown(`/initialState/layers/${id}`, `There is no layer "${id}"`),
      ),
      ...(initialState.selection && !(selected && 'selectable' in selected && selected.selectable)
        ? unknown(
            '/initialState/selection/layerId',
            `There is no selectable layer "${initialState.selection.layerId}"`,
          )
        : []),
      ...(initialState.time !== null && !layerTimes(data.layers).includes(initialState.time)
        ? unknown('/initialState/time', 'No layer has this time frame')
        : []),
    ]
  },

  // The starting basemap supports the starting projection.
  ({ data, initialState }) => {
    const active = data.basemaps.find((item) => item.id === initialState.activeBasemapId)
    if (initialState.activeBasemapId && !active)
      return [issue('/initialState/activeBasemapId', 'unknown', 'Active basemap does not exist')]
    if (
      active?.supportedProjections.length &&
      !active.supportedProjections.includes(initialState.view.projection)
    )
      return [
        issue(
          '/initialState/activeBasemapId',
          'projection',
          'Active basemap does not support the initial projection',
        ),
      ]
    return []
  },

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
