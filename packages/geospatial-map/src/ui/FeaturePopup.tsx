import type { FeatureEvent, PopupContext } from '../types.js'
import { ShapeCard, ShapeIconButton } from './shapes.js'

export function FeaturePopup({
  selection,
  render,
  onClose,
}: {
  selection: FeatureEvent
  render?: ((context: PopupContext) => React.ReactNode) | undefined
  onClose: () => void
}) {
  return (
    <ShapeCard className="geo-popup" role="dialog" aria-label="Selected feature details">
      <ShapeIconButton label="Close feature details" onClick={onClose}>
        ×
      </ShapeIconButton>
      {render ? (
        render({ selection, close: onClose })
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
