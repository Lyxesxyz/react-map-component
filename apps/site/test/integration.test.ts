import { EventEmitter } from 'node:events'
import { existsSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AstroIntegration } from 'astro'
import { afterEach, describe, expect, it } from 'vitest'
import { guides } from '../src/integrations/guides.mjs'
import { repoRoot, site, temporaryDirectory } from './support'

type Hooks = AstroIntegration['hooks']
type ConfigSetup = Parameters<NonNullable<Hooks['astro:config:setup']>>[0]
type ServerSetup = Parameters<NonNullable<Hooks['astro:server:setup']>>[0]

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

/** The integration run against the real folders, writing into a temporary srcDir. */
function setUp(command: ConfigSetup['command']) {
  const srcDir = temporaryDirectory()
  directories.push(srcDir)
  const messages: string[] = []
  const logger = {
    info: (message: string) => messages.push(message),
    error: (message: string) => messages.push(`error: ${message}`),
  }
  const integration = guides({ siteTitle: 'Geospatial map' })
  integration.hooks['astro:config:setup']?.({
    config: {
      root: pathToFileURL(`${site}/`),
      srcDir: pathToFileURL(`${srcDir}/`),
      base: '/react-map-component',
    },
    command,
    logger,
  } as unknown as ConfigSetup)
  return { integration, logger, messages, docs: path.join(srcDir, 'content/docs') }
}

describe('the guides integration', () => {
  it('writes the pages before Astro loads the content', () => {
    const { docs, messages } = setUp('sync')
    expect(existsSync(path.join(docs, 'react/guides/getting-started.md'))).toBe(true)
    expect(existsSync(path.join(docs, 'angular/guides/state-events-templates.md'))).toBe(true)
    expect(messages).toEqual(['22 pages from the folders: 22 written, 0 removed'])
  })

  it('does nothing for astro preview, which serves the built site', () => {
    const { docs } = setUp('preview')
    expect(existsSync(docs)).toBe(false)
  })

  it('watches the sources under astro dev and writes again when one changes', () => {
    const { integration, logger, messages, docs } = setUp('dev')
    const watcher = Object.assign(new EventEmitter(), {
      watched: [] as string[],
      add(paths: string[]) {
        this.watched.push(...paths)
      },
    })
    integration.hooks['astro:server:setup']?.({
      server: { watcher },
      logger,
    } as unknown as ServerSetup)

    const folder = path.join(repoRoot, 'packages/geospatial-map/src')
    expect(watcher.watched).toContain(path.join(folder, 'docs'))
    expect(watcher.watched).toContain(path.join(folder, 'README.md'))

    const page = path.join(docs, 'react/guides/migration.md')
    const content = readFileSync(page, 'utf8')
    unlinkSync(page)
    watcher.emit('change', path.join(repoRoot, 'apps/site/src/other.ts'))
    expect(existsSync(page)).toBe(false)
    watcher.emit('change', path.join(folder, 'docs/migration.md'))
    expect(readFileSync(page, 'utf8')).toBe(content)
    expect(messages.at(-1)).toBe('22 pages from the folders: 1 written, 0 removed')
  })
})
