import { expect, test } from './fixtures/test'
import type { Page } from '@playwright/test'
import { waitForMapReady } from '../../packages/geospatial-map/src/testing'

// Regression tests for 0.8.0: behaviour that used to depend on how a change reached the map.

const map = (page: Page) => page.locator('[data-slot="map"]').first()

test('a selection set by the host opens the popup, and clearing it closes the popup', async ({
  page,
}) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page)
  const popup = map(page).locator('[data-slot="map-popup"]')
  await expect(popup).toHaveCount(0)
  await page.getByRole('button', { name: 'Select Brazil' }).click()
  await expect(popup).toBeVisible()
  await expect(popup).toContainText('Area 76')
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect(popup).toHaveCount(0)
  // And the other way round: the popup's close button clears the host's state.
  await page.getByRole('button', { name: 'Select Brazil' }).click()
  await popup.getByRole('button', { name: 'Close feature details' }).click()
  await expect(page.getByTestId('selection')).toHaveText('none')
})

test('panning moves the existing OpenLayers view instead of replacing it', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page)
  await page.evaluate(() => {
    const olMap = window.geoChecks!.getOpenLayersMap()!
    ;(window as unknown as { firstView: unknown }).firstView = olMap.getView()
  })
  const box = (await map(page).locator('.geo-map-viewport').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 40, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const same = await page.evaluate(
    () =>
      window.geoChecks!.getOpenLayersMap()!.getView() ===
      (window as unknown as { firstView: unknown }).firstView,
  )
  expect(same).toBe(true)
  // The pan reached the host's state.
  const center = await page.evaluate(() => window.geoChecks!.getState().view.center[0])
  expect(center).not.toBeCloseTo(-50, 1)
})

test('layer visibility and opacity set by the host reach the map without reloading it', async ({
  page,
}) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page)
  const layer = () =>
    page.evaluate(() => {
      const olLayer = window
        .geoChecks!.getOpenLayersMap()!
        .getAllLayers()
        .find((item) => item.get('mapLayerId') === 'countries')!
      const known = (window as unknown as { countriesLayer?: unknown }).countriesLayer
      ;(window as unknown as { countriesLayer?: unknown }).countriesLayer = olLayer
      return {
        visible: olLayer.getVisible(),
        opacity: olLayer.getOpacity(),
        same: known === undefined || known === olLayer,
      }
    })
  expect(await layer()).toEqual({ visible: true, opacity: 1, same: true })
  await page.getByRole('button', { name: 'Hide countries' }).click()
  await expect.poll(layer).toEqual({ visible: false, opacity: 0.5, same: true })
})

test('errors reach onError with a code that says what failed', async ({ page, context }) => {
  await context.grantPermissions([])
  await page.goto('/?scenario=checks&hook-fails')
  await waitForMapReady(page)
  await expect(page.getByTestId('errors')).toContainText('HOOK_FAILED')
  await page.getByRole('button', { name: 'Download PNG' }).click()
  await expect(page.getByTestId('errors')).toContainText('EXPORT_CORS_BLOCKED')
  await map(page).getByRole('button', { name: 'Find my location' }).click()
  await expect(page.getByTestId('errors')).toContainText('LOCATION_UNAVAILABLE')
  await expect(map(page).locator('.geo-error-alert')).toBeVisible()
})

test('a grid keeps every synchronised change and reports focus', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page)
  const cells = page.locator('[data-slot="map-grid-cell"]')
  await expect(cells).toHaveCount(2)
  // A zoom in one map moves the other (view sync), with the grid profile in both cells.
  const resetRight = cells.nth(1).getByRole('button', { name: 'Reset zoom' })
  await expect(resetRight).toBeDisabled()
  await cells.nth(0).getByRole('button', { name: 'Zoom in' }).click()
  await expect(resetRight).toBeEnabled()
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-slot="map-grid-cell"] [data-slot="map"]')].map(
          (element) => element.getAttribute('data-status'),
        ),
      ),
    )
    .toEqual(['ready', 'ready'])
  await expect(cells.nth(1).getByRole('button', { name: 'Layers' })).toHaveCount(0)
  // Focus is part of the reported grid state.
  await cells.nth(1).getByRole('button', { name: 'Focus Right' }).click()
  await expect(page.getByTestId('grid-focus')).toHaveText('right')
  // Focused, the cell has the full UI; returning shows both cells again.
  await expect(cells).toHaveCount(1)
  await page.getByRole('button', { name: 'Return to grid' }).click()
  await expect(page.getByTestId('grid-focus')).toHaveText('grid')
  await expect(cells).toHaveCount(2)
})

// Regression tests for 0.9.0.

const moreChecks = (page: Page) => page.locator('[data-slot="map"][data-map-id="more-checks"]')

test('a panel controlled at the root agrees with its button', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page, { mapId: 'more-checks' })
  const map = moreChecks(page)
  const button = map.getByRole('button', { name: 'Layers' })
  await expect(map.getByRole('region', { name: 'Map layers' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open layers from the host' }).click()
  await expect(map.getByRole('region', { name: 'Map layers' })).toBeVisible()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await button.click()
  await expect(page.getByTestId('open-panel')).toHaveText('none')
  await expect(map.getByRole('region', { name: 'Map layers' })).toHaveCount(0)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('fit data fits the loaded features, not the world', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page, { mapId: 'more-checks' })
  await page.getByRole('button', { name: 'Fit data from the host' }).click()
  await expect
    .poll(() => page.evaluate(() => window.geoMoreChecks!.getState().view))
    .toMatchObject({ center: [expect.closeTo(12.8, -1), expect.closeTo(47.6, -1)] })
  const zoom = await page.evaluate(() => window.geoMoreChecks!.getState().view.zoom)
  expect(zoom).toBeGreaterThan(3)
})

test('the popup ref is the popup, and a host that rejects a selection wins', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page, { mapId: 'more-checks' })
  const map = moreChecks(page)
  const select = () =>
    page.evaluate(() => window.geoMoreChecks!.select({ layerId: 'cities', featureId: 'Sofia' }))
  await select()
  await expect(map.locator('[data-slot="map-popup"]')).toBeVisible()
  await expect(page.getByTestId('more-selection')).toHaveText('Sofia')
  await page.getByRole('button', { name: 'Read popup ref' }).click()
  await expect(page.getByTestId('popup-ref')).toHaveText('map-popup')

  await page.evaluate(() => window.geoMoreChecks!.clearSelection())
  await page.getByLabel('Lock selection').check()
  await select()
  await expect(page.getByTestId('more-selection')).toHaveText('none')
  await expect(map.locator('[data-slot="map-popup"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.geoMoreChecks!.getState().selection)).toBeNull()
})

test('a configuration change that waits for the world fit keeps the same map', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page, { mapId: 'more-checks' })
  await expect(page.getByTestId('hook-calls')).toHaveText('1')
  const first = await page.evaluate(() => {
    const map = window.geoMoreChecks!.getOpenLayersMap()!
    ;(window as unknown as { firstMap: unknown }).firstMap = map
    return true
  })
  expect(first).toBe(true)
  await page.getByRole('button', { name: 'Change basemaps' }).click()
  await waitForMapReady(page, { mapId: 'more-checks' })
  await page.getByRole('button', { name: 'Change basemaps' }).click()
  await waitForMapReady(page, { mapId: 'more-checks' })
  await expect(page.getByTestId('hook-calls')).toHaveText('1')
  const same = await page.evaluate(
    () =>
      window.geoMoreChecks!.getOpenLayersMap() ===
      (window as unknown as { firstMap: unknown }).firstMap,
  )
  expect(same).toBe(true)
})

test('a heatmap rebuilds its weights for a new time frame', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page, { mapId: 'more-checks' })
  const renderer = () =>
    page.evaluate(() => {
      const layer = window
        .geoMoreChecks!.getOpenLayersMap()!
        .getAllLayers()
        .find((item) => item.get('mapLayerId') === 'density')!
      const holder = window as unknown as { renderers?: unknown[] }
      holder.renderers ??= []
      const current = layer.getRenderer()
      if (!holder.renderers.includes(current)) holder.renderers.push(current)
      return holder.renderers.length
    })
  expect(await renderer()).toBe(1)
  await page.evaluate(() => window.geoMoreChecks!.setTime('b'))
  await page.waitForTimeout(200)
  expect(await renderer()).toBe(2)
})

test('a grid adds and removes maps, and a synced change does not echo back', async ({ page }) => {
  await page.goto('/?scenario=checks')
  await waitForMapReady(page)
  const cells = page.locator('[data-slot="map-grid-cell"]')
  await expect(cells).toHaveCount(2)
  await page.getByRole('button', { name: 'Add grid map' }).click()
  await expect(cells).toHaveCount(3)
  await page.getByRole('button', { name: 'Remove grid map' }).click()
  await expect(cells).toHaveCount(2)

  const before = Number(await page.getByTestId('grid-changes').textContent())
  await cells.nth(0).getByRole('button', { name: 'Zoom in' }).click()
  await expect(cells.nth(1).getByRole('button', { name: 'Reset zoom' })).toBeEnabled()
  await page.waitForTimeout(500)
  const after = Number(await page.getByTestId('grid-changes').textContent())
  // The zoom in the left map, and nothing more: the right map following it is not reported back.
  expect(after - before).toBe(1)
  await expect(page.getByTestId('grid-maps')).toHaveText('left right')
})
