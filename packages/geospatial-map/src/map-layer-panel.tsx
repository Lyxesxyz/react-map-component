'use client'

import { forwardRef, useId, useMemo } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { canReorder } from './core/layer-order'
import { useResettableState } from './hooks'
import { useMap, useMapIcons, useMapRuntime } from './map-context'
import { MapLegendSymbol } from './map-legend'
import { formatMapMessage, layerStatusLabel } from './messages'
import { ShapeBadge, ShapeCard, ShapeIconButton, ShapeSlider, ShapeSwitch } from './shapes'
import type {
  LayerPanelConfig,
  LayerStatus,
  MapActions,
  MapLayerConfig,
  MapMessages,
  MapPlacement,
  NormalizedLegend,
} from './types'
import { cn, safeId } from './utils'

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
    /** Corner of the map; defaults to `ui.layerPanel.placement`. */
    placement?: MapPlacement
    /** Replaces the default header (title, count, and close button). */
    header?: ReactNode
    /** Rendered after the layer list. */
    footer?: ReactNode
  }

/**
 * Layer visibility, opacity, order, and status, shown while the map's open panel is `'layers'`
 * (the layers button, `actions.setOpenPanel`, or `openPanel` on the root). Behaviour defaults
 * come from `ui.layerPanel`.
 */
export const MapLayerPanel = forwardRef<HTMLDivElement, MapLayerPanelProps>(
  function MapLayerPanel(props, ref) {
    const open = useMapRuntime((map) => map.openPanel === 'layers')
    // Mounting only while open resets expanded rows each time the panel is reopened.
    return open ? <LayerPanelContent ref={ref} {...props} /> : null
  },
)

type LayerItem = {
  layer: MapLayerConfig
  /** Position in drawing order (0 at the bottom). */
  order: number
  status: LayerStatus | undefined
  legend: NormalizedLegend | undefined
}

const LayerPanelContent = forwardRef<HTMLDivElement, MapLayerPanelProps>(function LayerPanelContent(
  {
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
  },
  ref,
) {
  const { ui, messages, actions, layers, statuses, legends } = useMap()
  const icons = useMapIcons()
  const options: LayerPanelOptions = {
    allowVisibility: allowVisibility ?? ui.layerPanel.allowVisibility,
    allowOpacity: allowOpacity ?? ui.layerPanel.allowOpacity,
    allowReorder: allowReorder ?? ui.layerPanel.allowReorder,
    showMetadata: showMetadata ?? ui.layerPanel.showMetadata,
    groupBy: groupBy ?? ui.layerPanel.groupBy,
    itemDetails: itemDetails ?? ui.layerPanel.itemDetails,
    defaultExpandedLayerIds: defaultExpandedLayerIds ?? ui.layerPanel.defaultExpandedLayerIds,
    showSymbolPreview: showSymbolPreview ?? ui.layerPanel.showSymbolPreview,
  }
  const close = () => actions.setOpenPanel(null)
  const idPrefix = safeId(useId())
  const [expanded, setExpanded] = useResettableState(
    JSON.stringify(options.defaultExpandedLayerIds),
    () => new Set(options.defaultExpandedLayerIds),
  )

  // `layers` is in drawing order; the panel lists the top layer first.
  const items = useMemo<LayerItem[]>(() => {
    const statusById = new Map(statuses.map((item) => [item.id, item]))
    const legendById = new Map(legends.map((item) => [item.layerId, item]))
    return layers
      .map((layer, order) => ({
        layer,
        order,
        status: statusById.get(layer.id),
        legend: legendById.get(layer.id),
      }))
      .filter((item) => item.layer.showInLayerControl !== false)
      .reverse()
  }, [layers, legends, statuses])

  const groups = useMemo(() => {
    const result: Array<{ id: string; label?: string; items: LayerItem[] }> = []
    for (const item of items) {
      const label =
        options.groupBy === 'group' ? (item.layer.group ?? messages.otherLayers) : undefined
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

  const visibleCount = items.filter(({ layer }) => layer.visible ?? true).length
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ShapeCard
      ref={ref}
      role="region"
      data-slot="map-layer-panel"
      data-placement={placement ?? ui.layerPanel.placement}
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
          <ShapeIconButton label={messages.closeLayers} onClick={close}>
            <icons.Close aria-hidden="true" />
          </ShapeIconButton>
        </header>
      )}
      <div className="geo-layer-groups">
        {groups.map((group) => (
          <section className="geo-layer-group" key={group.id}>
            {group.label && (
              <div className="geo-layer-group-heading">
                <h3 className="geo-layer-group-title">{group.label}</h3>
                {group.items.some((item) => item.layer.exclusiveGroup) && (
                  <span className="geo-layer-group-note">{messages.oneLayerAtATime}</span>
                )}
              </div>
            )}
            <ul className="geo-layer-list">
              {group.items.map((item) => {
                const expandedNow = options.itemDetails === 'always' || expanded.has(item.layer.id)
                const detailsId = `${idPrefix}-layer-options-${safeId(item.layer.id)}`
                return (
                  <li
                    key={item.layer.id}
                    className="geo-layer-item"
                    data-visible={item.layer.visible ?? true}
                  >
                    <LayerRow
                      item={item}
                      options={options}
                      expanded={expandedNow}
                      detailsId={detailsId}
                      onToggle={() => toggle(item.layer.id)}
                      messages={messages}
                      actions={actions}
                    />
                    {expandedNow && (
                      <LayerDetails
                        id={detailsId}
                        item={item}
                        options={options}
                        canMoveUp={canReorder(layers, item.order, 1)}
                        canMoveDown={canReorder(layers, item.order, -1)}
                        messages={messages}
                        actions={actions}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {footer}
    </ShapeCard>
  )
})

type RowProps = {
  item: LayerItem
  options: LayerPanelOptions
  messages: MapMessages
  actions: MapActions
}

/** A layer's symbol, title, status, visibility switch and disclosure button. */
function LayerRow({
  item: { layer, status, legend },
  options,
  expanded,
  detailsId,
  onToggle,
  messages,
  actions,
}: RowProps & { expanded: boolean; detailsId: string; onToggle: () => void }) {
  const icons = useMapIcons()
  const preview = legend?.entries[0]
  const statusLabel = layerStatusLabel(status, messages)
  return (
    <div className="geo-layer-row">
      {options.showSymbolPreview && preview && (
        <span className="geo-layer-preview">
          <MapLegendSymbol entry={preview} />
        </span>
      )}
      <span className="geo-layer-copy">
        <strong className="geo-layer-title">{layer.title}</strong>
        <span className="geo-layer-meta">
          {layer.kind.toUpperCase()}
          {statusLabel ? ` · ${statusLabel}` : ''}
        </span>
      </span>
      {options.allowVisibility && (
        <span className="geo-layer-visibility">
          <ShapeSwitch
            label={layer.title}
            checked={layer.visible ?? true}
            disabled={layer.required}
            onChange={(event) => actions.setLayerVisibility(layer.id, event.currentTarget.checked)}
          />
        </span>
      )}
      {options.itemDetails === 'disclosure' && (
        <ShapeIconButton
          className="geo-layer-disclosure"
          label={formatMapMessage(
            expanded ? messages.hideLayerOptions : messages.showLayerOptions,
            {
              layer: layer.title,
            },
          )}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={onToggle}
        >
          {expanded ? <icons.Collapse aria-hidden="true" /> : <icons.Expand aria-hidden="true" />}
        </ShapeIconButton>
      )}
    </div>
  )
}

/** A layer's badges, opacity slider and move buttons. */
function LayerDetails({
  id,
  item: { layer, status },
  options,
  canMoveUp,
  canMoveDown,
  messages,
  actions,
}: RowProps & { id: string; canMoveUp: boolean; canMoveDown: boolean }) {
  const icons = useMapIcons()
  const opacity = layer.opacity ?? 1
  const statusLabel = layerStatusLabel(status, messages)
  return (
    <div
      className="geo-layer-details"
      id={id}
      role="group"
      aria-label={formatMapMessage(messages.layerOptions, { layer: layer.title })}
    >
      {options.showMetadata && (
        <span className="geo-layer-metadata">
          <ShapeBadge>{layer.kind.toUpperCase()}</ShapeBadge>
          {layer.exclusiveGroup && <ShapeBadge>{messages.chooseOne}</ShapeBadge>}
          {statusLabel && <ShapeBadge>{statusLabel}</ShapeBadge>}
        </span>
      )}
      {options.allowOpacity && (
        <label className="geo-opacity-label">
          <span className="geo-opacity-value">
            {formatMapMessage(messages.opacity, { value: Math.round(opacity * 100) })}
          </span>
          <ShapeSlider
            aria-label={formatMapMessage(messages.layerOpacity, { layer: layer.title })}
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) =>
              actions.setLayerOpacity(layer.id, Number(event.currentTarget.value))
            }
          />
        </label>
      )}
      {options.allowReorder && layer.reorderable !== false && (
        <span className="geo-order-buttons">
          <ShapeIconButton
            label={formatMapMessage(messages.moveLayerUp, { layer: layer.title })}
            disabled={!canMoveUp}
            onClick={() => actions.reorderLayer(layer.id, 1)}
          >
            <icons.MoveUp aria-hidden="true" />
          </ShapeIconButton>
          <ShapeIconButton
            label={formatMapMessage(messages.moveLayerDown, { layer: layer.title })}
            disabled={!canMoveDown}
            onClick={() => actions.reorderLayer(layer.id, -1)}
          >
            <icons.MoveDown aria-hidden="true" />
          </ShapeIconButton>
        </span>
      )}
    </div>
  )
}
