import { reflectComponentType } from '@angular/core'
import type { Type } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as adminChoropleth from '../src/examples/admin-choropleth'
import * as arcgisIndicators from '../src/examples/arcgis-indicators'
import * as authenticatedData from '../src/examples/authenticated-data'
import * as brandTheme from '../src/examples/brand-theme'
import * as controlledStateAndGrid from '../src/examples/controlled-state-and-grid'
import * as customLayout from '../src/examples/custom-layout'
import * as quickStart from '../src/examples/quick-start'
import { mapReadySelector, waitForMapReady } from '../src/testing'
import { resetControllers } from './fake-controller'

// The examples, guides and agent instructions travel with the folder. These tests keep them
// true: every example renders a valid map, and every file and link they mention exists. The
// React folder has the same checks (packages/geospatial-map/test/examples-and-guides.test.tsx).

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)
// No network: an ArcGIS basemap stays loading, as in a server render.
vi.mock('../src/core/arcgis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/core/arcgis')>()),
  loadArcgisService: () => new Promise<never>(() => undefined),
}))

// (jsdom's `URL` replaces Node's here, so resolve from the file path.)
const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const read = (file: string) => readFileSync(path.join(folder, file), 'utf8')

/** The examples shared with the React folder, which define data or test helpers, not maps. */
const sharedExamples = ['map-ready-check.ts', 'symbology-layers.ts']
/** Every other example (a test below checks that this list is complete). */
const examples: Array<[string, Record<string, unknown>]> = [
  ['admin-choropleth.ts', adminChoropleth],
  ['arcgis-indicators.ts', arcgisIndicators],
  ['authenticated-data.ts', authenticatedData],
  ['brand-theme.ts', brandTheme],
  ['controlled-state-and-grid.ts', controlledStateAndGrid],
  ['custom-layout.ts', customLayout],
  ['quick-start.ts', quickStart],
]

/** Files of the host app a guide may name (the samples' own `regions-map.ts`, say). */
const hostAppFiles = new Set([
  'main.ts',
  'main.server.ts',
  'server.ts',
  'app.ts',
  'app.config.ts',
  'app.config.server.ts',
  'app.routes.ts',
  'app.routes.server.ts',
  'styles.css',
  'regions-map.ts',
])

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    return statSync(file).isDirectory() ? walk(file) : [path.relative(folder, file)]
  })
}
const folderFiles = walk(folder).map((file) => file.split(path.sep).join('/'))
const folderEntries = new Set(readdirSync(folder))

/**
 * The files a document names in backticks (`examples/quick-start.ts`, `icons.ts`) that are not in
 * the folder. A path names a file under the folder's own directories; a bare name may be any
 * file in the folder (`brand-theme.css`). Paths elsewhere (`src/styles.css`, `.claude/CLAUDE.md`)
 * and the listed host files are the app's, and a bare `.tsx` name is the React folder's (the
 * migration guide compares them).
 */
function missingMentions(document: string): { mentioned: number; missing: string[] } {
  const mentions = [...read(document).matchAll(/`((?:[\w.-]+\/)*[\w.-]+\.(?:tsx?|md|css))`/g)]
    .map((match) => match[1]!)
    .filter((file) => !file.includes('*') && !/^[\w.-]+\.tsx$/.test(file))
    .filter((file) =>
      file.includes('/') ? folderEntries.has(file.split('/')[0]!) : !hostAppFiles.has(file),
    )
  const missing = mentions.filter((file) =>
    file.includes('/')
      ? !folderFiles.includes(file)
      : !folderFiles.some((item) => path.posix.basename(item) === file),
  )
  return { mentioned: mentions.length, missing: missing.map((file) => `${document}: ${file}`) }
}

const guides = () => [
  'README.md',
  'AGENTS.md',
  ...readdirSync(path.join(folder, 'docs')).map((name) => `docs/${name}`),
]

describe('examples', () => {
  beforeEach(() => resetControllers())
  afterEach(() => vi.restoreAllMocks())

  it('covers the tasks the agent guide points to', () => {
    const files = readdirSync(path.join(folder, 'examples'))
    for (const name of [
      'quick-start.ts',
      'arcgis-indicators.ts',
      'admin-choropleth.ts',
      'authenticated-data.ts',
      'brand-theme.ts',
      'brand-theme.css',
      'custom-layout.ts',
      'controlled-state-and-grid.ts',
      'map-ready-check.ts',
    ])
      expect(files, name).toContain(name)
    // Every example the guide's task table names exists.
    const named = [...read('AGENTS.md').matchAll(/`(examples\/[\w.-]+)`/g)].map(
      (match) => match[1]!,
    )
    expect(named.length).toBeGreaterThan(8)
    expect(named.filter((file) => !existsSync(path.join(folder, file)))).toEqual([])
  })

  it('renders every example', () => {
    const files = readdirSync(path.join(folder, 'examples')).filter(
      (name) => name.endsWith('.ts') && !sharedExamples.includes(name),
    )
    expect(examples.map(([file]) => file).sort()).toEqual(files.sort())
  })

  it.each(examples)('%s renders valid maps', async (_file, module) => {
    const hints: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
      hints.push(String(message))
    })
    const components = Object.entries(module).filter(
      (entry): entry is [string, Type<unknown>] =>
        typeof entry[1] === 'function' && reflectComponentType(entry[1] as Type<unknown>) !== null,
    )
    expect(components.length).toBeGreaterThan(0)
    for (const [name, component] of components) {
      const fixture = TestBed.createComponent(component)
      const inputs = reflectComponentType(component)!.inputs.map((item) => item.templateName)
      if (inputs.includes('token')) fixture.componentRef.setInput('token', 'test-token')
      await fixture.whenStable()
      const html = (fixture.nativeElement as HTMLElement).innerHTML
      expect(html, name).toMatch(/geo-map-viewport|geo-map-grid/)
      expect(html, name).not.toContain('data-status="error"')
      expect(html, name).not.toContain('role="alert"')
      fixture.destroy()
    }
    // jsdom loads no stylesheet; any other setup hint is a mistake in the example.
    expect(hints.filter((hint) => !hint.includes('geospatial-map.css is not loaded'))).toEqual([])
  })
})

describe('agent guide and docs', () => {
  it('mentions only files that exist in the folder', () => {
    expect(missingMentions('AGENTS.md').mentioned).toBeGreaterThan(15)
    expect(guides().flatMap((document) => missingMentions(document).missing)).toEqual([])
  })

  it('links only to files inside the folder (or to the web)', () => {
    const broken: string[] = []
    for (const document of guides()) {
      for (const [, target] of read(document).matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target!)) continue
        const file = path.resolve(path.dirname(path.join(folder, document)), target!.split('#')[0]!)
        if (!file.startsWith(folder) || !existsSync(file)) broken.push(`${document} → ${target}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('names every guide the README and the agent guide point to', () => {
    for (const name of [
      'getting-started.md',
      'configuration.md',
      'layers-and-legends.md',
      'state-events-templates.md',
      'theming-localization.md',
      'export-grid-integration.md',
      'troubleshooting.md',
      'migration.md',
    ])
      expect(statSync(path.join(folder, 'docs', name)).isFile(), name).toBe(true)
  })

  it('loads the guide for Claude Code through CLAUDE.md', () => {
    expect(read('CLAUDE.md').trim()).toBe('@AGENTS.md')
  })
})

describe('testing helpers', () => {
  it('waits for the ready map, optionally by id', async () => {
    const calls: Array<{ selector: string; timeout: number | undefined }> = []
    const page = {
      locator: (selector: string) => ({
        first: () => ({
          waitFor: async (options?: { timeout?: number }) => {
            calls.push({ selector, timeout: options?.timeout })
          },
        }),
      }),
    }
    await waitForMapReady(page)
    await waitForMapReady(page, { mapId: 'before', timeout: 500 })
    expect(calls).toEqual([
      { selector: '[data-slot="map"][data-status="ready"]', timeout: 15_000 },
      { selector: '[data-slot="map"][data-map-id="before"][data-status="ready"]', timeout: 500 },
    ])
    expect(mapReadySelector()).toBe(calls[0]!.selector)
  })
})
