// @ts-check
// The Astro integration that publishes both folders' Markdown (README, guides, changelog, agents'
// guide) as pages: before Astro loads the content, for every command (dev, build, check, sync),
// it writes the site's copies into src/content/docs/<framework>/ (src/guides/sync.mjs). Under
// `astro dev` it watches the sources and writes again when one changes; Astro then reloads the
// page. A broken link fails `astro build` and `astro check`, and is logged under `astro dev`.
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { branch, repository } from '../../site.config.mjs'
import { frameworks } from '../guides/catalog.mjs'
import { syncGuides } from '../guides/sync.mjs'

/** What the pages are made from, in each folder (examples/ for the links that point into it). */
const watched = ['README.md', 'CHANGELOG.md', 'AGENTS.md', 'docs', 'examples']

/**
 * @param {object} options
 * @param {string} options.siteTitle The site's title (Starlight's `title`), for page titles.
 * @returns {import('astro').AstroIntegration}
 */
export function guides({ siteTitle }) {
  /** @type {() => void} */
  let sync = () => {}
  /** @type {string[]} */
  let sources = []

  return {
    name: 'geospatial-map-guides',
    hooks: {
      'astro:config:setup': ({ config, command, logger }) => {
        if (command === 'preview') return
        const repoRoot = path.resolve(fileURLToPath(config.root), '../..')
        /** @type {import('../guides/sync.mjs').SyncOptions} */
        const options = {
          repoRoot,
          outDir: fileURLToPath(new URL('content/docs/', config.srcDir)),
          base: config.base,
          repository,
          branch,
          siteTitle,
        }
        sync = () => {
          const { pages, written, removed } = syncGuides(options)
          if (written.length > 0 || removed.length > 0) {
            logger.info(
              `${pages.length} pages from the folders: ${written.length} written, ${removed.length} removed`,
            )
          }
        }
        sync()
        sources = frameworks.flatMap((framework) =>
          watched.map((name) => path.join(repoRoot, framework.folder, name)),
        )
      },
      'astro:server:setup': ({ server, logger }) => {
        server.watcher.add(sources)
        const resync = (/** @type {string} */ file) => {
          const changed = path.resolve(file)
          if (
            !sources.some((source) => changed === source || changed.startsWith(source + path.sep))
          )
            return
          try {
            sync()
          } catch (error) {
            logger.error(error instanceof Error ? error.message : String(error))
          }
        }
        server.watcher.on('change', resync)
        server.watcher.on('add', resync)
        server.watcher.on('unlink', resync)
      },
    },
  }
}
