import { forwardRef, useState } from 'react'
import {
  MapAttribution,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapFitButton,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapRoot,
  MapSettings,
  MapSettingsButton,
  MapZoomInButton,
  MapZoomOutButton,
  cn,
  useMap,
  useMapActions,
  type GeospatialMapConfigV1,
  type GeospatialMapHandle,
  type MapCallbacks,
} from '@/components/geospatial-map'

// A hand-composed map: the same parts the <GeospatialMap> preset uses, arranged and styled by
// the host. Styling comes only from app.css (tokens and classes); nothing in the component
// folder is edited.

function FitWorldButton() {
  const { fit } = useMapActions()
  return (
    <MapControlButton label="Fit world" onClick={() => fit([-180, -90, 180, 90])}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    </MapControlButton>
  )
}

/** A custom part: reads map state through useMap() and renders anywhere inside the map. */
function SelectionBadge() {
  const { selectedFeature } = useMap()
  return (
    <p className="demo-selection-badge" data-slot="demo-selection-badge">
      {selectedFeature
        ? `Selected: ${String(selectedFeature.properties.name ?? selectedFeature.featureId)}`
        : 'Click an area to select it'}
    </p>
  )
}

export const ComposedScenario = forwardRef<
  GeospatialMapHandle,
  MapCallbacks & { config: GeospatialMapConfigV1 }
>(function ComposedScenario({ config, ...callbacks }, ref) {
  const [brand, setBrand] = useState(true)
  const [dark, setDark] = useState(false)
  return (
    <>
      <div className="demo-composed-toolbar" role="group" aria-label="Styling playground">
        <label>
          <input
            type="checkbox"
            checked={brand}
            onChange={(event) => setBrand(event.currentTarget.checked)}
          />{' '}
          Brand tokens
        </label>
        <label>
          <input
            type="checkbox"
            checked={dark}
            onChange={(event) => setDark(event.currentTarget.checked)}
          />{' '}
          Dark mode
        </label>
      </div>
      <div className={cn('demo-composed', dark && 'dark')}>
        <MapRoot
          ref={ref}
          config={config}
          {...callbacks}
          className={cn('demo-composed-map', brand && 'demo-brand')}
        >
          <MapControls placement="top-left">
            <MapControlGroup>
              <MapZoomInButton />
              <MapZoomOutButton />
            </MapControlGroup>
            <MapControlGroup>
              <MapLayersButton />
              <MapSettingsButton />
              <MapFitButton fitTarget="data" label="Fit data" />
              <FitWorldButton />
            </MapControlGroup>
          </MapControls>
          <MapSettings placement="top-left" />
          <MapLayerPanel placement="top-left" allowReorder={false} />
          <MapLegend
            placement="top-right"
            className="demo-legend-card"
            header={<h2 className="demo-legend-heading">Legend</h2>}
          />
          <MapPopup placement="bottom-right">
            {({ selection, close }) => (
              <div className="demo-popup">
                <h2>{String(selection.properties.name ?? selection.featureId)}</h2>
                <p className="demo-statistic">{String(selection.properties.value ?? '—')}</p>
                <button className="demo-link-button" onClick={close}>
                  Done
                </button>
              </div>
            )}
          </MapPopup>
          <SelectionBadge />
          <MapAttribution compact />
        </MapRoot>
      </div>
    </>
  )
})
