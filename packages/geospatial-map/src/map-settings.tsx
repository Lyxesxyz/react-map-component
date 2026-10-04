'use client'

import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMapRuntime, useMapStatic } from './map-context'
import { ShapeCard, ShapeIconButton, ShapeLabel, ShapeSelect } from './shapes'
import type { ExportFormat, MapPlacement, SettingsFieldId } from './types'
import { cn } from './utils'

export type MapSettingsProps = ComponentPropsWithoutRef<'div'> & {
  /** Corner of the map; defaults to `ui.settings.placement`. */
  placement?: MapPlacement
  /** Fields rendered when there are no children; defaults to `ui.settings.fields`. */
  fields?: SettingsFieldId[]
  /** Replaces the default header (title and close button). */
  header?: ReactNode
  /** Rendered after the fields. */
  footer?: ReactNode
}

/**
 * Basemap, area, and export settings, shown while the map's open panel is `'settings'` (the
 * settings button, `actions.setOpenPanel`, or `openPanel` on the root).
 */
export const MapSettings = forwardRef<HTMLDivElement, MapSettingsProps>(function MapSettings(
  { placement, fields, header, footer, className, children, ...props },
  ref,
) {
  const { ui, messages, actions, icons } = useMapStatic()
  const open = useMapRuntime((map) => map.openPanel === 'settings')
  if (!open) return null
  const close = () => actions.setOpenPanel(null)
  return (
    <ShapeCard
      ref={ref}
      role="region"
      data-slot="map-settings"
      data-placement={placement ?? ui.settings.placement}
      aria-label={messages.mapSettings}
      {...props}
      className={cn('geo-map-settings', className)}
    >
      {header ?? (
        <header className="geo-panel-header">
          <div className="geo-panel-heading">
            <span className="geo-panel-kicker">{messages.mapOptions}</span>
            <h2 className="geo-panel-title">{messages.viewAndOutput}</h2>
          </div>
          <ShapeIconButton label={messages.closeSettings} onClick={close}>
            <icons.Close aria-hidden="true" />
          </ShapeIconButton>
        </header>
      )}
      <div className="geo-settings-fields">
        {children ??
          (fields ?? ui.settings.fields).map((field) => {
            if (field === 'basemap') return <MapBasemapField key={field} />
            if (field === 'zoom-target') return <MapZoomTargetField key={field} onSelect={close} />
            if (field === 'export') return <MapExportField key={field} />
            return null
          })}
      </div>
      {footer}
    </ShapeCard>
  )
})

type FieldProps = Omit<ComponentPropsWithoutRef<'label'>, 'onSelect'>

/** Picks the basemap, among those in the map's projection. Renders nothing with fewer than two. */
export const MapBasemapField = forwardRef<HTMLLabelElement, FieldProps>(function MapBasemapField(
  { className, ...props },
  ref,
) {
  const { config, messages, actions } = useMapStatic()
  const activeBasemapId = useMapRuntime((map) => map.state.activeBasemapId)
  const projection = config.initialState.view.projection
  const compatible = config.data.basemaps.filter((item) =>
    item.supportedProjections.includes(projection),
  )
  if (compatible.length < 2) return null
  return (
    <ShapeLabel ref={ref} {...props} className={cn('geo-settings-field', className)}>
      <span className="geo-settings-field-label">{messages.basemap}</span>
      <ShapeSelect
        aria-label={messages.basemap}
        value={activeBasemapId ?? ''}
        onChange={(event) => actions.setBasemap(event.currentTarget.value)}
      >
        {compatible.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </ShapeSelect>
    </ShapeLabel>
  )
})

/** Zooms to one of `config.data.zoomTargets`. Renders nothing without targets. */
export const MapZoomTargetField = forwardRef<
  HTMLLabelElement,
  FieldProps & { onSelect?: (targetId: string) => void }
>(function MapZoomTargetField({ onSelect, className, ...props }, ref) {
  const { config, messages, actions } = useMapStatic()
  const targets = config.data.zoomTargets ?? []
  if (!targets.length) return null
  return (
    <ShapeLabel ref={ref} {...props} className={cn('geo-settings-field', className)}>
      <span className="geo-settings-field-label">{messages.goToArea}</span>
      <ShapeSelect
        aria-label={messages.zoomToArea}
        defaultValue=""
        onChange={(event) => {
          const id = event.currentTarget.value
          actions.fitZoomTarget(id)
          onSelect?.(id)
        }}
      >
        <option value="" disabled>
          {messages.chooseArea}
        </option>
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            {target.label}
          </option>
        ))}
      </ShapeSelect>
    </ShapeLabel>
  )
})

const allFormats: ExportFormat[] = ['image/png', 'image/jpeg', 'image/svg+xml']
const formatLabels: Record<ExportFormat, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/svg+xml': 'SVG',
}

/** Downloads the map as a report image, in the formats `config.export` allows. */
export const MapExportField = forwardRef<
  HTMLLabelElement,
  FieldProps & { formats?: ExportFormat[]; defaultFormat?: ExportFormat }
>(function MapExportField({ formats, defaultFormat, className, ...props }, ref) {
  const { config, messages, actions } = useMapStatic()
  const exportConfig = config.export ?? {}
  if (exportConfig.enabled === false) return null
  const configured = formats ?? exportConfig.formats ?? allFormats
  const preferred = defaultFormat ?? exportConfig.defaultFormat
  const ordered = preferred
    ? [preferred, ...configured.filter((format) => format !== preferred)]
    : configured
  return (
    <ShapeLabel ref={ref} {...props} className={cn('geo-settings-field', className)}>
      <span className="geo-settings-field-label">{messages.download}</span>
      <ShapeSelect
        aria-label={messages.exportMap}
        defaultValue=""
        onChange={(event) => {
          const format = event.currentTarget.value as ExportFormat | ''
          if (format) void actions.downloadImage(format)
          event.currentTarget.value = ''
        }}
      >
        <option value="" disabled>
          {messages.exportReportImage}
        </option>
        {ordered.map((format) => (
          <option key={format} value={format}>
            {formatLabels[format]}
          </option>
        ))}
      </ShapeSelect>
    </ShapeLabel>
  )
})
