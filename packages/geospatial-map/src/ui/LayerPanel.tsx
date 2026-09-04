import type { LayerStatus, MapLayerConfig, SerializedMapState } from '../types.js'
import { ShapeBadge, ShapeCard, ShapeIconButton, ShapeSlider, ShapeSwitch } from './shapes.js'

export function LayerPanel({
  layers,
  state,
  statuses,
  onVisibility,
  onOpacity,
  onMove,
  onClose,
}: {
  layers: MapLayerConfig[]
  state: SerializedMapState['layers']
  statuses: LayerStatus[]
  onVisibility: (id: string, visible: boolean) => void
  onOpacity: (id: string, opacity: number) => void
  onMove: (id: string, direction: -1 | 1) => void
  onClose: () => void
}) {
  return (
    <ShapeCard className="geo-layer-panel" aria-label="Map layers">
      <header>
        <h2>Layers</h2>
        <ShapeIconButton label="Close layer panel" onClick={onClose}>
          ×
        </ShapeIconButton>
      </header>
      <ul>
        {layers.map((layer, index) => {
          if (layer.showInLayerControl === false) return null
          const runtime = state.find((item) => item.id === layer.id)
          const status = statuses.find((item) => item.id === layer.id)
          const visible = runtime?.visible ?? layer.visible ?? true
          const opacity = runtime?.opacity ?? layer.opacity ?? 1
          return (
            <li key={layer.id}>
              <ShapeSwitch
                label={`${layer.title} · ${layer.role}`}
                checked={visible}
                disabled={layer.required || status?.scaleUnavailable}
                onChange={(event) => onVisibility(layer.id, event.currentTarget.checked)}
              />
              <span className="geo-layer-metadata">
                <ShapeBadge>{layer.role}</ShapeBadge>
                {layer.group && <ShapeBadge>{layer.group}</ShapeBadge>}
                {layer.exclusiveGroup && <ShapeBadge>choose one</ShapeBadge>}
                {status?.scaleUnavailable && <ShapeBadge>unavailable at this scale</ShapeBadge>}
                {status?.noData && <ShapeBadge>no data for time</ShapeBadge>}
                {status?.error && <ShapeBadge>source error</ShapeBadge>}
              </span>
              <label className="geo-opacity-label">
                <span>Opacity {Math.round(opacity * 100)}%</span>
                <ShapeSlider
                  aria-label={`${layer.title} opacity`}
                  min="0"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(event) => onOpacity(layer.id, Number(event.currentTarget.value))}
                />
              </label>
              {layer.reorderable && !layer.orderLocked && (
                <span className="geo-order-buttons">
                  <ShapeIconButton
                    label={`Move ${layer.title} up`}
                    disabled={
                      index === layers.length - 1 || Boolean(layers[index + 1]?.orderLocked)
                    }
                    onClick={() => onMove(layer.id, 1)}
                  >
                    ↑
                  </ShapeIconButton>
                  <ShapeIconButton
                    label={`Move ${layer.title} down`}
                    disabled={index === 0 || Boolean(layers[index - 1]?.orderLocked)}
                    onClick={() => onMove(layer.id, -1)}
                  >
                    ↓
                  </ShapeIconButton>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </ShapeCard>
  )
}
