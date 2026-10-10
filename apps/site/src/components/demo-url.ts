// Where the embedded demos live, for the pages (at build time) and the frames' script (in the
// browser). A build serves them below the site, at <base>/demo/react/ and <base>/demo/angular/
// (scripts/build.mjs). Under `astro dev` those folders don't exist, so the frames load the demos'
// own dev servers instead (pnpm dev:react, pnpm dev:angular), or PUBLIC_DEMO_REACT_URL and
// PUBLIC_DEMO_ANGULAR_URL when they are set.

export type Framework = 'react' | 'angular'

export const frameworkIds: readonly Framework[] = ['react', 'angular']

/** The label of each framework. It is also the tab label Starlight's synced tabs remember. */
export const frameworkLabels: Record<Framework, string> = { react: 'React', angular: 'Angular' }

/**
 * Starlight's key for `<Tabs syncKey="framework">` in localStorage. The demo frames use it too,
 * so a framework picked on a frame, a code tab or a guide page is the one every other shows.
 */
export const frameworkStorageKey = 'starlight-synced-tabs__framework'

/** The site's base path without a trailing slash ('' for a site at the root of its domain). */
export const base = import.meta.env.BASE_URL.replace(/\/+$/, '')

/** A page or file below the site's base: `sitePath('react/')` is `/react-map-component/react/`. */
export function sitePath(path: string): string {
  return `${base}/${path.replace(/^\/+/, '')}`
}

/** Dev servers of the demos, as `pnpm dev:react` and `pnpm dev:angular` start them. */
const devServers: Record<Framework, string> = {
  react: import.meta.env.PUBLIC_DEMO_REACT_URL || 'http://127.0.0.1:5173/',
  angular: import.meta.env.PUBLIC_DEMO_ANGULAR_URL || 'http://127.0.0.1:4200/',
}

/** The folder a demo is served from, with a trailing slash. */
function demoRoot(framework: Framework): string {
  const root = import.meta.env.DEV ? devServers[framework] : sitePath(`demo/${framework}/`)
  return root.replace(/[?#].*$/, '').replace(/\/?$/, '/')
}

/** One view of a demo: a scenario, the extra query parameters, and whether it is embedded. */
export interface DemoView {
  /** The scenario (`?scenario=<id>`, apps/demo-shared/src/scenarios.ts). */
  scenario: string
  /** More parameters, such as `&theme=carbon&dark` (a leading `?` or none works too). */
  query?: string
  /** `&embed`: only the map, filling the frame (the default). False shows the whole demo. */
  embed?: boolean
}

/** A demo's URL: the embedded map by default, or the whole demo with `embed: false`. */
export function demoUrl(framework: Framework, { scenario, query = '', embed = true }: DemoView) {
  const extra = query.replace(/^[?&]+/, '')
  return (
    `${demoRoot(framework)}?scenario=${encodeURIComponent(scenario)}` +
    `${embed ? '&embed' : ''}${extra ? `&${extra}` : ''}`
  )
}

/** The other framework. */
export function otherFramework(framework: Framework): Framework {
  return framework === 'react' ? 'angular' : 'react'
}
