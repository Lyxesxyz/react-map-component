import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { examples } from '../src/data/examples.mjs'
import { frameworks } from '../src/guides/catalog.mjs'
import { parseMarkdown, plainText } from '../src/guides/markdown.mjs'
import { listPages } from '../src/guides/sync.mjs'
import { topics } from '../src/sidebar.mjs'
import { GithubSlugger, repoRoot } from './support'

/** The demos' scenario ids, read from the source (importing it would need the demos' aliases). */
function scenarioIds() {
  const source = readFileSync(path.join(repoRoot, 'apps/demo-shared/src/scenarios.ts'), 'utf8')
  const list = /export const scenarioOptions = \[([\s\S]*?)\] as const/.exec(source)?.[1]
  if (!list) throw new Error('scenarios.ts no longer declares `scenarioOptions = [...] as const`')
  return [...list.matchAll(/\bid: '([^']+)'/g)].map((match) => match[1])
}

const pages = listPages(repoRoot)

/** The heading ids of a generated page, by its route below the base. */
function headingIds(route: string) {
  const page = pages.find((candidate) => candidate.route === route)
  if (!page) return undefined
  const slugger = new GithubSlugger()
  const ids = new Set<string>()
  const visit = (node: Parameters<typeof plainText>[0]) => {
    if (node.type === 'heading') ids.add(slugger.slug(plainText(node)))
    for (const child of node.children ?? []) visit(child)
  }
  visit(parseMarkdown(readFileSync(path.join(repoRoot, page.source), 'utf8')))
  return ids
}

describe('the examples (src/data/examples.mjs)', () => {
  it('are demo scenarios, each once', () => {
    const ids = examples.map((example) => example.id)
    expect(new Set(ids).size).toBe(ids.length)
    const scenarios = scenarioIds()
    for (const id of ids) expect(scenarios, id).toContain(id)
  })

  it('name example files that exist in each folder', () => {
    for (const framework of frameworks) {
      const directory = path.join(repoRoot, framework.folder, 'examples')
      for (const example of examples) {
        for (const file of example[framework.id]) {
          expect(
            existsSync(path.join(directory, file)),
            `${example.id}: ${framework.id} ${file}`,
          ).toBe(true)
        }
      }
    }
  })

  it('name guide pages and headings that the site generates', () => {
    for (const example of examples) {
      for (const guide of example.guides ?? []) {
        for (const framework of frameworks) {
          const target = guide[framework.id]
          const [route = '', hash] = target.split('#')
          const ids = headingIds(`${framework.id}/${route}`)
          expect(ids, `${example.id}: ${framework.id} ${target} is not a page`).toBeDefined()
          if (hash) expect(ids?.has(hash), `${example.id}: ${framework.id} ${target}`).toBe(true)
        }
      }
    }
  })
})

describe('the sidebar (src/sidebar.mjs)', () => {
  type Item = string | { label?: string; link?: string; items?: Item[] }
  const flatten = (items: Item[]): Item[] =>
    items.flatMap((item) => (typeof item === 'object' && item.items ? flatten(item.items) : [item]))

  it('lists every generated page of a framework once, in the catalog’s order', () => {
    for (const framework of frameworks) {
      const topic = topics.find((candidate) => candidate.label === framework.label)
      expect(topic && 'items' in topic, framework.id).toBe(true)
      const items = topic && 'items' in topic ? flatten(topic.items as Item[]) : []
      expect(items).toEqual(
        pages.filter((page) => page.framework === framework.id).map((page) => page.id),
      )
      expect(topic?.link).toBe(`/${framework.id}/`)
    }
  })

  it('lists every example under Examples', () => {
    const topic = topics.find((candidate) => candidate.label === 'Examples')
    const items = topic && 'items' in topic ? flatten(topic.items as Item[]) : []
    expect(items).toEqual([
      { label: 'All examples', link: '/examples/' },
      ...examples.map((example) => ({ label: example.title, link: `/examples/${example.id}/` })),
    ])
  })
})
