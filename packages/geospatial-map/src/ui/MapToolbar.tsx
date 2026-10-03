import { useState } from 'react'
import type {
  BasemapConfig,
  ControlRailConfig,
  ExportConfig,
  ExportFormat,
  LonLat,
  MapMessages,
  MapSlotContext,
  MapSlots,
  MapViewState,
  ProjectionId,
  SettingsPanelConfig,
  ZoomTarget,
} from '../types'
import {
  Focus,
  Layers3,
  LoaderCircle,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  Scan,
  Settings2,
  X,
} from 'lucide-react'
import { ShapeCard, ShapeIconButton, ShapeLabel, ShapeSelect } from '../shapes'

const extensionFor = (format: ExportFormat) =>
  format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpeg' : 'svg'

export function MapToolbar({
  view,
  basemaps,
  activeBasemapId,
  targets,
  layersOpen,
  layersEnabled,
  settingsOpen,
  rail,
  settings,
  exportConfig,
  messages,
  hasSelection,
  slotContext,
  slots,
  onProjection,
  onBasemap,
  onZoom,
  initialZoom,
  onResetZoom,
  onLocate,
  onLocationError,
  onTarget,
  onFit,
  onLayers,
  onExport,
  onFullscreen,
  onSettings,
}: {
  view: MapViewState
  basemaps: BasemapConfig[]
  activeBasemapId: string
  targets: ZoomTarget[]
  layersOpen: boolean
  layersEnabled: boolean
  settingsOpen: boolean
  rail: Required<ControlRailConfig>
  settings: Required<SettingsPanelConfig>
  exportConfig: ExportConfig
  messages: MapMessages
  hasSelection: boolean
  slotContext: MapSlotContext
  slots?: MapSlots
  onProjection: (projection: ProjectionId) => void
  onBasemap: (id: string) => void
  onZoom: (delta: number) => void
  onResetZoom: () => void
  initialZoom: number
  onLocate: (coordinate: LonLat) => void
  onLocationError: (message: string) => void
  onTarget: (id: string) => void
  onFit: () => void
  onLayers: () => void
  onExport: (format: 'png' | 'jpeg' | 'svg') => void
  onFullscreen: () => void
  onSettings: (open: boolean) => void
}) {
  const [locating, setLocating] = useState(false)
  const compatible = basemaps.filter((item) => item.supportedProjections.includes(view.projection))
  const fields = settings.enabled ? settings.fields : []

  const locate = () => {
    if (!navigator.geolocation) return onLocationError(messages.locationUnavailable)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onLocate([coords.longitude, coords.latitude])
        setLocating(false)
      },
      () => {
        onLocationError(messages.locationDenied)
        setLocating(false)
      },
      {
        ...(rail.locate.enableHighAccuracy !== undefined
          ? { enableHighAccuracy: rail.locate.enableHighAccuracy }
          : {}),
        ...(rail.locate.timeoutMs !== undefined ? { timeout: rail.locate.timeoutMs } : {}),
        ...(rail.locate.maximumAgeMs !== undefined ? { maximumAge: rail.locate.maximumAgeMs } : {}),
      },
    )
  }

  const renderControl = (id: string) => {
    if (id.startsWith('custom:')) {
      const render = slots?.controls?.[id as `custom:${string}`]
      return render ? (
        <div key={id} className="geo-custom-control">
          {render(slotContext)}
        </div>
      ) : null
    }
    if (id === 'zoom-in')
      return (
        <ShapeIconButton key={id} label={messages.zoomIn} onClick={() => onZoom(rail.zoomStep)}>
          <Plus aria-hidden="true" />
        </ShapeIconButton>
      )
    if (id === 'zoom-out')
      return (
        <ShapeIconButton key={id} label={messages.zoomOut} onClick={() => onZoom(-rail.zoomStep)}>
          <Minus aria-hidden="true" />
        </ShapeIconButton>
      )
    if (id === 'reset-zoom')
      return (
        <ShapeIconButton
          key={id}
          label={messages.resetZoom}
          disabled={Math.abs(view.zoom - initialZoom) < 1e-6}
          onClick={onResetZoom}
        >
          <Scan aria-hidden="true" />
        </ShapeIconButton>
      )
    if (id === 'locate')
      return (
        <ShapeIconButton
          key={id}
          label={messages.findLocation}
          disabled={locating}
          onClick={locate}
        >
          {locating ? (
            <LoaderCircle className="geo-spin" aria-hidden="true" />
          ) : (
            <LocateFixed aria-hidden="true" />
          )}
        </ShapeIconButton>
      )
    if (id === 'layers' && layersEnabled)
      return (
        <ShapeIconButton
          key={id}
          label={messages.layers}
          className={layersOpen ? 'geo-control-active' : ''}
          aria-expanded={layersOpen}
          onClick={onLayers}
        >
          <Layers3 aria-hidden="true" />
        </ShapeIconButton>
      )
    if (id === 'fit') {
      if (rail.fitTarget === 'selection' && !hasSelection) return null
      return (
        <ShapeIconButton
          key={id}
          label={hasSelection ? messages.fitSelection : messages.fitData}
          onClick={onFit}
        >
          <Focus aria-hidden="true" />
        </ShapeIconButton>
      )
    }
    if (id === 'settings') {
      if (!settings.enabled || !fields.length) return null
      return (
        <ShapeIconButton
          key={id}
          label={messages.mapSettings}
          className={settingsOpen ? 'geo-control-active' : ''}
          aria-expanded={settingsOpen}
          onClick={() => onSettings(!settingsOpen)}
        >
          <Settings2 aria-hidden="true" />
        </ShapeIconButton>
      )
    }
    if (id === 'fullscreen')
      return (
        <ShapeIconButton key={id} label={messages.fullscreen} onClick={onFullscreen}>
          <Maximize2 aria-hidden="true" />
        </ShapeIconButton>
      )
    return null
  }

  return (
    <>
      {rail.enabled && (
        <div
          className="geo-map-controls"
          data-placement={rail.placement}
          aria-label={messages.mapControls}
        >
          {rail.groups.map((group) => {
            const controls = group.controls.map(renderControl).filter(Boolean)
            return controls.length ? (
              <div className="geo-control-group" data-control-group={group.id} key={group.id}>
                {controls}
              </div>
            ) : null
          })}
        </div>
      )}
      {settings.enabled && settingsOpen && (
        <ShapeCard
          className="geo-map-settings"
          data-placement={settings.placement}
          aria-label={messages.mapSettings}
        >
          {slots?.panelHeader?.('settings', slotContext) ?? (
            <header>
              <div>
                <span className="geo-panel-kicker">{messages.mapOptions}</span>
                <h2>{messages.viewAndOutput}</h2>
              </div>
              <ShapeIconButton label={messages.closeSettings} onClick={() => onSettings(false)}>
                <X aria-hidden="true" />
              </ShapeIconButton>
            </header>
          )}
          <div className="geo-settings-fields">
            {fields.map((field) => {
              if (field === 'projection')
                return (
                  <ShapeLabel key={field}>
                    <span>{messages.projection}</span>
                    <ShapeSelect
                      aria-label={messages.projection}
                      value={view.projection}
                      onChange={(event) => onProjection(event.currentTarget.value as ProjectionId)}
                    >
                      <option value="EPSG:8857">{messages.equalEarth}</option>
                      <option value="ESRI:EQUAL-EARTH-CM11">{messages.equalEarthArcgis}</option>
                      <option value="EPSG:3857">{messages.mercator}</option>
                    </ShapeSelect>
                  </ShapeLabel>
                )
              if (field === 'basemap')
                return (
                  <ShapeLabel key={field}>
                    <span>{messages.basemap}</span>
                    <ShapeSelect
                      aria-label={messages.basemap}
                      value={activeBasemapId}
                      onChange={(event) => onBasemap(event.currentTarget.value)}
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
              if (field === 'zoom-target' && targets.length)
                return (
                  <ShapeLabel key={field}>
                    <span>{messages.goToArea}</span>
                    <ShapeSelect
                      aria-label={messages.zoomToArea}
                      defaultValue=""
                      onChange={(event) => {
                        onTarget(event.currentTarget.value)
                        onSettings(false)
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
              if (field === 'export' && exportConfig.enabled !== false) {
                const configuredFormats = exportConfig.formats ?? [
                  'image/png',
                  'image/jpeg',
                  'image/svg+xml',
                ]
                const formats = exportConfig.defaultFormat
                  ? [
                      exportConfig.defaultFormat,
                      ...configuredFormats.filter(
                        (format) => format !== exportConfig.defaultFormat,
                      ),
                    ]
                  : configuredFormats
                return (
                  <ShapeLabel key={field}>
                    <span>{messages.download}</span>
                    <ShapeSelect
                      aria-label={messages.exportMap}
                      defaultValue=""
                      onChange={(event) => {
                        if (event.currentTarget.value)
                          onExport(event.currentTarget.value as 'png' | 'jpeg' | 'svg')
                        event.currentTarget.value = ''
                      }}
                    >
                      <option value="" disabled>
                        {messages.exportReportImage}
                      </option>
                      {formats.map((format) => (
                        <option key={format} value={extensionFor(format)}>
                          {format === 'image/png'
                            ? 'PNG'
                            : format === 'image/jpeg'
                              ? 'JPEG'
                              : 'SVG'}
                        </option>
                      ))}
                    </ShapeSelect>
                  </ShapeLabel>
                )
              }
              return null
            })}
          </div>
          {slots?.panelFooter?.('settings', slotContext)}
        </ShapeCard>
      )}
    </>
  )
}
