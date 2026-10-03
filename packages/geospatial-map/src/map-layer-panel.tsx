'use client'

import { useId, useMemo, useState } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { CloseIcon, CollapseIcon, ExpandIcon, MoveDownIcon, MoveUpIcon } from './icons'
import { useMap } from './map-context'
import { MapLegendSymbol } from './map-legend'
import { formatMapMessage } from './messages'
import { ShapeBadge, ShapeCard, ShapeIconButton, ShapeSlider, ShapeSwitch } from './shapes'
import type {
  LayerPanelConfig,
  LayerStatus,
  MapLayerConfig,
  MapPlacement,
  NormalizedLegend,
  SerializedMapState,
} from './types'
import { cn, safeId, withDefaults } from './utils'

type LayerItem = {
  layer: MapLayerConfig
  runtime: SerializedMapState['layers'][number] | undefined
  status: LayerStatus | undefined
  legend: NormalizedLegend | undefined
}

type LayerPanelOptions = Required<
  Pick<
    LayerPanelConfig,
    | 'allowVisibility'
    | 'allowOpacity'
    | 'allowReorder'
    | 'showMetadata'
    | 'groupBy'
    | 'itemDetails'
    | 'defaultExpandedLayerIds'
    | 'showSymbolPreview'
  >
>

export type MapLayerPanelProps = ComponentPropsWithoutRef<'div'> &
  Partial<LayerPanelOptions> & {
    /** Corner of the map; defaults to `ui.layers.placement`. */
    placement?: MapPlacement
    /** Force the panel open or closed; defaults to the layers button state. */
    open?: boolean
    /** Replaces the default header (title, count, and close button). */
    header?: ReactNode
    /** Rendered after the layer list. */
    footer?: ReactNode
  }

/** Layer visibility, opacity, order, and status panel. Behavior defaults come from `ui.layers`. */
export function MapLayerPanel({ open, ...props }: MapLayerPanelProps) {
  const { panels } = useMap()
  // Mounting only while open resets expanded rows each time the panel is reopened.
  return (open ?? panels.layers) ? <LayerPanelContent {...props} /> : null
}

function LayerPanelContent({
  placement,
  header,
  footer,
  allowVisibility,
  allowOpacity,
  allowReorder,
  showMetadata,
  groupBy,
  itemDetails,
  defaultExpandedLayerIds,
  showSymbolPreview,
  className,
  ...props
}: Omit<MapLayerPanelProps, 'open'>) {
  const { ui, messages, actions, layers, layerState, statuses, legends } = useMap()
  const options = withDefaults<LayerPanelOptions>(ui.layers, {
    allowVisibility,
    allowOpacity,
    allowReorder,
    showMetadata,
    groupBy,
    itemDetails,
    defaultExpandedLayerIds,
    showSymbolPreview,
  })
  const idPrefix = safeId(useId())

  const expandedDefaultsKey = JSON.stringify(options.defaultExpandedLayerIds)
  const [expanded, setExpanded] = useState(() => new Set(options.defaultExpandedLayerIds))
  const [expandedSource, setExpandedSource] = useState(expandedDefaultsKey)
  if (expandedSource !== expandedDefaultsKey) {
    setExpandedSource(expandedDefaultsKey)
    setExpanded(new Set(options.defaultExpandedLayerIds))
  }

  const items = useMemo<LayerItem[]>(() => {
    const stateById = new Map(layerState.map((item) => [item.id, item]))
    const statusById = new Map(statuses.map((item) => [item.id, item]))
    const legendById = new Map(legends.map((item) => [item.layerId, item]))
    return layers
      .filter((layer) => layer.showInLayerControl !== false)
      .map((layer, sourceIndex) => ({
        layer,
        runtime: stateById.get(layer.id),
        status: statusById.get(layer.id),
        legend: legendById.get(layer.id),
        order: stateById.get(layer.id)?.index ?? sourceIndex,
      }))
      .sort((left, right) => right.order - left.order)
  }, [layers, legends, layerState, statuses])

  const groups = useMemo(() => {
    const result: Array<{ id: string; label?: string; items: LayerItem[] }> = []
    for (const item of items) {
      const label =
        options.groupBy === 'group'
          ? (item.layer.group ?? messages.otherLayers)
          : options.groupBy === 'role'
            ? item.layer.role
            : undefined
      const previous = result.at(-1)
      if (previous && previous.label === label) previous.items.push(item)
      else
        result.push({
          id: `${label ?? 'all'}-${result.length}`,
          ...(label ? { label } : {}),
          items: [item],
        })
    }
    return result
  }, [options.groupBy, items, messages.otherLayers])

  const visibleCount = items.filter(
    ({ layer, runtime }) => runtime?.visible ?? layer.visible ?? true,
  ).length
  const layerAtOrder = (order: number) =>
    layers.find(
      (candidate, candidateIndex) =>
        (layerState.find((item) => item.id === candidate.id)?.index ?? candidateIndex) === order,
    )

  return (
    <ShapeCard
      data-slot="map-layer-panel"
      data-placement={placement ?? ui.layers.placement}
      aria-label={messages.mapLayers}
      {...props}
      className={cn('geo-layer-panel', className)}
    >
      {header ?? (
        <header className="geo-panel-header geo-layer-panel-header">
          <div className="geo-panel-heading">
            <span className="geo-panel-kicker">{messages.mapContent}</span>
            <h2 className="geo-panel-title">{messages.layers}</h2>
            <span className="geo-layer-count">
              {formatMapMessage(messages.layersVisible, {
                visible: visibleCount,
                total: items.length,
              })}
            </span>
          </div>
          <ShapeIconButton
            label={messages.closeLayers}
            onClick={() => actions.setPanelOpen('layers', false)}
          >
            <CloseIcon aria-hidden="true" />
          </ShapeIconButton>
        </header>
      )}
      <div className="geo-layer-groups">
        {groups.map((group) => {
          const exclusive = group.items.some((item) => item.layer.exclusiveGroup)
          return (
            <section className="geo-layer-group" key={group.id}>
              {group.label && (
                <div className="geo-layer-group-heading">
                  <h3 className="geo-layer-group-title">{group.label}</h3>
                  {exclusive && (
                    <span className="geo-layer-group-note">{messages.oneLayerAtATime}</span>
                  )}
                </div>
              )}
              <ul className="geo-layer-list">
                {group.items.map(({ layer, runtime, status, legend }) => {
                  const visible = runtime?.visible ?? layer.visible ?? true
                  const opacity = runtime?.opacity ?? layer.opacity ?? 1
                  const isExpanded = options.itemDetails === 'always' || expanded.has(layer.id)
                  const detailsId = `${idPrefix}-layer-options-${safeId(layer.id)}`
                  const sourceIndex = layers.findIndex((item) => item.id === layer.id)
                  const mapIndex = runtime?.index ?? sourceIndex
                  const canMoveUp =
                    mapIndex < layers.length - 1 && !layerAtOrder(mapIndex + 1)?.orderLocked
                  const canMoveDown = mapIndex > 0 && !layerAtOrder(mapIndex - 1)?.orderLocked
                  const preview = legend?.entries[0]
                  const statusLabel = status?.error
                    ? messages.sourceError
                    : status?.noData
                      ? messages.noDataForTime
                      : status?.scaleUnavailable
                        ? messages.unavailableAtScale
                        : undefined
                  return (
                    <li key={layer.id} className="geo-layer-item" data-visible={visible}>
                      <div className="geo-layer-row">
                        {options.showSymbolPreview && preview && (
                          <span className="geo-layer-preview">
                            <MapLegendSymbol entry={preview} />
                          </span>
                        )}
                        <span className="geo-layer-copy">
                          <strong className="geo-layer-title">{layer.title}</strong>
                          <span className="geo-layer-meta">
                            {layer.role} · {layer.kind.toUpperCase()}
                            {statusLabel ? ` · ${statusLabel}` : ''}
                          </span>
                        </span>
                        {options.allowVisibility && (
                          <span className="geo-layer-visibility">
                            <ShapeSwitch
                              label={`${layer.title} · ${layer.role}`}
                              checked={visible}
                              disabled={layer.required}
                              onChange={(event) =>
                                actions.setLayerVisibility(layer.id, event.currentTarget.checked)
                              }
                            />
                          </span>
                        )}
                        {options.itemDetails === 'disclosure' && (
                          <ShapeIconButton
                            className="geo-layer-disclosure"
                            label={formatMapMessage(
                              isExpanded ? messages.hideLayerOptions : messages.showLayerOptions,
                              { layer: layer.title },
                            )}
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() =>
                              setExpanded((current) => {
                                const next = new Set(current)
                                if (next.has(layer.id)) next.delete(layer.id)
                                else next.add(layer.id)
                                return next
                              })
                            }
                          >
                            {isExpanded ? (
                              <CollapseIcon aria-hidden="true" />
                            ) : (
                              <ExpandIcon aria-hidden="true" />
                            )}
                          </ShapeIconButton>
                        )}
                      </div>
                      {isExpanded && (
                        <div
                          className="geo-layer-details"
                          id={detailsId}
                          role="group"
                          aria-label={formatMapMessage(messages.layerOptions, {
                            layer: layer.title,
                          })}
                        >
                          {options.showMetadata && (
                            <span className="geo-layer-metadata">
                              <ShapeBadge>{layer.role}</ShapeBadge>
                              <ShapeBadge>{layer.kind.toUpperCase()}</ShapeBadge>
                              {layer.exclusiveGroup && (
                                <ShapeBadge>{messages.chooseOne}</ShapeBadge>
                              )}
                              {status?.scaleUnavailable && (
                                <ShapeBadge>{messages.unavailableAtScale}</ShapeBadge>
                              )}
                              {status?.noData && <ShapeBadge>{messages.noDataForTime}</ShapeBadge>}
                              {status?.error && <ShapeBadge>{messages.sourceError}</ShapeBadge>}
                            </span>
                          )}
                          {options.allowOpacity && (
                            <label className="geo-opacity-label">
                              <span className="geo-opacity-value">
                                {formatMapMessage(messages.opacity, {
                                  value: Math.round(opacity * 100),
                                })}
                              </span>
                              <ShapeSlider
                                aria-label={`${layer.title} ${messages.opacity.replace(' {value}%', '').toLowerCase()}`}
                                min="0"
                                max="1"
                                step="0.05"
                                value={opacity}
                                onChange={(event) =>
                                  actions.setLayerOpacity(
                                    layer.id,
                                    Number(event.currentTarget.value),
                                  )
                                }
                              />
                            </label>
                          )}
                          {options.allowReorder && layer.reorderable && !layer.orderLocked && (
                            <span className="geo-order-buttons">
                              <ShapeIconButton
                                label={formatMapMessage(messages.moveLayerUp, {
                                  layer: layer.title,
                                })}
                                disabled={!canMoveUp}
                                onClick={() => actions.reorderLayer(layer.id, 1)}
                              >
                                <MoveUpIcon aria-hidden="true" />
                              </ShapeIconButton>
                              <ShapeIconButton
                                label={formatMapMessage(messages.moveLayerDown, {
                                  layer: layer.title,
                                })}
                                disabled={!canMoveDown}
                                onClick={() => actions.reorderLayer(layer.id, -1)}
                              >
                                <MoveDownIcon aria-hidden="true" />
                              </ShapeIconButton>
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
      {footer}
    </ShapeCard>
  )
}
