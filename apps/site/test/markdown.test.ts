import { describe, expect, it } from 'vitest'
import { frameworks } from '../src/guides/catalog.mjs'
import { summarize, transformGuide } from '../src/guides/markdown.mjs'
import { renderPage } from '../src/guides/page.mjs'
import { parseFrontmatter } from './support'

/** Rewrites every target to `<kind>:<target>`, so each edit is visible. */
const mark = (target: string, kind: string) => `${kind}:${target}`

function transform(
  source: string,
  rewrite: (target: string, kind: string) => string | undefined = mark,
) {
  return transformGuide(source, { name: 'docs/test.md', rewrite })
}

describe('the title', () => {
  it('is the first line’s H1 as plain text, and leaves the body', () => {
    const guide = transform('# Theme from JSON (`config.theme`)\n\nIntro.\n\n## Next\n')
    expect(guide.title).toBe('Theme from JSON (config.theme)')
    expect(guide.body).toBe('Intro.\n\n## Next\n')
  })

  it('drops emphasis and link markup', () => {
    expect(transform('# *Big* [map](https://x.org) `a|b`\n').title).toBe('Big map a|b')
  })

  it('must be on the first line', () => {
    expect(() => transform('Intro.\n\n# Title\n')).toThrow(/docs\/test\.md: the first line/)
    expect(() => transform('## Title\n')).toThrow(/first line must be the page title/)
    expect(() => transform('\n# Title\n')).toThrow(/first line/)
  })

  it('may hold a link, which leaves with it', () => {
    const guide = transform('# [Map](./x.md) guide\n\nText [y](./y.md).\n')
    expect(guide.title).toBe('Map guide')
    expect(guide.body).toBe('Text [y](link:./y.md).\n')
  })

  it('ignores a byte order mark', () => {
    expect(transform('﻿# Title\n\nText.\n').title).toBe('Title')
  })
})

describe('the description', () => {
  it('is the first paragraph after the title, without Markdown', () => {
    const guide = transform(
      '# T\n\nThe stylesheet `geospatial-map.css` is **the** [source](./x.md) of truth.\n\nMore.\n',
    )
    expect(guide.description).toBe('The stylesheet geospatial-map.css is the source of truth.')
  })

  it('is the first paragraph after the first heading when the guide has no intro', () => {
    const guide = transform('# T\n\n## Contract\n\n`config` is policy.\n\n## Next\n\nOther.\n')
    expect(guide.description).toBe('config is policy.')
  })

  it('skips lists, tables and code before the first paragraph', () => {
    const guide = transform('# T\n\n- item\n\n```ts\nx\n```\n\nFirst prose.\n')
    expect(guide.description).toBe('First prose.')
  })

  it('is undefined when there is no paragraph', () => {
    expect(transform('# T\n\n## Only headings\n').description).toBeUndefined()
  })

  it('ends a list’s lead-in with a full stop', () => {
    expect(summarize('You restyle it in three ways:')).toBe('You restyle it in three ways.')
  })

  it('keeps the whole sentences that fit in 200 characters', () => {
    const first = 'A'.repeat(120) + '.'
    expect(summarize(`${first} ${'b'.repeat(100)}.`)).toBe(first)
  })

  it('otherwise cuts on a word boundary, with an ellipsis', () => {
    const text = `${'word '.repeat(60)}end.`
    const summary = summarize(text)
    expect(summary.length).toBeLessThanOrEqual(200)
    expect(summary).toMatch(/word…$/)
  })
})

describe('link rewriting', () => {
  it('changes only the link targets and leaves every other byte as written', () => {
    const source = [
      '# T',
      '',
      'See [the short form](./getting-started.md#short-form) and [*styling*](../README.md#styling "Styling").',
      'Escaped: [x](./a\\(1\\).md), angle: [y](<./b c.md>), code in text: [`a](b`](./z.md).',
      '',
      '| a | b |',
      '| --- | --- |',
      '| `x \\| y` | [cell](./t.md) |',
      '',
      '![Alt](./img.png)',
      '',
      '[ref]: ./def.md',
      '',
    ].join('\n')
    expect(transform(source).body).toBe(
      [
        'See [the short form](link:./getting-started.md#short-form) and [*styling*](link:../README.md#styling "Styling").',
        'Escaped: [x](link:./a%281%29.md), angle: [y](<link:./b%20c.md>), code in text: [`a](b`](link:./z.md).',
        '',
        '| a | b |',
        '| --- | --- |',
        '| `x \\| y` | [cell](link:./t.md) |',
        '',
        '![Alt](image:./img.png)',
        '',
        '[ref]: definition:./def.md',
        '',
      ].join('\n'),
    )
  })

  it('never touches code blocks or inline code', () => {
    const source = [
      '# T',
      '',
      'Inline `[a](./a.md)` code.',
      '',
      '```md',
      '[b](./b.md)',
      '```',
      '',
      '    [c](./c.md)',
      '',
      '- item',
      '',
      '  ```js',
      '  [d](./d.md)',
      '  ```',
      '',
    ].join('\n')
    const targets: string[] = []
    const guide = transform(source, (target) => {
      targets.push(target)
      return `changed:${target}`
    })
    expect(targets).toEqual([])
    expect(guide.body).toBe(source.slice('# T\n\n'.length))
  })

  it('rewrites a linked image and its link separately, even with the same target', () => {
    expect(transform('# T\n\n[![Alt](./a.png)](./a.png) [![Alt](./a.png)](./b.png)\n').body).toBe(
      '[![Alt](image:./a.png)](link:./a.png) [![Alt](image:./a.png)](link:./b.png)\n',
    )
  })

  it('finds the target after the link text when the text holds the same `](target`', () => {
    expect(transform('# T\n\n[see `](./a.md)` here](./a.md)\n').body).toBe(
      '[see `](./a.md)` here](link:./a.md)\n',
    )
  })

  it('leaves a link alone when rewrite returns undefined or the same target', () => {
    const source = '# T\n\n[a](#here) [b](https://example.org) [c](./c.md)\n'
    const guide = transform(source, (target) => (target === './c.md' ? target : undefined))
    expect(guide.body).toBe('[a](#here) [b](https://example.org) [c](./c.md)\n')
  })

  it('refuses raw HTML with a relative link, which it does not rewrite', () => {
    expect(() => transform('# T\n\n<a href="./x.md">x</a>\n')).toThrow(/raw HTML/)
    expect(transform('# T\n\n<a href="https://x.org">x</a>\n').body).toContain('https://x.org')
  })
})

describe('the generated page', () => {
  const [react] = frameworks
  if (!react) throw new Error('no frameworks')
  const page = {
    framework: 'react' as const,
    kind: 'guide' as const,
    source: 'packages/geospatial-map/src/docs/getting-started.md',
    path: 'docs/getting-started.md',
    id: 'react/guides/getting-started',
    file: 'react/guides/getting-started.md',
    route: 'react/guides/getting-started/',
    label: 'Getting started',
    order: 1,
  }
  const render = (source: string, lastUpdated?: Date) =>
    renderPage(source, {
      page,
      framework: react,
      siteTitle: 'Geospatial map',
      base: '/base',
      repository: 'https://github.com/o/r',
      branch: 'main',
      lastUpdated,
      kindOf: (path) => (path === 'docs/configuration.md' ? 'file' : undefined),
      routeOf: (path) =>
        path === 'docs/configuration.md' ? 'react/guides/configuration/' : undefined,
    })

  it('has Starlight frontmatter that Astro parses back', () => {
    const date = new Date('2026-10-09T14:03:12+02:00')
    const output = render(
      '# A "quoted": `title` #1\n\nIntro: with "quotes" and a [link](./configuration.md#full-form).\n',
      date,
    )
    const { frontmatter, content } = parseFrontmatter(output)
    expect(frontmatter).toEqual({
      title: 'A "quoted": title #1',
      description: 'Intro: with "quotes" and a link.',
      framework: 'react',
      topic: 'react',
      editUrl:
        'https://github.com/o/r/edit/main/packages/geospatial-map/src/docs/getting-started.md',
      lastUpdated: date,
      sidebar: { label: 'Getting started', order: 1 },
      head: [{ tag: 'title', content: 'A "quoted": title #1 (React) | Geospatial map' }],
    })
    expect(content.trimStart()).toBe(
      'Intro: with "quotes" and a [link](/base/react/guides/configuration/#full-form).\n',
    )
  })

  it('leaves the date out when the source has none', () => {
    const { frontmatter } = parseFrontmatter(render('# T\n\nText.\n'))
    expect(frontmatter).not.toHaveProperty('lastUpdated')
  })

  it('names the source in a comment, so a reader edits that file', () => {
    expect(render('# T\n').split('\n')[1]).toBe(
      '# Generated by apps/site/src/guides/sync.mjs from packages/geospatial-map/src/docs/getting-started.md: edit that file, not this one.',
    )
  })

  it('fails on a broken link, naming the file and the link', () => {
    expect(() => render('# T\n\n[x](./missing.md)\n')).toThrow(
      'packages/geospatial-map/src/docs/getting-started.md: the link "./missing.md" points at a file that does not exist.',
    )
  })
})
