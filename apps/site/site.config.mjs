// Where the docs site is published and where its sources live. Every URL the site builds (edit
// links, links to example files, the base path) comes from here, so a fork or a custom domain
// changes only this file (or sets SITE_URL / SITE_BASE when building).

/** The repository the guides and examples are read from. */
export const repository = 'https://github.com/Lyxesxyz/react-map-component'

/** The branch the site is built from: edit and source links point at it. */
export const branch = 'main'

/** The origin the site is served from (GitHub Pages for the repository's owner). */
export const site = process.env.SITE_URL || 'https://lyxesxyz.github.io'

/** The path below the origin, without a trailing slash (GitHub Pages serves a project site there). */
export const base = (process.env.SITE_BASE || '/react-map-component').replace(/\/+$/, '')
