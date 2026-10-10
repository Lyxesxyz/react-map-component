// STUB, replaced by the guides pipeline: an Astro integration that copies each folder's README,
// AGENTS, CHANGELOG and docs/ into src/content/docs/<framework>/ before the content is loaded.

/** @returns {import('astro').AstroIntegration} */
export function guides() {
  return { name: 'geospatial-map-guides', hooks: {} }
}
