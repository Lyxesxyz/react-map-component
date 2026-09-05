import { useState } from 'react'
import type { BasemapConfig, LonLat, MapViewState, ProjectionId, ZoomTarget } from '../types.js'
import {
  Compass,
  Focus,
  Layers3,
  LoaderCircle,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  Settings2,
  X,
} from 'lucide-react'
import { ShapeCard, ShapeIconButton, ShapeLabel, ShapeSelect } from './shapes.js'

export function MapToolbar({
  view,
  basemaps,
  activeBasemapId,
  targets,
  layersOpen,
  showLayers,
  showProjection,
  showBasemap,
  showZoom,
  showCompass,
  showLocate,
  showFit,
  showExport,
  showFullscreen,
  hasSelection,
  onProjection,
  onBasemap,
  onZoom,
  onResetRotation,
  onLocate,
  onLocationError,
  onTarget,
  onFitSelection,
  onLayers,
  onExport,
  onFullscreen,
  onSettingsOpen,
}: {
  view: MapViewState
  basemaps: BasemapConfig[]
  activeBasemapId: string
  targets: ZoomTarget[]
  layersOpen: boolean
  showLayers: boolean
  showProjection: boolean
  showBasemap: boolean
  showZoom: boolean
  showCompass: boolean
  showLocate: boolean
  showFit: boolean
  showExport: boolean
  showFullscreen: boolean
  hasSelection: boolean
  onProjection: (projection: ProjectionId) => void
  onBasemap: (id: string) => void
  onZoom: (delta: number) => void
  onResetRotation: () => void
  onLocate: (coordinate: LonLat) => void
  onLocationError: (message: string) => void
  onTarget: (id: string) => void
  onFitSelection: () => void
  onLayers: () => void
  onExport: (format: 'png' | 'jpeg' | 'svg') => void
  onFullscreen: () => void
  onSettingsOpen: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const compatible = basemaps.filter((item) => item.supportedProjections.includes(view.projection))
  const hasSettings = showProjection || showBasemap || (showFit && targets.length > 0) || showExport

  const locate = () => {
    if (!navigator.geolocation) {
      onLocationError('Location is not available in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onLocate([coords.longitude, coords.latitude])
        setLocating(false)
      },
      () => {
        onLocationError('Your location could not be retrieved. Check browser permissions.')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <>
      <div className="geo-map-controls" aria-label="Map controls">
        {showZoom && (
          <div className="geo-control-group">
            <ShapeIconButton label="Zoom in" onClick={() => onZoom(1)}>
              <Plus aria-hidden="true" />
            </ShapeIconButton>
            <ShapeIconButton label="Zoom out" onClick={() => onZoom(-1)}>
              <Minus aria-hidden="true" />
            </ShapeIconButton>
          </div>
        )}
        {showCompass && (
          <div className="geo-control-group">
            <ShapeIconButton label="Reset map rotation" onClick={onResetRotation}>
              <Compass
                aria-hidden="true"
                style={{ transform: `rotate(${-((view.rotation ?? 0) * 180) / Math.PI}deg)` }}
              />
            </ShapeIconButton>
          </div>
        )}
        {showLocate && (
          <div className="geo-control-group">
            <ShapeIconButton label="Find my location" disabled={locating} onClick={locate}>
              {locating ? (
                <LoaderCircle className="geo-spin" aria-hidden="true" />
              ) : (
                <LocateFixed aria-hidden="true" />
              )}
            </ShapeIconButton>
          </div>
        )}
        {showLayers && (
          <div className="geo-control-group">
            <ShapeIconButton
              label="Layers"
              className={layersOpen ? 'geo-control-active' : ''}
              aria-expanded={layersOpen}
              onClick={() => {
                setSettingsOpen(false)
                onLayers()
              }}
            >
              <Layers3 aria-hidden="true" />
            </ShapeIconButton>
          </div>
        )}
        {showFit && hasSelection && (
          <div className="geo-control-group">
            <ShapeIconButton label="Fit selection" onClick={onFitSelection}>
              <Focus aria-hidden="true" />
            </ShapeIconButton>
          </div>
        )}
        {(hasSettings || showFullscreen) && (
          <div className="geo-control-group">
            {hasSettings && (
              <ShapeIconButton
                label="Map settings"
                className={settingsOpen ? 'geo-control-active' : ''}
                aria-expanded={settingsOpen}
                onClick={() => {
                  const next = !settingsOpen
                  setSettingsOpen(next)
                  if (next) onSettingsOpen()
                }}
              >
                <Settings2 aria-hidden="true" />
              </ShapeIconButton>
            )}
            {showFullscreen && (
              <ShapeIconButton label="Toggle fullscreen" onClick={onFullscreen}>
                <Maximize2 aria-hidden="true" />
              </ShapeIconButton>
            )}
          </div>
        )}
      </div>

      {settingsOpen && (
        <ShapeCard className="geo-map-settings" aria-label="Map settings">
          <header>
            <div>
              <span className="geo-panel-kicker">Map options</span>
              <h2>View &amp; output</h2>
            </div>
            <ShapeIconButton label="Close map settings" onClick={() => setSettingsOpen(false)}>
              <X aria-hidden="true" />
            </ShapeIconButton>
          </header>
          <div className="geo-settings-fields">
            {showProjection && (
              <ShapeLabel>
                <span>Projection</span>
                <ShapeSelect
                  aria-label="Projection"
                  value={view.projection}
                  onChange={(event) => onProjection(event.currentTarget.value as ProjectionId)}
                >
                  <option value="EPSG:8857">Equal Earth</option>
                  <option value="ESRI:EQUAL-EARTH-CM11">Equal Earth · ArcGIS</option>
                  <option value="EPSG:3857">Mercator</option>
                </ShapeSelect>
              </ShapeLabel>
            )}
            {showBasemap && (
              <ShapeLabel>
                <span>Basemap</span>
                <ShapeSelect
                  aria-label="Basemap"
                  value={activeBasemapId}
                  onChange={(event) => onBasemap(event.currentTarget.value)}
                >
                  {compatible.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.network ? ' · network' : ''}
                    </option>
                  ))}
                </ShapeSelect>
              </ShapeLabel>
            )}
            {showFit && targets.length > 0 && (
              <ShapeLabel>
                <span>Go to area</span>
                <ShapeSelect
                  aria-label="Zoom to area"
                  defaultValue=""
                  onChange={(event) => {
                    onTarget(event.currentTarget.value)
                    setSettingsOpen(false)
                  }}
                >
                  <option value="" disabled>
                    Choose area
                  </option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </ShapeSelect>
              </ShapeLabel>
            )}
            {showExport && (
              <ShapeLabel>
                <span>Download</span>
                <ShapeSelect
                  aria-label="Export map"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.currentTarget.value)
                      onExport(event.currentTarget.value as 'png' | 'jpeg' | 'svg')
                    event.currentTarget.value = ''
                  }}
                >
                  <option value="" disabled>
                    Export report image
                  </option>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="svg">SVG</option>
                </ShapeSelect>
              </ShapeLabel>
            )}
          </div>
        </ShapeCard>
      )}
    </>
  )
}
