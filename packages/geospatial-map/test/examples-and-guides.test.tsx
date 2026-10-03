/// <reference types="vite/client" />
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mapReadySelector, waitForMapReady } from '../src/testing'

// The examples, guides and agent instructions travel with the folder. These tests keep them
// true: every example renders a valid map, and every file and link they mention exists.

const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const read = (file: string) => readFileSync(path.join(folder, file), 'utf8')

const examples = import.meta.glob<Record<string, unknown>>('../src/examples/*.tsx', {
  eager: true,
})

describe('examples', () => {
  it('covers the tasks the agent guide points to', () => {
    const files = readdirSync(path.join(folder, 'examples'))
    for (const name of [
      'quick-start.tsx',
      'arcgis-indicators.tsx',
      'admin-choropleth.tsx',
      'authenticated-data.tsx',
      'brand-theme.tsx',
      'brand-theme.css',
      'custom-layout.tsx',
      'controlled-state-and-grid.tsx',
      'map-ready-check.ts',
    ])
      expect(files, name).toContain(name)
  })

  it.each(Object.entries(examples))('%s renders valid maps', (_file, module) => {
    const components = Object.entries(module).filter(
      (entry): entry is [string, ComponentType<Record<string, unknown>>] =>
        typeof entry[1] === 'function' && /^[A-Z]/.test(entry[0]),
    )
    expect(components.length).toBeGreaterThan(0)
    for (const [name, Component] of components) {
      const html = renderToString(<Component token="test-token" />)
      expect(html, name).toMatch(/geo-map-viewport|geo-map-grid/)
      expect(html, name).not.toContain('data-status="error"')
      expect(html, name).not.toContain('role="alert"')
    }
  })
})

describe('agent guide and docs', () => {
  it('mentions only files that exist in the folder', () => {
    const guide = read('AGENTS.md')
    const mentioned = [...guide.matchAll(/`((?:[\w-]+\/)*[\w.-]+\.(?:tsx?|md|css))`/g)].map(
      (match) => match[1]!,
    )
    expect(mentioned.length).toBeGreaterThan(15)
    const missing = mentioned.filter(
      (file) => !file.includes('*') && !existsSync(path.join(folder, file)),
    )
    expect(missing).toEqual([])
  })

  it('links only to files inside the folder (or to the web)', () => {
    const documents = [
      'README.md',
      'AGENTS.md',
      ...readdirSync(path.join(folder, 'docs')).map((name) => `docs/${name}`),
    ]
    const broken: string[] = []
    for (const document of documents) {
      for (const [, target] of read(document).matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target!)) continue
        const file = path.resolve(path.dirname(path.join(folder, document)), target!.split('#')[0]!)
        if (!file.startsWith(folder) || !existsSync(file)) broken.push(`${document} → ${target}`)
      }
    }
    expect(broken).toEqual([])
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
