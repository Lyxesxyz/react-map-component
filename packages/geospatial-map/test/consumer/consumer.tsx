// Compiled (not run) against the copied folder with a fresh app's strict tsconfig.
// It exercises the public API the way a host application would.
import { useRef, useState } from 'react'
import {
  GeospatialMap,
  MapAttribution,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapDisclaimer,
  MapGrid,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapRoot,
  MapTooltip,
  MapSettings,
  MapZoomInButton,
  MapZoomOutButton,
  ShapeButton,
  cn,
  arcgisBasemap,
  defineMapConfig,
  fetchGeoJson,
  initialMapState,
  useMap,
  useMapActions,
  useMapPixel,
  useHoveredFeature,
  tileBasemap,
  worldBasemap,
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
      <MapSettings fields={['basemap']} />
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

// The short form, written inline, with fill and an authenticated loader.
export function ShortConfigMap({ token }: { token: string }) {
  return (
    <div style={{ height: '70vh' }}>
      <GeospatialMap
        fill
        config={{
          accessibility: { ariaLabel: 'Short map' },
          initialState: { view: { center: [25, 42], zoom: 5 } },
          data: {
            layers: [
              {
                id: 'regions',
                title: 'Regions',
                role: 'indicator',
                kind: 'geojson',
                data: { url: '/regions.geojson' },
                featureIdField: 'id',
                style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#60a5fa' } },
              },
            ],
          },
        }}
        loadGeoJson={async (url, { signal }) => {
          const response = await fetch(url, {
            ...(signal ? { signal } : {}),
            headers: { Authorization: `Bearer ${token}` },
          })
          return response.json()
        }}
      />
    </div>
  )
}

// 0.4: basemaps, clustering, the WebGL renderer, overlays, and the OpenLayers escape hatch.
function StationMarker({ lonLat }: { lonLat: [number, number] }) {
  const pixel = useMapPixel(lonLat)
  const hovered = useHoveredFeature()
  if (!pixel) return null
  return (
    <span style={{ position: 'absolute', left: pixel[0], top: pixel[1] }}>
      {hovered ? String(hovered.properties['name'] ?? '') : 'Station'}
    </span>
  )
}

export function OverlayMap() {
  return (
    <MapRoot
      config={{
        accessibility: { ariaLabel: 'Stations' },
        ui: { popup: { anchor: 'feature' }, tooltip: { fields: ['label'] } },
        data: {
          basemaps: [
            worldBasemap,
            tileBasemap({
              url: 'https://tiles.example.com/{z}/{x}/{y}.png',
              attribution: { label: '© Example', url: 'https://example.com' },
            }),
          ],
          layers: [
            {
              id: 'stations',
              title: 'Stations',
              role: 'indicator',
              kind: 'geojson',
              data: { url: '/stations.geojson' },
              featureIdField: 'id',
              cluster: { distance: 40 },
              renderer: 'auto',
              style: { type: 'constant', symbol: { kind: 'point', fillColor: '#16a34a' } },
            },
            {
              id: 'countries',
              title: 'Countries',
              role: 'reference',
              kind: 'geojson',
              data: { builtin: 'world' },
              style: { type: 'constant', symbol: { kind: 'polygon', strokeColor: 'var(--brand)' } },
            },
          ],
        },
      }}
      onOpenLayersMap={(map) => {
        const zoom = map.getView().getZoom()
        return () => void zoom
      }}
    >
      <MapPopup anchor="feature" />
      <MapTooltip fields={['name']}>{(feature) => feature.featureId}</MapTooltip>
      <StationMarker lonLat={[23.3, 42.7]} />
    </MapRoot>
  )
}

// 0.5: an ArcGIS basemap by URL, indicators from different sources, a disclaimer.
export function ArcgisMap({ token }: { token: string }) {
  return (
    <GeospatialMap
      config={{
        accessibility: { ariaLabel: 'Indicators' },
        ui: { disclaimer: { text: 'Boundaries are not official.', placement: 'bottom-right' } },
        data: {
          basemaps: [
            arcgisBasemap({
              url: 'https://tiles.arcgis.com/tiles/x/arcgis/rest/services/Basemap/VectorTileServer',
              styleOverrides: [{ layers: 'Boundary line/*', color: '#555', width: 1.5 }],
            }),
          ],
          layers: [
            { id: 'regions', data: { url: '/regions.geojson' } },
            {
              id: 'sites',
              title: 'Sites',
              data: { url: '/sites.csv', longitude: 'lon', latitude: 'lat' },
              style: { type: 'constant', symbol: { kind: 'point', fillColor: '#16a34a' } },
            },
            {
              id: 'offices',
              data: { rows: [{ name: 'HQ', lon: 2.35, lat: 48.85 }] },
            },
          ],
        },
      }}
      loadGeoJson={(url, options) =>
        fetchGeoJson(url.startsWith('/private/') ? `${url}?token=${token}` : url, options)
      }
      slots={{ tooltip: (feature) => <em>{feature.featureId}</em> }}
    >
      <MapDisclaimer title="Note" placement="bottom-left" defaultOpen>
        Data are provisional.
      </MapDisclaimer>
    </GeospatialMap>
  )
}
