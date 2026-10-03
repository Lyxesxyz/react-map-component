import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// The ArcGIS scenario: an Equal Earth vector tile basemap configured by URL, indicators on top,
// and a disclaimer. The service is served from fixtures (one z0 tile, a WKT projection with a
// central meridian of 11°) so the test needs no network.

const fixtures = new URL('./fixtures/arcgis/', import.meta.url)
const fixture = (name: string) => readFileSync(new URL(name, fixtures))

async function mockService(page: Page) {
  await page.route('**/EqualEarthBasemap/VectorTileServer**', (route) => {
    const url = route.request().url()
    if (url.includes('/resources/styles/root.json'))
      return route.fulfill({ contentType: 'application/json', body: fixture('style.json') })
    if (url.includes('/tile/0/0/0.pbf'))
      return route.fulfill({
        contentType: 'application/x-protobuf',
        body: fixture('tile-0-0-0.pbf'),
      })
    if (url.includes('f=json'))
      return route.fulfill({ contentType: 'application/json', body: fixture('service.json') })
    return route.fulfill({ status: 404, body: '' })
  })
}

test.beforeEach(async ({ page }) => {
  await mockService(page)
})

test('loads an ArcGIS basemap from its URL in the projection of the service', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?scenario=arcgis')

  await expect(page.locator('.geo-attribution')).toContainText('Test basemap · Natural Earth')
  // The projection is the developer's choice: users get no picker, and one basemap no picker.
  await page.getByRole('button', { name: 'Map settings' }).click()
  await expect(page.getByRole('combobox', { name: 'Export map' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /projection/i })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /basemap/i })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('expands and collapses the disclaimer', async ({ page }) => {
  await page.goto('/?scenario=arcgis')
  const toggle = page.getByRole('button', { name: 'Disclaimer' })
  const text = page.getByText(/do not necessarily reflect an official position/)

  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(text).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(text).toBeVisible()
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(text).toBeHidden()
})

test('exports the map with the disclaimer under it', async ({ page }) => {
  await page.goto('/?scenario=arcgis')
  await expect(page.locator('.geo-attribution')).toContainText('Test basemap')
  await page.getByRole('button', { name: 'Map settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('png')
  const png = readFileSync(await (await download).path()).toString('base64')
  // The basemap is drawn as an image, so the disclaimer is checked in the pixels: the strip under
  // the map (a 720 pixel report with two disclaimer lines and the attribution below them) is
  // the white report background with dark text, not map.
  const strip = await page.evaluate(async (data) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const scale = image.width / 1200
    const pixels = context.getImageData(24 * scale, 652 * scale, 576 * scale, 26 * scale).data
    let white = 0
    let dark = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const sum = pixels[index]! + pixels[index + 1]! + pixels[index + 2]!
      if (sum > 750) white++
      else if (sum < 300) dark++
    }
    return { white: white / (pixels.length / 4), dark }
  }, png)
  expect(strip.white).toBeGreaterThan(0.6)
  expect(strip.dark).toBeGreaterThan(100)
})
