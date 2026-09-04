import { describe, expect, it } from 'vitest'
import { createEmbedSnippet, createPublicEmbedConfig } from './embed.js'
import type { SerializedMapState } from '../types.js'

const state: SerializedMapState = {
  version: 1,
  view: { center: [0, 0], zoom: 1, projection: 'EPSG:8857' },
  layers: [],
}

describe('public embedding', () => {
  it('creates a versioned state without executable values', () => {
    expect(createPublicEmbedConfig('public-map-v1', state)).toEqual({
      version: 1,
      configId: 'public-map-v1',
      state,
    })
  })

  it('only emits an iframe for an approved origin', () => {
    const snippet = createEmbedSnippet({
      configId: 'public-map-v1',
      embedBaseUrl: 'https://maps.example.org/embed',
      approvedOrigins: ['https://maps.example.org'],
    })
    expect(snippet).toContain('config=public-map-v1')
    expect(snippet).toContain('sandbox=')
    expect(() =>
      createEmbedSnippet({
        configId: 'public-map-v1',
        embedBaseUrl: 'https://unapproved.example/embed',
        approvedOrigins: ['https://maps.example.org'],
      }),
    ).toThrow(/not approved/)
  })
})
