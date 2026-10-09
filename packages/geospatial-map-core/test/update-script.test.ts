import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// `scripts/update-geospatial-map.mjs` run in a small repository of its own. Its React folder is
// released as 0.1.0, changed in later commits that keep the version, then released as 0.2.0 with
// the version bump last, the way 0.10.0 landed. A copy of 0.1.0 must get every one of those
// changes, not only the bump.

const script = fileURLToPath(new URL('../../../scripts/update-geospatial-map.mjs', import.meta.url))
const root = mkdtempSync(path.join(tmpdir(), 'geospatial-map-update-test-'))
const repo = path.join(root, 'repo')
const folder = path.join(repo, 'packages/geospatial-map/src')

type Files = Record<string, string>
const version = (release: string) => `export const GEOSPATIAL_MAP_VERSION = '${release}'\n`
const release1: Files = {
  'version.ts': version('0.1.0'),
  'index.ts': "export * from './parts'\n",
  'map-root.tsx': 'root\n',
  'parts.tsx': 'one\ntwo\nthree\nfour\nfive\n',
  'types.ts': 'all types\n',
}

function git(...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args],
    {
      cwd: repo,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  )
}

function write(directory: string, files: Files) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    writeFileSync(path.join(directory, file), text)
  }
}

function commit(files: Files, message: string): string {
  write(folder, files)
  git('add', '-A')
  git('commit', '-q', '-m', message)
  return git('rev-parse', '--short', 'HEAD').trim()
}

function read(directory: string, prefix = ''): Files {
  return Object.fromEntries(
    readdirSync(directory).flatMap((name) => {
      const full = path.join(directory, name)
      const relative = path.posix.join(prefix, name)
      return statSync(full).isDirectory()
        ? Object.entries(read(full, relative))
        : [[relative, readFileSync(full, 'utf8')]]
    }),
  )
}

function update(copy: string): string {
  return execFileSync(
    process.execPath,
    [path.join(repo, 'scripts/update-geospatial-map.mjs'), copy, '--apply'],
    { encoding: 'utf8', stdio: 'pipe' },
  )
}

let firstRelease = ''

beforeAll(() => {
  mkdirSync(path.join(repo, 'scripts'), { recursive: true })
  copyFileSync(script, path.join(repo, 'scripts/update-geospatial-map.mjs'))
  git('init', '-q')
  firstRelease = commit(release1, 'Release 0.1.0')
  commit({ 'types.ts': 'shared types\n', 'component-types.ts': 'react types\n' }, 'Split types')
  commit({ 'parts.tsx': 'one\ntwo\nthree\nfour\nFIVE\n' }, 'Change a part')
  commit({ 'version.ts': version('0.2.0'), 'CHANGELOG.md': '## 0.2.0\n' }, 'Release 0.2.0')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('update-geospatial-map.mjs', () => {
  it('updates an untouched copy to the new release, with every commit since its own', () => {
    const copy = path.join(root, 'untouched')
    write(copy, release1)
    const output = update(copy)
    expect(output).toContain(`Base:      ${firstRelease} Release 0.1.0`)
    expect(read(copy)).toEqual(read(folder))
  })

  it("keeps the team's edits and merges them with the release", () => {
    const copy = path.join(root, 'edited')
    write(copy, {
      ...release1,
      'index.ts': "export * from './parts'\nexport * from './team'\n",
      'parts.tsx': 'ONE\ntwo\nthree\nfour\nfive\n',
      'team.ts': 'export const team = true\n',
    })
    expect(update(copy)).not.toContain('CONFLICT')
    const result = read(copy)
    expect(result['parts.tsx']).toBe('ONE\ntwo\nthree\nfour\nFIVE\n')
    expect(result['index.ts']).toContain('./team')
    expect(result['team.ts']).toBeDefined()
    expect(result['types.ts']).toBe('shared types\n')
    expect(result['component-types.ts']).toBe('react types\n')
    expect(result['version.ts']).toBe(version('0.2.0'))
    expect(existsSync(path.join(copy, 'CHANGELOG.md'))).toBe(true)
  })
})
