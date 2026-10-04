import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import {
  GeospatialMap,
  MapControls,
  MapGrid,
  MapLayerPanel,
  MapPopup,
  MapRoot,
  defineMapConfig,
  plainBasemap,
  worldBasemap,
  type GeospatialMapHandle,
  type MapGridState,
  type MapPanelId,
  type MapState,
} from '@/components/geospatial-map'
import { worldCountries } from './world'

// Behaviour the browser tests check directly: a selection set by the host opens and closes the
// popup, errors reach `onError` with their code, and a synchronised grid reports its state.

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Engine checks map' },
  initialState: { view: { center: [-50, -10], zoom: 2 } },
  view: { fitWorld: false },
  data: {
    layers: [
      {
        id: 'countries',
        title: 'Countries',
        data: worldCountries,
        featureIdField: 'geoId',
        // Blocks image export, so the export error can be checked without a server.
        exportable: false,
      },
    ],
  },
  ui: { popup: { anchor: 'feature' } },
})

declare global {
  interface Window {
    /** The checks map's actions, for the browser tests. */
    geoChecks?: GeospatialMapHandle | null
    /** The second checks map's actions. */
    geoMoreChecks?: GeospatialMapHandle | null
  }
}

/** Points in Europe, each in one of two time frames. */
const europe: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    [2.35, 48.86, 'Paris', 'a'],
    [13.4, 52.52, 'Berlin', 'a'],
    [23.32, 42.7, 'Sofia', 'b'],
    [12.5, 41.9, 'Rome', 'b'],
  ].map(([longitude, latitude, name, frame]) => ({
    type: 'Feature',
    properties: { name, frame },
    geometry: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
  })),
}

/**
 * A second map for 0.9.0 checks: the open panel controlled by the host, a popup `ref`, a host
 * that rejects selections, a timed heatmap, "fit data", and a configuration change that makes
 * the map wait for its world fit for a moment without rebuilding it.
 */
function MoreChecks() {
  const ref = useRef<GeospatialMapHandle>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [openPanel, setOpenPanel] = useState<MapPanelId | null>(null)
  const [lockSelection, setLockSelection] = useState(false)
  const [withPlain, setWithPlain] = useState(false)
  const [state, setState] = useState<MapState | undefined>(undefined)
  const [hookCalls, setHookCalls] = useState(0)
  const [popupTag, setPopupTag] = useState('')
  useEffect(() => {
    window.geoMoreChecks = ref.current
  })
  const config = useMemo(
    () =>
      defineMapConfig({
        id: 'more-checks',
        accessibility: { ariaLabel: 'More checks map' },
        data: {
          basemaps: withPlain ? [worldBasemap, plainBasemap] : [worldBasemap],
          layers: [
            {
              id: 'cities',
              title: 'Cities',
              data: europe,
              featureIdField: 'name',
              style: {
                type: 'constant',
                symbol: { kind: 'point', radius: 9, fillColor: '#be123c' },
              },
            },
            {
              id: 'density',
              title: 'Density',
              kind: 'heatmap',
              data: europe,
              time: { values: ['a', 'b'], field: 'frame' },
            },
          ],
        },
        ui: { time: { enabled: false } },
      }),
    [withPlain],
  )
  return (
    <>
      <div className="demo-composed-toolbar" role="group" aria-label="More checks">
        <button type="button" onClick={() => setWithPlain((current) => !current)}>
          Change basemaps
        </button>
        <label>
          <input
            type="checkbox"
            checked={lockSelection}
            onChange={(event) => setLockSelection(event.currentTarget.checked)}
          />{' '}
          Lock selection
        </label>
        <button type="button" onClick={() => setOpenPanel('layers')}>
          Open layers from the host
        </button>
        <button type="button" onClick={() => ref.current?.fitContent('data')}>
          Fit data from the host
        </button>
        <button type="button" onClick={() => setPopupTag(popupRef.current?.dataset.slot ?? 'null')}>
          Read popup ref
        </button>
        <output data-testid="open-panel">{openPanel ?? 'none'}</output>
        <output data-testid="hook-calls">{hookCalls}</output>
        <output data-testid="popup-ref">{popupTag}</output>
        <output data-testid="more-selection">{state?.selection?.featureId ?? 'none'}</output>
      </div>
      <MapRoot
        ref={ref}
        config={config}
        style={{ ['--geo-height' as string]: '320px' }}
        openPanel={openPanel}
        onOpenPanelChange={setOpenPanel}
        {...(state ? { state } : {})}
        onStateChange={(next, change) => {
          // A host that keeps the selection it has: the map is set back to it.
          if (lockSelection && change.domain === 'selection') return
          setState(next)
        }}
        onReady={(view) => setState((current) => current ?? { ...config.initialState, view })}
        onOpenLayersMap={() => setHookCalls((count) => count + 1)}
      >
        <MapControls />
        <MapLayerPanel />
        <MapPopup ref={popupRef} />
      </MapRoot>
    </>
  )
}

export function ChecksScenario() {
  const ref = useRef<GeospatialMapHandle>(null)
  const [state, setState] = useState<MapState>(config.initialState)
  const [errors, setErrors] = useState<string[]>([])
  const [grid, setGrid] = useState<MapGridState | undefined>(undefined)
  const [gridChanges, setGridChanges] = useState(0)
  const [thirdMap, setThirdMap] = useState(false)
  const hookFails = new URLSearchParams(window.location.search).has('hook-fails')
  useEffect(() => {
    window.geoChecks = ref.current
  })
  const select = (featureId: string | null) =>
    setState((current) => ({
      ...current,
      selection: featureId ? { layerId: 'countries', featureId } : null,
    }))
  return (
    <>
      <div className="demo-composed-toolbar" role="group" aria-label="Checks">
        <button type="button" onClick={() => select('76')}>
          Select Brazil
        </button>
        <button type="button" onClick={() => select(null)}>
          Clear selection
        </button>
        <button
          type="button"
          onClick={() =>
            setState((current) => ({
              ...current,
              layers: {
                ...current.layers,
                countries: { ...current.layers['countries']!, visible: false, opacity: 0.5 },
              },
            }))
          }
        >
          Hide countries
        </button>
        <button type="button" onClick={() => void ref.current?.downloadImage('image/png')}>
          Download PNG
        </button>
        <output data-testid="selection">{state.selection?.featureId ?? 'none'}</output>
        <output data-testid="errors">{errors.join(' ')}</output>
        <output data-testid="grid-focus">{grid ? (grid.focusedMapId ?? 'grid') : ''}</output>
        <button type="button" onClick={() => setThirdMap((current) => !current)}>
          {thirdMap ? 'Remove grid map' : 'Add grid map'}
        </button>
        <output data-testid="grid-changes">{gridChanges}</output>
        <output data-testid="grid-maps">{grid ? Object.keys(grid.maps).join(' ') : ''}</output>
      </div>
      <GeospatialMap
        ref={ref}
        config={config}
        state={state}
        onStateChange={setState}
        onError={(error) => setErrors((current) => [...current, error.code])}
        onOpenLayersMap={() => {
          if (hookFails) throw new Error('the host hook failed')
        }}
      />
      <MapGrid
        config={{
          shared: { ...config, ui: { popup: { enabled: true } } },
          maps: [
            { id: 'left', title: 'Left' },
            { id: 'right', title: 'Right' },
            ...(thirdMap ? [{ id: 'third', title: 'Third' }] : []),
          ],
          layout: { columns: 2, cellHeightPx: 220 },
          sync: { view: true, selection: true },
        }}
        onStateChange={(next) => {
          setGrid(next)
          setGridChanges((count) => count + 1)
        }}
      />
      <MoreChecks />
    </>
  )
}
