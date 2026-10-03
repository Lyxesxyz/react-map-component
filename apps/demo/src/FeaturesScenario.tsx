import { useRef, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import Graticule from 'ol/layer/Graticule.js'
import Stroke from 'ol/style/Stroke.js'
import { GeospatialMap, defineMapConfig } from '@/components/geospatial-map'
import { pointObservations } from './world'

// 0.4 features in one place: the built-in world basemap (no basemap configured), clustering,
// the WebGL renderer, a feature-anchored popup, the hover tooltip, and an OpenLayers layer the
// configuration does not offer (a graticule) added through `onOpenLayersMap`.

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const random = seeded(7)
const statuses = ['normal', 'watch', 'alert'] as const
const stations: FeatureCollection = {
  type: 'FeatureCollection',
  features: pointObservations.features.flatMap((city) => {
    const [longitude = 0, latitude = 0] = (city.geometry as Point).coordinates
    return Array.from({ length: 60 }, (_, index) => {
      const id = `${String(city.id)}-${index}`
      const reading = Math.round(random() * 100)
      return {
        type: 'Feature' as const,
        id,
        properties: {
          geoId: id,
          name: `${String(city.properties?.['name'])} station ${index + 1}`,
          reading,
          status: statuses[reading > 85 ? 2 : reading > 60 ? 1 : 0],
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude + (random() - 0.5) * 9, latitude + (random() - 0.5) * 6],
        },
      }
    })
  }),
}

export function FeaturesScenario() {
  const [cluster, setCluster] = useState(true)
  const [renderer, setRenderer] = useState<'auto' | 'canvas' | 'webgl'>('auto')
  const [anchor, setAnchor] = useState<'feature' | 'corner'>('feature')
  const [graticule, setGraticule] = useState(false)
  const [graticuleAttached, setGraticuleAttached] = useState(false)
  const graticuleRef = useRef<Graticule | null>(null)

  const config = defineMapConfig({
    accessibility: { ariaLabel: 'Monitoring stations' },
    ui: { popup: { anchor } },
    data: {
      layers: [
        {
          id: 'stations',
          title: 'Monitoring stations',
          role: 'indicator',
          kind: 'geojson',
          data: stations,
          featureIdField: 'geoId',
          ...(cluster ? { cluster: { distance: 44, minDistance: 24 } } : { renderer }),
          style: {
            type: 'categorical',
            field: 'status',
            categories: [
              {
                value: 'normal',
                label: 'Normal',
                symbol: { kind: 'point', radius: 5, fillColor: '#16a34a', strokeColor: '#ffffff' },
              },
              {
                value: 'watch',
                label: 'Watch',
                symbol: { kind: 'point', radius: 6, fillColor: '#f59e0b', strokeColor: '#ffffff' },
              },
              {
                value: 'alert',
                label: 'Alert',
                symbol: {
                  kind: 'point',
                  shape: 'triangle',
                  radius: 8,
                  fillColor: '#dc2626',
                  strokeColor: '#ffffff',
                },
              },
            ],
          },
        },
      ],
    },
  })

  return (
    <>
      <div className="demo-composed-toolbar" role="group" aria-label="0.4 feature controls">
        <label>
          <input
            type="checkbox"
            checked={cluster}
            onChange={(event) => setCluster(event.currentTarget.checked)}
          />{' '}
          Cluster points
        </label>
        <label>
          Renderer{' '}
          <select
            value={renderer}
            disabled={cluster}
            onChange={(event) => setRenderer(event.currentTarget.value as typeof renderer)}
          >
            <option value="auto">auto</option>
            <option value="canvas">canvas</option>
            <option value="webgl">webgl</option>
          </select>
        </label>
        <label>
          Popup{' '}
          <select
            value={anchor}
            onChange={(event) => setAnchor(event.currentTarget.value as typeof anchor)}
          >
            <option value="feature">next to the feature</option>
            <option value="corner">in a corner</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={graticule}
            onChange={(event) => {
              setGraticule(event.currentTarget.checked)
              graticuleRef.current?.setVisible(event.currentTarget.checked)
            }}
          />{' '}
          Graticule (OpenLayers layer)
        </label>
        <output aria-label="Graticule layer">
          Graticule layer: {graticuleAttached ? 'on the map' : 'not attached'}
        </output>
      </div>
      <GeospatialMap
        config={config}
        onOpenLayersMap={(map) => {
          const layer = new Graticule({
            strokeStyle: new Stroke({ color: 'rgba(15, 118, 110, 0.35)', width: 1 }),
            showLabels: false,
            wrapX: false,
            visible: graticule,
            zIndex: 100,
          })
          map.addLayer(layer)
          graticuleRef.current = layer
          // Shows that the layer stays on the map when the configuration changes.
          const check = () => setGraticuleAttached(map.getAllLayers().includes(layer))
          map.on('rendercomplete', check)
          return () => {
            map.un('rendercomplete', check)
            map.removeLayer(layer)
            graticuleRef.current = null
          }
        }}
      />
    </>
  )
}
