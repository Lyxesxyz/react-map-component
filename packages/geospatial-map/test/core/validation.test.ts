import { describe, expect, it } from 'vitest'
import { compatibleBasemap, validateBasemaps } from '../../src/core/validation'
import type { BasemapConfig } from '../../src/types'

const basemaps: BasemapConfig[] = [
  {
    id: 'equal',
    title: 'Equal',
    supportedProjections: ['EPSG:8857'],
    layers: [],
    backgroundColor: '#fff',
    attribution: [],
    exportable: true,
    fallbackFor: ['EPSG:8857'],
  },
  {
    id: 'mercator',
    title: 'Mercator',
    supportedProjections: ['EPSG:3857'],
    layers: [],
    backgroundColor: '#fff',
    attribution: [],
    exportable: true,
  },
]

describe('basemap compatibility', () => {
  it('keeps a compatible requested basemap', () => {
    expect(compatibleBasemap(basemaps, 'mercator', 'EPSG:3857').id).toBe('mercator')
  })

  it('selects the Equal Earth fallback', () => {
    expect(compatibleBasemap(basemaps, 'mercator', 'EPSG:8857').id).toBe('equal')
  })

  it('rejects duplicate IDs', () => {
    expect(() => validateBasemaps([basemaps[0]!, basemaps[0]!])).toThrow('Duplicate basemap ID')
  })
})
