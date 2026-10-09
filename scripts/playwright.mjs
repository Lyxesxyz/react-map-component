// Runs the browser suite for one framework, on every OS (the root test:browser:* scripts):
//
//   node scripts/playwright.mjs <react|angular|parity|all> [playwright test arguments]
//
// It sets PW_FRAMEWORK, which playwright.config.ts reads to pick the projects and the servers,
// then runs `playwright test` in this process. `PW_FRAMEWORK=react playwright test` would do the
// same, but that syntax fails in the Windows command prompt.
import { createRequire } from 'node:module'

const frameworks = ['react', 'angular', 'parity', 'all']
const [framework, ...args] = process.argv.slice(2)
if (!frameworks.includes(framework)) {
  console.error(
    `Usage: node scripts/playwright.mjs <${frameworks.join('|')}> [playwright test arguments]`,
  )
  process.exit(2)
}

process.env['PW_FRAMEWORK'] = framework
const require = createRequire(import.meta.url)
const cli = require.resolve('@playwright/test/cli')
process.argv = [process.argv[0], cli, 'test', ...args]
require(cli)
