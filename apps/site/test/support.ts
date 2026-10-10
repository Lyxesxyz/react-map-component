// Shared by the site's tests: paths, and two modules Astro itself uses, resolved through Astro so
// the tests check against exactly what the build does (the site doesn't depend on them directly).
import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = path.resolve(site, '../..')

const astro = createRequire(createRequire(import.meta.url).resolve('astro/package.json'))

/** The heading slugger of Astro's Markdown processor, which is GitHub's (github-slugger). */
export const { default: GithubSlugger } = (await import(
  pathToFileURL(astro.resolve('github-slugger')).href
)) as { default: new () => { slug(value: string): string } }

/** Astro's frontmatter parser for content entries. */
export const { parseFrontmatter } = (await import(
  pathToFileURL(astro.resolve('@astrojs/internal-helpers/frontmatter')).href
)) as { parseFrontmatter(code: string): { frontmatter: Record<string, unknown>; content: string } }

/** A new empty directory for one test. */
export function temporaryDirectory() {
  return mkdtempSync(path.join(os.tmpdir(), 'geospatial-map-site-test-'))
}
