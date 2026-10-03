import { describe, expect, it } from 'vitest'
import { mapConfigSchema, validateMapConfig } from '../src/config'

describe('distributable JSON Schema', () => {
  it('is a serializable JSON Schema 2020-12 document (written by `pnpm schema`)', () => {
    const parsed = JSON.parse(JSON.stringify(mapConfigSchema)) as Record<string, unknown>
    expect(parsed['$schema']).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(parsed['$id']).toBe('urn:org:geospatial-map:config:v1')
    expect(validateMapConfig({}).success).toBe(false)
  })
})
