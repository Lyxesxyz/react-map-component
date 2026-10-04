import Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { mapConfigSchema, mapInputSchema } from '../src/config/schema'
import { validateMapConfig } from '../src/config/validate'

describe('distributable JSON Schema', () => {
  it('is a serializable JSON Schema 2020-12 document (written by `pnpm schema`)', () => {
    const parsed = JSON.parse(JSON.stringify(mapConfigSchema)) as Record<string, unknown>
    expect(parsed['$schema']).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(parsed['$id']).toBe('urn:org:geospatial-map:config:v1')
    expect(validateMapConfig({}).success).toBe(false)
  })

  it('has a schema of the short form for editors, which accepts what people write', () => {
    const short = {
      accessibility: { ariaLabel: 'Regions' },
      initialState: { view: { zoom: 4 } },
      data: { layers: [{ id: 'regions', data: { url: '/regions.geojson' } }] },
      ui: { legend: { expanded: false } },
    }
    expect(Value.Check(mapInputSchema, short)).toBe(true)
    expect(validateMapConfig(short).success).toBe(true)
    const withRole = {
      ...short,
      data: { layers: [{ id: 'regions', role: 'indicator', data: { url: '/r.geojson' } }] },
    }
    expect(Value.Check(mapInputSchema, withRole)).toBe(false)
  })
})
