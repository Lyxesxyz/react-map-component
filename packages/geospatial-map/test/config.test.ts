import { describe, expect, it } from 'vitest'
import {
  defineMapConfig,
  initialMapState,
  mapConfigSchema,
  resolveMapMessages,
  resolveMapTheme,
  resolveMapUi,
  validateMapConfig,
} from '../src/config'
import type { GeospatialMapConfigV1 } from '../src/types'

const layers: GeospatialMapConfigV1['data']['layers'] = [
  {
    id: 'areas',
    title: 'Areas',
    role: 'indicator',
    kind: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#ddd' } },
  },
]

const valid = defineMapConfig({
  version: 1,
  accessibility: { ariaLabel: 'Configured map' },
  initialState: initialMapState(
    { center: [0, 0], zoom: 1, projection: 'EPSG:8857' },
    layers,
    'base',
  ),
  view: {},
  data: {
    layers,
    basemaps: [
      {
        id: 'base',
        title: 'Base',
        supportedProjections: ['EPSG:8857'],
        layers: [],
        backgroundColor: '#fff',
        attribution: [],
        exportable: true,
      },
    ],
  },
  ui: { profile: 'full' },
})

describe('versioned map configuration', () => {
  it('publishes and accepts the canonical v1 schema', () => {
    expect((mapConfigSchema as { $schema?: string }).$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    )
    expect(validateMapConfig(valid)).toEqual({ success: true, config: valid })
  })

  it('rejects unknown fields and semantic references', () => {
    const unknown = structuredClone(valid) as GeospatialMapConfigV1 & { surprise: boolean }
    unknown.surprise = true
    expect(validateMapConfig(unknown)).toMatchObject({ success: false })

    const missingBasemap = {
      ...structuredClone(valid),
      initialState: { ...valid.initialState, activeBasemapId: 'missing' },
    }
    const result = validateMapConfig(missingBasemap)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: '/initialState/activeBasemapId', code: 'unknown' }),
      )
  })

  it('rejects unsupported versions and defaults missing from their allowed sets', () => {
    expect(validateMapConfig({ ...valid, version: 2 })).toMatchObject({ success: false })

    const defaults = {
      ...structuredClone(valid),
      time: {
        speedsMs: [500],
        defaultSpeedMs: 900,
        frameFailurePolicy: 'skip' as const,
      },
      export: {
        formats: ['image/png'] as const,
        defaultFormat: 'image/jpeg' as const,
      },
    }
    const result = validateMapConfig(defaults)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['/time/defaultSpeedMs', '/export/defaultFormat']),
      )
  })

  it('deep-merges profile objects and replaces arrays', () => {
    const ui = resolveMapUi({
      profile: 'compact',
      controlRail: {
        placement: 'top-left',
        groups: [{ id: 'only', controls: ['fullscreen'] }],
      },
    })
    expect(ui.controlRail.placement).toBe('top-left')
    expect(ui.controlRail.zoomStep).toBe(1)
    expect(ui.controlRail.groups).toEqual([{ id: 'only', controls: ['fullscreen'] }])
  })

  it('resolves partial theme and message overrides against stable defaults', () => {
    expect(resolveMapTheme({ accentColor: '#123456' })).toMatchObject({
      accentColor: '#123456',
      density: 'comfortable',
    })
    expect(resolveMapMessages({ layers: 'Слоеве' })).toMatchObject({
      layers: 'Слоеве',
      zoomIn: 'Zoom in',
    })
  })

  it('accepts heatmaps and validates aggregate and layer-panel references', () => {
    const heatmap: GeospatialMapConfigV1['data']['layers'][number] = {
      id: 'density',
      title: 'Density',
      role: 'indicator',
      kind: 'heatmap',
      data: { type: 'FeatureCollection', features: [] },
      gradient: ['#0000ff', '#ff0000'],
    }
    const configured = {
      ...structuredClone(valid),
      data: { ...valid.data, layers: [heatmap] },
      initialState: initialMapState(valid.initialState.view, [heatmap], 'base'),
      ui: { layers: { defaultExpandedLayerIds: ['density'] } },
    }
    expect(validateMapConfig(configured)).toMatchObject({ success: true })

    heatmap.selectable = true
    const invalid = validateMapConfig(configured)
    expect(invalid).toMatchObject({ success: false })
    if (!invalid.success)
      expect(invalid.issues).toContainEqual(
        expect.objectContaining({ path: '/data/layers/0/selectable', code: 'unsupported' }),
      )

    delete heatmap.selectable
    configured.ui.layers.defaultExpandedLayerIds = ['missing']
    const missing = validateMapConfig(configured)
    expect(missing).toMatchObject({ success: false })
  })
})
