'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { CloseIcon } from './icons'
import { useMap } from './map-context'
import { ShapeCard, ShapeIconButton } from './shapes'
import type { MapPlacement, MapSlotContext, PopupContext } from './types'
import { cn } from './utils'

export type MapPopupRenderContext = PopupContext & MapSlotContext

export type MapPopupProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  /** Corner of the map; defaults to `ui.popup.placement`. */
  placement?: MapPlacement
  /**
   * Popup content for the selected feature. A function receives the selection, a `close`
   * callback, the map state, and actions. Without children, the feature properties are listed.
   */
  children?: ReactNode | ((context: MapPopupRenderContext) => ReactNode)
}

/** Dialog shown while a feature is selected. Host content goes in `children`. */
export function MapPopup({ placement, className, children, ...props }: MapPopupProps) {
  const { ui, messages, actions, state, selectedFeature } = useMap()
  if (!selectedFeature) return null
  const close = actions.clearSelection
  const content =
    typeof children === 'function'
      ? children({ selection: selectedFeature, close, state, actions })
      : children
  return (
    <ShapeCard
      data-slot="map-popup"
      data-placement={placement ?? ui.popup.placement}
      role="dialog"
      aria-label={messages.selectedFeatureDetails}
      {...props}
      className={cn('geo-popup', className)}
    >
      <ShapeIconButton
        className="geo-popup-close"
        label={messages.closeFeatureDetails}
        onClick={close}
      >
        <CloseIcon aria-hidden="true" />
      </ShapeIconButton>
      {children !== undefined ? (
        content
      ) : (
        <>
          <h2 className="geo-popup-title">
            {String(selectedFeature.properties.name ?? selectedFeature.featureId)}
          </h2>
          <dl className="geo-popup-fields">
            {Object.entries(selectedFeature.properties).map(([key, value]) => (
              <div key={key} className="geo-popup-field">
                <dt className="geo-popup-field-name">{key}</dt>
                <dd className="geo-popup-field-value">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </ShapeCard>
  )
}
