'use client'

import { useRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useAnchoredPosition } from './map-anchor'
import { useMap, useMapIcons, useMapPixel } from './map-context'
import { ShapeCard, ShapeIconButton } from './shapes'
import type { MapPlacement, MapSlotContext, PopupContext } from './types'
import { cn } from './utils'

export type MapPopupRenderContext = PopupContext & MapSlotContext

export type MapPopupProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  /** Corner of the map; defaults to `ui.popup.placement`. */
  placement?: MapPlacement
  /**
   * `'feature'` opens the popup next to the clicked point and keeps it there while the map
   * moves; `'corner'` uses `placement`. Defaults to `ui.popup.anchor` (`'corner'`).
   */
  anchor?: 'corner' | 'feature'
  /**
   * Popup content for the selected feature. A function receives the selection, a `close`
   * callback, the map state, and actions. Without children, the feature properties are listed.
   */
  children?: ReactNode | ((context: MapPopupRenderContext) => ReactNode)
}

/** Dialog shown while a feature is selected. Host content goes in `children`. */
export function MapPopup({ placement, anchor, className, children, ...props }: MapPopupProps) {
  const { ui, messages, actions, state, selectedFeature } = useMap()
  const icons = useMapIcons()
  const anchored = (anchor ?? ui.popup.anchor) === 'feature'
  const ref = useRef<HTMLDivElement>(null)
  const pixel = useMapPixel(anchored ? selectedFeature?.coordinate : null)
  useAnchoredPosition(ref, anchored ? pixel : undefined, 14)
  if (!selectedFeature) return null
  const close = actions.clearSelection
  const content =
    typeof children === 'function'
      ? children({ selection: selectedFeature, close, state, actions })
      : children
  return (
    <ShapeCard
      ref={ref}
      data-slot="map-popup"
      data-placement={placement ?? ui.popup.placement}
      data-anchor={anchored ? 'feature' : 'corner'}
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
        <icons.Close aria-hidden="true" />
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
