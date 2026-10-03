'use client'

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import type { CSSProperties, HTMLAttributes } from 'react'
import { MapRuntimeContext, MapStaticContext } from './map-context'
import { mapThemeStyle } from './theme'
import type { GeospatialMapHandle, MapCallbacks, MapRootProps } from './types'
import { useMapEngine } from './use-map-engine'
import { cn } from './utils'

const callbackKeys = [
  'onReady',
  'onViewChange',
  'onFeatureHover',
  'onFeatureSelect',
  'onLayerStateChange',
  'onSymbologyChange',
  'onProjectionChange',
  'onTimeChange',
  'onError',
  'onStatusChange',
  'onMetric',
] as const satisfies ReadonlyArray<keyof MapCallbacks>

// Compile-time guard: adding a callback to `MapCallbacks` without listing it above fails here.
type MissingCallbackKeys = Exclude<keyof MapCallbacks, (typeof callbackKeys)[number]>
const allCallbacksListed: MissingCallbackKeys extends never ? true : MissingCallbackKeys = true
void allCallbacksListed

const mapOnlyKeys = [
  ...callbackKeys,
  'config',
  'state',
  'onStateChange',
  'validate',
  'renderConfigError',
  'children',
  'className',
  'style',
] as const

/** The props of `<MapRoot>` that belong on its `<section>` element. */
function sectionProps(props: MapRootProps): HTMLAttributes<HTMLElement> {
  const result: Record<string, unknown> = { ...props }
  for (const key of mapOnlyKeys) delete result[key]
  return result
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
 */
export const MapRoot = forwardRef<GeospatialMapHandle, MapRootProps>(function MapRoot(props, ref) {
  const rootRef = useRef<HTMLElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)
  const engine = useMapEngine({ props, rootRef, targetRef })
  const { api } = engine

  useImperativeHandle(
    ref,
    () => ({
      fit: api.fit,
      fitSelection: api.fitSelection,
      exportImage: api.exportImage,
      getState: api.getState,
    }),
    [api],
  )

  const { renderConfigError, children, className, style } = props
  const theme = engine.config?.theme
  const rootStyle = useMemo(
    () => ({ ...mapThemeStyle(theme), ...style }) as CSSProperties,
    [style, theme],
  )
  const density = theme?.density ?? 'comfortable'

  if (!engine.staticValue) {
    const error = engine.configError
    return (
      <section
        data-slot="map"
        {...sectionProps(props)}
        className={cn('geo-map-root', className)}
        style={rootStyle}
      >
        <div className="geo-config-error" data-slot="map-config-error" role="alert">
          {error &&
            (renderConfigError?.(error, { state: engine.runtime.state, actions: api }) ?? (
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
    <MapStaticContext.Provider value={engine.staticValue}>
      <MapRuntimeContext.Provider value={engine.runtime}>
        <section
          ref={rootRef}
          data-slot="map"
          data-map-id={engine.mapId}
          data-density={density}
          {...sectionProps(props)}
          className={cn('geo-map-root', `geo-density-${density}`, className)}
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
