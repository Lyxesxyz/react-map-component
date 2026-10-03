import { useEffect, useMemo, useState } from 'react'
import type {
  LayerPanelConfig,
  LayerStatus,
  MapLayerConfig,
  MapMessages,
  MapSlotContext,
  MapSlots,
  NormalizedLegend,
  SerializedMapState,
} from '../types'
import { ChevronDown, ChevronRight, ChevronUp, X } from 'lucide-react'
import { formatMapMessage } from '../messages'
import { LegendMark } from './MapLegend'
import { ShapeBadge, ShapeCard, ShapeIconButton, ShapeSlider, ShapeSwitch } from '../shapes'

type LayerItem = {
  layer: MapLayerConfig
  runtime: SerializedMapState['layers'][number] | undefined
  status: LayerStatus | undefined
  legend: NormalizedLegend | undefined
}

function safeId(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9_-]/g, '-')
}

export function LayerPanel({
  layers,
  state,
  statuses,
  legends,
  config,
  messages,
  slotContext,
  slots,
  onVisibility,
  onOpacity,
  onMove,
  onClose,
}: {
  layers: MapLayerConfig[]
  state: SerializedMapState['layers']
  statuses: LayerStatus[]
  legends: NormalizedLegend[]
  config: Required<LayerPanelConfig>
  messages: MapMessages
  slotContext: MapSlotContext
  slots?: MapSlots
  onVisibility: (id: string, visible: boolean) => void
  onOpacity: (id: string, opacity: number) => void
  onMove: (id: string, direction: -1 | 1) => void
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(() => new Set(config.defaultExpandedLayerIds))

  useEffect(() => {
    setExpanded(new Set(config.defaultExpandedLayerIds))
  }, [config.defaultExpandedLayerIds])

  const items = useMemo<LayerItem[]>(() => {
    const stateById = new Map(state.map((item) => [item.id, item]))
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
  }, [layers, legends, state, statuses])

  const groups = useMemo(() => {
    const result: Array<{ id: string; label?: string; items: LayerItem[] }> = []
    for (const item of items) {
      const label =
        config.groupBy === 'group'
          ? (item.layer.group ?? messages.otherLayers)
          : config.groupBy === 'role'
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
  }, [config.groupBy, items, messages.otherLayers])

  const visibleCount = items.filter(
    ({ layer, runtime }) => runtime?.visible ?? layer.visible ?? true,
  ).length

  return (
    <ShapeCard
      className="geo-layer-panel"
      data-placement={config.placement}
      aria-label={messages.mapLayers}
    >
      {slots?.panelHeader?.('layers', slotContext) ?? (
        <header className="geo-layer-panel-header">
          <div>
            <span className="geo-panel-kicker">{messages.mapContent}</span>
            <h2>{messages.layers}</h2>
            <span className="geo-layer-count">
              {formatMapMessage(messages.layersVisible, {
                visible: visibleCount,
                total: items.length,
              })}
            </span>
          </div>
          <ShapeIconButton label={messages.closeLayers} onClick={onClose}>
            <X aria-hidden="true" />
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
                  <h3>{group.label}</h3>
                  {exclusive && <span>{messages.oneLayerAtATime}</span>}
                </div>
              )}
              <ul>
                {group.items.map(({ layer, runtime, status, legend }) => {
                  const visible = runtime?.visible ?? layer.visible ?? true
                  const opacity = runtime?.opacity ?? layer.opacity ?? 1
                  const isExpanded = config.itemDetails === 'always' || expanded.has(layer.id)
                  const detailsId = `geo-layer-options-${safeId(layer.id)}`
                  const sourceIndex = layers.findIndex((item) => item.id === layer.id)
                  const mapIndex = runtime?.index ?? sourceIndex
                  const layerAtOrder = (order: number) =>
                    layers.find(
                      (candidate, candidateIndex) =>
                        (state.find((item) => item.id === candidate.id)?.index ??
                          candidateIndex) === order,
                    )
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
                    <li key={layer.id} data-visible={visible}>
                      <div className="geo-layer-row">
                        {config.showSymbolPreview && preview && (
                          <span className="geo-layer-preview">
                            <LegendMark entry={preview} idPrefix={`layer-${safeId(layer.id)}`} />
                          </span>
                        )}
                        <span className="geo-layer-copy">
                          <strong>{layer.title}</strong>
                          <span>
                            {layer.role} · {layer.kind.toUpperCase()}
                            {statusLabel ? ` · ${statusLabel}` : ''}
                          </span>
                        </span>
                        {config.allowVisibility && (
                          <span className="geo-layer-visibility">
                            <ShapeSwitch
                              label={`${layer.title} · ${layer.role}`}
                              checked={visible}
                              disabled={layer.required}
                              onChange={(event) =>
                                onVisibility(layer.id, event.currentTarget.checked)
                              }
                            />
                          </span>
                        )}
                        {config.itemDetails === 'disclosure' && (
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
                              <ChevronDown aria-hidden="true" />
                            ) : (
                              <ChevronRight aria-hidden="true" />
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
                          {config.showMetadata && (
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
                          {config.allowOpacity && (
                            <label className="geo-opacity-label">
                              <span>
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
                                  onOpacity(layer.id, Number(event.currentTarget.value))
                                }
                              />
                            </label>
                          )}
                          {config.allowReorder && layer.reorderable && !layer.orderLocked && (
                            <span className="geo-order-buttons">
                              <ShapeIconButton
                                label={formatMapMessage(messages.moveLayerUp, {
                                  layer: layer.title,
                                })}
                                disabled={!canMoveUp}
                                onClick={() => onMove(layer.id, 1)}
                              >
                                <ChevronUp aria-hidden="true" />
                              </ShapeIconButton>
                              <ShapeIconButton
                                label={formatMapMessage(messages.moveLayerDown, {
                                  layer: layer.title,
                                })}
                                disabled={!canMoveDown}
                                onClick={() => onMove(layer.id, -1)}
                              >
                                <ChevronDown aria-hidden="true" />
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
      {slots?.panelFooter?.('layers', slotContext)}
    </ShapeCard>
  )
}
