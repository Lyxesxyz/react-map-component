// The reader's framework, React or Angular, shared by everything on the site that shows one or the
// other: the demo frames (DemoFrame.astro), the code tabs (FrameworkTabs.astro), and Starlight's
// own `<Tabs syncKey="framework">` should a page use them. It is remembered under Starlight's
// storage key for those tabs, so all of them agree from page to page; an inline script in <head>
// (astro.config.mjs) puts it on <html data-framework> before the page paints.
import { frameworkLabels, frameworkStorageKey, type Framework } from './demo-url'

type Listener = (framework: Framework) => void

const listeners = new Set<Listener>()

/** The framework a label names ('React' or 'Angular'). */
export function frameworkOfLabel(label: string | null | undefined): Framework | undefined {
  return (Object.keys(frameworkLabels) as Framework[]).find((id) => frameworkLabels[id] === label)
}

function remember(framework: Framework) {
  try {
    localStorage.setItem(frameworkStorageKey, frameworkLabels[framework])
  } catch {
    // No storage (a private window, blocked site data): the choice holds for this page only.
  }
}

/**
 * Tells every part of the page: <html data-framework> (which the theme's
 * [data-framework-only] rules read, and which an inline script in <head> sets before the page
 * paints) and each listener.
 */
function announce(framework: Framework) {
  document.documentElement.dataset.framework = framework
  for (const listener of listeners) listener(framework)
}

/** Calls `listener` whenever the reader picks a framework. Returns the unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

type SyncedTabs = HTMLElement & {
  switchTab?: (tab: HTMLAnchorElement, index: number, shouldSync?: boolean) => void
}

/** Selects the framework's tab in every set of Starlight's synced tabs on the page. */
function selectStarlightTabs(framework: Framework) {
  const label = frameworkLabels[framework]
  for (const tabs of document.querySelectorAll<SyncedTabs>(
    'starlight-tabs[data-sync-key="framework"]',
  )) {
    const list = [...tabs.querySelectorAll<HTMLAnchorElement>('[role="tab"]')].filter(
      (tab) => tab.closest('starlight-tabs') === tabs,
    )
    const index = list.findIndex((tab) => tab.textContent?.trim() === label)
    const tab = list[index]
    if (tab && tab.getAttribute('aria-selected') !== 'true') tabs.switchTab?.(tab, index, false)
  }
}

/**
 * The reader picked a framework: everything on the page follows, and the choice is remembered.
 * `anchor` (the control that was used) keeps its place on screen while content above it changes
 * height.
 */
export function pickFramework(framework: Framework, anchor?: Element) {
  const before = anchor?.getBoundingClientRect().top
  remember(framework)
  announce(framework)
  selectStarlightTabs(framework)
  if (anchor && before !== undefined) {
    const shift = anchor.getBoundingClientRect().top - before
    if (shift) window.scrollBy({ top: shift, behavior: 'instant' })
  }
}

// The reader picked a framework on Starlight's synced tabs, which remember it themselves.
function followStarlightTabs(event: Event) {
  const target = event.target instanceof Element ? event.target : null
  const tabs = target?.closest('[role="tab"]')?.closest('starlight-tabs[data-sync-key="framework"]')
  if (!tabs) return
  queueMicrotask(() => {
    const selected = [...tabs.querySelectorAll('[role="tab"][aria-selected="true"]')].find(
      (tab) => tab.closest('starlight-tabs') === tabs,
    )
    const framework = frameworkOfLabel(selected?.textContent?.trim())
    if (framework) announce(framework)
  })
}
document.addEventListener('click', followStarlightTabs)
document.addEventListener('keydown', followStarlightTabs)
