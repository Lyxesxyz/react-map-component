'use client'

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import type { ComponentPropsWithoutRef, CSSProperties } from 'react'
import { defaultMapIcons } from './icons'
import { MapRuntimeContext, MapStaticContext } from './map-context'
import { mapThemeStyle } from './theme'
import type { GeospatialMapHandle, MapCallbacks, MapRootProps } from './types'
import { useMapEngine } from './use-map-engine'
import { cn } from './utils'

type SectionProps = Omit<ComponentPropsWithoutRef<'section'>, keyof MapCallbacks | 'children'>

/** Every prop that configures the map rather than its `<section>` (checked by the type). */
const mapProps: Record<Exclude<keyof MapRootProps, keyof SectionProps>, true> = {
  config: true,
  state: true,
  onStateChange: true,
  children: true,
  fill: true,
  icons: true,
  loadGeoJson: true,
  onOpenLayersMap: true,
  validate: true,
  renderConfigError: true,
  onReady: true,
  onViewChange: true,
  onFeatureHover: true,
  onFeatureSelect: true,
  onLayerStateChange: true,
  onProjectionChange: true,
  onTimeChange: true,
  onError: true,
  onStatusChange: true,
  onMetric: true,
}

/** The props that belong on the `<section>` (`id`, `aria-*`, `data-*`, handlers…). */
function htmlProps(props: MapRootProps): SectionProps {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => !(key in mapProps)),
  ) as SectionProps
}

/**
 * The map frame. Renders the OpenLayers viewport and provides map state to its children, so
 * you can compose exactly the controls and panels you need:
 *
 * ```tsx
 * <MapRoot config={config}>
 *   <MapControls />
 *   <MapLegend />
 * </MapRoot>
 * ```
 *
 * The `ref` gives the map's actions (`fit`, `exportImage`, `getState`, …).
 */
export const MapRoot = forwardRef<GeospatialMapHandle, MapRootProps>(function MapRoot(props, ref) {
  const { renderConfigError, icons, fill, children, className, style } = props
  const sectionProps = htmlProps(props)
  const rootRef = useRef<HTMLElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)
  const engine = useMapEngine({ props, rootRef, targetRef })
  const { actions, theme } = engine
  useImperativeHandle(ref, () => actions, [actions])

  const rootStyle = useMemo(
    () => ({ ...mapThemeStyle(theme), ...style }) as CSSProperties,
    [style, theme],
  )
  const staticValue = useMemo(
    () =>
      engine.staticValue && {
        ...engine.staticValue,
        icons: icons ? { ...defaultMapIcons, ...icons } : defaultMapIcons,
      },
    [engine.staticValue, icons],
  )

  if (!staticValue) {
    const error = engine.configError
    return (
      <section
        data-slot="map"
        data-status="error"
        {...sectionProps}
        className={cn('geo-map-root', className)}
        style={rootStyle}
      >
        <div className="geo-config-error" data-slot="map-config-error" role="alert">
          {error &&
            (renderConfigError?.(error, { state: engine.runtime.state, actions }) ?? (
              <>
                <h2 className="geo-config-error-title">{engine.messages.invalidConfiguration}</h2>
                <p className="geo-config-error-message">{error.message}</p>
              </>
            ))}
        </div>
      </section>
    )
  }

  return (
    <MapStaticContext.Provider value={staticValue}>
      <MapRuntimeContext.Provider value={engine.runtime}>
        <section
          ref={rootRef}
          data-slot="map"
          data-map-id={engine.mapId}
          data-density={theme?.density ?? 'comfortable'}
          data-fill={fill ? '' : undefined}
          data-status={engine.mapStatus}
          data-layer-errors={engine.layerErrors || undefined}
          {...sectionProps}
          className={cn('geo-map-root', className)}
          style={rootStyle}
        >
          <div className="geo-map-stage" data-slot="map-stage">
            <div ref={targetRef} className="geo-map-viewport" data-slot="map-viewport" />
            {children}
          </div>
          <span className="geo-sr-only" aria-live="polite">
            {engine.liveMessage}
          </span>
        </section>
      </MapRuntimeContext.Provider>
    </MapStaticContext.Provider>
  )
})
