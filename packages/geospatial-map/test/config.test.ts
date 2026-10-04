import { describe, expect, it } from 'vitest'
import { defineMapConfig } from '../src/config/normalize'
import { mapConfigSchema } from '../src/config/schema'
import { resolveMapUi } from '../src/config/ui-profiles'
import { validateMapConfig } from '../src/config/validate'
import { resolveMapMessages } from '../src/messages'
import { mapThemeStyle, mapThemeTokenNames, themeVariable } from '../src/theme'
import type { MapConfig, MapLayerConfig } from '../src/types'

const layers: MapLayerConfig[] = [
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
  accessibility: { ariaLabel: 'Configured map' },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  data: {
    layers,
    basemaps: [{ id: 'base', title: 'Base', supportedProjections: ['EPSG:8857'], layers: [] }],
  },
  ui: { profile: 'full' },
})

const issuesOf = (input: unknown) => {
  const result = validateMapConfig(input)
  return result.success ? [] : result.issues
}

describe('map configuration', () => {
  it('publishes and accepts the canonical schema', () => {
    expect((mapConfigSchema as { $schema?: string }).$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    )
    expect(validateMapConfig(valid)).toEqual({ success: true, config: valid })
  })

  it('rejects unknown fields and semantic references', () => {
    expect(validateMapConfig({ ...valid, surprise: true })).toMatchObject({ success: false })
    expect(
      issuesOf({ ...valid, initialState: { ...valid.initialState, activeBasemapId: 'missing' } }),
    ).toContainEqual(
      expect.objectContaining({ path: '/initialState/activeBasemapId', code: 'unknown' }),
    )
  })

  it('rejects unsupported versions and defaults missing from their allowed sets', () => {
    expect(validateMapConfig({ ...valid, version: 2 })).toMatchObject({ success: false })
    const paths = issuesOf({
      ...valid,
      ui: { time: { speedsMs: [500], defaultSpeedMs: 900, frameFailurePolicy: 'skip' } },
      export: { formats: ['image/png'], defaultFormat: 'image/jpeg' },
      view: { minZoom: 5, maxZoom: 2 },
    }).map((issue) => issue.path)
    expect(paths).toEqual(
      expect.arrayContaining(['/ui/time/defaultSpeedMs', '/export/defaultFormat', '/view/minZoom']),
    )
  })

  it('names the new field for every field renamed or removed in 0.8.0', () => {
    const old = {
      ...valid,
      time: { reducedMotion: 'ignore', frameFailurePolicy: 'retain-last' },
      accessibility: { ariaLabel: 'Map', keyboard: false },
      ui: { controlRail: {}, layers: {}, hierarchy: {}, errors: {}, status: {} },
      theme: { accentColor: '#123456' },
      initialState: { ...valid.initialState, view: { ...valid.initialState.view, minZoom: 2 } },
      data: {
        ...valid.data,
        layers: [
          { ...layers[0], dataProjection: 'EPSG:3857', orderLocked: true },
          {
            id: 'tiles',
            title: 'Tiles',
            role: 'reference',
            kind: 'xyz',
            urlTemplate: 'https://tiles/{z}/{x}/{y}.png',
            sourceProjection: 'EPSG:3857',
            legend: { presentation: 'list' },
          },
          {
            id: 'arcgis',
            title: 'ArcGIS',
            role: 'basemap',
            kind: 'arcgis-vector-tiles',
            url: 'https://example.com/VectorTileServer',
            styleOverrides: [],
            projection: { code: 'X', definition: '+proj=longlat' },
          },
        ],
      },
    }
    const messages = issuesOf(old).map((issue) => issue.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        'time was renamed to ui.time in 0.8.0',
        'time.reducedMotion was renamed to accessibility.reducedMotion in 0.8.0',
        "frameFailurePolicy 'retain-last' was removed in 0.8.0; use 'pause' or 'skip'",
        'accessibility.keyboard was renamed to view.interactions.keyboard in 0.8.0',
        'ui.controlRail was renamed to ui.controls in 0.8.0',
        'ui.layers was renamed to ui.layerPanel in 0.8.0',
        'ui.hierarchy was renamed to ui.breadcrumbs in 0.8.0',
        'ui.errors was renamed to ui.errorAlert in 0.8.0',
        'ui.status was renamed to ui.statusChips in 0.8.0',
        'theme.accentColor was renamed to theme.primary in 0.8.0',
        'initialState.view.minZoom was renamed to view.minZoom in 0.8.0',
        'data.layers.0.dataProjection was renamed to sourceProjection in 0.8.0',
        'data.layers.0.orderLocked was removed in 0.8.0: use `reorderable: false`',
        'data.layers.1.urlTemplate was renamed to url in 0.8.0',
        'data.layers.1.legend.presentation was removed in 0.8.0: the legend draws each symbol at its own size',
        'data.layers.2.styleOverrides was renamed to mapboxStyle.overrides in 0.8.0',
        'data.layers.2.projection was renamed to sourceProjectionDefinition in 0.8.0',
      ]),
    )
  })

  it('fills the defaults of a layer that names its kind', () => {
    const config = defineMapConfig({
      accessibility: { ariaLabel: 'Map' },
      data: { layers: [{ id: 'cities', kind: 'geojson', data: { builtin: 'world' } }] },
    })
    expect(config.data.layers[0]).toMatchObject({
      kind: 'geojson',
      role: 'indicator',
      title: 'cities',
      selectable: true,
      style: { type: 'constant' },
    })
  })

  it('accepts GeoJSON with bbox and other members', () => {
    const result = validateMapConfig({
      accessibility: { ariaLabel: 'Map' },
      data: {
        layers: [
          {
            id: 'points',
            data: { type: 'FeatureCollection', bbox: [0, 0, 1, 1], name: 'Points', features: [] },
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('explains a configuration that cannot be completed', () => {
    const issues = issuesOf({ accessibility: { ariaLabel: 'Map' }, data: { layers: [null] } })
    expect(issues[0]).toMatchObject({ path: '/', code: 'invalid' })
    expect(issues[0]!.message).toMatch(/could not be completed/)
  })

  it('deep-merges profile objects and replaces arrays', () => {
    const ui = resolveMapUi({
      profile: 'compact',
      controls: { placement: 'top-left', groups: [{ id: 'only', controls: ['fullscreen'] }] },
    })
    expect(ui.profile).toBe('compact')
    expect(ui.controls.placement).toBe('top-left')
    expect(ui.controls.zoomStep).toBe(1)
    expect(ui.controls.groups).toEqual([{ id: 'only', controls: ['fullscreen'] }])
    expect(resolveMapUi({ profile: 'grid', legend: { enabled: true } })).toMatchObject({
      legend: { enabled: true },
      popup: { enabled: false },
      time: { enabled: false },
    })
  })

  it('resolves partial message overrides against stable defaults', () => {
    expect(resolveMapMessages({ layers: 'Слоеве' })).toMatchObject({
      layers: 'Слоеве',
      zoomIn: 'Zoom in',
    })
  })

  it('writes theme tokens by name, and only the ones that are set', () => {
    expect(mapThemeStyle(undefined)).toEqual({})
    expect(
      mapThemeStyle({ primary: '#123456', mutedForeground: '#777777', density: 'compact' }),
    ).toEqual({ '--geo-primary': '#123456', '--geo-muted-foreground': '#777777' })
    expect(mapThemeTokenNames.map(themeVariable)).toContain('--geo-control-size')
  })

  it('accepts heatmaps and validates aggregate and layer-panel references', () => {
    const heatmap: MapLayerConfig = {
      id: 'density',
      title: 'Density',
      role: 'indicator',
      kind: 'heatmap',
      data: { type: 'FeatureCollection', features: [] },
      gradient: ['#0000ff', '#ff0000'],
    }
    const configured = (layer: MapLayerConfig, expanded: string[]): MapConfig =>
      defineMapConfig({
        ...valid,
        initialState: { view: valid.initialState.view },
        data: { ...valid.data, layers: [layer] },
        ui: { layerPanel: { defaultExpandedLayerIds: expanded } },
      })
    expect(validateMapConfig(configured(heatmap, ['density']))).toMatchObject({ success: true })
    expect(issuesOf(configured({ ...heatmap, selectable: true }, ['density']))).toContainEqual(
      expect.objectContaining({ path: '/data/layers/0/selectable', code: 'unsupported' }),
    )
    expect(issuesOf(configured(heatmap, ['missing']))).toContainEqual(
      expect.objectContaining({ path: '/ui/layerPanel/defaultExpandedLayerIds/0' }),
    )
  })
})
