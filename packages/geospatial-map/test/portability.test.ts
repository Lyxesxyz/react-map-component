import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// These checks keep the promise of the folder: copy `src/` anywhere, install the listed
// packages, and it works — no aliases, no build step, no files from elsewhere in this repo.

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const folder = path.join(packageRoot, 'src')
const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    return statSync(file).isDirectory() ? walk(file) : [file]
  })
}

const files = walk(folder)
const sources = files.filter((file) => /\.tsx?$/.test(file))
const read = (file: string) => readFileSync(file, 'utf8')
const relative = (file: string) => path.relative(folder, file)

function specifiers(source: string): string[] {
  const patterns = [
    /\bfrom\s+'([^']+)'/g,
    /^\s*import\s+'([^']+)'/gm,
    /\bimport\(\s*'([^']+)'\s*\)/g,
  ]
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]!))
}

function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
}

describe('copy-paste folder', () => {
  it('contains only component source, styles, and its README', () => {
    const unexpected = files
      .map(relative)
      .filter(
        (file) =>
          !/\.(ts|tsx)$/.test(file) &&
          !['geospatial-map.css', 'README.md', 'CHANGELOG.md'].includes(file),
      )
    expect(unexpected).toEqual([])
    expect(files.map(relative).filter((file) => /\.(test|spec)\./.test(file))).toEqual([])
  })

  it('resolves every relative import inside the folder, without file extensions', () => {
    const problems: string[] = []
    for (const file of sources) {
      for (const specifier of specifiers(read(file)).filter((item) => item.startsWith('.'))) {
        if (/\.(js|ts|tsx|css)$/.test(specifier)) problems.push(`${relative(file)}: ${specifier}`)
        const target = path.resolve(path.dirname(file), specifier)
        const resolved = [`${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')].find(
          existsSync,
        )
        if (!resolved || !resolved.startsWith(folder))
          problems.push(`${relative(file)}: ${specifier}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('imports only the packages listed in package.json', () => {
    const allowed = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
      'geojson', // types only, from @types/geojson
    ])
    const used = new Set(
      sources.flatMap((file) =>
        specifiers(read(file))
          .filter((item) => !item.startsWith('.'))
          .map(packageName),
      ),
    )
    expect([...used].filter((name) => !allowed.has(name))).toEqual([])
    for (const dependency of Object.keys(manifest.dependencies)) expect(used).toContain(dependency)
  })

  it('documents the exact install command in the README that travels with the folder', () => {
    const readme = read(path.join(folder, 'README.md'))
    const install = readme.match(/npm install ([^\n]+)\nnpm install -D ([^\n]+)/)
    expect(install, 'README install commands').not.toBeNull()
    expect(install![1]!.split(' ').sort()).toEqual(Object.keys(manifest.dependencies).sort())
    expect(install![2]!.split(' ')).toEqual(['@types/geojson'])
  })

  it('stamps the folder with the package version and a matching changelog entry', () => {
    const version = (manifest as unknown as { version: string }).version
    expect(read(path.join(folder, 'version.ts'))).toContain(`'${version}'`)
    expect(read(path.join(folder, 'CHANGELOG.md'))).toMatch(
      new RegExp(`^## ${version.replaceAll('.', '\\.')}$`, 'm'),
    )
  })

  it('never imports CSS from TypeScript or relies on bundler or Node globals', () => {
    const problems = sources.flatMap((file) => {
      const source = read(file)
      return [
        ...specifiers(source).filter((item) => item.endsWith('.css')),
        ...(source.match(/\bimport\.meta\b|\bprocess\.env\b|\brequire\(/g) ?? []),
      ].map((match) => `${relative(file)}: ${match}`)
    })
    expect(problems).toEqual([])
  })

  it("marks every module that uses React state or JSX with 'use client'", () => {
    const missing = sources.filter((file) => {
      const source = read(file)
      const usesClientReact =
        file.endsWith('.tsx') ||
        /import\s+\{[^}]*\buse[A-Z]\w*[^}]*\}\s+from\s+'react'/.test(source)
      return usesClientReact && !source.startsWith("'use client'")
    })
    expect(missing.map(relative)).toEqual([])
  })

  it('keeps server-safe modules free of the client directive', () => {
    for (const name of [
      'config.ts',
      'types.ts',
      'messages.ts',
      'theme.ts',
      'utils.ts',
      'basemaps.ts',
      'world-data.ts',
    ])
      expect(read(path.join(folder, name)).startsWith("'use client'"), name).toBe(false)
  })
})
