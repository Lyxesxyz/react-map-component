import { useRef, useState } from 'react'
import Graticule from 'ol/layer/Graticule.js'
import Stroke from 'ol/style/Stroke.js'
import { GeospatialMap } from '@/components/geospatial-map'
import {
  createFeaturesConfig,
  defaultFeaturesOptions,
  graticuleOptions,
  popupAnchorOptions,
  rendererOptions,
  type FeaturesOptions,
} from '@demo-shared/src/fixtures'

// 0.4 features in one place: the built-in world basemap (no basemap configured), clustering,
// the WebGL renderer, a feature-anchored popup, the hover tooltip, and an OpenLayers layer the
// configuration does not offer (a graticule) added through `onOpenLayersMap`. The stations and
// the configuration are in apps/demo-shared/src/fixtures.ts.

export function FeaturesScenario() {
  const [cluster, setCluster] = useState(defaultFeaturesOptions.cluster)
  const [renderer, setRenderer] = useState(defaultFeaturesOptions.renderer)
  const [anchor, setAnchor] = useState(defaultFeaturesOptions.anchor)
  const [graticule, setGraticule] = useState(false)
  const [graticuleAttached, setGraticuleAttached] = useState(false)
  const graticuleRef = useRef<Graticule | null>(null)

  const config = createFeaturesConfig({ cluster, renderer, anchor })

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
            onChange={(event) =>
              setRenderer(event.currentTarget.value as FeaturesOptions['renderer'])
            }
          >
            {rendererOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Popup{' '}
          <select
            value={anchor}
            onChange={(event) => setAnchor(event.currentTarget.value as FeaturesOptions['anchor'])}
          >
            {popupAnchorOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
            strokeStyle: new Stroke({
              color: graticuleOptions.strokeColor,
              width: graticuleOptions.strokeWidth,
            }),
            showLabels: graticuleOptions.showLabels,
            wrapX: graticuleOptions.wrapX,
            visible: graticule,
            zIndex: graticuleOptions.zIndex,
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
