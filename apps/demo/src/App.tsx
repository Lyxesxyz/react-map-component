import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GeospatialMap,
  MapControlButton,
  MapGrid,
  type ClassificationMethod,
  type FeatureEvent,
  type GeospatialMapHandle,
  type MapPlacement,
  type MapSlots,
  type MapState,
  type MapUiConfig,
  type MapUiProfileId,
  type PaletteId,
} from '@/components/geospatial-map'
import {
  benchmarkNotice,
  classCountOptions,
  classificationOptions,
  createClassifiedIndicator,
  createHarnessCallbacks,
  createHarnessConfig,
  createHarnessGridConfig,
  defaultPlaygroundSettings,
  defaultSymbology,
  defaultUiOverrideJson,
  generatedPolicyJson,
  harnessLayers,
  harnessPopupContent,
  indicatorTableRows,
  logEvent,
  paletteOptions,
  parseUiOverride,
  placementOptions,
  popupLoadingMs,
  profileOptions,
  sourceFixtureNotice,
  stableRenderMark,
  worldBounds,
} from '@demo-shared/src/fixtures'
import {
  counterpartDemoHref,
  defaultDemoUrls,
  harnessView,
  parseHarnessParams,
  scenarioOptions,
  type ScenarioId,
} from '@demo-shared/src/scenarios'
import { ComposedScenario } from './ComposedScenario'
import { ArcgisScenario } from './ArcgisScenario'
import { ChecksScenario } from './ChecksScenario'
import { FeaturesScenario } from './FeaturesScenario'
import { QuickStartScenario } from './QuickStartScenario'
import { ThemesScenario } from './ThemesScenario'
import '@demo-shared/styles/app.css'

// The harness. Its scenarios, fixtures, configurations and styles come from apps/demo-shared,
// which the Angular demo renders too; this file and the *Scenario.tsx files only render them.

const angularDemoUrl = import.meta.env.VITE_ANGULAR_DEMO_URL || defaultDemoUrls.angular

function DemoPopup({ feature }: { feature: FeatureEvent }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), popupLoadingMs)
    return () => window.clearTimeout(timer)
  }, [feature.featureId])
  if (loading) return <p role="status">Loading indicator statistics…</p>
  const { title, statistic, note } = harnessPopupContent(feature)
  return (
    <div className="demo-popup">
      <h2>{title}</h2>
      <p className="demo-statistic">{statistic}</p>
      <p>{note}</p>
    </div>
  )
}

export function App() {
  // The URL never changes while the harness runs: the Scenario select switches in place.
  const [params] = useState(() => parseHarnessParams(window.location.search))
  const {
    sources: sourceMode,
    points: benchmarkCount,
    renderer: benchmarkRenderer,
    controlled: controlledMode,
    hidden: hiddenMode,
    // The projection is a developer setting (users cannot change it on the map): `?projection=`.
    projection: requestedProjection,
    activeBasemap,
  } = params
  const [scenario, setScenario] = useState<ScenarioId>(params.scenario)
  const [events, setEvents] = useState<string[]>([])
  const [stateJson, setStateJson] = useState('')
  const [mapVisible, setMapVisible] = useState(!hiddenMode)
  const [palette, setPalette] = useState<PaletteId>(defaultSymbology.palette)
  const [method, setMethod] = useState<ClassificationMethod>(defaultSymbology.method)
  const [classCount, setClassCount] = useState(defaultSymbology.classCount)
  const [profile, setProfile] = useState<MapUiProfileId>(defaultPlaygroundSettings.profile)
  const [railPlacement, setRailPlacement] = useState<MapPlacement>(
    defaultPlaygroundSettings.railPlacement,
  )
  const [showLegend, setShowLegend] = useState<boolean>(defaultPlaygroundSettings.showLegend)
  const [showLayers, setShowLayers] = useState<boolean>(defaultPlaygroundSettings.showLayers)
  const [compactTheme, setCompactTheme] = useState<boolean>(defaultPlaygroundSettings.compactTheme)
  const [translated, setTranslated] = useState<boolean>(defaultPlaygroundSettings.translated)
  const [uiJson, setUiJson] = useState(defaultUiOverrideJson)
  const [uiOverride, setUiOverride] = useState<MapUiConfig>(defaultPlaygroundSettings.uiOverride)
  const [uiJsonError, setUiJsonError] = useState('')
  const [controlledState, setControlledState] = useState<MapState | null>(null)
  const mapRef = useRef<GeospatialMapHandle>(null)
  const classifiedIndicator = useMemo(
    () => createClassifiedIndicator({ palette, method, classCount }),
    [classCount, method, palette],
  )
  const layers = useMemo(
    () =>
      harnessLayers(
        scenario,
        { sources: sourceMode, points: benchmarkCount, renderer: benchmarkRenderer },
        classifiedIndicator,
      ),
    [benchmarkCount, benchmarkRenderer, classifiedIndicator, scenario, sourceMode],
  )

  const record = (name: string, detail: unknown) =>
    setEvents((current) => logEvent(current, name, detail))
  const config = useMemo(
    () =>
      createHarnessConfig({
        scenario,
        layers,
        projection: requestedProjection,
        activeBasemap,
        profile,
        railPlacement,
        showLegend,
        showLayers,
        compactTheme,
        translated,
        uiOverride,
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

  const callbacks = createHarnessCallbacks(record)
  const slots: MapSlots = {
    popup: ({ feature }) => <DemoPopup feature={feature} />,
    controls: {
      'custom:home': ({ actions }) => (
        <MapControlButton label="Fit world" onClick={() => actions.fit(worldBounds)}>
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
  const content = harnessView(scenario, params)

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
              onChange={(event) => setScenario(event.currentTarget.value as ScenarioId)}
            >
              {scenarioOptions.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
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
                    setPalette(event.currentTarget.value as PaletteId)
                    record('symbologyControl', { palette: event.currentTarget.value })
                  }}
                >
                  {paletteOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Classification
                <select
                  value={method}
                  onChange={(event) => {
                    setMethod(event.currentTarget.value as ClassificationMethod)
                    record('symbologyControl', { method: event.currentTarget.value })
                  }}
                >
                  {classificationOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Classes
                <select
                  value={classCount}
                  onChange={(event) => setClassCount(Number(event.currentTarget.value))}
                >
                  {classCountOptions.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </details>
          <a
            className="demo-framework-link"
            href={counterpartDemoHref(
              angularDemoUrl,
              window.location,
              import.meta.env.BASE_URL,
              scenario,
            )}
          >
            Angular version
          </a>
        </div>
      </header>

      {benchmarkCount > 0 && <p className="demo-notice">{benchmarkNotice(benchmarkCount)}</p>}
      {sourceMode && <p className="demo-notice">{sourceFixtureNotice}</p>}
      {hiddenMode && !mapVisible && <button onClick={() => setMapVisible(true)}>Reveal map</button>}

      {scenario === 'configuration' && (
        <section className="demo-configurator" aria-label="Map configuration playground">
          <label>
            Profile
            <select
              value={profile}
              onChange={(event) => setProfile(event.currentTarget.value as MapUiProfileId)}
            >
              {profileOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Control placement
            <select
              value={railPlacement}
              onChange={(event) => setRailPlacement(event.currentTarget.value as MapPlacement)}
            >
              {placementOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
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
              const result = parseUiOverride(uiJson)
              if ('ui' in result) {
                setUiOverride(result.ui)
                setUiJsonError('')
              } else {
                setUiJsonError(result.error)
              }
            }}
          >
            Apply JSON
          </button>
          <output role="status">{uiJsonError || 'Configuration valid'}</output>
          <details>
            <summary>Generated policy</summary>
            <pre>{generatedPolicyJson(config)}</pre>
          </details>
        </section>
      )}

      <section style={{ display: mapVisible ? 'block' : 'none' }}>
        {content === 'grid' ? (
          <MapGrid
            {...callbacks}
            slots={slots}
            config={createHarnessGridConfig(config, classifiedIndicator)}
          />
        ) : content === 'quickstart' ? (
          <QuickStartScenario />
        ) : content === 'features' ? (
          <FeaturesScenario />
        ) : content === 'themes' ? (
          <ThemesScenario />
        ) : content === 'arcgis' ? (
          <ArcgisScenario />
        ) : content === 'checks' ? (
          <ChecksScenario />
        ) : content === 'composed' ? (
          <ComposedScenario {...callbacks} ref={mapRef} config={config} />
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
              performance.mark(stableRenderMark)
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
            {indicatorTableRows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.area}</th>
                <td>{row.value}</td>
                <td>{row.category}</td>
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
