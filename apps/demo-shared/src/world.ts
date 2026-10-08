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

export const pointObservations: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    ['london', 'London', -0.13, 51.51, 92, 'education'],
    ['paris', 'Paris', 2.35, 48.86, 78, 'infrastructure'],
    ['madrid', 'Madrid', -3.7, 40.42, 57, 'health'],
    ['lagos', 'Lagos', 3.38, 6.52, 96, 'infrastructure'],
    ['cairo', 'Cairo', 31.24, 30.04, 88, 'health'],
    ['nairobi-observation', 'Nairobi', 36.82, -1.29, 48, 'education'],
    ['cape-town', 'Cape Town', 18.42, -33.93, 35, 'health'],
    ['dubai', 'Dubai', 55.27, 25.2, 68, 'infrastructure'],
    ['delhi', 'Delhi', 77.21, 28.61, 100, 'health'],
    ['mumbai', 'Mumbai', 72.88, 19.08, 89, 'infrastructure'],
    ['bangkok', 'Bangkok', 100.5, 13.76, 63, 'education'],
    ['singapore', 'Singapore', 103.82, 1.35, 52, 'infrastructure'],
    ['beijing', 'Beijing', 116.41, 39.9, 84, 'education'],
    ['tokyo-observation', 'Tokyo', 139.69, 35.69, 94, 'health'],
    ['seoul', 'Seoul', 126.98, 37.57, 71, 'education'],
    ['sydney', 'Sydney', 151.21, -33.87, 42, 'health'],
    ['los-angeles', 'Los Angeles', -118.24, 34.05, 73, 'infrastructure'],
    ['mexico-city', 'Mexico City', -99.13, 19.43, 86, 'health'],
    ['new-york', 'New York', -74.01, 40.71, 91, 'education'],
    ['toronto', 'Toronto', -79.38, 43.65, 46, 'infrastructure'],
    ['bogota', 'Bogotá', -74.07, 4.71, 59, 'education'],
    ['lima', 'Lima', -77.04, -12.05, 66, 'health'],
    ['sao-paulo-observation', 'São Paulo', -46.63, -23.55, 83, 'infrastructure'],
    ['buenos-aires', 'Buenos Aires', -58.38, -34.6, 54, 'education'],
  ].map(([id, name, longitude, latitude, magnitude, category]) => ({
    type: 'Feature',
    id: String(id),
    properties: {
      geoId: String(id),
      name: String(name),
      magnitude: Number(magnitude),
      category: String(category),
      weight: Number(magnitude) / 100,
    },
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
