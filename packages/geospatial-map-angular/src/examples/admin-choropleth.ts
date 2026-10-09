// Example: colour admin areas by an indicator kept in a separate table. The basemap only draws
// boundaries; to colour them, load your own boundary GeoJSON and join the values onto it. The same
// goes for countries: `{ builtin: 'world' }` is one outline with no country codes, and the loader
// isn't called for it, so load a countries file of your own here.
// Task: "colour regions by our data". See docs/layers-and-legends.md → Colouring admin areas.

import { ChangeDetectionStrategy, Component } from '@angular/core'
import { GeospatialMap, defineMapConfig, fetchGeoJson, type GeoJsonLoader } from '../index'

type PovertyRow = { adm1_code: string; poverty: number }

/** Loads the boundaries, then adds `poverty` to each region from the values table. */
const loadWithValues: GeoJsonLoader = async (url, options) => {
  const boundaries = await fetchGeoJson(url, options)
  if (!url.includes('admin1')) return boundaries
  const response = await fetch(
    '/api/poverty.json',
    options.signal ? { signal: options.signal } : {},
  )
  if (!response.ok) throw new Error(`HTTP ${response.status} from /api/poverty.json`)
  const rows = (await response.json()) as PovertyRow[]
  const values = new Map(rows.map((row) => [row.adm1_code, row.poverty]))
  return {
    ...boundaries,
    features: boundaries.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        poverty: values.get(String(feature.properties?.['adm1_code'])) ?? null,
      },
    })),
  }
}

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Poverty by region' },
  data: {
    layers: [
      {
        id: 'admin1-poverty',
        title: 'Poverty headcount',
        data: { url: '/data/admin1.geojson' },
        featureIdField: 'adm1_code',
        propertyAllowlist: ['name', 'poverty'],
        style: {
          type: 'graduated',
          field: 'poverty',
          classes: [
            { label: '< 10%', max: 10, symbol: { kind: 'polygon', fillColor: '#fef3c7' } },
            {
              label: '10–30%',
              min: 10,
              max: 30,
              symbol: { kind: 'polygon', fillColor: '#f59e0b' },
            },
            { label: '≥ 30%', min: 30, symbol: { kind: 'polygon', fillColor: '#b45309' } },
          ],
          missing: { label: 'No data', symbol: { kind: 'polygon', fillColor: '#e5e7eb' } },
        },
        legend: { units: '% of population', sourceNote: 'Source: household surveys' },
      },
    ],
  },
})

@Component({
  selector: 'app-poverty-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" [loadGeoJson]="loadGeoJson" />`,
})
export class PovertyMap {
  protected readonly config = config
  protected readonly loadGeoJson = loadWithValues
}
