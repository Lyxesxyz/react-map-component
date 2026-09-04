import type { FeatureCollection, Geometry } from 'geojson'
import { feature, mesh } from 'topojson-client'
import countries from 'world-atlas/countries-110m.json'

const topology = countries as unknown as Parameters<typeof feature>[0]
const countryObject = topology.objects['countries'] as never
const converted = feature(topology, countryObject) as unknown as FeatureCollection
const borderMesh = mesh(topology, countryObject)

function splitAtAntimeridian(lines: number[][][]): number[][][] {
  const result: number[][][] = []
  for (const line of lines) {
    let part: number[][] = []
    for (const coordinate of line) {
      const previous = part.at(-1)
      if (previous && Math.abs(coordinate[0]! - previous[0]!) > 180) {
        if (part.length > 1) result.push(part)
        part = []
      }
      part.push(coordinate)
    }
    if (part.length > 1) result.push(part)
  }
  return result
}

function numericId(id: string | number | undefined, index: number): number {
  const parsed = Number(id)
  return Number.isFinite(parsed) ? parsed : index + 1
}

export const worldCountries: FeatureCollection = {
  type: 'FeatureCollection',
  features: converted.features
    .filter((country) => String(country.id) !== '242')
    .map((country, index) => {
      const id = numericId(country.id, index)
      return {
        ...country,
        id: String(id),
        properties: {
          geoId: String(id),
          name: `Area ${id}`,
          value: (id * 37) % 101,
          category: ['Improving', 'Stable', 'Declining'][id % 3],
        },
      }
    }),
}

export const timedCountries: FeatureCollection = {
  type: 'FeatureCollection',
  features: [2021, 2022, 2023, 2024].flatMap((year) =>
    worldCountries.features.map((country, index) => ({
      ...country,
      id: `${String(country.id)}-${year}`,
      properties: {
        ...country.properties,
        geoId: `${String(country.id)}-${year}`,
        baseGeoId: String(country.id),
        year: String(year),
        value: (((index + 11) * (year - 2018)) % 96) + 3,
      },
    })),
  ),
}

export const worldBorders: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        ...(borderMesh as Geometry & { type: 'MultiLineString'; coordinates: number[][][] }),
        coordinates: splitAtAntimeridian(
          (borderMesh as Geometry & { type: 'MultiLineString'; coordinates: number[][][] })
            .coordinates,
        ),
      },
    },
  ],
}

export const cityPoints: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    ['sofia', 'Sofia', 23.3219, 42.6977, 8],
    ['tokyo', 'Tokyo', 139.6917, 35.6895, 12],
    ['sao-paulo', 'São Paulo', -46.6333, -23.5505, 11],
    ['nairobi', 'Nairobi', 36.8219, -1.2921, 7],
    ['washington', 'Washington, DC', -77.0369, 38.9072, 9],
  ].map(([id, name, longitude, latitude, size]) => ({
    type: 'Feature',
    id: String(id),
    properties: { geoId: String(id), name: String(name), size: Number(size), kind: 'city' },
    geometry: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
  })),
}

export const routeLines: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'demo-route',
      properties: { geoId: 'demo-route', name: 'Demonstration route', flow: 72 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-77.0369, 38.9072],
          [23.3219, 42.6977],
          [36.8219, -1.2921],
        ],
      },
    },
  ],
}
