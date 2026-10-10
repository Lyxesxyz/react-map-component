import { expect, test } from './fixtures/test'
import type { Page } from '@playwright/test'
import { waitForMapReady } from '../../packages/geospatial-map/src/testing'

// `?embed` works with every scenario: only the map, filling the window, for the docs site's
// iframes (apps/site). The harness marks its <main> with `data-embed`, and app.css hides the
// header, notices, toolbars, data table and inspector and sets --geo-height to the window's
// height. Without `embed`, the harness is unchanged.

/** The visible elements outside every map and grid: the harness chrome left on screen. */
function chromeOnScreen(page: Page) {
  return page.evaluate(() => {
    const maps = [...document.querySelectorAll('[data-slot="map"], [data-slot="map-grid"]')]
    return [...document.body.querySelectorAll('*')]
      .filter((element) => !maps.some((map) => map.contains(element) || element.contains(map)))
      .filter((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 1 && box.height > 1 && getComputedStyle(element).visibility !== 'hidden'
      })
      .map((element) => `<${element.localName} class="${element.getAttribute('class') ?? ''}">`)
  })
}

/** The first map's box, the window's size and the document's scroll size, in CSS pixels. */
function layout(page: Page) {
  return page.evaluate(() => {
    const map = document.querySelector('[data-slot="map"]')!.getBoundingClientRect()
    const { scrollWidth, scrollHeight } = document.documentElement
    return {
      map: { x: map.x, y: map.y, width: map.width, height: map.height },
      window: { width: window.innerWidth, height: window.innerHeight },
      scroll: { width: scrollWidth, height: scrollHeight },
    }
  })
}

/** Checks that the first map covers the window (within 1px) and the document doesn't scroll. */
async function expectMapFillsWindow(page: Page) {
  await expect
    .poll(async () => {
      const { map, window, scroll } = await layout(page)
      const off = (value: number, expected: number) => Math.abs(value - expected) > 1
      return [
        off(map.x, 0) && `map x ${map.x}`,
        off(map.y, 0) && `map y ${map.y}`,
        off(map.width, window.width) && `map width ${map.width} in ${window.width}`,
        off(map.height, window.height) && `map height ${map.height} in ${window.height}`,
        scroll.width > window.width && `scroll width ${scroll.width} in ${window.width}`,
        scroll.height > window.height && `scroll height ${scroll.height} in ${window.height}`,
      ].filter(Boolean)
    })
    .toEqual([])
}

for (const scenario of ['global', 'themes', 'quickstart', 'features']) {
  test(`?scenario=${scenario}&embed shows only the map, filling the window`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/?scenario=${scenario}&embed`)
    await waitForMapReady(page)
    await expect(page.getByRole('heading', { name: 'Indicator geospatial map' })).toBeHidden()
    await expect(page.getByRole('combobox', { name: 'Scenario' })).toBeHidden()
    await expect(page.getByText('Accessible indicator data table')).toBeHidden()
    await expect(page.getByRole('region', { name: 'Integration inspector' })).toBeHidden()
    await expect(page.getByRole('list', { name: 'Recent map events' })).toBeHidden()
    await expect(page.locator('.demo-composed-toolbar')).toBeHidden()
    expect(await chromeOnScreen(page)).toEqual([])
    await expectMapFillsWindow(page)
    expect(errors).toEqual([])
  })
}

test('embed fills a narrow window too', async ({ page }) => {
  // Below 680px of map width the map takes --geo-height-narrow, which embed sets as well.
  await page.setViewportSize({ width: 375, height: 560 })
  await page.goto('/?scenario=global&embed')
  await waitForMapReady(page)
  await expectMapFillsWindow(page)
})

test('embed leaves no harness chrome on screen in any scenario', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/?embed')
  await expect(page.locator('[data-slot="map"]').first()).toBeAttached()
  // The harness's (hidden) Scenario select lists every scenario.
  const scenarios = await page
    .locator('.demo-scenario-control option')
    .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
  expect(scenarios.length).toBeGreaterThan(10)
  for (const scenario of scenarios) {
    await page.goto(`/?scenario=${scenario}&embed`)
    await expect(page.locator('[data-slot="map"]').first()).toBeAttached({ timeout: 20_000 })
    expect(await chromeOnScreen(page), `?scenario=${scenario}&embed`).toEqual([])
  }
})

test('without embed, the harness shows its header and inspector around the map', async ({
  page,
}) => {
  await page.goto('/?scenario=global')
  await waitForMapReady(page)
  await expect(page.getByRole('heading', { name: 'Indicator geospatial map' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Scenario' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Integration inspector' })).toBeVisible()
  await expect(page.locator('main.demo-shell')).not.toHaveAttribute('data-embed')
  const { map } = await layout(page)
  expect(map.y).toBeGreaterThan(50)
  expect(map.height).toBe(680)
})
