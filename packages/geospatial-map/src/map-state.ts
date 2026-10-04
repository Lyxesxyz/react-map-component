// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type {
  ExportFormat,
  FeatureEvent,
  MapLayerConfig,
  MapPanelId,
  MapState,
  ResolvedMapUiConfig,
} from './types'
import { sameSelection } from './core/layers/common'
import { sameView } from './core/projections'

// Pure helpers for the public `MapState` and the parts. No React, no DOM.

export const fallbackState: MapState = {
  view: { center: [0, 15], zoom: 1.2, projection: 'EPSG:8857' },
  layers: {},
  selection: null,
  time: null,
}

export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function sameMapState(left: MapState, right: MapState): boolean {
  return (
    left === right ||
    (sameView(left.view, right.view) &&
      left.activeBasemapId === right.activeBasemapId &&
      left.time === right.time &&
      sameSelection(left.selection, right.selection) &&
      sameJson(left.layers, right.layers))
  )
}

/** The configured layers with visibility, opacity, order and style overrides from state. */
export function applyState(layers: MapLayerConfig[], state: MapState['layers']): MapLayerConfig[] {
  return layers
    .map((layer, sourceOrder) => {
      const runtime = state[layer.id]
      if (!runtime) return { layer, order: sourceOrder }
      const styled = runtime.style && 'style' in layer ? { ...layer, style: runtime.style } : layer
      return {
        layer: { ...styled, visible: runtime.visible, opacity: runtime.opacity },
        order: runtime.order,
      }
    })
    .sort((left, right) => left.order - right.order)
    .map((item) => item.layer)
}

/** The panel open when the map loads (`ui.layerPanel.defaultOpen`, `ui.settings.defaultOpen`). */
export function defaultOpenPanel(ui: ResolvedMapUiConfig): MapPanelId | null {
  if (ui.layerPanel.enabled && ui.layerPanel.defaultOpen) return 'layers'
  if (ui.settings.enabled && ui.settings.defaultOpen) return 'settings'
  return null
}

/**
 * A feature's name for people: the first of `fields` it has (`ui.tooltip.fields`: by default
 * `name`, `title`, `label`). The tooltip shows it; the popup title and announcements fall back
 * to the feature id.
 */
export function featureLabel(feature: FeatureEvent, fields: readonly string[]): string | undefined {
  for (const field of fields) {
    const value = feature.properties[field]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return undefined
}

/** The file extension of an export format. */
export const fileExtension: Record<ExportFormat, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
}
