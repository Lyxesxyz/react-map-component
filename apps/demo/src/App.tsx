import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GeospatialMap,
  MapGrid,
  createClassifiedPolygonStyle,
  createEmbedSnippet,
  createPublicEmbedConfig,
  type FeatureEvent,
  type GeospatialMapHandle,
  type MapError,
  type MapLayerConfig,
  type MapViewState,
} from '@org/geospatial-map'
import {
  basemaps,
  brokenLayer,
  cityLayer,
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

type Scenario = 'global' | 'geometry' | 'layers' | 'time' | 'raster' | 'grid' | 'errors'

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
    const timer = window.setTimeout(() => setLoading(false), 250)
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
    setEvents((current) => [eventSummary(name, detail), ...current].slice(0, 8))
  const onError = (error: MapError) => record('error', { code: error.code, layerId: error.layerId })
  const gridDefinitions: Array<{ id: string; title: string; center: MapViewState['center'] }> = [
    { id: 'europe', title: 'Europe', center: [15, 52] },
    { id: 'africa', title: 'Africa', center: [22, 2] },
    { id: 'asia', title: 'Asia', center: [95, 38] },
    { id: 'north-america', title: 'North America', center: [-105, 42] },
    { id: 'south-america', title: 'South America', center: [-60, -18] },
    { id: 'oceania', title: 'Oceania', center: [135, -25] },
  ]
  const gridMaps = gridDefinitions.map(({ id, title, center }) => ({
    id,
    title,
    view: { ...initialView, center, zoom: 2.1 },
  }))

  const common = {
    ariaLabel: 'Indicator geospatial map',
    basemaps,
    defaultBasemapId: requestedBasemap ?? 'reference-equal-earth',
    zoomTargets,
    hierarchy,
    projectionBehavior: { mode: 'manual' as const },
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
    renderPopup: ({ selection }: { selection: FeatureEvent }) => (
      <DemoPopup selection={selection} />
    ),
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
              <option value="layers">Layer controls</option>
              <option value="time">Time series</option>
              <option value="raster">Raster</option>
              <option value="grid">3 × 2 grid</option>
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

      <section style={{ display: mapVisible ? 'block' : 'none' }}>
        {scenario === 'grid' && !sourceMode && benchmarkCount === 0 ? (
          <MapGrid {...common} maps={gridMaps} sharedLayers={[classifiedIndicator]} />
        ) : (
          <GeospatialMap
            {...common}
            key={`${scenario}-${sourceMode}-${benchmarkCount}`}
            ref={mapRef}
            defaultView={{ ...initialView, projection: requestedProjection }}
            layers={layers}
            defaultTime={scenario === 'time' ? '2021' : null}
            timePlayback={{ speedsMs: [400, 900, 1600], defaultSpeedMs: 900 }}
            exportOptions={{ title: 'Indicator geospatial map', subtitle: `Scenario: ${scenario}` }}
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
            onClick={() => setStateJson(JSON.stringify(mapRef.current?.serialize() ?? {}, null, 2))}
          >
            Inspect state
          </button>
          <button onClick={() => mapRef.current?.fitSelection({ maxZoom: 6 })}>
            Fit selected feature
          </button>
          <button
            onClick={() => {
              const state = mapRef.current?.serialize()
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
