import { expect, test } from '@playwright/test'
import { waitForMapReady } from '../../packages/geospatial-map/src/testing'

// The quick-start scenario is written the way a new team would write it (inline config,
// short form, fill, custom loader). These tests guard the integration fixes.

test('an inline short config renders, fills its frame, and loads through the custom loader', async ({
  page,
}) => {
  const hints: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('[geospatial-map]')) hints.push(message.text())
  })
  await page.goto('/?scenario=quickstart')
  const map = page.getByRole('application', { name: 'Quick start map' })
  await expect(map).toBeVisible()
  await expect(page.getByLabel('Custom loader calls')).not.toHaveText('Custom loader calls: 0')
  await expect.poll(() => page.locator('.ol-viewport').evaluate((el) => el.clientHeight)).toBe(560)
  await expect
    .poll(() =>
      page.evaluate(() => {
        let painted = 0
        for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
          '.geo-map-viewport canvas',
        )) {
          const pixels = canvas
            .getContext('2d')
            ?.getImageData(0, 0, canvas.width, canvas.height).data
          if (pixels)
            for (let index = 3; index < pixels.length; index += 4)
              if (pixels[index]! > 10) painted++
        }
        return painted
      }),
    )
    .toBeGreaterThan(2_000)
  expect(hints).toEqual([])
})

test('re-rendering the parent with an inline config keeps the current view', async ({ page }) => {
  await page.goto('/?scenario=quickstart')
  await expect(page.getByRole('application', { name: 'Quick start map' })).toBeVisible()
  const reset = page.getByRole('button', { name: 'Reset zoom' })
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(reset).toBeEnabled()
  for (let count = 1; count <= 3; count++)
    await page.getByRole('button', { name: /Re-render parent/ }).click()
  await expect(page.getByRole('button', { name: 'Re-render parent (3)' })).toBeVisible()
  await page.waitForTimeout(400)
  await expect(reset).toBeEnabled()
})

test('layers with a feature id are selectable without extra settings', async ({ page }) => {
  await page.goto('/?scenario=quickstart')
  const map = page.getByRole('application', { name: 'Quick start map' })
  await expect(page.getByLabel('Custom loader calls')).not.toHaveText('Custom loader calls: 0')
  await page.waitForTimeout(800)
  const box = await map.boundingBox()
  if (!box) throw new Error('Map has no visible bounds')
  // Central Africa sits near the middle of the default whole-world view.
  await map.click({ position: { x: box.width * 0.53, y: box.height * 0.55 } })
  await expect(page.getByLabel('Selected area')).not.toHaveText('Selected: none')
  await expect(page.getByRole('dialog', { name: 'Selected feature details' })).toBeVisible()
})

test('exposes loading and then ready on the map element for tests and agents', async ({ page }) => {
  // Record every data-status the map element goes through.
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { mapStatuses: string[] }).mapStatuses = seen
    new MutationObserver(() => {
      const status = document.querySelector('[data-slot="map"]')?.getAttribute('data-status')
      if (status && seen.at(-1) !== status) seen.push(status)
    }).observe(document, { subtree: true, childList: true, attributeFilter: ['data-status'] })
  })
  await page.goto('/?scenario=quickstart')
  await waitForMapReady(page)
  const map = page.locator('[data-slot="map"]')
  await expect(map).toHaveAttribute('data-status', 'ready')
  await expect(map).not.toHaveAttribute('data-layer-errors', /.*/)
  const statuses = await page.evaluate(
    () => (window as unknown as { mapStatuses: string[] }).mapStatuses,
  )
  expect(statuses[0]).toBe('loading')
  expect(statuses.at(-1)).toBe('ready')
})
