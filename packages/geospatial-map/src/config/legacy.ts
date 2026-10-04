// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { ConfigIssue } from '../types'

// Fields renamed or removed in 0.8.0 and 0.9.0. A configuration stored as JSON before then
// fails validation with a message saying what to write instead, not "unknown property".

type Rename = { from: string; to?: string; note?: string }

/** Renamed and removed fields, by object: a path pattern (`*` for any key or index). */
type Change = {
  at: string
  version: string
  fields: Rename[]
  /** Only objects this is true for (by default, all). */
  when?: (object: Record<string, unknown>) => boolean
}

const layerPaths = ['data/layers/*', 'data/basemaps/*/layers/*']
const vectorKinds = new Set(['geojson', 'mvt', undefined])
const timedKinds = new Set(['geojson', 'heatmap', 'mvt', 'xyz', 'wms', undefined])

const changes: Change[] = [
  // 0.8.0
  { at: '', version: '0.8.0', fields: [{ from: 'time', to: 'ui.time' }] },
  {
    at: 'ui',
    version: '0.8.0',
    fields: [
      { from: 'controlRail', to: 'ui.controls' },
      { from: 'layers', to: 'ui.layerPanel' },
      { from: 'hierarchy', to: 'ui.breadcrumbs' },
      { from: 'errors', to: 'ui.errorAlert' },
      { from: 'status', to: 'ui.statusChips' },
    ],
  },
  {
    at: 'accessibility',
    version: '0.8.0',
    fields: [{ from: 'keyboard', to: 'view.interactions.keyboard' }],
  },
  {
    at: 'time',
    version: '0.8.0',
    fields: [{ from: 'reducedMotion', to: 'accessibility.reducedMotion' }],
  },
  {
    at: 'initialState/view',
    version: '0.8.0',
    fields: [
      { from: 'minZoom', to: 'view.minZoom' },
      { from: 'maxZoom', to: 'view.maxZoom' },
    ],
  },
  {
    at: 'theme',
    version: '0.8.0',
    fields: [
      { from: 'textColor', to: 'theme.foreground' },
      { from: 'mutedColor', to: 'theme.mutedForeground' },
      { from: 'borderColor', to: 'theme.border' },
      { from: 'surfaceColor', to: 'theme.background' },
      { from: 'softSurfaceColor', to: 'theme.muted' },
      { from: 'glassColor', to: 'theme.overlay' },
      { from: 'accentColor', to: 'theme.primary' },
      { from: 'accentHoverColor', to: 'theme.primaryHover' },
      { from: 'dangerColor', to: 'theme.destructive' },
      { from: 'focusColor', to: 'theme.ring' },
    ],
  },
  ...layerPaths.map((at) => ({
    at,
    version: '0.8.0',
    fields: [
      { from: 'urlTemplate', to: 'url' },
      { from: 'dataProjection', to: 'sourceProjection' },
      { from: 'orderLocked', note: 'use `reorderable: false`' },
      { from: 'tiled', note: 'WMS layers are always tiled' },
      { from: 'sourceLayer', note: 'it had no effect' },
      { from: 'styleUrl', to: 'mapboxStyle.url' },
      { from: 'styleLayers', to: 'mapboxStyle.layers' },
      { from: 'styleOverrides', to: 'mapboxStyle.overrides' },
    ],
  })),
  ...layerPaths.map((at) => ({
    at,
    version: '0.8.0',
    // Only ArcGIS layers had a `projection`.
    when: (layer: Record<string, unknown>) => layer.kind === 'arcgis-vector-tiles',
    fields: [{ from: 'projection', to: 'sourceProjectionDefinition' }],
  })),
  ...layerPaths.map((at) => ({
    at: `${at}/legend`,
    version: '0.8.0',
    fields: [
      { from: 'presentation', note: 'the legend draws each symbol at its own size' },
      { from: 'showLayerToggle', note: 'show and hide layers from the layer panel' },
    ],
  })),

  // 0.9.0
  ...layerPaths.map((at) => ({
    at,
    version: '0.9.0',
    fields: [
      { from: 'role', note: 'list layers under a heading with `group`' },
      { from: 'zIndex', note: 'layers are drawn in the order of the list' },
      { from: 'hitPriority', note: 'the top-most feature is selected' },
      { from: 'boundarySetId', note: 'put it in the feature properties if you need it' },
      { from: 'geographyLevel', note: 'put it in the feature properties if you need it' },
    ],
  })),
  ...layerPaths.map((at) => ({
    at,
    version: '0.9.0',
    when: (layer: Record<string, unknown>) => !vectorKinds.has(layer.kind as string | undefined),
    fields: ['selectable', 'featureIdField', 'propertyAllowlist'].map((from) => ({
      from,
      note: 'only GeoJSON and vector tile (mvt) layers are selectable',
    })),
  })),
  ...layerPaths.map((at) => ({
    at,
    version: '0.9.0',
    when: (layer: Record<string, unknown>) => !timedKinds.has(layer.kind as string | undefined),
    fields: [{ from: 'time', note: 'WMTS and ArcGIS layers have no time frames' }],
  })),
  {
    at: 'data/layers/*',
    version: '0.9.0',
    fields: [{ from: 'aboveOverlays', note: 'only basemap layers can be drawn above your layers' }],
  },
  ...layerPaths.map((at) => ({
    at: `${at}/time`,
    version: '0.9.0',
    fields: [
      { from: 'available', to: 'time.values' },
      { from: 'fieldOrParameter', to: 'time.field' },
      { from: 'mode', note: 'it follows from the layer: `{time}` in the URL, WMS, or a property' },
      { from: 'missingPolicy', note: 'a layer is hidden while the map shows a frame it lacks' },
      { from: 'prefetchFrames', note: 'the next frame is loaded ahead' },
    ],
  })),
  {
    at: 'data/basemaps/*',
    version: '0.9.0',
    fields: [
      { from: 'fallbackFor', note: 'each map has one projection' },
      { from: 'network', note: 'it had no effect' },
    ],
  },
  {
    at: 'data',
    version: '0.9.0',
    fields: [{ from: 'hierarchy', note: 'list zoom target ids in `ui.breadcrumbs.targets`' }],
  },
  {
    at: 'data/zoomTargets/*',
    version: '0.9.0',
    fields: [
      { from: 'parentId', note: 'list the path in `ui.breadcrumbs.targets`' },
      { from: 'geographyLevel', note: 'list the path in `ui.breadcrumbs.targets`' },
    ],
  },
  {
    at: 'view',
    version: '0.9.0',
    fields: [{ from: 'projectionBehavior', note: 'each map has one projection' }],
  },
  {
    at: 'initialState/selection',
    version: '0.9.0',
    fields: [
      { from: 'boundarySetId', note: 'a selection is `{ layerId, featureId }`' },
      { from: 'geographyLevel', note: 'a selection is `{ layerId, featureId }`' },
    ],
  },
  {
    at: 'ui/legend',
    version: '0.9.0',
    fields: [{ from: 'defaultOpen', to: 'ui.legend.expanded' }],
  },
  {
    at: 'messages',
    version: '0.9.0',
    fields: [
      { from: 'projectionChanged', note: 'each map has one projection' },
      { from: 'network', note: 'basemaps have no network badge' },
    ],
  },
]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Every object at a path pattern, with its concrete path. */
function objectsAt(root: unknown, pattern: string): Array<[string, Record<string, unknown>]> {
  let found: Array<[string, unknown]> = [['', root]]
  for (const segment of pattern ? pattern.split('/') : [])
    found = found.flatMap(([path, value]) => {
      if (!isObject(value)) return []
      const keys = segment === '*' ? Object.keys(value) : [segment]
      return keys
        .filter((key) => key in value)
        .map((key): [string, unknown] => [`${path}/${key}`, value[key]])
    })
  return found.filter((entry): entry is [string, Record<string, unknown>] => isObject(entry[1]))
}

/** Issues for fields that were renamed or removed, saying what to write instead. */
export function legacyIssues(input: unknown): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  const report = (path: string, message: string, code = 'removed') =>
    issues.push({ path, code, message })
  for (const { at, version, fields, when } of changes)
    for (const [path, object] of objectsAt(input, at)) {
      if (when && !when(object)) continue
      for (const { from, to, note } of fields) {
        if (!(from in object)) continue
        const name = path ? `${path.slice(1).replaceAll('/', '.')}.${from}` : from
        if (to) report(`${path}/${from}`, `${name} was renamed to ${to} in ${version}`, 'renamed')
        else
          report(`${path}/${from}`, `${name} was removed in ${version}${note ? `: ${note}` : ''}`)
      }
    }
  const config = input as {
    ui?: { time?: { frameFailurePolicy?: unknown }; layerPanel?: { groupBy?: unknown } }
    time?: { frameFailurePolicy?: unknown }
  } | null
  if (config?.ui?.time?.frameFailurePolicy === 'retain-last')
    report(
      '/ui/time/frameFailurePolicy',
      "frameFailurePolicy 'retain-last' was removed in 0.8.0; use 'pause' or 'skip'",
    )
  else if (config?.time?.frameFailurePolicy === 'retain-last')
    report(
      '/time/frameFailurePolicy',
      "frameFailurePolicy 'retain-last' was removed in 0.8.0; use 'pause' or 'skip'",
    )
  if (config?.ui?.layerPanel?.groupBy === 'role')
    report(
      '/ui/layerPanel/groupBy',
      "groupBy 'role' was removed in 0.9.0 with layer roles; use 'group' or 'none'",
    )
  return issues
}
