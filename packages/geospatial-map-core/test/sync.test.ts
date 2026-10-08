import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The shared files live in this package and are copied, byte for byte, into each framework
// folder by `pnpm sync-core`. These checks fail on drift (a copy edited by hand, or a core
// change that wasn't synced) and keep the shared files framework-neutral.

const packages = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const core = path.join(packages, 'geospatial-map-core')
const source = path.join(core, 'src')

type Manifest = { version: string; dependencies: Record<string, string> }
const manifestOf = (directory: string) =>
  JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')) as Manifest
const manifest = manifestOf(core)

function walk(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const full = path.join(directory, name)
      const relative = path.join(prefix, name)
      return statSync(full).isDirectory() ? walk(full, relative) : [relative]
    })
}

function specifiers(text: string): string[] {
  const patterns = [
    /\bfrom\s+'([^']+)'/g,
    /^\s*import\s+'([^']+)'/gm,
    /\bimport\(\s*'([^']+)'\s*\)/g,
  ]
  return patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[1]!))
}

const shared = walk(source)
const sources = shared.filter((file) => file.endsWith('.ts'))
/** The framework folders that exist: React always, Angular once it is added. */
const folders = ['geospatial-map', 'geospatial-map-angular'].filter((name) =>
  existsSync(path.join(packages, name, 'src')),
)

describe('shared files', () => {
  it('cover the engine, configuration, types and stylesheet', () => {
    for (const file of ['types.ts', 'map-bridges.ts', 'geospatial-map.css', 'config/schema.ts'])
      expect(shared, file).toContain(file)
    expect(sources.filter((file) => file.startsWith('core/')).length).toBeGreaterThan(20)
    expect(folders).toContain('geospatial-map')
  })

  it.each(folders)('are byte-identical in %s/src (run `pnpm sync-core`)', (folder) => {
    const target = path.join(packages, folder, 'src')
    const drift = shared.filter((file) => {
      const copy = path.join(target, file)
      return !existsSync(copy) || !readFileSync(copy).equals(readFileSync(path.join(source, file)))
    })
    expect(drift).toEqual([])
    // `core/` and `config/` are shared whole: nothing there may be missing from the core.
    const stale = ['core', 'config']
      .flatMap((directory) => walk(path.join(target, directory), directory))
      .filter((file) => !shared.includes(file))
    expect(stale).toEqual([])
  })

  it.each(folders)('need only dependencies %s lists, at the same version', (folder) => {
    const target = manifestOf(path.join(packages, folder))
    expect(target.version).toBe(manifest.version)
    for (const [name, range] of Object.entries(manifest.dependencies))
      expect(target.dependencies[name], name).toBe(range)
  })

  it('import only each other and the core dependencies (no framework)', () => {
    const allowed = new Set([...Object.keys(manifest.dependencies), 'geojson'])
    const problems: string[] = []
    for (const file of sources) {
      for (const specifier of specifiers(readFileSync(path.join(source, file), 'utf8'))) {
        if (!specifier.startsWith('.')) {
          const parts = specifier.split('/')
          const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
          if (!allowed.has(name)) problems.push(`${file}: ${specifier}`)
          continue
        }
        const target = path.resolve(path.dirname(path.join(source, file)), specifier)
        const resolved = [`${target}.ts`, path.join(target, 'index.ts')].find(existsSync)
        if (!resolved || !resolved.startsWith(source)) problems.push(`${file}: ${specifier}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('mark every engine file as internals shared by both versions', () => {
    const engine = sources.filter(
      (file) =>
        file.startsWith('core/') ||
        file.startsWith('config/') ||
        ['map-state.ts', 'map-bridges.ts'].includes(file),
    )
    const unmarked = engine.filter((file) => {
      const text = readFileSync(path.join(source, file), 'utf8')
      return (
        !text.startsWith("// Engine internals: read freely, but don't edit") ||
        !text.includes('identical\n// in the React and Angular versions of the map.')
      )
    })
    expect(unmarked).toEqual([])
  })
})
