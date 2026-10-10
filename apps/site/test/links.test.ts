import { describe, expect, it } from 'vitest'
import { siteUrlFor, type LinkContext } from '../src/guides/links.mjs'

const files = new Set([
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/configuration.md',
  'docs/getting-started.md',
  'examples/quick-start.tsx',
  'examples/brand theme.css',
  'img/map.png',
])
const directories = new Set(['', 'docs', 'examples', 'img'])
const routes = new Map([
  ['README.md', 'react/'],
  ['CHANGELOG.md', 'react/changelog/'],
  ['AGENTS.md', 'react/agents/'],
  ['docs/configuration.md', 'react/guides/configuration/'],
  ['docs/getting-started.md', 'react/guides/getting-started/'],
])

function context(from: string): LinkContext {
  return {
    from,
    folder: 'packages/geospatial-map/src',
    base: '/react-map-component',
    repository: 'https://github.com/Lyxesxyz/react-map-component',
    branch: 'main',
    kindOf: (path) => (files.has(path) ? 'file' : directories.has(path) ? 'directory' : undefined),
    routeOf: (path) => routes.get(path),
  }
}

const github = 'https://github.com/Lyxesxyz/react-map-component'
const fromGuide = (target: string) => siteUrlFor(target, context('docs/configuration.md'))
const fromReadme = (target: string) => siteUrlFor(target, context('README.md'))

describe('a link to another published page', () => {
  it('points at the guide’s page, with its anchor', () => {
    expect(fromGuide('./getting-started.md#short-form')).toBe(
      '/react-map-component/react/guides/getting-started/#short-form',
    )
    expect(fromGuide('getting-started.md')).toBe(
      '/react-map-component/react/guides/getting-started/',
    )
    expect(fromReadme('./docs/configuration.md#full-form')).toBe(
      '/react-map-component/react/guides/configuration/#full-form',
    )
  })

  it('points at the overview for the README, the changelog and the agents’ guide', () => {
    expect(fromGuide('../README.md#styling')).toBe('/react-map-component/react/#styling')
    expect(fromGuide('../README.md')).toBe('/react-map-component/react/')
    expect(fromGuide('../CHANGELOG.md')).toBe('/react-map-component/react/changelog/')
    expect(fromReadme('./AGENTS.md#rules')).toBe('/react-map-component/react/agents/#rules')
  })

  it('keeps a query', () => {
    expect(fromGuide('./getting-started.md?x=1#a')).toBe(
      '/react-map-component/react/guides/getting-started/?x=1#a',
    )
  })

  it('works without a base', () => {
    expect(siteUrlFor('../README.md', { ...context('docs/configuration.md'), base: '' })).toBe(
      '/react/',
    )
  })
})

describe('a link to another file of the folder', () => {
  it('points at a directory’s tree on GitHub', () => {
    expect(fromReadme('./examples/')).toBe(
      `${github}/tree/main/packages/geospatial-map/src/examples`,
    )
    expect(fromReadme('./docs/')).toBe(`${github}/tree/main/packages/geospatial-map/src/docs`)
    expect(fromGuide('..')).toBe(`${github}/tree/main/packages/geospatial-map/src`)
  })

  it('points at a file on GitHub, with its anchor', () => {
    expect(fromGuide('../examples/quick-start.tsx')).toBe(
      `${github}/blob/main/packages/geospatial-map/src/examples/quick-start.tsx`,
    )
    expect(fromGuide('../examples/quick-start.tsx#L10')).toBe(
      `${github}/blob/main/packages/geospatial-map/src/examples/quick-start.tsx#L10`,
    )
    expect(fromReadme('CLAUDE.md')).toBe(
      `${github}/blob/main/packages/geospatial-map/src/CLAUDE.md`,
    )
  })

  it('decodes and re-encodes the path', () => {
    expect(fromGuide('../examples/brand%20theme.css')).toBe(
      `${github}/blob/main/packages/geospatial-map/src/examples/brand%20theme.css`,
    )
  })

  it('points an image at the raw file', () => {
    expect(siteUrlFor('../img/map.png', context('docs/configuration.md'), { image: true })).toBe(
      `${github}/raw/main/packages/geospatial-map/src/img/map.png`,
    )
  })
})

describe('a link that stays as written', () => {
  it.each([
    '#full-form',
    'https://example.org/x.md',
    'http://x.org',
    'mailto:a@b.org',
    '//cdn.x/y',
    '',
  ])('%s', (target) => {
    expect(fromGuide(target)).toBeUndefined()
  })
})

describe('a broken link fails, naming the file and the link', () => {
  it('when it leaves the folder', () => {
    expect(() => fromGuide('../../package.json')).toThrow(
      'packages/geospatial-map/src/docs/configuration.md: the link "../../package.json" leaves the folder',
    )
    expect(() => fromReadme('../README.md')).toThrow(/leaves the folder/)
  })

  it('when it starts at the root', () => {
    expect(() => fromGuide('/react-map-component/react/')).toThrow(/starts at the root/)
  })

  it('when the file does not exist', () => {
    expect(() => fromGuide('./missing.md#x')).toThrow(
      'packages/geospatial-map/src/docs/configuration.md: the link "./missing.md#x" points at a file that does not exist.',
    )
  })

  it('when an image is a directory', () => {
    expect(() => siteUrlFor('../img/', context('docs/configuration.md'), { image: true })).toThrow(
      /is not a file/,
    )
  })

  it('when the URL is malformed', () => {
    expect(() => fromGuide('./%E0%A4%A.md')).toThrow(/not a valid URL/)
  })
})
