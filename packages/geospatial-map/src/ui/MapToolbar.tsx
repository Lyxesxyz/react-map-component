import type { BasemapConfig, MapViewState, ProjectionId, ZoomTarget } from '../types.js'
import { ShapeButton, ShapeIconButton, ShapeLabel, ShapeSelect } from './shapes.js'

export function MapToolbar({
  view,
  basemaps,
  activeBasemapId,
  targets,
  showLayers,
  showProjection,
  showBasemap,
  showZoom,
  showFit,
  showExport,
  showFullscreen,
  hasSelection,
  onProjection,
  onBasemap,
  onZoom,
  onTarget,
  onFitSelection,
  onLayers,
  onExport,
  onFullscreen,
}: {
  view: MapViewState
  basemaps: BasemapConfig[]
  activeBasemapId: string
  targets: ZoomTarget[]
  showLayers: boolean
  showProjection: boolean
  showBasemap: boolean
  showZoom: boolean
  showFit: boolean
  showExport: boolean
  showFullscreen: boolean
  hasSelection: boolean
  onProjection: (projection: ProjectionId) => void
  onBasemap: (id: string) => void
  onZoom: (delta: number) => void
  onTarget: (id: string) => void
  onFitSelection: () => void
  onLayers: () => void
  onExport: (format: 'png' | 'jpeg' | 'svg') => void
  onFullscreen: () => void
}) {
  const compatible = basemaps.filter((item) => item.supportedProjections.includes(view.projection))
  return (
    <div className="geo-toolbar" aria-label="Map controls">
      {showProjection && (
        <ShapeLabel>
          <span>Projection</span>
          <ShapeSelect
            aria-label="Projection"
            value={view.projection}
            onChange={(event) => onProjection(event.currentTarget.value as ProjectionId)}
          >
            <option value="EPSG:8857">Equal Earth</option>
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
          <span>Area</span>
          <ShapeSelect
            aria-label="Zoom to area"
            defaultValue=""
            onChange={(event) => onTarget(event.currentTarget.value)}
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
      <span className="geo-toolbar-buttons">
        {showZoom && (
          <ShapeIconButton label="Zoom in" onClick={() => onZoom(1)}>
            +
          </ShapeIconButton>
        )}
        {showZoom && (
          <ShapeIconButton label="Zoom out" onClick={() => onZoom(-1)}>
            −
          </ShapeIconButton>
        )}
        {showLayers && <ShapeButton onClick={onLayers}>Layers</ShapeButton>}
        {showFit && hasSelection && (
          <ShapeButton onClick={onFitSelection}>Fit selection</ShapeButton>
        )}
        {showExport && (
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
              Export
            </option>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="svg">SVG wrapper</option>
          </ShapeSelect>
        )}
        {showFullscreen && (
          <ShapeIconButton label="Toggle fullscreen" onClick={onFullscreen}>
            ⛶
          </ShapeIconButton>
        )}
      </span>
    </div>
  )
}
