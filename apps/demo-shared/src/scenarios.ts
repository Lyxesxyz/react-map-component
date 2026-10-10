// The demo routes, shared by the React demo (apps/demo) and the Angular demo (apps/demo-angular)
// so both serve the same scenarios from the same URLs. Framework-neutral: plain data and
// functions, no React or Angular. The browser suite (tests/browser) drives these routes.
import { initialView } from './demo-config'

/** Every scenario, in the order the harness's "Scenario" select lists them. */
export const scenarioOptions = [
  { id: 'global', label: 'Global choropleth' },
  { id: 'geometry', label: 'Geometry types' },
  { id: 'points', label: 'Point & density layers' },
  { id: 'layers', label: 'Layer controls' },
  { id: 'time', label: 'Time series' },
  { id: 'raster', label: 'Raster' },
  { id: 'grid', label: '3 × 2 grid' },
  { id: 'configuration', label: 'Configuration playground' },
  { id: 'composed', label: 'Composed parts & styling' },
  { id: 'quickstart', label: 'Quick start (short config)' },
  { id: 'features', label: 'Basemap, clusters & overlays' },
  { id: 'arcgis', label: 'ArcGIS basemap + indicators' },
  { id: 'themes', label: 'Design-system themes' },
  { id: 'errors', label: 'Error handling' },
  { id: 'checks', label: 'Engine checks' },
] as const

export type ScenarioId = (typeof scenarioOptions)[number]['id']

export const scenarioIds: readonly ScenarioId[] = scenarioOptions.map((option) => option.id)

export function isScenarioId(value: unknown): value is ScenarioId {
  return scenarioIds.includes(value as ScenarioId)
}

/**
 * Scenarios with a component of their own. The others (global, geometry, points, layers, time,
 * raster, configuration, errors) run on the main harness map with different layers and UI.
 */
export const dedicatedScenarios = [
  'grid',
  'quickstart',
  'features',
  'arcgis',
  'themes',
  'checks',
  'composed',
] as const satisfies readonly ScenarioId[]

export type DedicatedScenarioId = (typeof dedicatedScenarios)[number]

/** The themes of `?scenario=themes`. Each one but `default` is a stylesheet in styles/themes. */
export const demoThemes = ['default', 'material', 'carbon', 'editorial'] as const

export type DemoTheme = (typeof demoThemes)[number]

export const demoThemeLabels: Record<DemoTheme, string> = {
  default: 'Default',
  material: 'Material',
  carbon: 'Carbon',
  editorial: 'Editorial',
}

/** The renderers `?renderer=` can force on the benchmark points. */
export type BenchmarkRenderer = 'canvas' | 'webgl'

/** What the URL asks the harness for. Every field has a default, so `/` is a complete route. */
export type HarnessParams = {
  /** `?scenario=`: the scenario the harness opens with (unknown ids open `global`). */
  scenario: ScenarioId
  /** `?sources`: the GeoJSON, XYZ, WMS, WMTS and MVT source fixtures on the main map. */
  sources: boolean
  /** `?points=`: the number of benchmark points on the main map; `0` is off. */
  points: number
  /** `?renderer=canvas|webgl`: the benchmark points' renderer (otherwise `auto`). */
  renderer: BenchmarkRenderer | undefined
  /** `?controlled`: the main map's complete state is held by the host. */
  controlled: boolean
  /** `?hidden`: the map starts in a hidden container, with a "Reveal map" button. */
  hidden: boolean
  /** `?basemap=`: the basemap id the URL asks for, if any. */
  basemap: string | undefined
  /**
   * `?projection=`: a developer setting (users cannot change it on the map). Without it, the
   * ArcGIS Equal Earth basemap brings its own projection and everything else uses Equal Earth.
   */
  projection: string
  /**
   * The basemap the main map starts with: `?basemap=`, else the Esri World Basemap (`esri-world`)
   * in Equal Earth and the reference basemap in Web Mercator.
   */
  activeBasemap: string
  /** `?theme=`: the themes scenario's starting theme (`material` unless another is named). */
  theme: DemoTheme
  /** `?dark`: the themes scenario starts in dark mode. */
  dark: boolean
  /** `?hook-fails`: the checks scenario's `onOpenLayersMap` throws (an error check). */
  hookFails: boolean
  /**
   * `?embed`: only the map, filling the window (the docs site's iframes); the harness chrome
   * (header, toolbars, data table, inspector) is hidden. Works with every scenario.
   */
  embed: boolean
}

/** Reads the harness parameters from a query string (`window.location.search` by default). */
export function parseHarnessParams(
  search: string | URLSearchParams = window.location.search,
): HarnessParams {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const requested = params.get('scenario')
  const points = Number(params.get('points') ?? 0)
  const basemap = params.get('basemap') ?? undefined
  const projection =
    params.get('projection') ??
    (basemap === 'arcgis-equal-earth' ? 'ESRI:EQUAL-EARTH-CM11' : initialView.projection)
  return {
    scenario: isScenarioId(requested) ? requested : 'global',
    sources: params.has('sources'),
    points: Number.isFinite(points) && points > 0 ? points : 0,
    renderer: (['canvas', 'webgl'] as const).find(
      (renderer) => renderer === params.get('renderer'),
    ),
    controlled: params.has('controlled'),
    hidden: params.has('hidden'),
    basemap,
    projection,
    activeBasemap: basemap ?? (projection === 'EPSG:3857' ? 'reference-mercator' : 'esri-world'),
    theme: demoThemes.find((theme) => theme === params.get('theme')) ?? 'material',
    dark: params.has('dark'),
    hookFails: params.has('hook-fails'),
    embed: params.has('embed'),
  }
}

/**
 * What the harness renders for a scenario: the scenario's own component, or `map` (the main
 * harness map). The source and benchmark fixtures always use the main map.
 */
export function harnessView(
  scenario: ScenarioId,
  params: Pick<HarnessParams, 'sources' | 'points'>,
): DedicatedScenarioId | 'map' {
  if (params.sources || params.points > 0) return 'map'
  return (dedicatedScenarios as readonly ScenarioId[]).includes(scenario)
    ? (scenario as DedicatedScenarioId)
    : 'map'
}

/** The default address of the other demo: the React demo on 5173, the Angular demo on 4200. */
export const defaultDemoUrls = {
  react: 'http://127.0.0.1:5173',
  angular: 'http://127.0.0.1:4200',
} as const

/**
 * The link to the same route in the other demo: the same path (below each demo's base) and the
 * same query string, with `scenario` set to the scenario on screen when the harness's select
 * has moved away from the URL's.
 *
 * @param target The other demo's URL, absolute or relative to this page.
 * @param location This page's location (`window.location`).
 * @param base This demo's base path (`/` unless it is served below a path).
 * @param scenario The scenario on screen.
 */
export function counterpartDemoHref(
  target: string,
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>,
  base = '/',
  scenario?: ScenarioId,
): string {
  const url = new URL(target, location.href)
  const ownBase = base.endsWith('/') ? base : `${base}/`
  const route = location.pathname.startsWith(ownBase)
    ? location.pathname.slice(ownBase.length)
    : location.pathname.replace(/^\//, '')
  url.pathname = `${url.pathname.replace(/\/?$/, '/')}${route}`
  const params = new URLSearchParams(location.search)
  if (scenario && scenario !== parseHarnessParams(params).scenario) {
    params.set('scenario', scenario)
    url.search = params.toString()
  } else {
    url.search = location.search
  }
  url.hash = location.hash
  return url.toString()
}
