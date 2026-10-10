// @ts-check
// The sidebar topics (starlight-sidebar-topics): React and Angular, each with the pages the guides
// integration generates from its folder (src/guides/catalog.mjs), and the examples gallery. Each
// topic has its own sidebar; the topic list above it switches between them.
//
// How a page finds its topic (the plugin fails the build for a page without one):
// - the generated React and Angular pages say so in their frontmatter (`topic: react`);
// - a page listed in a topic's sidebar belongs to that topic, and a topic's `link` page to it;
// - otherwise `topicsOptions.topics` matches the page's path (without the base or a trailing
//   slash), which covers the examples pages and any page added below /react/ or /angular/.
// The landing page uses the splash template, which has no sidebar and so needs no topic.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { examples } from './data/examples.mjs'
import { frameworks } from './guides/catalog.mjs'
import { listPages } from './guides/sync.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const pages = listPages(repoRoot)

/**
 * A framework's sidebar: its overview, the guides in reading order, the changelog and the agents'
 * guide. Entries name the generated pages by id; Starlight takes each label from the page's
 * frontmatter (`sidebar.label`).
 *
 * @param {import('./guides/catalog.mjs').Framework} framework
 */
function frameworkItems(framework) {
  const own = pages.filter((page) => page.framework === framework.id)
  const ids = (/** @type {import('./guides/catalog.mjs').PageKind} */ kind) =>
    own.filter((page) => page.kind === kind).map((page) => page.id)
  return [
    ...ids('overview'),
    { label: 'Guides', items: ids('guide') },
    ...ids('changelog'),
    ...ids('agents'),
  ]
}

/** Icons are Starlight's built-in names; it has none for Angular. */
const icons = { react: 'seti:react', angular: 'puzzle' }

/** @type {import('starlight-sidebar-topics').StarlightSidebarTopicsUserConfig} */
export const topics = [
  ...frameworks.map((framework) => ({
    id: framework.id,
    label: framework.label,
    link: `/${framework.id}/`,
    icon: icons[framework.id],
    items: frameworkItems(framework),
  })),
  {
    id: 'examples',
    label: 'Examples',
    link: '/examples/',
    icon: 'laptop',
    items: [
      { label: 'All examples', link: '/examples/' },
      ...examples.map((example) => ({ label: example.title, link: `/examples/${example.id}/` })),
    ],
  },
]

/** @type {import('starlight-sidebar-topics').StarlightSidebarTopicsUserOptions} */
export const topicsOptions = {
  topics: {
    ...Object.fromEntries(frameworks.map((framework) => [framework.id, [`/${framework.id}/**`]])),
    examples: ['/examples', '/examples/**'],
  },
}
