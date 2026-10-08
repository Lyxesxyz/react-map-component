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
            kind: 'xyz',
            urlTemplate: 'https://tiles/{z}/{x}/{y}.png',
            sourceProjection: 'EPSG:3857',
            legend: { presentation: 'list' },
          },
          {
            id: 'arcgis',
            title: 'ArcGIS',
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

  it('explains every field renamed or removed in 0.9.0', () => {
    const old = {
      accessibility: { ariaLabel: 'Map' },
      initialState: { selection: { layerId: 'areas', featureId: '1', geographyLevel: 'admin1' } },
      view: { projectionBehavior: { mode: 'automatic' } },
      data: {
        layers: [
          {
            ...layers[0],
            role: 'indicator',
            zIndex: 4,
            hitPriority: 1,
            boundarySetId: 'gadm',
            aboveOverlays: true,
            time: { available: ['2020'], mode: 'property', fieldOrParameter: 'year' },
          },
          {
            id: 'tiles',
            title: 'Tiles',
            kind: 'wmts',
            selectable: true,
            time: { values: ['2020'] },
          },
        ],
        basemaps: [{ id: 'b', title: 'B', supportedProjections: [], layers: [], network: true }],
        hierarchy: [],
        zoomTargets: [{ id: 'world', label: 'World', bounds: [-180, -90, 180, 90], parentId: 'x' }],
      },
      ui: { legend: { defaultOpen: true }, layerPanel: { groupBy: 'role' } },
      messages: { projectionChanged: 'Projection: {projection}' },
    }
    const messages = issuesOf(old).map((issue) => issue.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        'data.layers.0.role was removed in 0.9.0: list layers under a heading with `group`',
        'data.layers.0.zIndex was removed in 0.9.0: layers are drawn in the order of the list',
        'data.layers.0.hitPriority was removed in 0.9.0: the top-most feature is selected',
        'data.layers.0.boundarySetId was removed in 0.9.0: put it in the feature properties if you need it',
        'data.layers.0.aboveOverlays was removed in 0.9.0: only basemap layers can be drawn above your layers',
        'data.layers.0.time.available was renamed to time.values in 0.9.0',
        'data.layers.0.time.fieldOrParameter was renamed to time.field in 0.9.0',
        'data.layers.0.time.mode was removed in 0.9.0: it follows from the layer: `{time}` in the URL, WMS, or a property',
        'data.layers.1.selectable was removed in 0.9.0: only GeoJSON and vector tile (mvt) layers are selectable',
        'data.layers.1.time was removed in 0.9.0: WMTS and ArcGIS layers have no time frames',
        'data.basemaps.0.network was removed in 0.9.0: it had no effect',
        'data.hierarchy was removed in 0.9.0: list zoom target ids in `ui.breadcrumbs.targets`',
        'data.zoomTargets.0.parentId was removed in 0.9.0: list the path in `ui.breadcrumbs.targets`',
        'view.projectionBehavior was removed in 0.9.0: each map has one projection',
        'initialState.selection.geographyLevel was removed in 0.9.0: a selection is `{ layerId, featureId }`',
        'ui.legend.defaultOpen was renamed to ui.legend.expanded in 0.9.0',
        "groupBy 'role' was removed in 0.9.0 with layer roles; use 'group' or 'none'",
        'messages.projectionChanged was removed in 0.9.0: each map has one projection',
      ]),
    )
    expect(issuesOf({ ...valid, messages: { notAMessage: 'x' } })).toContainEqual(
      expect.objectContaining({ path: '/messages' }),
    )
  })

  it('checks references and runtime rules with paths', () => {
    const timed = { ...layers[0]!, time: { values: ['2020', '2021'] } }
    const withRules = defineMapConfig({
      ...valid,
      initialState: { view: valid.initialState.view, selection: { layerId: 'x', featureId: '1' } },
      data: {
        ...valid.data,
        layers: [timed, { ...layers[0]!, id: 'blank', title: ' ' }],
        zoomTargets: [{ id: 'world', label: 'World', bounds: [-180, -90, 180, 90] }],
      },
      ui: { breadcrumbs: { targets: ['world', 'nowhere'] } },
    })
    expect(withRules.initialState.time).toBe('2020')
    expect(issuesOf(withRules).map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        '/data/layers/1/title',
        '/ui/breadcrumbs/targets/1',
        '/initialState/selection/layerId',
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
    expect(
      issuesOf(configured({ ...heatmap, selectable: true } as MapLayerConfig, ['density'])),
    ).toContainEqual(
      expect.objectContaining({
        path: '/data/layers/0/selectable',
        message: expect.stringContaining('only GeoJSON and vector tile (mvt) layers'),
      }),
    )
    expect(issuesOf(configured(heatmap, ['missing']))).toContainEqual(
      expect.objectContaining({ path: '/ui/layerPanel/defaultExpandedLayerIds/0' }),
    )
  })
})
