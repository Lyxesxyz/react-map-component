import { useEffect, useRef, useState } from 'react'
import {
  GeospatialMap,
  MapGrid,
  defineMapConfig,
  type GeospatialMapHandle,
  type MapGridState,
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
  }
}

export function ChecksScenario() {
  const ref = useRef<GeospatialMapHandle>(null)
  const [state, setState] = useState<MapState>(config.initialState)
  const [errors, setErrors] = useState<string[]>([])
  const [grid, setGrid] = useState<MapGridState | undefined>(undefined)
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
          ],
          layout: { columns: 2, cellHeightPx: 220 },
          sync: { view: true, selection: true },
        }}
        onStateChange={(next) => setGrid(next)}
      />
    </>
  )
}
