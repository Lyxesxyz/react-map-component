import type { FeatureCollection } from 'geojson'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import { get as getProjection } from 'ol/proj.js'
import { describe, expect, it, vi } from 'vitest'
import { LayerRegistry } from '../../src/core/layer-registry'
import { validateLayerConfigs } from '../../src/core/validation'
import type {
  GeoJsonLayerConfig,
  GeoJsonLoader,
  MapError,
  MapLayerConfig,
  VectorTileLayerConfig,
} from '../../src/types'

const layer = (id: string): GeoJsonLayerConfig => ({
  id,
  title: id,
  kind: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
  style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#fff' } },
})

const points = (...ids: Array<string | undefined>): FeatureCollection => ({
  type: 'FeatureCollection',
  features: ids.map((id, index) => ({
    type: 'Feature',
    properties: id === undefined ? {} : { code: id },
    geometry: { type: 'Point', coordinates: [index, index] },
  })),
})

function registry(loadGeoJson: GeoJsonLoader = () => Promise.resolve(points())) {
  const errors: MapError[] = []
  const instance = new LayerRegistry(
    getProjection('EPSG:3857')!,
    { loadGeoJson, onError: (error) => errors.push(error), onStatus: () => undefined },
    null,
  )
  return { registry: instance, errors }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('layer validation', () => {
  it('rejects duplicate IDs', () => {
    expect(() => validateLayerConfigs([layer('same'), layer('same')])).toThrow('Duplicate ID')
  })

  it('requires an id field for selectable tiles; GeoJSON features get ids when loaded', () => {
    expect(() => validateLayerConfigs([{ ...layer('selectable'), selectable: true }])).not.toThrow()
    expect(() =>
      validateLayerConfigs([
        {
          id: 'tiles',
          title: 'Tiles',
          kind: 'mvt',
          url: '/tiles/{z}/{x}/{y}.pbf',
          sourceProjection: 'EPSG:3857',
          style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#000' } },
          selectable: true,
        },
      ]),
    ).toThrow('needs featureIdField')
  })

  it('checks a service-styled MVT layer against its projection definition', () => {
    const mvt: VectorTileLayerConfig = {
      id: 'service-basemap',
      title: 'Service basemap',
      kind: 'mvt',
      url: '/tiles/{z}/{y}/{x}.pbf',
      sourceProjection: 'CUSTOM:1',
      sourceProjectionDefinition: {
        code: 'CUSTOM:2',
        definition: '+proj=longlat +datum=WGS84 +no_defs',
      },
      tileGrid: { extent: [-1, -1, 1, 1], origin: [-1, 1], resolutions: [1], tileSize: 512 },
      mapboxStyle: { url: '/style.json', source: 'basemap' },
    }
    expect(() => validateLayerConfigs([mvt])).toThrow('must be for its sourceProjection')
  })

  it('applies the runtime rules of validateMapConfig: stops, domains, time placeholders', () => {
    const heatmap: MapLayerConfig = {
      id: 'density',
      title: 'Density',
      kind: 'heatmap',
      data: { type: 'FeatureCollection', features: [] },
      radiusStops: [
        { zoom: 2, value: 10 },
        { zoom: 1, value: 8 },
      ],
    }
    expect(() => validateLayerConfigs([heatmap])).toThrow('strictly ascending')
    expect(() =>
      validateLayerConfigs([
        {
          ...layer('ramp'),
          style: { type: 'continuous', field: 'v', domain: [5, 1], stops: [] },
        },
      ]),
    ).toThrow('low to high')
    expect(() =>
      validateLayerConfigs([
        {
          id: 'radar',
          title: 'Radar',
          kind: 'xyz',
          url: '/radar/{z}/{x}/{y}.png',
          sourceProjection: 'EPSG:3857',
          time: { values: ['1', '2'] },
        },
      ]),
    ).toThrow('{time} placeholder')
    expect(() => validateLayerConfigs([{ ...layer('blank'), title: '  ' }])).toThrow(
      'needs a title',
    )
  })
})

describe('layer registry', () => {
  it('gates layers by zoom in one place, and reports the scale status', () => {
    const { registry: layers } = registry()
    const [built] = layers.reconcile([{ ...layer('near'), minZoom: 5 }])
    layers.setZoom(2)
    expect(built!.getVisible()).toBe(false)
    expect(layers.getStatuses()[0]).toMatchObject({ scaleUnavailable: true })
    // The OpenLayers layer itself has no zoom range: the registry is the only gate.
    expect(built!.getMinZoom()).toBe(-Infinity)
    layers.setZoom(6)
    expect(built!.getVisible()).toBe(true)
  })

  it('hides a timed layer at a frame it lacks, and says so in its status', () => {
    const { registry: layers } = registry()
    const [built] = layers.reconcile([{ ...layer('timed'), time: { values: ['2021'] } }])
    layers.setTime('2021')
    expect(built!.getVisible()).toBe(true)
    layers.setTime('2022')
    expect(built!.getVisible()).toBe(false)
    expect(layers.getStatuses()[0]).toMatchObject({ noData: true })
  })

  it('shows only the latest load of a timed URL, and retries a frame that failed', async () => {
    const pending = new Map<string, (value: FeatureCollection) => void>()
    let failNext = false
    const load = vi.fn<GeoJsonLoader>((url) =>
      failNext
        ? ((failNext = false), Promise.reject(new Error('offline')))
        : new Promise((resolve) => pending.set(url, resolve)),
    )
    const { registry: layers, errors } = registry(load)
    layers.reconcile([
      {
        ...layer('frames'),
        featureIdField: 'code',
        data: { url: '/data/{time}.geojson' },
        time: { values: ['a', 'b'] },
      },
    ])
    layers.setTime('a')
    layers.setTime('b')
    // The older load finishes last: it must not replace the newer one.
    pending.get('/data/b.geojson')!(points('b1'))
    pending.get('/data/a.geojson')!(points('a1', 'a2'))
    await settle()
    expect(layers.getFeature('frames', 'b1')).toBeDefined()
    expect(layers.getFeature('frames', 'a1')).toBeUndefined()
    expect(load.mock.calls[0]![1].layerId).toBe('frames')

    failNext = true
    layers.setTime('a')
    await settle()
    expect(errors.at(-1)?.code).toBe('SOURCE_LOAD_FAILED')
    layers.setTime('b')
    layers.setTime('a')
    expect(load.mock.calls.filter(([url]) => url === '/data/a.geojson').length).toBe(3)
  })

  it('drops a load that finishes after the layer was removed', async () => {
    let resolve: (value: FeatureCollection) => void = () => undefined
    const { registry: layers } = registry(() => new Promise((done) => (resolve = done)))
    layers.reconcile([{ ...layer('late'), data: { url: '/late.geojson' } }])
    layers.reconcile([])
    resolve(points('x'))
    await settle()
    expect(layers.getFeature('late', 'x')).toBeUndefined()
  })

  it('keeps the current layers when a new one cannot be built', () => {
    const { registry: layers } = registry()
    const before = layers.reconcile([layer('kept')])
    const broken = { ...layer('broken'), sourceProjection: 'EPSG:9999999' }
    expect(() => layers.reconcile([layer('kept'), broken])).toThrow('unsupported source projection')
    expect(layers.layers()).toEqual(before)
  })

  it('draws layers in list order, without a configurable z-index', () => {
    const { registry: layers } = registry()
    const built = layers.reconcile([layer('bottom'), layer('top')])
    expect(built.map((item) => item.getZIndex())).toEqual([0, 1])
    const swapped = layers.reconcile([layer('top'), layer('bottom')])
    expect(swapped.map((item) => item.get('mapLayerId'))).toEqual(['top', 'bottom'])
    expect(swapped.map((item) => item.getZIndex())).toEqual([0, 1])
  })

  it('reports a feature without an id once per layer, and describes each hit once', () => {
    const { registry: layers, errors } = registry()
    const config = {
      ...layer('codes'),
      selectable: true,
      featureIdField: 'code',
      data: points('a', undefined),
    }
    const [built] = layers.reconcile([config])
    const [withId, withoutId] = config.data.features.map((_, index) =>
      layers.getFeature('codes', index === 0 ? 'a' : '1'),
    )
    expect(withId).toBeDefined()
    // Features without the id field get their position as id, so they stay selectable.
    expect(withoutId).toBeDefined()
    const hit = { feature: withId!, layer: built! }
    expect(layers.candidates([hit, hit])).toHaveLength(1)
    expect(errors).toEqual([])
    // A feature with no id at all (tiles without the id field) is reported once, not per hover.
    const anonymous = new Feature({ geometry: new Point([0, 0]) })
    expect(layers.describe('codes', anonymous)).toBeUndefined()
    expect(layers.describe('codes', anonymous)).toBeUndefined()
    expect(errors.map((error) => error.code)).toEqual(['FEATURE_ID_MISSING'])
  })
})
