// The Angular paste test (angular-plan.md, section 7). Copies the Angular folder
// (packages/geospatial-map-angular/src) into a fresh Angular 21 app and a fresh Angular 22 app,
// exactly as a team would (src/app/geospatial-map, imported without path aliases), and builds
// them with `ng new --strict` settings. Any compile error fails, so the folder keeps to the APIs
// both versions share (decision D5) and to TypeScript 5.9 (Angular 21) and 6.0 (Angular 22).
//
//   node scripts/paste-test.mjs <v21|v22|all>        (pnpm test:paste runs all)
//
// - v21 (packages/geospatial-map-angular/test/consumer-v21, Angular 21.2, TypeScript 5.9):
//   `ng build`.
// - v22 (…/consumer-v22, Angular 22.2, TypeScript 6.0): an `ngc` type-check, then the production
//   build. The Angular 22 CLI refuses Node.js older than its `engines` (^22.22.3 || ^24.15.0 ||
//   >=26); on such a Node the build runs through the Architect API instead
//   (scripts/angular-architect-build.mjs), and with `ng build` otherwise.
//
// Each app is its own pnpm workspace package with its own Angular, so `pnpm install` sets both up.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const folder = path.join(root, 'packages/geospatial-map-angular/src')
const apps = {
  v21: path.join(root, 'packages/geospatial-map-angular/test/consumer-v21'),
  v22: path.join(root, 'packages/geospatial-map-angular/test/consumer-v22'),
}
/** Where a team pastes the folder, inside the app. */
const pasted = 'src/app/geospatial-map'

const which = process.argv[2] ?? 'all'
if (which !== 'all' && !(which in apps)) {
  console.error(`Usage: node scripts/paste-test.mjs <${[...Object.keys(apps), 'all'].join('|')}>`)
  process.exit(2)
}
const selected = which === 'all' ? Object.keys(apps) : [which]

function step(title) {
  console.log(`\n=== ${title}`)
}

/** Runs a Node.js script in the app; returns whether it succeeded. */
function run(app, script, args) {
  console.log(`$ node ${path.relative(app, script)} ${args.join(' ')}`)
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: app,
    stdio: 'inherit',
    env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
  })
  return result.status === 0
}

/** A binary of a package installed in the app (`ng` of @angular/cli, `ngc` of compiler-cli). */
function binary(app, packageName, name) {
  const require = createRequire(path.join(app, 'package.json'))
  const manifestPath = require.resolve(`${packageName}/package.json`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[name]
  if (!bin) throw new Error(`${packageName} has no "${name}" binary`)
  return { script: path.join(path.dirname(manifestPath), bin), manifest, require }
}

/** Whether this Node.js satisfies the `engines.node` range of the app's Angular CLI. */
function cliAcceptsThisNode(app) {
  const { manifest, require } = binary(app, '@angular/cli', 'ng')
  const range = manifest.engines?.node
  if (!range) return true
  const semver = createRequire(require.resolve('@angular/cli/package.json'))('semver')
  return semver.satisfies(process.version, range)
}

function paste(app) {
  const target = path.join(app, pasted)
  rmSync(target, { recursive: true, force: true })
  cpSync(folder, target, { recursive: true })
  console.log(`Copied ${path.relative(root, folder)} to ${path.relative(root, target)}`)
}

function build(name, app) {
  if (!existsSync(path.join(app, 'node_modules/@angular/core'))) {
    console.error(`${path.relative(root, app)} has no node_modules: run pnpm install first.`)
    return false
  }
  step(`${name}: paste the folder`)
  paste(app)
  rmSync(path.join(app, 'dist'), { recursive: true, force: true })

  if (name === 'v21') {
    step('v21: ng build')
    return run(app, binary(app, '@angular/cli', 'ng').script, ['build'])
  }

  step('v22: ngc type-check (strict templates)')
  if (
    !run(app, binary(app, '@angular/compiler-cli', 'ngc').script, [
      '-p',
      'tsconfig.app.json',
      '--noEmit',
    ])
  )
    return false
  if (cliAcceptsThisNode(app)) {
    step('v22: ng build')
    return run(app, binary(app, '@angular/cli', 'ng').script, ['build'])
  }
  step(
    `v22: production build through the Architect API (the Angular 22 CLI refuses Node.js ${process.version})`,
  )
  return run(app, path.join(root, 'scripts/angular-architect-build.mjs'), [
    '.',
    'consumer',
    'build',
    'production',
  ])
}

/** The two apps are the same app: only their package.json (Angular and TypeScript) differ. */
function sameApps() {
  const files = (directory, base = directory) =>
    readdirSync(directory).flatMap((name) => {
      const file = path.join(directory, name)
      if (path.relative(base, file) === path.normalize('app/geospatial-map')) return []
      return statSync(file).isDirectory() ? files(file, base) : [path.relative(base, file)]
    })
  const left = path.join(apps.v21, 'src')
  const right = path.join(apps.v22, 'src')
  const names = [...new Set([...files(left), ...files(right)])].sort()
  const config = ['angular.json', 'tsconfig.json', 'tsconfig.app.json', '.gitignore']
  const differing = [
    ...names
      .filter((name) => {
        const a = path.join(left, name)
        const b = path.join(right, name)
        return (
          !existsSync(a) || !existsSync(b) || readFileSync(a, 'utf8') !== readFileSync(b, 'utf8')
        )
      })
      .map((name) => `src/${name}`),
    ...config.filter(
      (name) =>
        readFileSync(path.join(apps.v21, name), 'utf8') !==
        readFileSync(path.join(apps.v22, name), 'utf8'),
    ),
  ]
  if (differing.length)
    console.error(
      `consumer-v21 and consumer-v22 must be the same app; these differ:\n  ${differing.join('\n  ')}`,
    )
  return differing.length === 0
}

const results = []
if (which === 'all') results.push(['v21 and v22 are the same app', sameApps()])
for (const name of selected) results.push([`${name} build`, build(name, apps[name])])

step('Paste test')
for (const [name, ok] of results) console.log(`${ok ? 'ok    ' : 'FAILED'} ${name}`)
process.exitCode = results.every(([, ok]) => ok) ? 0 : 1
