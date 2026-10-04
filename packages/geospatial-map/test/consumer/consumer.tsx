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
  MapErrorAlert,
  MapStatusChips,
  useMap,
  useMapStatic,
  validateMapConfig,
  useMapActions,
  useMapIcons,
  defaultMapIcons,
  useMapPixel,
  useHoveredFeature,
  tileBasemap,
  worldBasemap,
  type GeospatialMapHandle,
  type MapConfig,
  type MapLayerConfig,
  type MapIcon,
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

const config: MapConfig = defineMapConfig({
  accessibility: { ariaLabel: 'Consumer map' },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  view: { minZoom: 1, interactions: { keyboard: true } },
  data: {
    layers,
    basemaps: [
      {
        id: 'base',
        title: 'Base',
        supportedProjections: ['EPSG:8857', 'EPSG:3857'],
        layers: [],
        backgroundColor: '#dbeafe',
      },
    ],
  },
  ui: { profile: 'compact', layerPanel: { allowReorder: false }, time: { autoplay: false } },
  theme: { primary: '#7c3aed', mutedForeground: '#6b7280', density: 'compact' },
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
        shared: config,
        maps: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B', initialState: { view: { zoom: 3 } } },
        ],
        sync: { view: true },
      }}
      cellClassName="cell"
      onStateChange={(state, mapId) => void [state.focusedMapId, mapId]}
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

// 0.6: per-map icons, and a custom part using the map's icon set.
const BrandLayersIcon: MapIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" />
)

function ThemedLayersButton() {
  const icons = useMapIcons()
  return (
    <MapControlButton label="Layers">
      <icons.Layers aria-hidden="true" />
    </MapControlButton>
  )
}

export function IconMap() {
  return (
    <MapRoot
      config={config}
      icons={{ Layers: BrandLayersIcon, Close: defaultMapIcons.Close }}
      className="theme-carbon"
    >
      <MapControls>
        <MapControlGroup>
          <ThemedLayersButton />
        </MapControlGroup>
      </MapControls>
    </MapRoot>
  )
}

// 0.8: one set of actions (ref, hook, slots), controlled panels, host selection, custom controls.
function SettingsToggle() {
  const { actions, messages } = useMapStatic()
  return (
    <MapControlButton label={messages.mapSettings} onClick={() => actions.setOpenPanel('settings')}>
      <svg viewBox="0 0 24 24" aria-hidden="true" />
    </MapControlButton>
  )
}

export function ActionsMap({ json }: { json: unknown }) {
  const ref = useRef<GeospatialMapHandle>(null)
  const [layersOpen, setLayersOpen] = useState(false)
  const result = validateMapConfig(json)
  if (!result.success) return <p>{result.issues[0]?.message}</p>
  return (
    <>
      <ShapeButton onClick={() => ref.current?.select({ layerId: 'areas', featureId: '1' })}>
        Select
      </ShapeButton>
      <ShapeButton onClick={() => ref.current?.setView({ zoom: 4 })}>Zoom</ShapeButton>
      <MapRoot ref={ref} config={result.config}>
        <MapControls
          groups={[{ id: 'more', controls: ['zoom-in', 'custom:settings'] }]}
          customControls={{ 'custom:settings': () => <SettingsToggle /> }}
        />
        <MapSettings />
        <MapLayerPanel open={layersOpen} onOpenChange={setLayersOpen} />
        <MapStatusChips placement="bottom-left" />
        <MapErrorAlert dismissible={false} />
      </MapRoot>
      <GeospatialMap
        config={result.config}
        slots={{
          controls: { 'custom:home': ({ actions }) => <HomeButton key={String(actions)} /> },
        }}
      />
    </>
  )
}
