// @ts-check
// What the site publishes from each copied folder, and where. The folders' Markdown is the source
// of truth (it travels with the folder a team copies); the site writes its own copies of it into
// src/content/docs/<framework>/ (src/guides/sync.mjs). This file is data and pure functions only:
// astro.config.mjs reads it (through src/sidebar.mjs) before Vite runs.

/** @typedef {'react' | 'angular'} FrameworkId */

/**
 * @typedef {object} Guide
 * @property {string} stem The guide's file name in the folder's docs/, without `.md`.
 * @property {string} label Its short name in the sidebar.
 */

/**
 * @typedef {object} Framework
 * @property {FrameworkId} id The first segment of the framework's routes (`/react/…`).
 * @property {string} label
 * @property {string} folder The copied folder, relative to the repository root.
 * @property {Guide[]} guides The guides in reading order. A guide in docs/ that is missing here is
 *   still published, after these, under its title (a test fails until it is added).
 */

/** @type {Framework[]} */
export const frameworks = [
  {
    id: 'react',
    label: 'React',
    folder: 'packages/geospatial-map/src',
    guides: [
      { stem: 'getting-started', label: 'Getting started' },
      { stem: 'configuration', label: 'Configuration' },
      { stem: 'layers-and-legends', label: 'Layers & legends' },
      { stem: 'state-events-slots', label: 'State, events & slots' },
      { stem: 'theming-localization', label: 'Theming & localization' },
      { stem: 'export-grid-integration', label: 'Export, grids & Vite' },
      { stem: 'troubleshooting', label: 'Troubleshooting' },
      { stem: 'migration', label: 'Migration' },
    ],
  },
  {
    id: 'angular',
    label: 'Angular',
    folder: 'packages/geospatial-map-angular/src',
    guides: [
      { stem: 'getting-started', label: 'Getting started' },
      { stem: 'configuration', label: 'Configuration' },
      { stem: 'layers-and-legends', label: 'Layers & legends' },
      { stem: 'state-events-templates', label: 'State, events & templates' },
      { stem: 'theming-localization', label: 'Theming & localization' },
      { stem: 'export-grid-integration', label: 'Export, grids & Angular CLI' },
      { stem: 'troubleshooting', label: 'Troubleshooting' },
      { stem: 'migration', label: 'Migration' },
    ],
  },
]

/** @typedef {'overview' | 'guide' | 'changelog' | 'agents'} PageKind */

/**
 * One generated page.
 *
 * @typedef {object} Page
 * @property {FrameworkId} framework
 * @property {PageKind} kind
 * @property {string} source The Markdown file, relative to the repository root.
 * @property {string} path The same file, relative to the framework's folder (`docs/x.md`).
 * @property {string} id The page's id in the docs collection, which is its route without slashes
 *   (`react/guides/x`); sidebar entries name pages by it.
 * @property {string} file The generated file, relative to src/content/docs (`react/guides/x.md`).
 * @property {string} route The page below the site's base, with a trailing slash (`react/guides/x/`).
 * @property {string | undefined} label The sidebar label (the title when undefined).
 * @property {number} order The page's position in its framework's sidebar.
 */

/**
 * The pages of one framework: the README as its overview, the guides, the changelog and the
 * agents' guide. (CLAUDE.md is a one-line pointer to AGENTS.md and is not published.)
 *
 * @param {Framework} framework
 * @param {string[]} stems The `.md` files in the folder's docs/, without the extension.
 * @returns {Page[]}
 */
export function pagesOf(framework, stems) {
  const { id, folder } = framework
  const listed = framework.guides.filter((guide) => stems.includes(guide.stem))
  const unlisted = stems
    .filter((stem) => !framework.guides.some((guide) => guide.stem === stem))
    .sort()
    .map((stem) => ({ stem, label: undefined }))
  /**
   * @param {PageKind} kind
   * @param {string} path The source, relative to the folder.
   * @param {string} slug The page below the framework ('' for its overview).
   * @param {string | undefined} label
   * @param {number} order
   * @returns {Page}
   */
  const page = (kind, path, slug, label, order) => ({
    framework: id,
    kind,
    source: `${folder}/${path}`,
    path,
    id: slug ? `${id}/${slug}` : id,
    file: slug ? `${id}/${slug}.md` : `${id}/index.md`,
    route: slug ? `${id}/${slug}/` : `${id}/`,
    label,
    order,
  })
  const guides = [...listed, ...unlisted].map((guide, index) =>
    page('guide', `docs/${guide.stem}.md`, `guides/${guide.stem}`, guide.label, index + 1),
  )
  return [
    page('overview', 'README.md', '', 'Overview', 0),
    ...guides,
    page('changelog', 'CHANGELOG.md', 'changelog', 'Changelog', guides.length + 1),
    page('agents', 'AGENTS.md', 'agents', 'For coding agents', guides.length + 2),
  ]
}
