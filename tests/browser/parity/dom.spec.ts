import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import { mockArcgisService } from '../fixtures/arcgis'
import { comparableLines, firstDifference, stableMapNodes } from './dom-summary'
import type { DomNode } from './dom-summary'

// DOM parity (angular-plan.md, D3): each route opens in the React demo and in the Angular demo
// at the same viewport, and the visible elements inside every map must be the same (see
// dom-summary.ts for what is compared). Runs in the `parity` project, which starts both demos:
// `pnpm test:browser:parity`. A failure prints the first differing node with its neighbours.

const demos = { react: 'http://127.0.0.1:4173', angular: 'http://127.0.0.1:4174' } as const

type ParityRoute = {
  name: string
  path: string
  /** Serves fixtures with `page.route`, as the route's own spec does. */
  mock?: (page: Page) => Promise<void>
  /** Brings the map into the state to compare (opens a panel, selects a feature, …). */
  prepare?: (page: Page) => Promise<void>
}

async function openPanel(page: Page, name: string, panel: string) {
  await page.getByRole('button', { name, exact: true }).first().click()
  await expect(page.locator(panel).first()).toBeVisible()
}

/** Page position of the first land pixel of the quick start map (as in features.spec.ts). */
function findLand(page: Page) {
  return page.evaluate(() => {
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>('.geo-map-viewport canvas')) {
      const context = canvas.getContext('2d')
      if (!context) continue
      const rect = canvas.getBoundingClientRect()
      const ratio = canvas.width / rect.width
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let y = 0; y < height; y += 2)
        for (let x = 0; x < width - 90 * ratio; x += 2) {
          const index = (y * width + x) * 4
          const [red, green, blue, alpha] = [0, 1, 2, 3].map((offset) => data[index + offset]!)
          if (
            Math.abs(red! - 0x5b) <= 10 &&
            Math.abs(green! - 0x8f) <= 10 &&
            Math.abs(blue! - 0xd6) <= 10 &&
            alpha! > 200
          )
            return { x: rect.left + x / ratio, y: rect.top + y / ratio }
        }
    }
    return null
  })
}

const routes: ParityRoute[] = [
  { name: 'main harness map', path: '/' },
  // The map alone, filling the window (the docs site's iframes): a bigger map, same parts.
  { name: 'embed mode', path: '/?scenario=global&embed' },
  {
    name: 'settings panel',
    path: '/',
    prepare: (page) => openPanel(page, 'Map settings', '.geo-map-settings'),
  },
  {
    name: 'layer panel',
    path: '/?scenario=layers',
    prepare: (page) => openPanel(page, 'Layers', '.geo-layer-panel'),
  },
  { name: 'time controls', path: '/?scenario=time' },
  { name: 'comparison grid', path: '/?scenario=grid' },
  {
    name: 'quick start popup and tooltip',
    path: '/?scenario=quickstart',
    prepare: async (page) => {
      // As in quickstart.spec.ts: central Africa sits near the middle of the whole-world view.
      await expect(page.getByLabel('Custom loader calls')).not.toHaveText('Custom loader calls: 0')
      await page.waitForTimeout(800)
      const map = page.getByRole('application', { name: 'Quick start map' })
      const box = await map.boundingBox()
      if (!box) throw new Error('Map has no visible bounds')
      const point = { x: box.x + box.width * 0.53, y: box.y + box.height * 0.55 }
      await page.mouse.click(point.x, point.y)
      await expect(page.getByRole('dialog', { name: 'Selected feature details' })).toBeVisible()
      // Then hover another country (the first one from the top), away from the popup.
      await expect.poll(() => findLand(page)).not.toBeNull()
      const land = (await findLand(page))!
      await page.mouse.move(land.x, land.y, { steps: 2 })
      await expect(page.locator('.geo-tooltip')).toBeVisible()
    },
  },
  {
    name: 'source error',
    path: '/?scenario=errors',
    // The missing file: Vite answers with its index.html, ng serve with a 404, and the message
    // says which. Both get the 404 here, so the alert's text is compared too.
    mock: async (page) => {
      await page.route('**/data/does-not-exist.geojson', (route) =>
        route.fulfill({ status: 404, body: 'Not found' }),
      )
    },
  },
  { name: 'configuration playground', path: '/?scenario=configuration' },
  { name: 'composed parts', path: '/?scenario=composed' },
  { name: 'features', path: '/?scenario=features' },
  { name: 'ArcGIS basemap', path: '/?scenario=arcgis', mock: mockArcgisService },
  { name: 'design-system themes', path: '/?scenario=themes' },
  { name: 'engine checks', path: '/?scenario=checks' },
]

/** Opens the route in one demo, waits for every map, and returns its maps' nodes. */
async function mapNodes(
  page: Page,
  demo: keyof typeof demos,
  route: ParityRoute,
): Promise<DomNode[]> {
  await page.goto(demos[demo] + route.path)
  const maps = page.locator('[data-slot="map"]')
  await expect(maps.first()).toBeAttached({ timeout: 20_000 })
  // Every map has drawn and loaded its layers (or shows its configuration error).
  await expect(
    maps.and(page.locator(':not([data-status="ready"]):not([data-status="error"])')),
  ).toHaveCount(0, { timeout: 20_000 })
  // The right demo answered (once rendered, Angular's root carries ng-version): two servers of
  // one demo would make every route pass.
  expect(await page.locator('[ng-version]').count(), `${demo} demo at ${demos[demo]}`).toBe(
    demo === 'angular' ? 1 : 0,
  )
  await route.prepare?.(page)
  return stableMapNodes(page)
}

for (const route of routes) {
  test(`${route.name} (${route.path}): React and Angular render the same map DOM`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await route.mock?.(page)
    const react = await mapNodes(page, 'react', route)
    const angular = await mapNodes(page, 'angular', route)
    expect(react.length, 'the React maps have content').toBeGreaterThan(5)
    const lines = comparableLines(react, angular)
    const difference = firstDifference(lines.react, lines.angular)
    expect(lines.angular, difference ?? undefined).toEqual(lines.react)
  })
}
