// Copies the shared, framework-neutral files from packages/geospatial-map-core/src into the
// React folder (packages/geospatial-map/src) and, once it exists, the Angular folder
// (packages/geospatial-map-angular/src), at the same relative paths. The copies are committed,
// so each folder stays self-contained: a team copies one folder and never needs the core.
//
//   pnpm sync-core            # write the copies
//   pnpm sync-core --check    # compare only; exits 1 listing the files that differ or are missing
//
// Edit shared files only in the core package, then run this. `core/` and `config/` are shared
// as whole directories, so a file there that the core doesn't have is removed (or, with
// --check, reported).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(repo, 'packages/geospatial-map-core/src')
const folders = ['packages/geospatial-map/src', 'packages/geospatial-map-angular/src']
const sharedDirectories = ['core', 'config']
const check = process.argv.includes('--check')

function walk(directory, prefix = '') {
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const full = path.join(directory, name)
      const relative = path.join(prefix, name)
      return statSync(full).isDirectory() ? walk(full, relative) : [relative]
    })
}

const shared = walk(source)
const problems = []
let written = 0
let removed = 0
for (const folder of folders) {
  const target = path.join(repo, folder)
  if (!existsSync(target)) continue
  for (const file of shared) {
    const content = readFileSync(path.join(source, file))
    const destination = path.join(target, file)
    const current = existsSync(destination) ? readFileSync(destination) : undefined
    if (current && Buffer.compare(current, content) === 0) continue
    if (check) {
      problems.push(`${current ? 'differs' : 'missing'}  ${folder}/${file}`)
      continue
    }
    mkdirSync(path.dirname(destination), { recursive: true })
    writeFileSync(destination, content)
    written++
  }
  const known = new Set(shared)
  const stale = sharedDirectories
    .flatMap((directory) => walk(path.join(target, directory), directory))
    .filter((file) => !known.has(file))
  for (const file of stale) {
    if (check) {
      problems.push(`not in core  ${folder}/${file}`)
      continue
    }
    unlinkSync(path.join(target, file))
    removed++
  }
}

if (check) {
  if (problems.length) {
    console.error(
      'These copies of shared files are out of step with packages/geospatial-map-core/src.\n' +
        'Edit shared files only in the core package, then run `pnpm sync-core`:\n',
    )
    for (const problem of problems) console.error(`  ${problem}`)
    process.exit(1)
  }
  console.log(`All ${shared.length} shared files are in step with the core.`)
} else {
  console.log(
    `Synced ${shared.length} shared files: ${written} written, ${removed} removed` +
      ` (${folders.filter((folder) => existsSync(path.join(repo, folder))).join(', ')}).`,
  )
}
