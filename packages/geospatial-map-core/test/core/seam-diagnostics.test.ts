import type { FeatureCollection, Geometry, MultiLineString, MultiPolygon, Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import { diagnoseLayerData } from '../../src/core/diagnostics'
import { splitAtSeam } from '../../src/core/seam'
import type { GeoJsonLayerConfig } from '../../src/types'

const collection = (...geometries: Geometry[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: geometries.map((geometry, index) => ({
    type: 'Feature',
    properties: { id: String(index) },
    geometry,
  })),
})

// A small island straddling ±180° (like Fiji).
const acrossAntimeridian: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [178, -17],
      [-179, -17],
      [-179, -16],
      [178, -16],
      [178, -17],
    ],
  ],
}

const longitudes = (geometry: Geometry) =>
  (geometry as MultiPolygon).coordinates.flatMap((polygon) => polygon[0]!.map((point) => point[0]!))

describe('cutting geometry at the projection seam', () => {
  it('splits a polygon that crosses ±180° into one part per side', () => {
    const [feature] = splitAtSeam(collection(acrossAntimeridian), 0).features
    expect(feature?.geometry.type).toBe('MultiPolygon')
    const [west, east] = (feature!.geometry as MultiPolygon).coordinates
    expect(west![0]!.every((point) => point[0]! >= 178 && point[0]! <= 180)).toBe(true)
    expect(east![0]!.every((point) => point[0]! >= -180 && point[0]! <= -179)).toBe(true)
  })

  it('uses the seam of the projection: -169° for a central meridian of 11°', () => {
    const alaska: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-171, 63],
          [-168, 63],
          [-168, 64],
          [-171, 64],
          [-171, 63],
        ],
      ],
    }
    const atGreenwich = splitAtSeam(collection(alaska), 0).features[0]!.geometry
    expect(atGreenwich.type).toBe('Polygon')
    const atEleven = splitAtSeam(collection(alaska), 11).features[0]!.geometry
    expect(atEleven.type).toBe('MultiPolygon')
    expect(longitudes(atEleven).some((longitude) => Math.abs(longitude - -169) < 1e-9)).toBe(true)
    // The Fiji-like island is whole when the seam is elsewhere.
    expect(splitAtSeam(collection(acrossAntimeridian), 11).features[0]!.geometry.type).toBe(
      'Polygon',
    )
  })

  it('splits lines and keeps polar rings and ordinary features as they are', () => {
    const line: Geometry = {
      type: 'LineString',
      coordinates: [
        [170, 10],
        [-170, 20],
      ],
    }
    const cut = splitAtSeam(collection(line), 0).features[0]!.geometry as MultiLineString
    const rounded = cut.coordinates.map((part) =>
      part.map((point) => point.map((value) => Math.round(value * 1e6) / 1e6)),
    )
    expect(cut.type).toBe('MultiLineString')
    expect(rounded).toEqual([
      [
        [170, 10],
        [180, 15],
      ],
      [
        [-180, 15],
        [-170, 20],
      ],
    ])
    // Seam points stay a hair inside their side: OpenLayers would read ±180 as the next world.
    expect(Math.abs(cut.coordinates[0]![1]![0]!)).toBeLessThan(180)
    const polar: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-180, -80],
          [0, -75],
          [180, -80],
          [180, -90],
          [-180, -90],
          [-180, -80],
        ],
      ],
    }
    const input = collection(polar, { type: 'Point', coordinates: [179, 0] })
    expect(splitAtSeam(input, 0)).toBe(input)
  })
})

describe('rings around a pole', () => {
  it('closes a ring that crosses the seam once along the pole line', () => {
    const antarctica: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-170, -70],
          [-100, -72],
          [0, -70],
          [100, -72],
          [-175, -70],
          [-170, -70],
        ],
      ],
    }
    const geometry = splitAtSeam(collection(antarctica), 11).features[0]!.geometry as Polygon
    const ring = geometry.coordinates[0]!
    expect(ring.filter((point) => point[1] === -90)).toHaveLength(2)
    expect(ring.every((point) => Math.abs(point[0]!) <= 180)).toBe(true)
  })
})

describe('data diagnostics', () => {
  const layer = (style: GeoJsonLayerConfig['style'], extra: Partial<GeoJsonLayerConfig> = {}) =>
    ({
      id: 'regions',
      title: 'Regions',
      kind: 'geojson',
      data: { url: '/x' },
      style,
      ...extra,
    }) as GeoJsonLayerConfig
  const data = (
    rows: Array<Record<string, unknown>>,
    coordinates = [10, 10],
  ): FeatureCollection => ({
    type: 'FeatureCollection',
    features: rows.map((properties) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates },
    })),
  })
  const point = { kind: 'point' as const, fillColor: '#000' }

  it('names the available properties when the style field is missing', () => {
    const hints = diagnoseLayerData(
      layer({ type: 'graduated', field: 'Value', classes: [{ label: 'a', symbol: point }] }),
      data([{ value: 1, name: 'A' }]),
    )
    expect(hints).toEqual([
      'Layer "regions" is styled by "Value", but its features have no such property. Properties: value, name.',
    ])
  })

  it('reports text in a numeric style, unmatched categories, ids and projected coordinates', () => {
    expect(
      diagnoseLayerData(
        layer({
          type: 'continuous',
          field: 'v',
          domain: [0, 1],
          stops: [
            { value: 0, color: '#000' },
            { value: 1, color: '#fff' },
          ],
        }),
        data([{ v: 'high' }]),
      )[0],
    ).toMatch(/as numbers, but the values are text/)
    expect(
      diagnoseLayerData(
        layer({
          type: 'categorical',
          field: 'code',
          categories: [{ value: '1', label: 'One', symbol: point }],
        }),
        data([{ code: 1 }, { code: '1' }]),
      )[0],
    ).toMatch(/^Layer "regions": 1 in "code" match no category/)
    expect(
      diagnoseLayerData(
        layer({ type: 'constant', symbol: point }, { featureIdField: 'id' }),
        data([{ id: 'a' }, { id: 'a' }, {}]),
      ),
    ).toEqual([
      '1 of 3 features in Layer "regions" have no "id".',
      'Layer "regions" has features sharing a "id" (a); selection needs unique values.',
    ])
    expect(
      diagnoseLayerData(
        layer({ type: 'constant', symbol: point }),
        data([{}], [2_600_000, 5_500_000]),
      )[0],
    ).toMatch(/not longitude\/latitude/)
    expect(diagnoseLayerData(layer({ type: 'constant', symbol: point }), data([]))).toEqual([
      'Layer "regions" loaded no features.',
    ])
  })
})
