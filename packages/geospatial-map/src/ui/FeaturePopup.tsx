import type { FeatureEvent, MapMessages, MapPlacement, MapSlotContext, MapSlots } from '../types'
import { X } from 'lucide-react'
import { ShapeCard, ShapeIconButton } from '../shapes'

export function FeaturePopup({
  selection,
  slots,
  slotContext,
  messages,
  placement,
  onClose,
}: {
  selection: FeatureEvent
  slots?: MapSlots
  slotContext: MapSlotContext
  messages: MapMessages
  placement: MapPlacement
  onClose: () => void
}) {
  return (
    <ShapeCard
      className="geo-popup"
      data-placement={placement}
      role="dialog"
      aria-label={messages.selectedFeatureDetails}
    >
      <ShapeIconButton label={messages.closeFeatureDetails} onClick={onClose}>
        <X aria-hidden="true" />
      </ShapeIconButton>
      {slots?.popup ? (
        slots.popup({ selection, close: onClose, ...slotContext })
      ) : (
        <>
          <h2>{String(selection.properties.name ?? selection.featureId)}</h2>
          <dl>
            {Object.entries(selection.properties).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </ShapeCard>
  )
}
