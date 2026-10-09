import type { Page } from '@playwright/test'

// The DOM parity contract (angular-plan.md, D3): inside every map, both demos render the same
// visible elements with the same geo-* classes, data-slot and data-* states, roles, ARIA, titles
// and text. This module turns the maps of a page into a list of comparable lines.

/** One visible element inside a map, flattened in document order. */
export type DomNode = {
  /** Index of the map (or map grid) on the page, in document order. */
  map: number
  /** Depth below the map element, counting only the elements that are listed. */
  depth: number
  /** The element name; Angular part hosts (`geo-map-legend`) stand in for React's element. */
  tag: string
  /** The compared attributes, as `name="value"`, sorted. */
  attributes: string[]
  /** The element's own text (its text-node children), with whitespace collapsed. */
  text: string
}

/**
 * Collects the visible elements of every map on the page (`[data-slot="map"]`, or the whole
 * `[data-slot="map-grid"]` around grid maps). Runs in the browser, so it must stay
 * self-contained.
 *
 * - Skipped: subtrees with `display: none` (an Angular part hides its host that way, where React
 *   renders nothing), Angular's `display: contents` component wrappers that carry nothing
 *   compared but `class="geo-icon"` and `aria-hidden` (`<geo-map-icon class="geo-icon">`,
 *   `<geo-shape-select>`; their children are kept), the inside of each `svg` (icon artwork), and
 *   OpenLayers' own elements inside `.ol-viewport` unless they carry something compared.
 * - Compared: the element name, `geo-*` classes, `data-*` attributes, `role`, `aria-*`, `title`,
 *   `type`, `disabled`, `open`, `href`, `tabindex`, `for`, the live `value` or `checked` of form
 *   controls and the element's own text. Attributes that hold ids (`aria-labelledby`,
 *   `aria-controls`, `for`, …) are replaced by the text of the element they point to, so the
 *   links are compared but the generated ids are not; so is a generated `data-map-id`.
 *   Angular's selector attributes (`geomapzoomin`) and lucide's classes are never compared.
 */
export function collectMapNodes(): DomNode[] {
  const idReferences = new Set([
    'aria-activedescendant',
    'aria-controls',
    'aria-describedby',
    'aria-details',
    'aria-errormessage',
    'aria-flowto',
    'aria-labelledby',
    'aria-owns',
    'for',
  ])
  const squash = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  const referenced = (ids: string) =>
    ids
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const target = document.getElementById(id)
        return target ? `→${squash(target.textContent)}` : '→(missing)'
      })
      .join(' ')

  function attributesOf(element: Element): string[] {
    const list: string[] = []
    const classes = [...element.classList].filter((name) => name.startsWith('geo-')).sort()
    if (classes.length) list.push(`class="${classes.join(' ')}"`)
    for (const { name, value } of [...element.attributes]) {
      if (name === 'class' || name === 'id') continue
      const compared =
        name.startsWith('data-') ||
        name.startsWith('aria-') ||
        ['role', 'title', 'type', 'disabled', 'open', 'href', 'tabindex', 'for'].includes(name)
      if (!compared) continue
      // A map without a config id gets a generated one (React's useId, Angular's counter).
      const generated = name === 'data-map-id' && value.startsWith('geospatial-map-')
      list.push(
        `${name}="${idReferences.has(name) ? referenced(value) : generated ? 'geospatial-map-(generated)' : squash(value)}"`,
      )
    }
    // The live state of form controls, which both set as properties (React also writes `value`
    // as an attribute, Angular doesn't): a switch's `checked`, a select's or slider's `value`.
    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type))
      list.push(`.checked=${element.checked}`)
    else if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    )
      list.push(`.value="${squash(element.value)}"`)
    return list.sort()
  }

  function ownText(element: Element): string {
    let text = ''
    for (const child of element.childNodes)
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? ''
    return squash(text)
  }

  const nodes: DomNode[] = []
  function visit(element: Element, map: number, depth: number, insideOpenLayers: boolean) {
    if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(element.tagName)) return
    const style = getComputedStyle(element)
    if (style.display === 'none') return
    const attributes = attributesOf(element)
    const text = ownText(element)
    // Angular's layout-neutral component wrappers (display: contents): `<geo-map-icon
    // class="geo-icon" aria-hidden="true">` around an icon, `<geo-shape-select>` around React's
    // `.geo-shape-select-wrap`. A host with a data-*, role or label is a part, and is listed.
    const wrapper =
      element.localName.includes('-') &&
      style.display === 'contents' &&
      text === '' &&
      attributes.every((item) => item === 'class="geo-icon"' || item === 'aria-hidden="true"')
    const openLayers = insideOpenLayers || element.classList.contains('ol-viewport')
    const listed = !wrapper && (!openLayers || attributes.length > 0 || text !== '')
    if (listed) nodes.push({ map, depth, tag: element.localName, attributes, text })
    if (element.localName === 'svg') return
    for (const child of element.children) visit(child, map, listed ? depth + 1 : depth, openLayers)
  }

  // A grid is compared as a whole (cell headers and focus buttons included), other maps alone.
  const regions = [...document.querySelectorAll('[data-slot="map-grid"], [data-slot="map"]')]
  regions
    .filter((region) => !region.parentElement?.closest('[data-slot="map-grid"]'))
    .forEach((region, index) => visit(region, index, 0, false))
  return nodes
}

/** Reads the maps' nodes until two reads 300 ms apart agree (late loads, fades, popups). */
export async function stableMapNodes(page: Page, timeout = 8_000): Promise<DomNode[]> {
  const deadline = Date.now() + timeout
  let previous = JSON.stringify(await page.evaluate(collectMapNodes))
  for (;;) {
    await page.waitForTimeout(300)
    const current = JSON.stringify(await page.evaluate(collectMapNodes))
    if (current === previous || Date.now() > deadline) return JSON.parse(current) as DomNode[]
    previous = current
  }
}

/** One readable line per node: `[map] indent tag attributes "text"`. */
export function formatNode(node: DomNode): string {
  const text = node.text ? ` "${node.text}"` : ''
  const attributes = node.attributes.length ? ` ${node.attributes.join(' ')}` : ''
  return `[${node.map}] ${'  '.repeat(node.depth)}${node.tag}${attributes}${text}`
}

/** Roles that React's part elements have implicitly, and Angular's hosts must state. */
const implicitRoles: Record<string, string> = {
  aside: 'complementary',
  footer: 'contentinfo',
  form: 'form',
  header: 'banner',
  nav: 'navigation',
  section: 'region',
}

/**
 * Lines for both demos, ready for `toEqual`. Where the Angular element is a custom element (a
 * part's host, `geo-map-legend`), its name says nothing about parity: the React name is used,
 * and a `role` the host states for the React element's implicit role (`role="navigation"` for
 * a `<nav>`) is not a difference.
 */
export function comparableLines(react: DomNode[], angular: DomNode[]) {
  const angularLines = angular.map((node, index) => {
    const counterpart = react[index]
    if (!node.tag.includes('-') || !counterpart) return formatNode(node)
    const implicit = implicitRoles[counterpart.tag]
    const stated = (item: string) =>
      implicit !== undefined &&
      item === `role="${implicit}"` &&
      !counterpart.attributes.some((attribute) => attribute.startsWith('role='))
    return formatNode({
      ...node,
      tag: counterpart.tag,
      attributes: node.attributes.filter((item) => !stated(item)),
    })
  })
  return { react: react.map(formatNode), angular: angularLines }
}

/** The first differing line, with a few lines of context from both demos, for the failure. */
export function firstDifference(react: string[], angular: string[], context = 4): string | null {
  const length = Math.max(react.length, angular.length)
  let index = 0
  while (index < length && react[index] === angular[index]) index++
  if (index === length) return null
  const from = Math.max(0, index - context)
  const show = (lines: string[]) =>
    lines
      .slice(from, index + context + 1)
      .map((line, offset) => `${from + offset === index ? '>' : ' '} ${from + offset}: ${line}`)
      .join('\n')
  return [
    `First difference at node ${index} (React has ${react.length} nodes, Angular ${angular.length}).`,
    'React:',
    show(react),
    'Angular:',
    show(angular),
  ].join('\n')
}
