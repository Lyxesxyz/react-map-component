'use client'

// Example: your own layout from the parts, a custom popup and tooltip, and a custom part that
// reads map state. Nothing here edits the component; parts take `className` and `placement`.
// Task: "change the popup / move the controls / add our own panel". See README.md → Build your
// own layout, and docs/state-events-slots.md.

import {
  MapAttribution,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapRoot,
  MapTooltip,
  MapZoomInButton,
  MapZoomOutButton,
  defineMapConfig,
  useMap,
  useMapActions,
  useMapIcons,
} from '..'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regional statistics' },
  data: {
    layers: [
      {
        id: 'regions',
        title: 'Regions',
        data: { url: '/data/regions.geojson' },
        featureIdField: 'code',
      },
    ],
  },
})

/** A custom part: any component inside <MapRoot> can read the map through useMap(). */
function SelectionSummary() {
  const { selectedFeature, mapStatus } = useMap()
  if (mapStatus !== 'ready') return null
  return (
    <p className="regions-summary">
      {selectedFeature ? String(selectedFeature.properties['name']) : 'Select a region'}
    </p>
  )
}

/** A rail button with the map's own icon set, so it matches the built-in buttons. */
function HomeButton() {
  const { fit } = useMapActions()
  const icons = useMapIcons()
  return (
    <MapControlButton label="Whole world" onClick={() => fit([-180, -90, 180, 90])}>
      <icons.Fit aria-hidden="true" />
    </MapControlButton>
  )
}

export function RegionsMap() {
  return (
    <MapRoot config={config} className="regions-map">
      <MapControls placement="top-left">
        <MapControlGroup>
          <MapZoomInButton />
          <MapZoomOutButton />
        </MapControlGroup>
        <MapControlGroup>
          <MapLayersButton />
          <HomeButton />
        </MapControlGroup>
      </MapControls>
      <MapLayerPanel placement="top-left" allowReorder={false} />
      <MapLegend placement="bottom-right" />
      <MapTooltip>
        {(feature) => String(feature.properties['name'] ?? feature.featureId)}
      </MapTooltip>
      <MapPopup anchor="feature">
        {({ selection, close }) => (
          <div className="regions-popup">
            <h2>{String(selection.properties['name'] ?? selection.featureId)}</h2>
            <p>Population: {String(selection.properties['population'] ?? '—')}</p>
            <button type="button" onClick={close}>
              Close
            </button>
          </div>
        )}
      </MapPopup>
      <SelectionSummary />
      <MapAttribution compact />
    </MapRoot>
  )
}
