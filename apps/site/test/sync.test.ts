import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { branch, repository } from '../site.config.mjs'
import { frameworks } from '../src/guides/catalog.mjs'
import { parseMarkdown, plainText } from '../src/guides/markdown.mjs'
import { gitLastUpdated, listPages, syncGuides, type SyncResult } from '../src/guides/sync.mjs'
import { GithubSlugger, parseFrontmatter, repoRoot, temporaryDirectory } from './support'

const base = '/react-map-component'
const options = { repoRoot, base, repository, branch, siteTitle: 'Geospatial map' }

type Node = { type: string; url?: string; depth?: number; children?: Node[] }

function walk(node: Node, visit: (node: Node) => void) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

/** The ids GitHub (and Astro) give the headings of a Markdown file, its H1 included. */
function headingIds(markdown: string) {
  const slugger = new GithubSlugger()
  const ids = new Set<string>()
  walk(parseMarkdown(markdown) as Node, (node) => {
    if (node.type === 'heading') ids.add(slugger.slug(plainText(node)))
  })
  return ids
}

/** Every link, image and definition target in a Markdown file. */
function targets(markdown: string) {
  const found: string[] = []
  walk(parseMarkdown(markdown) as Node, (node) => {
    if (node.url !== undefined) found.push(node.url)
  })
  return found
}

/** The Markdown with every link target replaced by `URL`, to compare everything else. */
function withoutTargets(markdown: string) {
  return markdown
    .replace(/\]\((<[^>]*>|[^)\s]*)/g, '](URL')
    .replace(/^(\[[^\]]+\]:) \S+/gm, '$1 URL')
}

describe('the guide sync, over both folders', () => {
  const pages = listPages(repoRoot)
  let outDir = ''
  let result: SyncResult
  const read = (file: string) => readFileSync(path.join(outDir, file), 'utf8')

  beforeAll(() => {
    outDir = temporaryDirectory()
    result = syncGuides({ ...options, outDir })
  })
  afterAll(() => rmSync(outDir, { recursive: true, force: true }))

  it('writes every page: README, eight guides, changelog and agents’ guide per framework', () => {
    const expected = frameworks.flatMap((framework) => {
      const docs = readdirSync(path.join(repoRoot, framework.folder, 'docs'))
      expect(docs).toHaveLength(8)
      return [
        `${framework.id}/index.md`,
        ...docs.map((name) => `${framework.id}/guides/${name}`),
        `${framework.id}/changelog.md`,
        `${framework.id}/agents.md`,
      ]
    })
    expect([...result.written].sort()).toEqual(expected.sort())
    for (const file of expected) expect(existsSync(path.join(outDir, file)), file).toBe(true)
    expect(result.pages.map((page) => page.file).sort()).toEqual(expected.sort())
  })

  it('lists every guide of each folder in the catalog, so the sidebar shows them in order', () => {
    for (const framework of frameworks) {
      const docs = readdirSync(path.join(repoRoot, framework.folder, 'docs'))
        .map((name) => name.replace(/\.md$/, ''))
        .sort()
      expect(framework.guides.map((guide) => guide.stem).sort(), framework.id).toEqual(docs)
    }
    const [react, angular] = frameworks
    const order = (stems: string[]) => stems.map((stem) => stem.replace(/-(slots|templates)$/, ''))
    expect(order(angular?.guides.map((guide) => guide.stem) ?? [])).toEqual(
      order(react?.guides.map((guide) => guide.stem) ?? []),
    )
  })

  it('keeps each page’s Markdown as written, apart from the title and the link targets', () => {
    for (const page of pages) {
      const source = readFileSync(path.join(repoRoot, page.source), 'utf8')
      const { content } = parseFrontmatter(read(page.file))
      const body = source.slice(source.indexOf('\n')).trimStart()
      expect(withoutTargets(content.trimStart()), page.file).toBe(withoutTargets(body))
    }
  })

  it('rewrites every relative link: site links reach a generated page and heading', () => {
    const ids = new Map(
      pages.map((page) => [
        `${base}/${page.route}`,
        headingIds(readFileSync(path.join(repoRoot, page.source), 'utf8')),
      ]),
    )
    let siteLinks = 0
    for (const page of pages) {
      const own = ids.get(`${base}/${page.route}`)
      for (const target of targets(parseFrontmatter(read(page.file)).content)) {
        if (/^(https?:|mailto:)/.test(target)) continue
        const [pathname = '', hash] = target.split('#')
        if (pathname === '') {
          expect(own?.has(hash ?? ''), `${page.file}: ${target}`).toBe(true)
          continue
        }
        expect(pathname.startsWith(`${base}/`), `${page.file}: ${target} is not rewritten`).toBe(
          true,
        )
        siteLinks++
        const headings = ids.get(pathname)
        expect(headings, `${page.file}: ${target} is not a generated page`).toBeDefined()
        if (hash)
          expect(headings?.has(hash), `${page.file}: ${target} has no such heading`).toBe(true)
      }
    }
    expect(siteLinks).toBeGreaterThan(20)
  })

  it('points the other links at files and directories of the folder on GitHub', () => {
    const prefix = new RegExp(`^${repository}/(blob|tree|raw)/${branch}/`)
    let githubLinks = 0
    for (const page of pages) {
      const folder = frameworks.find((framework) => framework.id === page.framework)?.folder ?? ''
      for (const target of targets(parseFrontmatter(read(page.file)).content)) {
        const match = prefix.exec(target)
        if (!match) continue
        githubLinks++
        const file = decodeURIComponent(target.slice(match[0].length).split('#')[0] ?? '')
        expect(file.startsWith(`${folder}/`) || file === folder, target).toBe(true)
        const stats = statSync(path.join(repoRoot, file))
        expect(stats.isDirectory(), target).toBe(match[1] === 'tree')
      }
    }
    expect(githubLinks).toBeGreaterThan(10)
  })

  it('titles each page from its H1, and tells React and Angular apart in <title>', () => {
    const titles = new Set<string>()
    for (const page of pages) {
      const { frontmatter } = parseFrontmatter(read(page.file))
      const source = readFileSync(path.join(repoRoot, page.source), 'utf8')
      const h1 = /^# (.+)$/m.exec(source)?.[1]?.replaceAll('`', '')
      expect(frontmatter['title'], page.file).toBe(h1)
      expect(frontmatter['framework']).toBe(page.framework)
      expect(frontmatter['topic']).toBe(page.framework)
      expect(frontmatter['editUrl']).toBe(`${repository}/edit/${branch}/${page.source}`)
      expect(frontmatter['description'], page.file).toEqual(expect.any(String))
      expect(frontmatter['sidebar']).toEqual({ label: expect.any(String), order: page.order })
      const [head] = frontmatter['head'] as { tag: string; content: string }[]
      expect(head?.tag).toBe('title')
      titles.add(head?.content ?? '')
    }
    expect(titles.size).toBe(pages.length)
  })

  it('writes nothing when nothing changed, and deletes copies whose source is gone', () => {
    const stale = path.join(outDir, 'react/guides/removed.md')
    writeFileSync(stale, read('react/guides/migration.md'))
    const own = path.join(outDir, 'react/notes.md')
    writeFileSync(own, '---\ntitle: Not generated\n---\n')
    mkdirSync(path.join(outDir, 'angular/empty/inner'), { recursive: true })
    writeFileSync(path.join(outDir, 'angular/empty/inner/old.md'), read('angular/agents.md'))

    const again = syncGuides({ ...options, outDir })
    expect(again.written).toEqual([])
    expect(again.removed.sort()).toEqual(['angular/empty/inner/old.md', 'react/guides/removed.md'])
    expect(existsSync(stale)).toBe(false)
    expect(existsSync(path.join(outDir, 'angular/empty'))).toBe(false)
    expect(existsSync(own)).toBe(true)
  })
})

describe('the last-updated dates', () => {
  it('come from one git log, for the files git knows', () => {
    if (!existsSync(path.join(repoRoot, '.git'))) return
    const files = listPages(repoRoot).map((page) => page.source)
    const dates = gitLastUpdated(repoRoot, [...files, 'packages/not-a-file.md'])
    for (const file of files) expect(dates.get(file), file).toBeInstanceOf(Date)
    expect(dates.has('packages/not-a-file.md')).toBe(false)
  })

  it('are left out outside a git checkout', () => {
    const outside = temporaryDirectory()
    try {
      expect(gitLastUpdated(outside, ['README.md']).size).toBe(0)
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
