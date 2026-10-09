// @vitest-environment node
import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The Angular demo compiles the folder's sources from packages/geospatial-map-angular/src, so
// their imports resolve from this package's node_modules, and the demo's own files from the
// demo's. Both must reach the same copy of each package: two @angular/core instances break
// injection (NG0203), two `ol` instances break `instanceof` checks between the engine and
// ol-mapbox-style. pnpm links one copy when the versions (and peer versions) agree; this test
// fails when they drift apart.

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const demo = path.join(repository, 'apps/demo-angular')
const folder = path.join(repository, 'packages/geospatial-map-angular')

/** Where Node.js and the bundlers find `name` from `directory`: the nearest node_modules. */
function packageDirectory(name: string, directory: string): string {
  for (let current = directory; ; current = path.dirname(current)) {
    const candidate = path.join(current, 'node_modules', name)
    if (existsSync(candidate)) return realpathSync(candidate)
    if (path.dirname(current) === current) throw new Error(`${name} not found from ${directory}`)
  }
}

const shared = [
  '@angular/core',
  '@angular/common',
  'tslib',
  'ol',
  'lucide',
  'proj4',
  'typebox',
  'ol-mapbox-style',
]

describe('one instance of each shared package in the Angular demo', () => {
  it.each(shared)('%s resolves to the same copy from the demo and from the folder', (name) => {
    expect(packageDirectory(name, folder)).toBe(packageDirectory(name, demo))
  })

  it('ol-mapbox-style uses the same ol as the engine', () => {
    const mapboxStyle = packageDirectory('ol-mapbox-style', folder)
    expect(packageDirectory('ol', mapboxStyle)).toBe(packageDirectory('ol', folder))
  })
})
