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

// Pure helpers that translate between the public `MapState` and the renderer. No React, no DOM.

export const fallbackState: MapState = {
  view: { center: [0, 15], zoom: 1.2, projection: 'EPSG:8857', minZoom: 0, maxZoom: 20 },
  layers: {},
  selection: null,
  time: null,
}

export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function sameMapState(left: MapState, right: MapState): boolean {
  const close = (a: number | undefined, b: number | undefined) =>
    Math.abs((a ?? 0) - (b ?? 0)) < 1e-7
  return (
    close(left.view.center[0], right.view.center[0]) &&
    close(left.view.center[1], right.view.center[1]) &&
    close(left.view.zoom, right.view.zoom) &&
    close(left.view.rotation, right.view.rotation) &&
    left.view.projection === right.view.projection &&
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

/** Applies visibility, opacity, order, and style overrides from state to configured layers. */
export function applyState(layers: MapLayerConfig[], state: MapState): MapLayerConfig[] {
  return layers
    .map((layer, sourceOrder) => {
      const runtime = state.layers[layer.id]
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

/** Converts a renderer snapshot back into public state, preserving style overrides. */
export function stateFromSerialized(
  serialized: SerializedMapState,
  layers: MapLayerConfig[],
  previous: MapState,
): MapState {
  return {
    view: serialized.view,
    ...(serialized.activeBasemapId ? { activeBasemapId: serialized.activeBasemapId } : {}),
    layers: Object.fromEntries(
      serialized.layers.map((item) => {
        const source = layers.find((layer) => layer.id === item.id)
        const style =
          previous.layers[item.id]?.style ??
          (source && 'style' in source ? source.style : undefined)
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

/** Layer runtime rows before the renderer has mounted (server render and first paint). */
export function initialLayerState(
  layers: MapLayerConfig[],
  state: MapState,
): SerializedMapState['layers'] {
  return layers.map((layer, index) => ({
    id: layer.id,
    visible: state.layers[layer.id]?.visible ?? layer.visible ?? true,
    opacity: state.layers[layer.id]?.opacity ?? layer.opacity ?? 1,
    index,
  }))
}

export type ExportExtension = 'png' | 'jpeg' | 'svg'

export function extensionForFormat(format: ExportFormat): ExportExtension {
  return format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpeg' : 'svg'
}

export function formatForExtension(extension: ExportExtension): ExportFormat {
  return extension === 'png' ? 'image/png' : extension === 'jpeg' ? 'image/jpeg' : 'image/svg+xml'
}

const featureArrayIds = new WeakMap<object, number>()
let nextFeatureArrayId = 0

/**
 * Content key for a configuration, so a config rebuilt on every render (for example written
 * inline in a component) is recognized as unchanged. Inline GeoJSON `features` arrays are keyed
 * by identity instead of being serialized, which keeps this cheap for large datasets.
 */
export function configFingerprint(config: unknown): string {
  return JSON.stringify(config, (key, value: unknown) => {
    if ((key !== 'features' && key !== 'rows') || !Array.isArray(value)) return value
    let id = featureArrayIds.get(value)
    if (id === undefined) {
      id = ++nextFeatureArrayId
      featureArrayIds.set(value, id)
    }
    return `#features-${id}`
  })
}
