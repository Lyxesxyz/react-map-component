// The folders' own files, read at build time, so the code on the site is always the code a team
// copies: the example files (shown on the example pages and the landing page) and the install and
// stylesheet lines of each folder's README.md (read from its page, src/content/docs/<framework>/,
// whose code blocks are the README's, unchanged).
import { getEntry } from 'astro:content'
import versionSource from '../../../../packages/geospatial-map/src/version.ts?raw'
import { frameworks } from '../guides/catalog.mjs'
import type { Framework } from './demo-url'

const exampleFiles: Record<Framework, Record<string, string>> = {
  react: import.meta.glob<string>('../../../../packages/geospatial-map/src/examples/*', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  angular: import.meta.glob<string>('../../../../packages/geospatial-map-angular/src/examples/*', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
}

/** The copied folder of a framework, relative to the repository root. */
export function folderOf(framework: Framework): string {
  const entry = frameworks.find((candidate) => candidate.id === framework)
  if (!entry) throw new Error(`No folder for ${framework} in src/guides/catalog.mjs`)
  return entry.folder
}

/** The language Expressive Code highlights a file in, from its extension. */
export function languageOf(file: string): string {
  const extension = file.slice(file.lastIndexOf('.') + 1)
  return (
    { tsx: 'tsx', ts: 'ts', css: 'css', json: 'json', html: 'html', md: 'md' }[extension] ?? 'text'
  )
}

/** An example file of a folder (`quick-start.tsx`), as it is in examples/. */
export function exampleFile(framework: Framework, file: string): string {
  const entry = Object.entries(exampleFiles[framework]).find(([key]) => key.endsWith(`/${file}`))
  if (!entry) throw new Error(`${folderOf(framework)}/examples/${file} does not exist`)
  return entry[1].replace(/\s+$/, '')
}

/**
 * The first fenced code block under a heading of a folder's README.md (`1. Install`), up to the
 * next heading of the same or a higher level.
 */
export async function readmeCode(
  framework: Framework,
  heading: string,
): Promise<{ lang: string; code: string }> {
  const readme = (await getEntry('docs', framework))?.body
  if (!readme) throw new Error(`No page for ${folderOf(framework)}/README.md (src/guides)`)
  const lines = readme.split(/\r?\n/)
  const start = lines.findIndex(
    (line) => /^#{2,4} /.test(line) && line.replace(/^#+ /, '') === heading,
  )
  if (start === -1) throw new Error(`${folderOf(framework)}/README.md has no heading "${heading}"`)
  const level = /^#+/.exec(lines[start] ?? '')?.[0].length ?? 2
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index] ?? ''
    const heading = /^(#+) /.exec(line)
    if (heading && (heading[1]?.length ?? 0) <= level) break
    const fence = /^```(\w*)\s*$/.exec(line)
    if (!fence) continue
    const end = lines.findIndex((candidate, at) => at > index && /^```\s*$/.test(candidate))
    if (end === -1) break
    return { lang: fence[1] || 'text', code: lines.slice(index + 1, end).join('\n') }
  }
  throw new Error(`${folderOf(framework)}/README.md has no code block under "${heading}"`)
}

/** The release of the folders (version.ts; both folders are released together). */
export const version = /GEOSPATIAL_MAP_VERSION = '([^']+)'/.exec(versionSource)?.[1] ?? ''
