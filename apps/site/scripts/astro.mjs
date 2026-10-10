// Runs the Astro CLI with telemetry off, on every OS (the site's dev, preview and typecheck scripts):
//
//   node scripts/astro.mjs <dev|build|preview|check> [astro arguments]
//
// Astro reports usage to its servers unless ASTRO_TELEMETRY_DISABLED is set, and the repository's
// checks don't reach the network. `ASTRO_TELEMETRY_DISABLED=1 astro check` would do the same, but
// that syntax fails in the Windows command prompt.
//
// It runs in the site's directory whatever the working directory: Astro takes the project from the
// working directory, so `node apps/site/scripts/astro.mjs build` from the repository root would
// otherwise build an empty site (and `check` would offer to install @astrojs/check there).
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env['ASTRO_TELEMETRY_DISABLED'] = '1'
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
const require = createRequire(import.meta.url)
const manifest = require.resolve('astro/package.json')
const cli = path.join(path.dirname(manifest), require(manifest).bin.astro)
process.argv = [process.argv[0], cli, ...process.argv.slice(2)]
await import(pathToFileURL(cli).href)
