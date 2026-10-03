// Updates a team's pasted copy of the geospatial-map folder to the version in this repository,
// keeping their own edits. Run it from a clone of this repository:
//
//   node scripts/update-geospatial-map.mjs <path-to-your-copy>            # dry run: report only
//   node scripts/update-geospatial-map.mjs <path-to-your-copy> --apply    # write the changes
//
// Options:
//   --from <git-ref>  The commit your copy was taken from. Defaults to the last commit of the
//                     version in your copy's version.ts. Needed for copies older than 0.3.0.
//   --to <git-ref>    The version to update to. Defaults to HEAD.
//
// Every file is a three-way comparison between the version you copied (base), the new version
// (upstream), and your copy (local):
//   - unchanged locally        -> replaced by the upstream file (or added / deleted)
//   - changed locally only     -> kept as you have it
//   - changed on both sides    -> merged with `git merge-file`; conflicts are marked in the file
// Files that only exist in your copy are left alone.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { URL } from 'node:url'

const FOLDER = 'packages/geospatial-map/src'
const repo = path.resolve(new URL('..', import.meta.url).pathname)

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const target = args.find(
  (arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--'),
)
const apply = args.includes('--apply')
if (!target) {
  console.error(
    'Usage: node scripts/update-geospatial-map.mjs <path-to-your-copy> [--apply] [--from <ref>] [--to <ref>]',
  )
  process.exit(2)
}
const local = path.resolve(target)
if (!existsSync(path.join(local, 'index.ts'))) {
  console.error(`${local} does not look like a copy of the geospatial-map folder (no index.ts).`)
  process.exit(2)
}

const git = (...gitArgs) =>
  execFileSync('git', gitArgs, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const versionIn = (text) => /GEOSPATIAL_MAP_VERSION\s*=\s*'([^']+)'/.exec(text ?? '')?.[1]
const showFile = (ref, file) => {
  try {
    return execFileSync('git', ['show', `${ref}:${FOLDER}/${file}`], {
      cwd: repo,
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return undefined
  }
}

/** The last commit at which version.ts still had `version`: just before the next bump, or `to`. */
function baseForVersion(version, to) {
  const history = git('log', '--format=%H', to, '--', `${FOLDER}/version.ts`)
    .split('\n')
    .filter(Boolean)
  let newer
  for (const commit of history) {
    if (versionIn(showFile(commit, 'version.ts')?.toString()) === version)
      return newer ? `${newer}^` : to
    newer = commit
  }
  return undefined
}

const to = option('--to') ?? 'HEAD'
const localVersion = versionIn(
  existsSync(path.join(local, 'version.ts'))
    ? readFileSync(path.join(local, 'version.ts'), 'utf8')
    : '',
)
const from = option('--from') ?? (localVersion ? baseForVersion(localVersion, to) : undefined)
if (!from) {
  console.error(
    localVersion
      ? `Version ${localVersion} from your copy was not found in this repository's history. Pass --from <commit>.`
      : 'Your copy has no version.ts (it predates 0.3.0). Pass --from <commit> with the commit you copied.',
  )
  process.exit(2)
}

const listFiles = (ref) =>
  git('ls-tree', '-r', '--name-only', ref, '--', FOLDER)
    .split('\n')
    .filter(Boolean)
    .map((file) => path.relative(FOLDER, file))
function listLocal(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name)
    const relative = path.join(prefix, name)
    return statSync(full).isDirectory() ? listLocal(full, relative) : [relative]
  })
}

const baseFiles = new Set(listFiles(from))
const upstreamFiles = new Set(listFiles(to))
const localFiles = new Set(listLocal(local))
const all = [...new Set([...baseFiles, ...upstreamFiles, ...localFiles])].sort()
const same = (left, right) => (left && right ? Buffer.compare(left, right) === 0 : left === right)

const scratch = mkdtempSync(path.join(tmpdir(), 'geospatial-map-update-'))
const results = []
try {
  for (const file of all) {
    const base = baseFiles.has(file) ? showFile(from, file) : undefined
    const upstream = upstreamFiles.has(file) ? showFile(to, file) : undefined
    const mine = localFiles.has(file) ? readFileSync(path.join(local, file)) : undefined
    const write = (content) => {
      if (!apply) return
      const destination = path.join(local, file)
      if (content === undefined) {
        if (existsSync(destination)) unlinkSync(destination)
        return
      }
      mkdirSync(path.dirname(destination), { recursive: true })
      writeFileSync(destination, content)
    }
    if (same(mine, upstream)) continue
    if (same(mine, base)) {
      results.push([
        upstream === undefined ? 'delete' : mine === undefined ? 'add' : 'update',
        file,
      ])
      write(upstream)
    } else if (same(upstream, base)) {
      results.push(['keep (yours)', file])
    } else if (mine === undefined || upstream === undefined || base === undefined) {
      results.push([
        'CONFLICT',
        file,
        mine === undefined
          ? 'you deleted it; it changed upstream'
          : upstream === undefined
            ? 'deleted upstream; you changed it'
            : 'added on both sides',
      ])
    } else {
      const paths = ['mine', 'base', 'upstream'].map((name) => path.join(scratch, name))
      writeFileSync(paths[0], mine)
      writeFileSync(paths[1], base)
      writeFileSync(paths[2], upstream)
      let merged
      let conflicts = 0
      try {
        merged = execFileSync(
          'git',
          ['merge-file', '-p', '-L', 'yours', '-L', 'base', '-L', 'upstream', ...paths],
          { maxBuffer: 64 * 1024 * 1024 },
        )
      } catch (error) {
        if (typeof error.status !== 'number' || error.status < 0 || !error.stdout) throw error
        merged = error.stdout
        conflicts = error.status
      }
      results.push(
        conflicts
          ? ['CONFLICT', file, `${conflicts} conflict(s) marked in the file`]
          : ['merge', file],
      )
      write(merged)
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

const describe = (ref) => git('log', '-1', '--format=%h %s', ref).trim()
console.log(`Your copy: ${local}${localVersion ? ` (version ${localVersion})` : ''}`)
console.log(`Base:      ${describe(from)}`)
console.log(
  `Upstream:  ${describe(to)} (version ${versionIn(showFile(to, 'version.ts')?.toString()) ?? '?'})`,
)
console.log('')
if (!results.length) console.log('Already up to date.')
for (const [action, file, note] of results)
  console.log(`${action.padEnd(13)} ${file}${note ? `  (${note})` : ''}`)
const conflicts = results.filter(([action]) => action === 'CONFLICT').length
console.log('')
if (!apply && results.length)
  console.log('Dry run: nothing was written. Re-run with --apply to update your copy.')
else if (apply)
  console.log(conflicts ? `Done, with ${conflicts} conflict(s) to resolve by hand.` : 'Done.')
console.log(
  'Then read CHANGELOG.md in your copy for behaviour changes, and run your typecheck and tests.',
)
process.exit(conflicts && apply ? 1 : 0)
