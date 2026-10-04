'use client'

import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMap, useMapStatic, usePanelOpen } from './map-context'
import { extensionForFormat, formatForExtension } from './map-state'
import type { ExportExtension } from './map-state'
import { ShapeCard, ShapeIconButton, ShapeLabel, ShapeSelect } from './shapes'
import type { ExportFormat, MapPlacement, SettingsFieldId } from './types'
import { cn } from './utils'

export type MapSettingsProps = ComponentPropsWithoutRef<'div'> & {
  /** Corner of the map; defaults to `ui.settings.placement`. */
  placement?: MapPlacement
  /** Open state, when you control it; defaults to the settings button's. */
  open?: boolean
  /** Called when the panel asks to open or close (its close button, a chosen area). */
  onOpenChange?: (open: boolean) => void
  /** Fields rendered when there are no children; defaults to `ui.settings.fields`. */
  fields?: SettingsFieldId[]
  /** Replaces the default header (title and close button). */
  header?: ReactNode
  /** Rendered after the fields. */
  footer?: ReactNode
}

/** Basemap, area, and export settings, opened from the settings button. */
export const MapSettings = forwardRef<HTMLDivElement, MapSettingsProps>(function MapSettings(
  { placement, open, onOpenChange, fields, header, footer, className, children, ...props },
  ref,
) {
  const { ui, messages, icons } = useMapStatic()
  const [isOpen, setOpen] = usePanelOpen('settings', open, onOpenChange)
  if (!isOpen) return null
  const close = () => setOpen(false)
  return (
    <ShapeCard
      ref={ref}
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

export function MapBasemapField({ className, ...props }: FieldProps) {
  const { config, state, messages, actions } = useMap()
  const compatible = config.data.basemaps.filter((item) =>
    item.supportedProjections.includes(state.view.projection),
  )
  // Nothing to choose: users only ever switch between basemaps in the map's projection.
  if (compatible.length < 2) return null
  return (
    <ShapeLabel {...props} className={cn('geo-settings-field', className)}>
      <span className="geo-settings-field-label">{messages.basemap}</span>
      <ShapeSelect
        aria-label={messages.basemap}
        value={state.activeBasemapId ?? ''}
        onChange={(event) => actions.setBasemap(event.currentTarget.value)}
      >
        {compatible.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
            {item.network ? ` · ${messages.network}` : ''}
          </option>
        ))}
      </ShapeSelect>
    </ShapeLabel>
  )
}

export function MapZoomTargetField({
  onSelect,
  className,
  ...props
}: FieldProps & { onSelect?: (targetId: string) => void }) {
  const { config, messages, actions } = useMap()
  const targets = config.data.zoomTargets ?? []
  if (!targets.length) return null
  return (
    <ShapeLabel {...props} className={cn('geo-settings-field', className)}>
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
}

const allFormats: ExportFormat[] = ['image/png', 'image/jpeg', 'image/svg+xml']
const formatLabels: Record<ExportFormat, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/svg+xml': 'SVG',
}

export function MapExportField({
  formats,
  defaultFormat,
  className,
  ...props
}: FieldProps & { formats?: ExportFormat[]; defaultFormat?: ExportFormat }) {
  const { config, messages, actions } = useMap()
  const exportConfig = config.export ?? {}
  if (exportConfig.enabled === false) return null
  const configured = formats ?? exportConfig.formats ?? allFormats
  const preferred = defaultFormat ?? exportConfig.defaultFormat
  const ordered = preferred
    ? [preferred, ...configured.filter((format) => format !== preferred)]
    : configured
  return (
    <ShapeLabel {...props} className={cn('geo-settings-field', className)}>
      <span className="geo-settings-field-label">{messages.download}</span>
      <ShapeSelect
        aria-label={messages.exportMap}
        defaultValue=""
        onChange={(event) => {
          const value = event.currentTarget.value as ExportExtension | ''
          if (value) void actions.downloadImage(formatForExtension(value))
          event.currentTarget.value = ''
        }}
      >
        <option value="" disabled>
          {messages.exportReportImage}
        </option>
        {ordered.map((format) => (
          <option key={format} value={extensionForFormat(format)}>
            {formatLabels[format]}
          </option>
        ))}
      </ShapeSelect>
    </ShapeLabel>
  )
}
