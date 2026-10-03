import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GeospatialMap,
  MapControlButton,
  MapGrid,
  createClassifiedPolygonStyle,
  createEmbedSnippet,
  createPublicEmbedConfig,
  defineMapConfig,
  initialMapState,
  type FeatureEvent,
  type GeospatialMapHandle,
  type MapError,
  type MapLayerConfig,
  type MapPlacement,
  type MapSlots,
  type MapState,
  type MapUiConfig,
  type MapUiProfileId,
  type MapViewState,
} from '@/components/geospatial-map'
import {
  basemaps,
  brokenLayer,
  bubbleLayer,
  categoricalPointLayer,
  cityLayer,
  heatmapLayer,
  hierarchy,
  indicatorLayer,
  initialView,
  rasterLayer,
  rasterLayerSecondary,
  routeLayer,
  timedLayer,
  timedRasterLayer,
  zoomTargets,
} from './demo-config.js'
import { worldCountries } from './world.js'
import './app.css'

type Scenario =
  | 'global'
  | 'geometry'
  | 'points'
  | 'layers'
  | 'time'
  | 'raster'
  | 'grid'
  | 'configuration'
  | 'errors'

function createPointFixture(count: number): MapLayerConfig {
  return {
    id: 'benchmark-points',
    title: `${count.toLocaleString()} benchmark points`,
    role: 'indicator',
    kind: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: Array.from({ length: count }, (_, index) => {
        const longitude = ((index * 137.508) % 360) - 180
        const latitude = Math.sin(index * 0.73) * 70
        return {
          type: 'Feature',
          id: `point-${index}`,
          properties: { geoId: `point-${index}`, value: index % 100 },
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
        }
      }),
    },
    style: {
      type: 'continuous',
      field: 'value',
      domain: [0, 100],
      stops: [
        { value: 0, color: '#fbbf24' },
        { value: 100, color: '#dc2626' },
      ],
      symbol: { kind: 'point', radius: 2 },
    },
    legend: { title: 'Point benchmark', units: 'synthetic value' },
    featureIdField: 'geoId',
  }
}

const sourceFixtureLayers: MapLayerConfig[] = [
  {
    id: 'fixture-geojson',
    title: 'GeoJSON fixture',
    role: 'indicator',
    kind: 'geojson',
    data: { url: '/fixtures/data.geojson' },
    style: { type: 'constant', symbol: { kind: 'point', fillColor: '#e11d48' } },
  },
  {
    id: 'fixture-xyz',
    title: 'XYZ fixture',
    role: 'indicator',
    kind: 'xyz',
    urlTemplate: '/fixtures/xyz/{z}/{x}/{y}.png',
    sourceProjection: 'EPSG:3857',
  },
  {
    id: 'fixture-wms',
    title: 'WMS fixture',
    role: 'indicator',
    kind: 'wms',
    url: '/fixtures/wms',
    params: { LAYERS: 'fixture', TILED: true },
    sourceProjection: 'EPSG:3857',
  },
  {
    id: 'fixture-wmts',
    title: 'WMTS fixture',
    role: 'indicator',
    kind: 'wmts',
    url: '/fixtures/wmts/{TileMatrix}/{TileRow}/{TileCol}.png',
    layer: 'fixture',
    matrixSet: 'EPSG3857',
    format: 'image/png',
    sourceProjection: 'EPSG:3857',
    tileGrid: {
      extent: [-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244],
      origin: [-20037508.342789244, 20037508.342789244],
      resolutions: [156543.03392804097],
      matrixIds: ['0'],
    },
  },
  {
    id: 'fixture-mvt',
    title: 'MVT fixture',
    role: 'indicator',
    kind: 'mvt',
    urlTemplate: '/fixtures/mvt/{z}/{x}/{y}.pbf',
    sourceProjection: 'EPSG:3857',
    style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#ddd6fe' } },
  },
]

function scenarioLayers(scenario: Scenario, classifiedIndicator: MapLayerConfig): MapLayerConfig[] {
  if (scenario === 'geometry') return [classifiedIndicator, routeLayer, cityLayer]
  if (scenario === 'points') return [heatmapLayer, categoricalPointLayer, bubbleLayer]
  if (scenario === 'layers')
    return [classifiedIndicator, rasterLayer, rasterLayerSecondary, routeLayer, cityLayer]
  if (scenario === 'time') return [timedLayer, timedRasterLayer, cityLayer]
  if (scenario === 'raster') return [classifiedIndicator, rasterLayer, rasterLayerSecondary]
  if (scenario === 'errors') return [classifiedIndicator, brokenLayer]
  return [classifiedIndicator]
}

function DemoPopup({ selection }: { selection: FeatureEvent }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 750)
    return () => window.clearTimeout(timer)
  }, [selection.featureId])
  if (loading) return <p role="status">Loading indicator statistics…</p>
  return (
    <>
      <h2>{String(selection.properties.name ?? selection.featureId)}</h2>
      <p className="demo-statistic">
        {selection.properties.value === undefined
          ? 'No indicator value'
          : String(selection.properties.value)}
      </p>
      <p>{String(selection.properties.category ?? 'Associated demonstration statistic')}</p>
    </>
  )
}

function eventSummary(name: string, detail: unknown): string {
  return `${new Date().toLocaleTimeString()} · ${name} · ${JSON.stringify(detail)}`
}

export function App() {
  const params = new URLSearchParams(window.location.search)
  const requestedScenario = params.get('scenario') as Scenario | null
  const sourceMode = params.has('sources')
  const benchmarkCount = Number(params.get('points') ?? 0)
  const controlledMode = params.has('controlled')
  const hiddenMode = params.has('hidden')
  const requestedBasemap = params.get('basemap') ?? undefined
  const requestedProjection =
    requestedBasemap === 'arcgis-equal-earth' ? 'ESRI:EQUAL-EARTH-CM11' : initialView.projection
  const [scenario, setScenario] = useState<Scenario>(requestedScenario ?? 'global')
  const [events, setEvents] = useState<string[]>([])
  const [stateJson, setStateJson] = useState('')
  const [mapVisible, setMapVisible] = useState(!hiddenMode)
  const [palette, setPalette] = useState<'blue' | 'blueOrange' | 'viridis'>('blue')
  const [method, setMethod] = useState<'equal-interval' | 'quantile'>('equal-interval')
  const [classCount, setClassCount] = useState(5)
  const [profile, setProfile] = useState<MapUiProfileId>('full')
  const [railPlacement, setRailPlacement] = useState<MapPlacement>('top-right')
  const [showLegend, setShowLegend] = useState(true)
  const [showLayers, setShowLayers] = useState(true)
  const [compactTheme, setCompactTheme] = useState(false)
  const [translated, setTranslated] = useState(false)
  const [uiJson, setUiJson] = useState('{\n  "legend": { "layout": "compact" }\n}')
  const [uiOverride, setUiOverride] = useState<MapUiConfig>({})
  const [uiJsonError, setUiJsonError] = useState('')
  const [controlledState, setControlledState] = useState<MapState | null>(null)
  const mapRef = useRef<GeospatialMapHandle>(null)
  const indicatorValues = useMemo(
    () =>
      worldCountries.features
        .map((feature) => Number(feature.properties?.value))
        .filter(Number.isFinite),
    [],
  )
  const classifiedIndicator = useMemo<MapLayerConfig>(
    () => ({
      ...indicatorLayer,
      style: createClassifiedPolygonStyle({
        field: 'value',
        values: indicatorValues,
        palette,
        method,
        classCount,
        range: [0, 100],
      }),
    }),
    [classCount, indicatorValues, method, palette],
  )
  const layers = useMemo(
    () =>
      sourceMode
        ? sourceFixtureLayers
        : benchmarkCount > 0
          ? [createPointFixture(benchmarkCount)]
          : scenarioLayers(scenario, classifiedIndicator),
    [benchmarkCount, classifiedIndicator, scenario, sourceMode],
  )

  const record = (name: string, detail: unknown) =>
    setEvents((current) => [eventSummary(name, detail), ...current].slice(0, 24))
  const onError = (error: MapError) => record('error', { code: error.code, layerId: error.layerId })
  const gridDefinitions: Array<{ id: string; title: string; center: MapViewState['center'] }> = [
    { id: 'europe', title: 'Europe', center: [15, 52] },
    { id: 'africa', title: 'Africa', center: [22, 2] },
    { id: 'asia', title: 'Asia', center: [95, 38] },
    { id: 'north-america', title: 'North America', center: [-105, 42] },
    { id: 'south-america', title: 'South America', center: [-60, -18] },
    { id: 'oceania', title: 'Oceania', center: [135, -25] },
  ]
  const activeBasemap = requestedBasemap ?? 'reference-equal-earth'
  const config = useMemo(
    () =>
      defineMapConfig({
        version: 1,
        accessibility: { ariaLabel: 'Indicator geospatial map', keyboard: true },
        initialState: initialMapState(
          { ...initialView, projection: requestedProjection },
          layers,
          activeBasemap,
          scenario === 'time' ? '2021' : null,
        ),
        view: {
          projectionBehavior: { mode: 'manual' },
          interactions: { dragPan: true, wheelZoom: true, keyboard: true, select: true },
          fit: { padding: [40, 40, 40, 40], duration: 300, maxZoom: 7 },
        },
        data: { layers, basemaps, zoomTargets, hierarchy },
        ui: {
          profile: scenario === 'configuration' ? profile : 'full',
          ...(scenario === 'points'
            ? {
                layers: {
                  defaultOpen: true,
                  defaultExpandedLayerIds: ['population-bubbles'],
                },
              }
            : {}),
          ...(scenario === 'configuration'
            ? {
                controlRail: {
                  placement: railPlacement,
                  groups: [
                    { id: 'zoom', controls: ['zoom-in', 'zoom-out'] },
                    { id: 'content', controls: ['layers', 'fit', 'custom:home'] },
                    { id: 'more', controls: ['settings', 'fullscreen'] },
                  ],
                },
                layers: { enabled: showLayers },
                legend: { enabled: showLegend },
                ...uiOverride,
              }
            : {}),
        },
        time: { enabled: true, speedsMs: [400, 900, 1600], defaultSpeedMs: 900, loop: true },
        export: {
          enabled: true,
          formats: ['image/png', 'image/jpeg', 'image/svg+xml'],
          title: 'Indicator geospatial map',
          subtitle: `Scenario: ${scenario}`,
          includeLegend: true,
          includeAttribution: true,
        },
        theme: {
          density: compactTheme ? 'compact' : 'comfortable',
          ...(scenario === 'configuration'
            ? { accentColor: '#6d28d9', accentHoverColor: '#5b21b6' }
            : {}),
        },
        messages: translated
          ? { mapSettings: 'Настройки на картата', layers: 'Слоеве', legend: 'Легенда' }
          : {},
      }),
    [
      activeBasemap,
      compactTheme,
      layers,
      profile,
      railPlacement,
      requestedProjection,
      scenario,
      showLayers,
      showLegend,
      translated,
      uiOverride,
    ],
  )

  const gridMaps = gridDefinitions.map(({ id, title, center }) => {
    const gridLayers = [classifiedIndicator]
    return {
      id,
      title,
      initialState: initialMapState(
        { ...initialView, center, zoom: 2.1 },
        gridLayers,
        'reference-equal-earth',
      ),
      layers: gridLayers,
    }
  })

  const callbacks = {
    onFeatureSelect: (event: FeatureEvent | null) =>
      record('featureSelect', event?.featureId ?? null),
    onViewChange: (event: { view: MapViewState }) =>
      record('viewChange', { zoom: Number(event.view.zoom.toFixed(2)) }),
    onProjectionChange: (event: { current: string }) => record('projectionChange', event.current),
    onLayerStateChange: (event: { layerId: string; visible: boolean; index: number }) =>
      record('layerStateChange', event),
    onTimeChange: (event: { time: string | null }) => record('timeChange', event.time),
    onSymbologyChange: (event: { layerId: string }) => record('symbologyChange', event.layerId),
    onMetric: (metric: { name: string; durationMs: number; layerId?: string }) =>
      record('metric', {
        name: metric.name,
        durationMs: Number(metric.durationMs.toFixed(1)),
        layerId: metric.layerId,
      }),
    onError,
  }
  const slots: MapSlots = {
    popup: ({ selection }) => <DemoPopup selection={selection} />,
    controls: {
      'custom:home': ({ actions }) => (
        <MapControlButton label="Fit world" onClick={() => actions.fit([-180, -90, 180, 90])}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
        </MapControlButton>
      ),
    },
  }

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <div>
          <p className="demo-eyebrow">Component harness</p>
          <h1>Indicator geospatial map</h1>
          <p>
            Vector, raster, projection, time, interaction, legend, grid, and export demonstrations.
          </p>
        </div>
        <div className="demo-header-actions">
          <label className="demo-scenario-control">
            Scenario
            <select
              value={scenario}
              onChange={(event) => setScenario(event.currentTarget.value as Scenario)}
            >
              <option value="global">Global choropleth</option>
              <option value="geometry">Geometry types</option>
              <option value="points">Point &amp; density layers</option>
              <option value="layers">Layer controls</option>
              <option value="time">Time series</option>
              <option value="raster">Raster</option>
              <option value="grid">3 × 2 grid</option>
              <option value="configuration">Configuration playground</option>
              <option value="errors">Error handling</option>
            </select>
          </label>
          <details className="demo-symbology-controls">
            <summary>Style map</summary>
            <fieldset className="demo-symbology-panel">
              <legend>Approved symbology</legend>
              <label>
                Palette
                <select
                  value={palette}
                  onChange={(event) => {
                    setPalette(event.currentTarget.value as typeof palette)
                    record('symbologyControl', { palette: event.currentTarget.value })
                  }}
                >
                  <option value="blue">Blue</option>
                  <option value="blueOrange">Blue–orange</option>
                  <option value="viridis">Viridis</option>
                </select>
              </label>
              <label>
                Classification
                <select
                  value={method}
                  onChange={(event) => {
                    setMethod(event.currentTarget.value as typeof method)
                    record('symbologyControl', { method: event.currentTarget.value })
                  }}
                >
                  <option value="equal-interval">Equal interval</option>
                  <option value="quantile">Quantile</option>
                </select>
              </label>
              <label>
                Classes
                <select
                  value={classCount}
                  onChange={(event) => setClassCount(Number(event.currentTarget.value))}
                >
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </label>
            </fieldset>
          </details>
        </div>
      </header>

      {benchmarkCount > 0 && (
        <p className="demo-notice">Benchmark mode: {benchmarkCount.toLocaleString()} points.</p>
      )}
      {sourceMode && (
        <p className="demo-notice">Source fixture mode: GeoJSON, XYZ, WMS, WMTS, and MVT.</p>
      )}
      {hiddenMode && !mapVisible && <button onClick={() => setMapVisible(true)}>Reveal map</button>}

      {scenario === 'configuration' && (
        <section className="demo-configurator" aria-label="Map configuration playground">
          <label>
            Profile
            <select
              value={profile}
              onChange={(event) => setProfile(event.currentTarget.value as MapUiProfileId)}
            >
              <option value="full">Full</option>
              <option value="compact">Compact</option>
              <option value="embedded">Embedded</option>
              <option value="grid">Grid</option>
            </select>
          </label>
          <label>
            Control placement
            <select
              value={railPlacement}
              onChange={(event) => setRailPlacement(event.currentTarget.value as MapPlacement)}
            >
              <option value="top-right">Top right</option>
              <option value="top-left">Top left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={showLayers}
              onChange={(event) => setShowLayers(event.currentTarget.checked)}
            />{' '}
            Layer panel
          </label>
          <label>
            <input
              type="checkbox"
              checked={showLegend}
              onChange={(event) => setShowLegend(event.currentTarget.checked)}
            />{' '}
            Legend
          </label>
          <label>
            <input
              type="checkbox"
              checked={compactTheme}
              onChange={(event) => setCompactTheme(event.currentTarget.checked)}
            />{' '}
            Compact density
          </label>
          <label>
            <input
              type="checkbox"
              checked={translated}
              onChange={(event) => setTranslated(event.currentTarget.checked)}
            />{' '}
            Bulgarian labels
          </label>
          <label className="demo-config-json">
            UI override JSON
            <textarea value={uiJson} onChange={(event) => setUiJson(event.currentTarget.value)} />
          </label>
          <button
            onClick={() => {
              try {
                setUiOverride(JSON.parse(uiJson) as MapUiConfig)
                setUiJsonError('')
              } catch (error) {
                setUiJsonError(String(error))
              }
            }}
          >
            Apply JSON
          </button>
          <output role="status">{uiJsonError || 'Configuration valid'}</output>
          <details>
            <summary>Generated policy</summary>
            <pre>
              {JSON.stringify(
                { version: 1, ui: config.ui, theme: config.theme, messages: config.messages },
                null,
                2,
              )}
            </pre>
          </details>
        </section>
      )}

      <section style={{ display: mapVisible ? 'block' : 'none' }}>
        {scenario === 'grid' && !sourceMode && benchmarkCount === 0 ? (
          <MapGrid
            {...callbacks}
            slots={slots}
            config={{
              version: 1,
              shared: {
                ...config,
                initialState: gridMaps[0]!.initialState,
                data: { ...config.data, layers: [classifiedIndicator] },
              },
              maps: gridMaps,
              layout: {
                columns: 3,
                tabletColumns: 2,
                mobileColumns: 1,
                gapPx: 12,
                cellHeightPx: 340,
              },
              sync: { layers: true, time: true },
              focus: { enabled: true },
            }}
          />
        ) : (
          <GeospatialMap
            {...callbacks}
            key={`${scenario}-${sourceMode}-${benchmarkCount}`}
            ref={mapRef}
            config={config}
            slots={slots}
            {...(controlledMode
              ? {
                  state: controlledState ?? config.initialState,
                  onStateChange: (next: MapState, change: { domain: string }) => {
                    setControlledState(next)
                    record('stateChange', change.domain)
                  },
                }
              : {})}
            onReady={(view) => {
              performance.mark('geospatial-map-stable-render')
              record('ready', view.projection)
            }}
          />
        )}
      </section>

      <details className="demo-data-table">
        <summary>Accessible indicator data table</summary>
        <table>
          <caption>Development index values represented by the global map</caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Value</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            {worldCountries.features.map((feature, index) => (
              <tr key={String(feature.properties?.geoId ?? index)}>
                <th scope="row">{String(feature.properties?.name ?? 'Unnamed area')}</th>
                <td>{String(feature.properties?.value ?? 'No data')}</td>
                <td>{String(feature.properties?.category ?? 'Not classified')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <section className="demo-inspector" aria-label="Integration inspector">
        <header>
          <div>
            <h2>Integration inspector</h2>
            <p>Typed events and the reusable JSON-safe state contract.</p>
          </div>
          <button
            onClick={() => setStateJson(JSON.stringify(mapRef.current?.getState() ?? {}, null, 2))}
          >
            Inspect state
          </button>
          <button onClick={() => mapRef.current?.fitSelection({ maxZoom: 6 })}>
            Fit selected feature
          </button>
          <button
            onClick={() => {
              const state = mapRef.current?.getState()
              if (!state) return
              const config = createPublicEmbedConfig('development-index-public-v1', state)
              const snippet = createEmbedSnippet({
                configId: config.configId,
                embedBaseUrl: `${window.location.origin}/embed`,
                approvedOrigins: [window.location.origin],
                title: 'Development index map',
              })
              const output = `${JSON.stringify(config, null, 2)}\n\n${snippet}`
              void navigator.clipboard?.writeText(output)
              setStateJson(output)
            }}
          >
            Copy approved embed
          </button>
        </header>
        {stateJson && <pre data-testid="serialized-state">{stateJson}</pre>}
        <ol aria-label="Recent map events">
          {events.map((event, index) => (
            <li key={`${event}-${index}`}>{event}</li>
          ))}
        </ol>
      </section>
    </main>
  )
}
