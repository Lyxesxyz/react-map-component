// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { MapUiConfig, MapUiProfileId, ResolvedMapUiConfig } from '../types'

// The UI profiles: what each part shows by default. `config.ui` is layered over one of them.

const full: ResolvedMapUiConfig = {
  profile: 'full',
  controls: {
    enabled: true,
    placement: 'top-right',
    groups: [
      { id: 'zoom', controls: ['zoom-in', 'zoom-out', 'reset-zoom'] },
      { id: 'location', controls: ['locate'] },
      { id: 'content', controls: ['layers'] },
      { id: 'fit', controls: ['fit'] },
      { id: 'more', controls: ['settings', 'fullscreen'] },
    ],
    zoomStep: 1,
    locate: { enableHighAccuracy: false, timeoutMs: 10_000, maximumAgeMs: 60_000, zoom: 6 },
    fitTarget: 'selection-or-data',
    fullscreenTarget: 'map',
  },
  settings: {
    enabled: true,
    placement: 'top-right',
    defaultOpen: false,
    fields: ['basemap', 'zoom-target', 'export'],
  },
  layerPanel: {
    enabled: true,
    placement: 'top-right',
    defaultOpen: false,
    allowVisibility: true,
    allowOpacity: true,
    allowReorder: true,
    showMetadata: true,
    groupBy: 'group',
    itemDetails: 'disclosure',
    defaultExpandedLayerIds: [],
    showSymbolPreview: true,
  },
  legend: { enabled: true, placement: 'bottom-left', defaultOpen: true, layout: 'list' },
  popup: { enabled: true, placement: 'top-left', closeOnMapClick: true, anchor: 'corner' },
  tooltip: { enabled: true, fields: ['name', 'title', 'label'] },
  disclaimer: { enabled: true, text: '', title: '', placement: 'bottom-left', defaultOpen: false },
  attribution: { enabled: true, placement: 'bottom-right', compact: true },
  statusChips: {
    enabled: true,
    placement: 'bottom-right',
    showLoading: true,
    showNoData: true,
    showScaleUnavailable: true,
  },
  errorAlert: { enabled: true, placement: 'top-left', dismissible: true },
  breadcrumbs: { enabled: true, placement: 'top-left' },
  time: {
    enabled: true,
    placement: 'bottom-left',
    speedsMs: [500, 900, 1500],
    defaultSpeedMs: 900,
    autoplay: false,
    loop: true,
    frameFailurePolicy: 'pause',
  },
}

const zoomOnly = { id: 'zoom', controls: ['zoom-in', 'zoom-out', 'reset-zoom'] } as const

/** What each profile changes from `full`, merged like `config.ui`. */
const profileOverrides: Record<MapUiProfileId, MapUiConfig> = {
  full: {},
  compact: {
    controls: {
      groups: [
        { ...zoomOnly, controls: [...zoomOnly.controls] },
        { id: 'content', controls: ['fit', 'layers'] },
        { id: 'more', controls: ['settings', 'fullscreen'] },
      ],
    },
  },
  embedded: {
    controls: {
      groups: [
        { ...zoomOnly, controls: [...zoomOnly.controls] },
        { id: 'more', controls: ['fullscreen'] },
      ],
    },
    settings: { enabled: false },
    layerPanel: { allowOpacity: false, allowReorder: false },
    time: { enabled: false },
  },
  grid: {
    controls: { groups: [{ ...zoomOnly, controls: [...zoomOnly.controls] }] },
    settings: { enabled: false },
    layerPanel: { enabled: false },
    legend: { enabled: false },
    popup: { enabled: false },
    statusChips: { enabled: false },
    errorAlert: { enabled: false },
    breadcrumbs: { enabled: false },
    time: { enabled: false },
  },
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `base` with `override` merged in: objects recursively, everything else (arrays too) replaced. */
function merge<T>(base: T, override: unknown): T {
  if (!isObject(base) || !isObject(override)) return (override === undefined ? base : override) as T
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override))
    if (value !== undefined) result[key] = merge(result[key], value)
  return result as T
}

/** `config.ui` with every default filled in from its profile. */
export function resolveMapUi(config: MapUiConfig = {}): ResolvedMapUiConfig {
  const profile = config.profile ?? 'full'
  return { ...merge(merge(full, profileOverrides[profile]), config), profile }
}
