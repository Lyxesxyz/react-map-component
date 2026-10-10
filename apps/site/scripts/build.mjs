// Builds the docs site with both demos below it, on every OS (the site's build script; pnpm
// build:site runs it from the repository root):
//
//   node scripts/build.mjs
//
// 1. `astro build` writes the site to dist/ (scripts/astro.mjs, telemetry off). The guides
//    integration copies the folders' Markdown in first, and the links validator fails the build
//    on a broken link.
// 2. The React demo is built into dist/demo/react/ and the Angular demo into dist/demo/angular/,
//    for <base>/demo/<framework>/ (site.config.mjs). Each one's "other version" link points at the
//    sibling folder. The demos keep their own build scripts; only flags are added.
// 3. Both dist/demo/*/index.html must exist: nothing else checks the demo links (the links
//    validator skips <base>/demo/**, and the site's iframes and buttons point there).
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { base } from '../site.config.mjs'

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(site, '../..')
const dist = path.join(site, 'dist')
const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NG_CLI_ANALYTICS: 'false' }

/** @param {string} title */
function step(title) {
  console.log(`\n=== ${title}`)
}

/**
 * Runs a command and exits with its status when it fails.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, shell?: boolean }} [options]
 */
function run(command, args, options = {}) {
  console.log(`$ ${[path.basename(command), ...args].join(' ')}`)
  const result = options.shell
    ? // The Windows command prompt: one quoted command line (an argument array with `shell`
      // is deprecated in Node.js).
      spawnSync([command, ...args].map(quote).join(' '), {
        cwd: options.cwd ?? root,
        env: options.env ?? env,
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync(command, args, {
        cwd: options.cwd ?? root,
        env: options.env ?? env,
        stdio: 'inherit',
      })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

/** @param {string} arg */
function quote(arg) {
  return /^[\w./:=@'-]+$/.test(arg) ? arg : `"${arg.replaceAll('"', '""')}"`
}

/**
 * Runs pnpm: through Node.js when this script runs under pnpm (it names its own script in
 * npm_execpath), otherwise the `pnpm` on the PATH (a .cmd shim on Windows, hence the shell).
 *
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [extraEnv]
 */
function pnpm(args, extraEnv = {}) {
  const options = { env: { ...env, ...extraEnv } }
  const script = process.env['npm_execpath']
  if (script && /pnpm/i.test(path.basename(script)) && /\.[cm]?js$/.test(script)) {
    run(process.execPath, [script, ...args], options)
  } else {
    run('pnpm', args, { ...options, shell: process.platform === 'win32' })
  }
}

step('The site (astro build)')
run(process.execPath, [path.join(site, 'scripts/astro.mjs'), 'build'], { cwd: site })

step(`The React demo, for ${base}/demo/react/`)
pnpm(
  [
    '--filter',
    'geospatial-map-demo',
    'build',
    '--base',
    `${base}/demo/react/`,
    '--outDir',
    path.join(dist, 'demo/react'),
    '--emptyOutDir',
  ],
  { VITE_ANGULAR_DEMO_URL: '../angular/' },
)

step(`The Angular demo, for ${base}/demo/angular/`)
const angularBuild = mkdtempSync(path.join(os.tmpdir(), 'geospatial-map-site-'))
try {
  pnpm([
    '--filter',
    'geospatial-map-demo-angular',
    'build',
    '--base-href',
    `${base}/demo/angular/`,
    '--output-path',
    angularBuild,
    '--define',
    "REACT_DEMO_URL='../react/'",
  ])
  // The application builder writes the app to browser/, with licences beside it.
  const angularDemo = path.join(dist, 'demo/angular')
  rmSync(angularDemo, { recursive: true, force: true })
  cpSync(path.join(angularBuild, 'browser'), angularDemo, { recursive: true })
} finally {
  rmSync(angularBuild, { recursive: true, force: true })
}

step('Check')
const missing = ['react', 'angular']
  .map((framework) => path.join(dist, 'demo', framework, 'index.html'))
  .filter((file) => !existsSync(file))
if (missing.length > 0) {
  console.error(
    `The site build has no ${missing.map((file) => path.relative(site, file)).join(' or ')}.`,
  )
  process.exit(1)
}
console.log(`The site and both demos are in ${path.relative(root, dist)} (base ${base || '/'}).`)
