// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { ConfigIssue } from '../types'

// Fields renamed or removed in 0.8.0. A configuration stored as JSON before then fails
// validation with a message saying what to write instead, not "unknown property".

const VERSION = '0.8.0'

type Rename = { from: string; to?: string; note?: string }

/** Renamed and removed fields, by object: a path pattern (`*` for any key or index). */
const changes: Array<{ at: string; fields: Rename[] }> = [
  { at: '', fields: [{ from: 'time', to: 'ui.time' }] },
  {
    at: 'ui',
    fields: [
      { from: 'controlRail', to: 'ui.controls' },
      { from: 'layers', to: 'ui.layerPanel' },
      { from: 'hierarchy', to: 'ui.breadcrumbs' },
      { from: 'errors', to: 'ui.errorAlert' },
      { from: 'status', to: 'ui.statusChips' },
    ],
  },
  { at: 'accessibility', fields: [{ from: 'keyboard', to: 'view.interactions.keyboard' }] },
  {
    at: 'time',
    fields: [{ from: 'reducedMotion', to: 'accessibility.reducedMotion' }],
  },
  {
    at: 'initialState/view',
    fields: [
      { from: 'minZoom', to: 'view.minZoom' },
      { from: 'maxZoom', to: 'view.maxZoom' },
    ],
  },
  {
    at: 'theme',
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
  ...['data/layers/*', 'data/basemaps/*/layers/*'].map((at) => ({
    at,
    fields: [
      { from: 'urlTemplate', to: 'url' },
      { from: 'dataProjection', to: 'sourceProjection' },
      { from: 'orderLocked', note: 'use `reorderable: false`' },
      { from: 'tiled', note: 'WMS layers are always tiled' },
      { from: 'sourceLayer', note: 'it had no effect' },
      { from: 'styleUrl', to: 'mapboxStyle.url' },
      { from: 'styleLayers', to: 'mapboxStyle.layers' },
      { from: 'styleOverrides', to: 'mapboxStyle.overrides' },
      { from: 'projection', to: 'sourceProjectionDefinition' },
    ],
  })),
  ...['data/layers/*/legend', 'data/basemaps/*/layers/*/legend'].map((at) => ({
    at,
    fields: [
      { from: 'presentation', note: 'the legend draws each symbol at its own size' },
      { from: 'showLayerToggle', note: 'show and hide layers from the layer panel' },
    ],
  })),
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
  for (const { at, fields } of changes)
    for (const [path, object] of objectsAt(input, at))
      for (const { from, to, note } of fields) {
        if (!(from in object)) continue
        // Only ArcGIS layers had a `projection`.
        if (from === 'projection' && object.kind !== 'arcgis-vector-tiles') continue
        const name = path ? `${path.slice(1).replaceAll('/', '.')}.${from}` : from
        issues.push({
          path: `${path}/${from}`,
          code: 'renamed',
          message: to
            ? `${name} was renamed to ${to} in ${VERSION}`
            : `${name} was removed in ${VERSION}${note ? `: ${note}` : ''}`,
        })
      }
  const policy = (input as { ui?: { time?: { frameFailurePolicy?: unknown } } } | null)?.ui?.time
    ?.frameFailurePolicy
  const oldPolicy = (input as { time?: { frameFailurePolicy?: unknown } } | null)?.time
    ?.frameFailurePolicy
  if (policy === 'retain-last' || oldPolicy === 'retain-last')
    issues.push({
      path: policy === 'retain-last' ? '/ui/time/frameFailurePolicy' : '/time/frameFailurePolicy',
      code: 'renamed',
      message: `frameFailurePolicy 'retain-last' was removed in ${VERSION}; use 'pause' or 'skip'`,
    })
  return issues
}
