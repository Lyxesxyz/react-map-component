import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { waitForMapReady } from '../../packages/geospatial-map/src/testing'
import { ESRI_WORLD_COPYRIGHT, expect, failEsriWorldBasemap, test } from './fixtures/test'

// The default basemap (0.11.0): a configuration without basemaps starts on Esri's World Basemap,
// Web Mercator vector tiles reprojected to Equal Earth in the browser, and falls back quietly to
// the bundled World outlines when the service, its style or its tiles can't be loaded. The
// service is the offline stand-in of fixtures/esri-world (see fixtures/test.ts).

/** The stand-in style's land colour (fixtures/esri-world/style.json). */
const STAND_IN_LAND: [number, number, number] = [0xe6, 0xd8, 0xad]

/** Collects the map's `[geospatial-map]` console hints. */
function collectHints(page: Page) {
  const hints: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('[geospatial-map]')) hints.push(message.text())
  })
  return hints
}

/** Opens the quick start's layer panel and hides its countries, to see the basemap's land. */
async function hideCountries(page: Page) {
  await page.getByRole('button', { name: 'Layers' }).click()
  await page
    .getByLabel('Map layers')
    .getByRole('checkbox', { name: /Countries/ })
    .uncheck()
  await page.getByRole('button', { name: 'Layers' }).click()
}

/**
 * Pixels close to `rgb` in each cell of a 3 × 3 grid over the map's canvases, and the most
 * pixels of one row that sit between two pixels of that colour without being it (a seam where
 * reprojected tiles meet).
 */
function measureLand(page: Page, rgb: [number, number, number]) {
  return page.evaluate((target) => {
    const cells = Array.from({ length: 9 }, () => 0)
    let seam = 0
    const near = (data: Uint8ClampedArray, index: number, tolerance: number) =>
      data[index + 3]! > 200 &&
      Math.abs(data[index]! - target[0]!) <= tolerance &&
      Math.abs(data[index + 1]! - target[1]!) <= tolerance &&
      Math.abs(data[index + 2]! - target[2]!) <= tolerance
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>('.geo-map-viewport canvas')) {
      const context = canvas.getContext('2d')
      if (!context || !canvas.width) continue
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let y = 2; y < height - 2; y++) {
        let between = 0
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4
          if (near(data, index, 6)) {
            cells[Math.floor((3 * y) / height) * 3 + Math.floor((3 * x) / width)]! += 1
            continue
          }
          // Land two pixels above and below, and here something lighter and bluer than land.
          const above = index - 2 * width * 4
          const below = index + 2 * width * 4
          if (
            near(data, above, 6) &&
            near(data, below, 6) &&
            data[index + 2]! > target[2]! + 8 &&
            data[index]! >= target[0]! - 30
          )
            between += 1
        }
        seam = Math.max(seam, between)
      }
    }
    return { cells, seam }
  }, rgb)
}

test('starts on the Esri World Basemap, reprojected to Equal Earth', async ({ page }) => {
  const hints = collectHints(page)
  await page.goto('/?scenario=quickstart')
  await waitForMapReady(page)
  const map = page.locator('[data-slot="map"]')
  await expect(map).not.toHaveAttribute('data-layer-errors', /.*/)
  await expect(page.locator('.geo-attribution')).toContainText(ESRI_WORLD_COPYRIGHT)
  await hideCountries(page)
  // Land in every row and column of the map: the whole Equal Earth world, from the Arctic to
  // Antarctica, not a band of Web Mercator tiles.
  await expect
    .poll(async () => (await measureLand(page, STAND_IN_LAND)).cells.filter((count) => count > 200))
    .toHaveLength(9)
  const { seam } = await measureLand(page, STAND_IN_LAND)
  expect(seam, 'no seam where reprojected tiles meet').toBeLessThan(25)
  // The settings panel offers the Esri basemap and its offline fallback.
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  const basemap = page.getByRole('combobox', { name: 'Basemap' })
  await expect(basemap).toHaveValue('esri-world')
  await expect(basemap.getByRole('option')).toHaveText(['Esri World Basemap', 'World'])
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(hints).toEqual([])
})

test('switches between the Esri basemap and the World outlines from the settings', async ({
  page,
}) => {
  await page.goto('/?scenario=quickstart')
  await waitForMapReady(page)
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  const basemap = page.getByRole('combobox', { name: 'Basemap' })
  await basemap.selectOption('world')
  await expect(page.getByRole('link', { name: 'Natural Earth' })).toBeVisible()
  await basemap.selectOption('esri-world')
  await expect(page.locator('.geo-attribution')).toContainText(ESRI_WORLD_COPYRIGHT)
  await waitForMapReady(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

for (const part of ['service', 'style', 'tiles'] as const) {
  test(`falls back quietly to the World outlines when the ${part} can't be loaded`, async ({
    page,
  }) => {
    const hints = collectHints(page)
    await failEsriWorldBasemap(page, part)
    await page.goto('/?scenario=quickstart')
    await waitForMapReady(page)
    const map = page.locator('[data-slot="map"]')
    await expect(page.getByRole('link', { name: 'Natural Earth' })).toBeVisible()
    await expect(page.locator('.geo-attribution')).not.toContainText(ESRI_WORLD_COPYRIGHT)
    await expect(map).toHaveAttribute('data-status', 'ready')
    await expect(map).not.toHaveAttribute('data-layer-errors', /.*/)
    await expect(page.getByRole('alert')).toHaveCount(0)
    // The World outlines' land token, not the stand-in's colour.
    await hideCountries(page)
    await expect
      .poll(async () => (await measureLand(page, STAND_IN_LAND)).cells.every((count) => !count))
      .toBe(true)
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    const basemap = page.getByRole('combobox', { name: 'Basemap' })
    if (part === 'service') {
      // The service was never read: the Esri basemap is left out, so there is nothing to pick.
      await expect(basemap).toHaveCount(0)
    } else {
      // The map switched while running: the state, and so the settings, follow.
      await expect(basemap).toHaveValue('world')
    }
    expect(hints).toHaveLength(1)
    expect(hints[0]).toContain(
      'The basemap "Esri World Basemap" (esri-world) could not be loaded, so the map shows its ' +
        'fallback "World" (world) instead.',
    )
  })
}

for (const [part, what] of [
  ['style', 'its style fails'],
  ['tiles', 'its tiles fail'],
] as const) {
  test(`tells a host that controls the state when ${what} and the map falls back`, async ({
    page,
  }) => {
    const hints = collectHints(page)
    await failEsriWorldBasemap(page, part)
    // The harness starts its Equal Earth map on the Esri World Basemap, whose fallback there is
    // the reference basemap; `?controlled` makes the host hold the state.
    await page.goto('/?controlled=1')
    await waitForMapReady(page)
    const map = page.locator('[data-slot="map"]')
    await expect(page.getByRole('list', { name: 'Recent map events' })).toContainText(
      'stateChange · "basemap"',
    )
    await page.getByRole('button', { name: 'Inspect state' }).click()
    await expect(page.getByTestId('serialized-state')).toContainText(
      '"activeBasemapId": "reference-equal-earth"',
    )
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Basemap' })).toHaveValue(
      'reference-equal-earth',
    )
    await expect(map).toHaveAttribute('data-status', 'ready')
    await expect(map).not.toHaveAttribute('data-layer-errors', /.*/)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(hints.filter((hint) => hint.includes('(esri-world)'))).toHaveLength(1)
  })
}

test('tells a host that controls the state when the service can’t be read', async ({ page }) => {
  const hints = collectHints(page)
  await failEsriWorldBasemap(page, 'service')
  // The host's state names the Esri basemap, which is left out of the configuration once its
  // service can't be read: the map shows the fallback (the reference basemap in the harness) and
  // proposes it, as when the basemap fails while the map runs.
  await page.goto('/?controlled=1')
  await waitForMapReady(page)
  const map = page.locator('[data-slot="map"]')
  await expect(page.getByRole('list', { name: 'Recent map events' })).toContainText(
    'stateChange · "basemap"',
  )
  await page.getByRole('button', { name: 'Inspect state' }).click()
  await expect(page.getByTestId('serialized-state')).toContainText(
    '"activeBasemapId": "reference-equal-earth"',
  )
  // The reference basemap is the only one left in Equal Earth: nothing to pick.
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await expect(page.locator('.geo-map-settings')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Basemap' })).toHaveCount(0)
  await expect(map).toHaveAttribute('data-status', 'ready')
  await expect(map).not.toHaveAttribute('data-layer-errors', /.*/)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(hints.filter((hint) => hint.includes('(esri-world)'))).toHaveLength(1)
})

test('exports the reprojected basemap: PNG with its land, SVG as an image', async ({ page }) => {
  await page.goto('/?scenario=quickstart')
  await waitForMapReady(page)
  await hideCountries(page)
  await expect
    .poll(async () => (await measureLand(page, STAND_IN_LAND)).cells.filter((count) => count > 200))
    .toHaveLength(9)
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  const exportMap = page.getByRole('combobox', { name: 'Export map' })
  let download = page.waitForEvent('download')
  await exportMap.selectOption('PNG')
  const png = readFileSync((await (await download).path())!)
  // The stand-in's land colour, decoded from the exported image.
  const landPixels = await page.evaluate(
    async ({ data, rgb }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${data}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let count = 0
      for (let index = 0; index < pixels.length; index += 4)
        if (
          Math.abs(pixels[index]! - rgb[0]) <= 6 &&
          Math.abs(pixels[index + 1]! - rgb[1]) <= 6 &&
          Math.abs(pixels[index + 2]! - rgb[2]) <= 6
        )
          count += 1
      return count
    },
    { data: png.toString('base64'), rgb: STAND_IN_LAND },
  )
  expect(landPixels).toBeGreaterThan(5000)
  download = page.waitForEvent('download')
  await exportMap.selectOption('SVG')
  const svg = readFileSync((await (await download).path())!, 'utf8')
  // Vector tiles are not vector-native in SVG: the map is an image, labelled as such.
  expect(svg).toContain('svg-wrapper')
  expect(svg).not.toContain('vector-native')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('reads the service once for the six maps of a grid', async ({ page }) => {
  const reads: string[] = []
  page.on('request', (request) => {
    if (/\/World_Basemap_v2\/VectorTileServer\/?\?f=json/.test(request.url()))
      reads.push(request.url())
  })
  await page.goto('/?scenario=grid')
  await expect(page.locator('[data-slot="map-grid-cell"] [data-slot="map"]')).toHaveCount(6)
  await expect(
    page.locator('[data-slot="map-grid-cell"] [data-slot="map"][data-status="ready"]'),
  ).toHaveCount(6)
  expect(reads).toHaveLength(1)
})
