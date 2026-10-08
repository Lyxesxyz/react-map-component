// The world countries of the React demo (apps/demo-shared/src/world.ts), copied until the
// Angular demo imports the shared demo package.

import type { FeatureCollection } from 'geojson'
import { feature } from 'topojson-client'
import countries from 'world-atlas/countries-110m.json'

const topology = countries as unknown as Parameters<typeof feature>[0]
const countryObject = topology.objects['countries'] as never
const converted = feature(topology, countryObject) as unknown as FeatureCollection

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
