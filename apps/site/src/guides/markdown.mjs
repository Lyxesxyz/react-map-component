// @ts-check
// Turns one of a folder's Markdown files into a page of the site, as text in and text out:
//
// - the first line's `# Title` becomes the page title (Starlight renders it) and leaves the body;
// - the first paragraph becomes the page description;
// - every link target is passed to `rewrite` (src/guides/links.mjs), and only the target's own
//   characters change: the rest of the file stays byte for byte as written, so the site renders
//   what GitHub renders. Code blocks and inline code are never touched (they hold no links).
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'

/** @typedef {ReturnType<typeof fromMarkdown>} Root */
/** @typedef {Root['children'][number]} Block */
/**
 * The parts of an mdast node this file reads.
 *
 * @typedef {{
 *   type: string,
 *   value?: string,
 *   alt?: string | null,
 *   url?: string,
 *   depth?: number,
 *   children?: Node[],
 *   position?: { start: { line: number, offset?: number }, end: { offset?: number } },
 * }} Node
 */

/** @param {string} source */
export function parseMarkdown(source) {
  return fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

/**
 * The last tree parsed for each file, by name. Parsing is the slow part of a sync (about a second
 * for both folders), and the dev server syncs again on every change, usually to one file.
 *
 * @type {Map<string, { text: string, tree: Root }>}
 */
const parsed = new Map()

/** @param {string} name @param {string} text */
function parseOnce(name, text) {
  const cached = parsed.get(name)
  if (cached?.text === text) return cached.tree
  const tree = parseMarkdown(text)
  parsed.set(name, { text, tree })
  return tree
}

/**
 * The text a reader sees: inline code without its backticks, links and emphasis without their
 * markup, an image's alt text; runs of whitespace become one space.
 *
 * @param {Node} node
 * @returns {string}
 */
export function plainText(node) {
  return textOf(node).replace(/\s+/g, ' ').trim()
}

/** @param {Node} node @returns {string} */
function textOf(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? ''
  if (node.type === 'image') return node.alt ?? ''
  if (node.type === 'break') return ' '
  return (node.children ?? []).map(textOf).join('')
}

/**
 * A page description from a paragraph's text: at most `max` characters, cut after the last whole
 * sentence that fits (or on a word boundary, with an ellipsis). A paragraph that introduces a list
 * ends with a colon; it ends with a full stop instead.
 *
 * @param {string} text
 * @param {number} [max]
 */
export function summarize(text, max = 200) {
  const sentence = text.replace(/:$/, '.')
  if (sentence.length <= max) return sentence
  let end = -1
  for (const match of sentence.matchAll(/[.!?](?=\s)/g)) {
    if (match.index + 1 > max) break
    end = match.index + 1
  }
  if (end >= max / 3) return sentence.slice(0, end)
  const space = sentence.lastIndexOf(' ', max - 1)
  return `${sentence.slice(0, space > 0 ? space : max - 1).replace(/[\s,;:.(–—-]+$/, '')}…`
}

/**
 * @typedef {object} Guide
 * @property {string} title The first line's H1, as plain text.
 * @property {string | undefined} description The first paragraph after it, summarized.
 * @property {string} body The rest of the file with every link target rewritten.
 */

/**
 * @param {string} source A Markdown file whose first line is `# Title`.
 * @param {object} options
 * @param {string} options.name The file, for error messages.
 * @param {(target: string, kind: 'link' | 'image' | 'definition') => string | undefined} options.rewrite
 *   The new target for a link, an image or a link reference definition (undefined keeps it).
 * @returns {Guide}
 */
export function transformGuide(source, { name, rewrite }) {
  const text = source.replace(/^\uFEFF/, '')
  const tree = parseOnce(name, text)
  const [first, next] = /** @type {Node[]} */ (tree.children)
  if (!first || first.type !== 'heading' || first.depth !== 1 || first.position?.start.line !== 1) {
    throw new Error(`${name}: the first line must be the page title, a "# Title" heading.`)
  }

  // The title line goes (with the blank lines after it); the links after it get their new targets.
  /** @type {{ start: number, end: number, text: string }[]} */
  const edits = [{ start: 0, end: next ? offset(next, 'start') : text.length, text: '' }]
  const after = /** @type {Node[]} */ (tree.children).slice(1)
  visit({ type: 'root', children: after }, (node) => {
    const kind =
      node.type === 'link' || node.type === 'image' || node.type === 'definition'
        ? node.type
        : undefined
    if (kind && node.url !== undefined) {
      const target = rewrite(node.url, kind)
      if (target !== undefined && target !== node.url) {
        edits.push({ ...destination(text, node, name), text: escapeDestination(target) })
      }
    } else if (node.type === 'html' && hasRelativeUrl(node.value ?? '')) {
      throw new Error(
        `${name}: raw HTML with a relative href or src is not rewritten for the site; use a Markdown link.`,
      )
    }
  })

  let body = text
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    body = body.slice(0, edit.start) + edit.text + body.slice(edit.end)
  }
  const intro = /** @type {Node[]} */ (tree.children).find(
    (node, index) => index > 0 && node.type === 'paragraph',
  )
  const description = intro ? summarize(plainText(intro)) : undefined
  return { title: plainText(first), description: description || undefined, body }
}

/** Whether raw HTML has an href or src that is neither absolute nor an anchor. @param {string} html */
function hasRelativeUrl(html) {
  for (const match of html.matchAll(/\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const url = match[1] ?? match[2] ?? match[3] ?? ''
    if (!/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return true
  }
  return false
}

/** @param {Node} node @param {(node: Node) => void} callback */
function visit(node, callback) {
  callback(node)
  for (const child of node.children ?? []) visit(child, callback)
}

/** @param {Node} node @param {'start' | 'end'} side */
function offset(node, side) {
  const value = node.position?.[side].offset
  if (value === undefined) throw new Error('The Markdown parser reported no position.')
  return value
}

/**
 * Where a link's destination is in the source: after the `](` of `[text](destination "title")`,
 * or after the `]:` of `[label]: destination "title"`. Several `](` can occur inside a link (an
 * image or code in its text), so the search starts after the link text, and the destination is
 * the one whose text is the URL the parser reported.
 *
 * @param {string} source
 * @param {Node} node
 * @param {string} name
 */
function destination(source, node, name) {
  const text = node.type === 'link' ? node.children?.at(-1) : undefined
  const start = text ? offset(text, 'end') : offset(node, 'start')
  const end = offset(node, 'end')
  const marker = node.type === 'definition' ? ']:' : ']('
  for (
    let at = source.indexOf(marker, start);
    at >= 0 && at < end;
    at = source.indexOf(marker, at + 1)
  ) {
    const found = readDestination(source, at + 2, end)
    if (unescape(source.slice(found.start, found.end)) === node.url) return found
  }
  throw new Error(`${name}: could not find the target of the link "${node.url}" in the source.`)
}

/**
 * A link destination starting at `from` (after optional whitespace): `<…>`, or a run without
 * whitespace and with balanced parentheses.
 *
 * @param {string} source
 * @param {number} from
 * @param {number} limit
 */
function readDestination(source, from, limit) {
  let start = from
  while (start < limit && /[ \t\r\n]/.test(source.charAt(start))) start++
  if (source.charAt(start) === '<') {
    const close = source.indexOf('>', start + 1)
    return { start: start + 1, end: close < 0 ? start + 1 : close }
  }
  let end = start
  let depth = 0
  for (; end < limit; end++) {
    const char = source.charAt(end)
    if (char === '\\') end++
    else if (char === '(') depth++
    else if (char === ')' && depth-- === 0) break
    else if (/\s/.test(char)) break
  }
  return { start, end }
}

/** Removes Markdown's backslash escapes (`\(` is `(`). @param {string} value */
function unescape(value) {
  return value.replace(/\\([!-/:-@[-`{-~])/g, '$1')
}

/** A URL as a link destination: spaces and unbalanced brackets are percent-encoded. @param {string} url */
function escapeDestination(url) {
  return url.replace(
    /[\s<>()\\]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  )
}
