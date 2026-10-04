// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type {
  ExportFormat,
  FeatureEvent,
  MapLayerConfig,
  MapSelection,
  MapState,
  SerializedMapState,
} from './types'
import { sameView } from './core/projections'

// Pure helpers that translate between the public `MapState` and the renderer. No React, no DOM.

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
    sameView(left.view, right.view) &&
    left.activeBasemapId === right.activeBasemapId &&
    left.time === right.time &&
    sameJson(left.selection, right.selection) &&
    sameJson(left.layers, right.layers)
  )
}

export function selectionFromEvent(event: FeatureEvent | null): MapSelection | null {
  if (!event) return null
  return {
    layerId: event.layerId,
    featureId: event.featureId,
    ...(event.boundarySetId ? { boundarySetId: event.boundarySetId } : {}),
    ...(event.geographyLevel ? { geographyLevel: event.geographyLevel } : {}),
  }
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

/** The public state from a renderer snapshot, keeping the style overrides of `previous`. */
export function stateFromSerialized(serialized: SerializedMapState, previous: MapState): MapState {
  return {
    view: serialized.view,
    ...(serialized.activeBasemapId ? { activeBasemapId: serialized.activeBasemapId } : {}),
    layers: Object.fromEntries(
      serialized.layers.map((item) => {
        const style = previous.layers[item.id]?.style
        return [
          item.id,
          {
            visible: item.visible,
            opacity: item.opacity,
            order: item.index,
            ...(style ? { style } : {}),
          },
        ]
      }),
    ),
    selection: serialized.selection ?? null,
    time: serialized.time ?? null,
  }
}

export type ExportExtension = 'png' | 'jpeg' | 'svg'

export function extensionForFormat(format: ExportFormat): ExportExtension {
  return format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpeg' : 'svg'
}

export function formatForExtension(extension: ExportExtension): ExportFormat {
  return extension === 'png' ? 'image/png' : extension === 'jpeg' ? 'image/jpeg' : 'image/svg+xml'
}
