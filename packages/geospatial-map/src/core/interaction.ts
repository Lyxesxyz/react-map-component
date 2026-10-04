// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { FeatureLike } from 'ol/Feature.js'
import type OlMap from 'ol/Map.js'
import type BaseLayer from 'ol/layer/Base.js'
import type { EventsKey } from 'ol/events.js'
import { createEmpty, extend, getCenter, getHeight, getWidth } from 'ol/extent.js'
import { unByKey } from 'ol/Observable.js'
import type { FeatureCandidate, FeatureEvent, MapInteractionConfig, MapSelection } from '../types'
import type { LayerRegistry } from './layer-registry'
import { sameSelection } from './layers/common'
import { ANIMATION_MS, safeToLonLat } from './projections'

// Pointer interaction with the map's features: click to select, hover, and clicking a cluster
// bubble to zoom in to its points.

const SELECT_HIT_TOLERANCE = 7
const HOVER_HIT_TOLERANCE = 3
const CLUSTER_PADDING = 56
const CLUSTER_ZOOM_STEP = 2

type Hit = { feature: FeatureLike; layer: BaseLayer }

export type InteractionHooks = {
  mapId: () => string
  config: () => MapInteractionConfig | undefined
  /** A click selected a feature, or cleared the selection (`null`). */
  select: (event: FeatureEvent | null) => void
  /** The pointer is over a feature, or no longer over one (`null`). Unset: no hover tracking. */
  hover: () => ((event: FeatureEvent | null) => void) | undefined
  /** A view animation started here ended. */
  moved: () => void
}

/** A feature event for `candidate` at a map coordinate. */
function featureEvent(
  map: OlMap,
  mapId: string,
  { layerId, featureId, properties }: FeatureCandidate,
  coordinate: number[],
): FeatureEvent {
  const lonLat = safeToLonLat(coordinate, map.getView().getProjection())
  return { layerId, featureId, mapId, coordinate: lonLat, properties }
}

/** A point on the feature for anchoring its popup: a polygon's interior, else its centre. */
function anchorOf(feature: FeatureLike): number[] | undefined {
  const geometry = feature.getGeometry() as
    | (ReturnType<FeatureLike['getGeometry']> & {
        getInteriorPoint?: () => { getCoordinates(): number[] }
        getInteriorPoints?: () => { getPoint(index: number): { getCoordinates(): number[] } }
      })
    | undefined
  if (!geometry) return undefined
  if (geometry.getInteriorPoint) return geometry.getInteriorPoint().getCoordinates().slice(0, 2)
  if (geometry.getInteriorPoints)
    return geometry.getInteriorPoints().getPoint(0).getCoordinates().slice(0, 2)
  return getCenter(geometry.getExtent())
}

export class MapInteractions {
  private readonly map: OlMap
  private readonly registry: LayerRegistry
  private readonly hooks: InteractionHooks
  private readonly keys: EventsKey[]
  private readonly stopPointerLeave: () => void
  private hoverFrame: number | undefined
  /** The last clicked feature: keeps the clicked point for the popup and the extent for tiles. */
  private lastSelected: { event: FeatureEvent; extent: number[] | undefined } | undefined

  constructor(map: OlMap, registry: LayerRegistry, hooks: InteractionHooks) {
    this.map = map
    this.registry = registry
    this.hooks = hooks
    const viewport = map.getViewport()
    const leave = () => this.clearHover()
    viewport.addEventListener('pointerleave', leave)
    this.stopPointerLeave = () => viewport.removeEventListener('pointerleave', leave)
    this.keys = [
      map.on('singleclick', (event) => {
        if (hooks.config()?.select !== false) this.selectAt(event.pixel, event.coordinate)
      }),
      map.on('pointermove', (event) => {
        if (hooks.config()?.hover === false) return
        // No hover while panning: the tooltip would chase the map.
        if (event.dragging) this.clearHover()
        else this.scheduleHover(event.pixel, event.coordinate)
      }),
    ]
  }

  /**
   * The feature event for a selection, wherever it came from (a click, the host's `state`, a
   * restored URL). `null` when the selected feature isn't loaded (yet).
   */
  describe(selection: MapSelection | null): FeatureEvent | null {
    if (!selection) return null
    const last = this.lastSelected?.event
    if (last && sameSelection(last, selection)) return last
    const feature = this.registry.getFeature(selection.layerId, selection.featureId)
    const anchor = feature && anchorOf(feature)
    const candidate = feature && this.registry.describe(selection.layerId, feature)
    if (!candidate || !anchor) return null
    return featureEvent(this.map, this.hooks.mapId(), candidate, anchor)
  }

  /** The selected feature's extent, from the loaded data or the last click. */
  selectionExtent(selection: MapSelection): number[] | undefined {
    const extent = this.registry
      .getFeature(selection.layerId, selection.featureId)
      ?.getGeometry()
      ?.getExtent()
    if (extent) return [...extent]
    const last = this.lastSelected
    return last && sameSelection(last.event, selection) ? last.extent : undefined
  }

  dispose(): void {
    this.clearHover(false)
    this.stopPointerLeave()
    unByKey(this.keys)
  }

  private hitsAt(pixel: number[], hitTolerance: number): Hit[] {
    const hits: Hit[] = []
    this.map.forEachFeatureAtPixel(
      pixel,
      (feature, layer) => {
        if (layer) hits.push({ feature, layer })
        return undefined
      },
      { hitTolerance },
    )
    return hits
  }

  private selectAt(pixel: number[], coordinate: number[]): void {
    const hits = this.hitsAt(pixel, this.hooks.config()?.selectHitTolerance ?? SELECT_HIT_TOLERANCE)
    const members = hits[0]?.feature.get('features') as FeatureLike[] | undefined
    if (Array.isArray(members) && members.length > 1) return this.expandCluster(members)
    const found = this.registry.candidates(hits)
    const top = found[0]
    if (!top) {
      this.lastSelected = undefined
      return this.hooks.select(null)
    }
    const event: FeatureEvent = {
      ...featureEvent(this.map, this.hooks.mapId(), top.candidate, coordinate),
      candidates: found.map((item) => item.candidate),
    }
    const extent = top.feature.getGeometry()?.getExtent()
    this.lastSelected = { event, extent: extent ? [...extent] : undefined }
    this.hooks.select(event)
  }

  /** Zooms in to the points of a clicked cluster bubble. */
  private expandCluster(members: FeatureLike[]): void {
    const extent = createEmpty()
    for (const member of members) {
      const geometry = member.getGeometry()
      if (geometry) extend(extent, geometry.getExtent())
    }
    const view = this.map.getView()
    const callback = () => this.hooks.moved()
    if (getWidth(extent) === 0 && getHeight(extent) === 0)
      view.animate(
        {
          center: getCenter(extent),
          zoom: (view.getZoom() ?? 0) + CLUSTER_ZOOM_STEP,
          duration: ANIMATION_MS,
        },
        callback,
      )
    else
      view.fit(extent, {
        padding: Array(4).fill(CLUSTER_PADDING),
        duration: ANIMATION_MS,
        callback,
      })
  }

  private scheduleHover(pixel: number[], coordinate: number[]): void {
    const hover = this.hooks.hover()
    if (!hover) return
    if (this.hoverFrame !== undefined) cancelAnimationFrame(this.hoverFrame)
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = undefined
      const hits = this.hitsAt(pixel, this.hooks.config()?.hoverHitTolerance ?? HOVER_HIT_TOLERANCE)
      const top = this.registry.candidates(hits)[0]
      hover(top ? featureEvent(this.map, this.hooks.mapId(), top.candidate, coordinate) : null)
    })
  }

  private clearHover(notify = true): void {
    if (this.hoverFrame !== undefined) cancelAnimationFrame(this.hoverFrame)
    this.hoverFrame = undefined
    if (notify) this.hooks.hover()?.(null)
  }
}
