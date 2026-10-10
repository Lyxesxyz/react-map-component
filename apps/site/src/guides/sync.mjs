// @ts-check
// Writes the site's copies of both folders' Markdown into src/content/docs/<framework>/ (see
// src/guides/catalog.mjs for what is published where). Every page is rendered before anything is
// written, so a broken link leaves the previous copies in place; a file is written only when its
// content changed (the dev server reloads on every write), and copies whose source is gone are
// deleted. The guides integration (src/integrations/guides.mjs) runs this before Astro loads the
// content, for every command; the output directories are gitignored.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { frameworks, pagesOf } from './catalog.mjs'
import { generatedMarker, renderPage } from './page.mjs'

/**
 * Every page the site generates, both frameworks, in sidebar order.
 *
 * @param {string} repoRoot
 * @returns {import('./catalog.mjs').Page[]}
 */
export function listPages(repoRoot) {
  return frameworks.flatMap((framework) => {
    const docs = path.join(repoRoot, framework.folder, 'docs')
    const stems = readdirSync(docs, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name.slice(0, -'.md'.length))
    return pagesOf(framework, stems)
  })
}

/**
 * What is at a path inside a directory, with the exact case of every segment (a link that only
 * works on a case-insensitive disk is broken on GitHub and on Linux).
 *
 * @param {string} directory
 * @param {string} relative A path with `/` separators; '' is the directory itself.
 * @returns {'file' | 'directory' | undefined}
 */
export function kindAt(directory, relative) {
  let current = directory
  for (const segment of relative ? relative.split('/') : []) {
    if (!existsSync(current) || !statSync(current).isDirectory()) return undefined
    if (!readdirSync(current).includes(segment)) return undefined
    current = path.join(current, segment)
  }
  if (!existsSync(current)) return undefined
  return statSync(current).isDirectory() ? 'directory' : 'file'
}

/**
 * The date of the last commit that touched each file, in one `git log` (one per file is slow), or
 * none for a file git does not know. Empty when git is missing or the checkout is not a repository.
 * A shallow clone dates every file to its one commit.
 *
 * @param {string} repoRoot
 * @param {string[]} files Relative to the repository root, with `/` separators.
 * @returns {Map<string, Date>}
 */
export function gitLastUpdated(repoRoot, files) {
  /** @type {Map<string, Date>} */
  const dates = new Map()
  let output
  try {
    output = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', 'log', '--format=%x01%cI', '--name-only', '--', ...files],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 },
    )
  } catch {
    return dates
  }
  /** @type {Date | undefined} */
  let date
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('\u0001')) {
      const parsed = new Date(line.slice(1).trim())
      date = Number.isNaN(parsed.getTime()) ? undefined : parsed
    } else if (line && date && !dates.has(line)) {
      dates.set(line, date)
    }
  }
  return dates
}

/**
 * @typedef {object} SyncOptions
 * @property {string} repoRoot The repository's root directory.
 * @property {string} outDir Where the pages go (the site's src/content/docs).
 * @property {string} base The site's base path, without a trailing slash.
 * @property {string} repository
 * @property {string} branch
 * @property {string} siteTitle
 * @property {(file: string) => Date | undefined} [lastUpdated] The source's last change, by its
 *   path relative to the repository root (default: the date of its last commit).
 */

/**
 * @typedef {object} SyncResult
 * @property {import('./catalog.mjs').Page[]} pages
 * @property {string[]} written The files written, relative to outDir.
 * @property {string[]} removed The stale copies deleted, relative to outDir.
 */

/**
 * @param {SyncOptions} options
 * @returns {SyncResult}
 */
export function syncGuides(options) {
  const { repoRoot, outDir } = options
  const base = options.base.replace(/\/+$/, '')
  const pages = listPages(repoRoot)
  const dates = options.lastUpdated
    ? undefined
    : gitLastUpdated(
        repoRoot,
        pages.map((page) => page.source),
      )
  const lastUpdated = options.lastUpdated ?? ((/** @type {string} */ file) => dates?.get(file))

  /** @type {Map<string, string>} */
  const contents = new Map()
  for (const framework of frameworks) {
    const own = pages.filter((page) => page.framework === framework.id)
    const routes = new Map(own.map((page) => [page.path, page.route]))
    const folder = path.join(repoRoot, framework.folder)
    for (const page of own) {
      const source = readFileSync(path.join(repoRoot, page.source), 'utf8')
      const content = renderPage(source, {
        page,
        framework,
        siteTitle: options.siteTitle,
        base,
        repository: options.repository,
        branch: options.branch,
        lastUpdated: lastUpdated(page.source),
        kindOf: (relative) => kindAt(folder, relative),
        routeOf: (relative) => routes.get(relative),
      })
      contents.set(page.file, content)
    }
  }

  /** @type {string[]} */
  const written = []
  for (const [file, content] of contents) {
    const target = path.join(outDir, file)
    if (existsSync(target) && readFileSync(target, 'utf8') === content) continue
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
    written.push(file)
  }

  /** @type {string[]} */
  const removed = []
  for (const framework of frameworks) {
    removeStale(outDir, framework.id, contents, removed)
  }
  return { pages, written, removed }
}

/**
 * Deletes generated files under outDir/<directory> that the sync no longer writes, then the
 * directories that are left empty. Files without the generated marker are left alone.
 *
 * @param {string} outDir
 * @param {string} directory Relative to outDir, with `/` separators.
 * @param {Map<string, string>} keep The generated files, relative to outDir.
 * @param {string[]} removed Collects the deleted files.
 */
function removeStale(outDir, directory, keep, removed) {
  const absolute = path.join(outDir, directory)
  if (!existsSync(absolute)) return
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`
    const full = path.join(absolute, entry.name)
    if (entry.isDirectory()) {
      removeStale(outDir, relative, keep, removed)
      if (readdirSync(full).length === 0) rmdirSync(full)
    } else if (!keep.has(relative) && isGenerated(full)) {
      unlinkSync(full)
      removed.push(relative)
    }
  }
}

/** @param {string} file */
function isGenerated(file) {
  const [, second] = readFileSync(file, 'utf8').split('\n', 2)
  return second?.startsWith(generatedMarker) ?? false
}
