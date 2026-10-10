// @ts-check
// Where a link in a folder's Markdown points on the site. The guides link to each other and to
// files in the folder by relative path, which works on GitHub and in a team's copy; the site's
// pages live elsewhere, so the guide sync (src/guides/sync.mjs) rewrites every relative target:
//
//   another published page (docs/x.md, README.md, CHANGELOG.md, AGENTS.md) -> its site page
//   a directory of the folder (./examples/, ./docs/)                          -> GitHub tree view
//   any other file of the folder (../examples/quick-start.tsx)                -> GitHub blob view
//   an image                                                                  -> GitHub raw file
//
// Same-page anchors (#x) and absolute URLs (https:, mailto:, …) stay as they are. A target that
// leaves the folder, starts at the root (/x) or does not exist throws: the folder is copied on
// its own, so such a link would be broken in every team's copy too.
import path from 'node:path'

/**
 * @typedef {object} LinkContext
 * @property {string} from The Markdown file, relative to the folder (`docs/configuration.md`).
 * @property {string} folder The folder, relative to the repository root.
 * @property {string} base The site's base path, without a trailing slash (`/react-map-component`).
 * @property {string} repository The repository's URL (`https://github.com/owner/name`).
 * @property {string} branch The branch the site is built from.
 * @property {(path: string) => 'file' | 'directory' | undefined} kindOf What is at a path relative
 *   to the folder ('' is the folder itself).
 * @property {(path: string) => string | undefined} routeOf The site route (below the base, with a
 *   trailing slash) of a published file, by its path relative to the folder.
 */

const absolute = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

/**
 * The site's URL for a link target, or undefined when the target stays as written.
 *
 * @param {string} target The destination as the Markdown parser reports it (escapes resolved).
 * @param {LinkContext} context
 * @param {{ image?: boolean }} [options]
 * @returns {string | undefined}
 */
export function siteUrlFor(target, context, { image = false } = {}) {
  if (target === '' || target.startsWith('#') || absolute.test(target)) return undefined
  const where = `${context.folder}/${context.from}`
  if (target.startsWith('/')) {
    throw new Error(
      `${where}: the link "${target}" starts at the root; link relative to the file instead.`,
    )
  }
  const hashAt = target.indexOf('#')
  const hash = hashAt < 0 ? '' : target.slice(hashAt)
  const beforeHash = hashAt < 0 ? target : target.slice(0, hashAt)
  const queryAt = beforeHash.indexOf('?')
  const query = queryAt < 0 ? '' : beforeHash.slice(queryAt)
  const pathPart = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt)

  let decoded
  try {
    decoded = decodeURIComponent(pathPart)
  } catch {
    throw new Error(`${where}: the link "${target}" is not a valid URL.`)
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(context.from), decoded))
  if (resolved === '..' || resolved.startsWith('../')) {
    throw new Error(
      `${where}: the link "${target}" leaves the folder, which teams copy on its own.`,
    )
  }
  const relative = resolved === '.' || resolved === './' ? '' : resolved.replace(/\/$/, '')
  const kind = context.kindOf(relative)
  if (!kind) throw new Error(`${where}: the link "${target}" points at a file that does not exist.`)

  const inRepository = relative ? `${context.folder}/${relative}` : context.folder
  const github = (/** @type {string} */ view) =>
    `${context.repository}/${view}/${context.branch}/${encodePath(inRepository)}`
  if (image) {
    if (kind !== 'file') throw new Error(`${where}: the image "${target}" is not a file.`)
    return `${github('raw')}${query}`
  }
  if (kind === 'directory') return `${github('tree')}${query}${hash}`
  const route = context.routeOf(relative)
  if (route !== undefined) return `${context.base}/${route}${query}${hash}`
  return `${github('blob')}${query}${hash}`
}

/** @param {string} value A path with `/` separators. */
function encodePath(value) {
  return value.split('/').map(encodeURIComponent).join('/')
}
