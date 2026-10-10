import { expect, test } from './fixtures/test'
import type { Page } from '@playwright/test'

// 0.4 features: built-in world basemap, hover tooltip, feature-anchored popup, clustering, and
// layers a host adds through `onOpenLayersMap`.

/** Page position of the first canvas pixel close to `rgb`, away from the control rail. */
async function findPixel(page: Page, rgb: [number, number, number], tolerance = 10) {
  return page.evaluate(
    ([red, green, blue, tol]) => {
      for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
        '.geo-map-viewport canvas',
      )) {
        const context = canvas.getContext('2d')
        if (!context) continue
        const rect = canvas.getBoundingClientRect()
        const ratio = canvas.width / rect.width
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
        for (let y = 0; y < height; y += 2)
          for (let x = 0; x < width - 90 * ratio; x += 2) {
            const index = (y * width + x) * 4
            if (
              Math.abs(data[index]! - red!) <= tol! &&
              Math.abs(data[index + 1]! - green!) <= tol! &&
              Math.abs(data[index + 2]! - blue!) <= tol! &&
              data[index + 3]! > 200
            )
              return { x: rect.left + x / ratio, y: rect.top + y / ratio }
          }
      }
      return null
    },
    [...rgb, tolerance],
  )
}

test('draws the built-in world basemap', async ({ page }) => {
  // The features scenario lists `worldBasemap`; a configuration without basemaps starts on the
  // Esri World Basemap (default-basemap.spec.ts).
  await page.goto('/?scenario=features')
  await expect(page.getByRole('link', { name: 'Natural Earth', exact: true })).toBeVisible()
  await expect(page.locator('.geo-map-viewport')).toHaveAttribute(
    'style',
    /var\(--geo-basemap-water\)/,
  )
})

test('shows a tooltip over a feature and hides it when the pointer leaves', async ({ page }) => {
  await page.goto('/?scenario=quickstart')
  const viewport = page.locator('.geo-map-viewport')
  await expect(page.getByLabel('Custom loader calls')).not.toHaveText('Custom loader calls: 0')
  const box = (await viewport.boundingBox())!
  // The world fills the map, centred on 0°, 0° (ocean): hover a country instead.
  await expect.poll(() => findPixel(page, [0x5b, 0x8f, 0xd6])).not.toBeNull()
  const land = (await findPixel(page, [0x5b, 0x8f, 0xd6]))!
  await page.mouse.move(land.x, land.y)
  await expect(page.locator('.geo-tooltip')).toHaveText(/^Area \d+$/)
  await page.mouse.move(box.x + box.width / 2, box.y - 40)
  await expect(page.locator('.geo-tooltip')).toHaveCount(0)
})

test('keeps the map alive when an Equal Earth view is dragged into a corner', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?scenario=quickstart')
  const box = (await page.locator('.geo-map-viewport').boundingBox())!
  for (let index = 0; index < 3; index++) {
    await page.mouse.move(box.x + 300, box.y + 500)
    await page.mouse.down()
    await page.mouse.move(box.x + 520, box.y + 540, { steps: 8 })
    await page.mouse.up()
  }
  await expect(page.getByRole('application', { name: 'Quick start map' })).toBeVisible()
  expect(errors).toEqual([])
})

test('zooms into a cluster when it is clicked', async ({ page }) => {
  await page.goto('/?scenario=features')
  const reset = page.getByRole('button', { name: 'Reset zoom' })
  await expect(reset).toBeDisabled()
  await expect.poll(() => findPixel(page, [15, 118, 110])).not.toBeNull()
  const bubble = (await findPixel(page, [15, 118, 110]))!
  await page.mouse.click(bubble.x + 4, bubble.y + 6)
  await expect(reset).toBeEnabled()
  await expect(page.locator('.geo-popup')).toHaveCount(0)
})

test('opens the popup next to the clicked station and keeps it there while panning', async ({
  page,
}) => {
  await page.goto('/?scenario=features')
  await page.getByLabel('Cluster points').uncheck()
  await expect.poll(() => findPixel(page, [22, 163, 74])).not.toBeNull()
  const station = (await findPixel(page, [22, 163, 74]))!
  await page.mouse.click(station.x + 2, station.y + 3)
  const popup = page.locator('.geo-popup')
  await expect(popup).toHaveAttribute('data-anchor', 'feature')
  await expect(popup.locator('.geo-popup-title')).toHaveText(/station \d+$/)
  const before = (await popup.boundingBox())!
  expect(Math.abs(before.x + before.width / 2 - station.x)).toBeLessThan(24)
  const box = (await page.locator('.geo-map-viewport').boundingBox())!
  // Drag 90 × 30 pixels from open water near the top-left (the map is taller than the test
  // window), a step per frame as a hand would.
  await page.mouse.move(box.x + 220, box.y + 120)
  await page.mouse.down()
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(box.x + 220 + 15 * step, box.y + 120 + 5 * step)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  // The popup moves with the map: at least as far as the drag moved it (OpenLayers pans from the
  // second step, so 75 × 25), in the same direction, and further when kinetic panning carries the
  // map on. Whether it does depends on the timing of the drag, which differs between engines.
  await expect
    .poll(async () => {
      const after = (await popup.boundingBox())!
      const [dx, dy] = [after.x - before.x, after.y - before.y]
      return dx >= 70 && dy >= 22 && Math.abs(dx / dy - 3) < 0.6
    })
    .toBe(true)
})

test('keeps a layer added through onOpenLayersMap when the configuration changes', async ({
  page,
}) => {
  await page.goto('/?scenario=features')
  await page.getByLabel('Graticule (OpenLayers layer)').check()
  const status = page.getByLabel('Graticule layer')
  await expect(status).toHaveText('Graticule layer: on the map')
  await page.getByLabel('Cluster points').uncheck()
  await page.getByLabel('Renderer').selectOption('canvas')
  await page.getByLabel('Cluster points').check()
  await expect(status).toHaveText('Graticule layer: on the map')
})
