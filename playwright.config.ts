import { defineConfig, devices } from '@playwright/test'
import type { PlaywrightTestConfig } from '@playwright/test'

// One suite, run against both demos. The specs stay framework-neutral (roles, labels, data-slot):
// the React projects open the React demo (Vite, :4173), the *-angular projects the Angular demo
// (ng serve, :4174), chromium-angular-zone a second Angular server that forces zone.js change
// detection (:4175), and parity opens both to compare their DOM (tests/browser/parity).
//
// PW_FRAMEWORK picks the projects, and so the servers a run starts: react, angular (with the
// zone project), parity, or all (the default). The root scripts test:browser:react,
// test:browser:angular and test:browser:parity set it through scripts/playwright.mjs.
//
// Each project but parity names its demo in `metadata` (`framework`, and `zone` for the zone.js
// server); framework.spec.ts checks that the server at its baseURL really is that demo.
const frameworks = ['react', 'angular', 'parity', 'all'] as const
type Framework = (typeof frameworks)[number]
const framework = (process.env['PW_FRAMEWORK'] ?? 'all') as Framework
if (!frameworks.includes(framework))
  throw new Error(`PW_FRAMEWORK must be one of ${frameworks.join(', ')}, not "${framework}"`)

const ci = Boolean(process.env['CI'])
const react = 'http://127.0.0.1:4173'
const angular = 'http://127.0.0.1:4174'
const angularZone = 'http://127.0.0.1:4175'

type Server = NonNullable<Exclude<PlaywrightTestConfig['webServer'], unknown[]>>
const servers = {
  react: {
    command: 'pnpm --filter geospatial-map-demo dev --host 127.0.0.1 --port 4173',
    url: react,
    reuseExistingServer: !ci,
  },
  // The demo's dev script copies the shared public files first, then runs ng serve.
  angular: {
    command: 'pnpm --filter geospatial-map-demo-angular dev --host 127.0.0.1 --port 4174',
    url: angular,
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
  // angular.json's `zone` configuration defines GEO_DEMO_FORCE_ZONE, which main.ts reads, and
  // turns prebundling off: the :4174 server's Vite prebundle folder is shared, and a server with
  // another `define` would rewrite it under that server's pages.
  angularZone: {
    command:
      'pnpm --filter geospatial-map-demo-angular dev --configuration zone --host 127.0.0.1 --port 4175',
    url: angularZone,
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
} satisfies Record<string, Server>

const serversFor: Record<Framework, Server[]> = {
  react: [servers.react],
  angular: [servers.angular, servers.angularZone],
  parity: [servers.react, servers.angular],
  all: [servers.react, servers.angular, servers.angularZone],
}

type Project = NonNullable<PlaywrightTestConfig['projects']>[number]
const reactDemo = { framework: 'react' }
const angularDemo = { framework: 'angular' }
const projects: Record<Exclude<Framework, 'all'>, Project[]> = {
  react: [
    { name: 'chromium', metadata: reactDemo, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', metadata: reactDemo, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', metadata: reactDemo, use: { ...devices['Desktop Safari'] } },
  ],
  angular: [
    {
      name: 'chromium-angular',
      metadata: angularDemo,
      use: { ...devices['Desktop Chrome'], baseURL: angular },
    },
    {
      name: 'firefox-angular',
      metadata: angularDemo,
      use: { ...devices['Desktop Firefox'], baseURL: angular },
    },
    {
      name: 'webkit-angular',
      metadata: angularDemo,
      use: { ...devices['Desktop Safari'], baseURL: angular },
    },
    // Zone-based host apps: the smoke specs, plus a check that zone.js really runs.
    {
      name: 'chromium-angular-zone',
      metadata: { ...angularDemo, zone: true },
      testMatch: ['framework.spec.ts', 'quickstart.spec.ts', 'map.spec.ts', 'zone/*.spec.ts'],
      testIgnore: ['parity/**'],
      use: { ...devices['Desktop Chrome'], baseURL: angularZone },
    },
  ],
  // Opens each route in both demos, at the React and Angular addresses above.
  parity: [
    {
      name: 'parity',
      testMatch: 'parity/*.spec.ts',
      testIgnore: [],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
}

export default defineConfig({
  testDir: './tests/browser',
  // parity/ runs only in the parity project, zone/ only in chromium-angular-zone.
  testIgnore: ['parity/**', 'zone/**'],
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter: ci ? 'github' : 'list',
  use: {
    baseURL: react,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: serversFor[framework],
  projects:
    framework === 'all'
      ? [...projects.react, ...projects.angular, ...projects.parity]
      : projects[framework],
})
