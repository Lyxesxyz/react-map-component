// Compiled (not run) against the copied folder with a fresh app's strict tsconfig.
// It exercises the public API the way a host application would.
import { useRef, useState } from 'react'
import {
  GeospatialMap,
  MapAttribution,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapGrid,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapRoot,
  MapSettings,
  MapZoomInButton,
  MapZoomOutButton,
  ShapeButton,
  cn,
  defineMapConfig,
  initialMapState,
  useMap,
  useMapActions,
  type GeospatialMapHandle,
  type MapLayerConfig,
  type MapState,
} from '../../src'

const layers: MapLayerConfig[] = [
  {
    id: 'areas',
    title: 'Areas',
    role: 'indicator',
    kind: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#2563eb' } },
  },
]

const config = defineMapConfig({
  version: 1,
  accessibility: { ariaLabel: 'Consumer map' },
  initialState: initialMapState(
    { center: [0, 0], zoom: 1, projection: 'EPSG:8857' },
    layers,
    'base',
  ),
  view: {},
  data: {
    layers,
    basemaps: [
      {
        id: 'base',
        title: 'Base',
        supportedProjections: ['EPSG:8857', 'EPSG:3857'],
        layers: [],
        backgroundColor: '#dbeafe',
        attribution: [],
        exportable: true,
      },
    ],
  },
  ui: { profile: 'compact' },
  theme: { accentColor: '#7c3aed', density: 'compact' },
})

function SelectionTitle() {
  const { state, messages } = useMap()
  return <p>{state.selection?.featureId ?? messages.selectionCleared}</p>
}

function HomeButton() {
  const { fit } = useMapActions()
  return (
    <MapControlButton label="World" onClick={() => fit([-180, -90, 180, 90])}>
      <svg viewBox="0 0 24 24" aria-hidden="true" />
    </MapControlButton>
  )
}

export function PresetMap() {
  const ref = useRef<GeospatialMapHandle>(null)
  const [state, setState] = useState<MapState>(config.initialState)
  return (
    <>
      <ShapeButton onClick={() => void ref.current?.exportImage({ format: 'image/png' })}>
        Export
      </ShapeButton>
      <GeospatialMap
        ref={ref}
        config={config}
        state={state}
        onStateChange={setState}
        className={cn('h-full', state.selection && 'has-selection')}
        slots={{
          popup: ({ selection, close }) => <button onClick={close}>{selection.featureId}</button>,
        }}
      >
        <SelectionTitle />
      </GeospatialMap>
    </>
  )
}

export function ComposedMap() {
  return (
    <MapRoot config={config} className="brand-map" style={{ ['--geo-radius' as string]: '6px' }}>
      <MapControls placement="top-left">
        <MapControlGroup>
          <MapZoomInButton />
          <MapZoomOutButton step={2} />
        </MapControlGroup>
        <MapControlGroup>
          <MapLayersButton />
          <HomeButton />
        </MapControlGroup>
      </MapControls>
      <MapSettings fields={['projection']} />
      <MapLayerPanel allowReorder={false} />
      <MapLegend placement="bottom-right" layout="compact" />
      <MapPopup>{({ selection }) => <strong>{selection.featureId}</strong>}</MapPopup>
      <MapAttribution compact />
    </MapRoot>
  )
}

export function Grid() {
  return (
    <MapGrid
      config={{
        version: 1,
        shared: config,
        maps: [{ id: 'a', title: 'A', initialState: config.initialState }],
      }}
      cellClassName="cell"
    />
  )
}
