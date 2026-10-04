import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultLayerStyle, normalizeMapConfig } from '../../src/config/normalize'
import { validateMapConfig } from '../../src/config/validate'
import {
  detectFormat,
  fetchGeoJson,
  loadArcgisFeatures,
  parseCsv,
  rowsToFeatureCollection,
  toFeatureCollection,
} from '../../src/core/data-sources'
import { symbolForGeometry } from '../../src/core/style-compiler'

const FEATURES = 'https://services.example.com/arcgis/rest/services/Indicators/FeatureServer/0'

function respond(routes: Record<string, unknown>) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      calls.push(input)
      const match = Object.entries(routes).find(([prefix]) => input.startsWith(prefix))
      if (!match) return new Response('not found', { status: 404 })
      const [, body] = match
      const value = typeof body === 'function' ? (body as (url: string) => unknown)(input) : body
      return typeof value === 'string'
        ? new Response(value, { headers: { 'content-type': 'text/html' } })
        : Response.json(value)
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('data formats', () => {
  it('detects formats from URLs', () => {
    expect(detectFormat(FEATURES)).toBe('arcgis')
    expect(detectFormat(`${FEATURES}/query?where=year%3D2024`)).toBe('arcgis')
    expect(detectFormat('https://example.com/data/sites.CSV?v=2')).toBe('csv')
    expect(detectFormat('/data/regions.geojson')).toBe('geojson')
    expect(detectFormat('https://api.example.com/indicators')).toBeUndefined()
  })

  it('parses quoted CSV with any common delimiter', () => {
    expect(parseCsv('﻿name;lat;lon\r\n"Sofia; BG";42.7;23.3\r\n"Say ""hi""";1;2\r\n')).toEqual([
      { name: 'Sofia; BG', lat: '42.7', lon: '23.3' },
      { name: 'Say "hi"', lat: '1', lon: '2' },
    ])
  })

  it('turns rows into points, keeping codes with leading zeros as text', () => {
    const collection = rowsToFeatureCollection(
      [
        { Name: 'A', Longitude: '10.5', Latitude: '-2', code: '004', value: '12.5' },
        { Name: 'B', Longitude: '', Latitude: '1', code: '010', value: 'n/a' },
      ],
      {},
      'test.csv',
    )
    expect(collection.features).toHaveLength(1)
    expect(collection.features[0]?.geometry).toEqual({ type: 'Point', coordinates: [10.5, -2] })
    expect(collection.features[0]?.properties).toMatchObject({ code: '004', value: 12.5 })
  })

  it('names the columns when coordinates cannot be found', () => {
    expect(() => rowsToFeatureCollection([{ site: 'A', east: 1 }], {}, 'sites.csv')).toThrow(
      /Columns: site, east\. Set data\.longitude/,
    )
    const points = rowsToFeatureCollection(
      [{ site: 'A', east: 1, north: 2 }],
      { longitude: 'east', latitude: 'north' },
      's',
    )
    expect(points.features).toHaveLength(1)
  })

  it('accepts GeoJSON, single features, geometries and wrapped row lists', () => {
    const point = { type: 'Point', coordinates: [1, 2] }
    expect(toFeatureCollection(point, {}, 'x').features).toHaveLength(1)
    expect(
      toFeatureCollection({ type: 'Feature', properties: {}, geometry: point }, {}, 'x').features,
    ).toHaveLength(1)
    expect(toFeatureCollection({ data: [{ lat: 1, lng: 2 }] }, {}, 'x').features).toHaveLength(1)
    expect(() => toFeatureCollection({ hello: 'world' }, {}, 'api')).toThrow(/neither GeoJSON nor/)
  })
})

describe('loading data from URLs', () => {
  it('pages through an ArcGIS feature layer past its record limit', async () => {
    const feature = (id: number) => ({ type: 'Feature', id, properties: { id }, geometry: null })
    const calls = respond({
      [`${FEATURES}?f=json`]: { name: 'Indicators', maxRecordCount: 2 },
      [`${FEATURES}/query`]: (url: string) => {
        const offset = Number(new URL(url).searchParams.get('resultOffset'))
        const page = [offset, offset + 1].filter((id) => id < 5).map(feature)
        return { type: 'FeatureCollection', features: page, exceededTransferLimit: offset + 2 < 5 }
      },
    })
    const collection = await loadArcgisFeatures(`${FEATURES}/query?where=year%3D2024`)
    expect(collection.features.map((item) => item.id)).toEqual([0, 1, 2, 3, 4])
    const query = new URL(calls[1]!).searchParams
    expect(query.get('where')).toBe('year=2024')
    expect(query.get('f')).toBe('geojson')
    expect(query.get('outSR')).toBe('4326')
  })

  it('explains a web page returned instead of data', async () => {
    respond({ 'https://example.com/login': '<!doctype html><title>Sign in</title>' })
    await expect(fetchGeoJson('https://example.com/login')).rejects.toThrow(
      /web page instead of data/,
    )
  })

  it('reports ArcGIS errors with their message', async () => {
    respond({ [`${FEATURES}?f=json`]: { error: { code: 400, message: 'Invalid URL' } } })
    await expect(fetchGeoJson(FEATURES)).rejects.toThrow(/Invalid URL/)
  })

  it('follows an ArcGIS Online feature layer item to its layer', async () => {
    const id = 'abcdef0123456789abcdef0123456789'
    const service = 'https://services.example.com/arcgis/rest/services/Indicators/FeatureServer'
    respond({
      [`https://www.arcgis.com/sharing/rest/content/items/${id}?f=json`]: {
        type: 'Feature Service',
        url: service,
      },
      [`${service}/0?f=json`]: { maxRecordCount: 1000 },
      [`${service}/0/query`]: { type: 'FeatureCollection', features: [] },
    })
    await expect(fetchGeoJson(`https://www.arcgis.com/home/item.html?id=${id}`)).resolves.toEqual({
      type: 'FeatureCollection',
      features: [],
    })
  })
})

describe('layer defaults', () => {
  it('completes a layer given as just an id and data', () => {
    const config = normalizeMapConfig({
      accessibility: { ariaLabel: 'Sites' },
      data: { layers: [{ id: 'sites', data: { url: '/sites.csv' } }] },
    })
    expect(config.data.layers[0]).toEqual({
      id: 'sites',
      title: 'sites',
      role: 'indicator',
      kind: 'geojson',
      data: { url: '/sites.csv' },
      style: defaultLayerStyle,
      selectable: true,
    })
    expect(
      validateMapConfig({
        accessibility: { ariaLabel: 'Sites' },
        data: { layers: [{ id: 'sites', data: { rows: [{ lat: 1, lon: 2 }] } }] },
      }).success,
    ).toBe(true)
  })

  it('adapts a symbol to the geometry it draws', () => {
    const polygon = defaultLayerStyle.type === 'constant' ? defaultLayerStyle.symbol : undefined
    expect(symbolForGeometry(polygon!, 'Point')).toMatchObject({ kind: 'point', radius: 6 })
    expect(symbolForGeometry(polygon!, 'MultiLineString')).toMatchObject({ kind: 'line', width: 2 })
    expect(symbolForGeometry(polygon!, 'Polygon')).toBe(polygon)
  })
})
