import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+/VDFUgAAAABJRU5ErkJggg==',
  'base64',
)

test('renders a visible Equal Earth choropleth and switches to Mercator', async ({ page }) => {
  await page.goto('/')
  const map = page.getByRole('application', { name: 'Indicator geospatial map' })
  await expect(map).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Legend' })).toBeVisible()
  await expect(page.getByText('Development index', { exact: true }).first()).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        let painted = 0
        for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
          '.geo-map-viewport canvas',
        )) {
          const context = canvas.getContext('2d')
          if (!context) continue
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          for (let index = 3; index < pixels.length; index += 4)
            if (pixels[index]! > 10) painted += 1
        }
        return painted
      }),
    )
    .toBeGreaterThan(2_000)

  await page.getByRole('combobox', { name: 'Projection' }).selectOption('EPSG:3857')
  await expect(page.getByRole('combobox', { name: 'Projection' })).toHaveValue('EPSG:3857')
  await expect(page.getByRole('combobox', { name: 'Basemap' })).toHaveValue('reference-mercator')
})

test('selects and highlights a region and exposes host statistics', async ({ page }) => {
  await page.goto('/')
  const map = page.getByRole('application', { name: 'Indicator geospatial map' })
  await page.getByRole('combobox', { name: 'Zoom to area' }).selectOption('bulgaria')
  await expect
    .poll(() => page.getByRole('list', { name: 'Recent map events' }).textContent())
    .toContain('viewChange')
  const box = await map.boundingBox()
  if (!box) throw new Error('Map has no visible bounds')
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } })
  await expect(page.getByRole('dialog', { name: 'Selected feature details' })).toBeVisible()
  await expect(page.getByText('Loading indicator statistics…')).toBeVisible()
  await expect(page.getByText('Loading indicator statistics…')).toBeHidden({ timeout: 2_000 })
  await expect(page.getByRole('list', { name: 'Recent map events' })).toContainText('featureSelect')
  await expect(page.getByRole('button', { name: 'Fit selection' })).toBeVisible()
  await page.getByRole('button', { name: 'Fit selection' }).click()
})

test('controls layer visibility, opacity, and order', async ({ page }) => {
  await page.goto('/?scenario=layers')
  await page.getByRole('button', { name: 'Layers' }).click()
  const panel = page.getByLabel('Map layers')
  await expect(panel.getByRole('checkbox')).toHaveCount(5)
  await expect(panel.getByText('indicator').first()).toBeVisible()
  await expect(panel.getByText('reference').first()).toBeVisible()
  const cities = panel.getByRole('checkbox', { name: /Cities/ })
  await expect(cities).toBeChecked()
  await cities.click()
  await expect(cities).not.toBeChecked()
  await panel.getByRole('slider', { name: 'Development index opacity' }).fill('0.45')
  await expect(panel.getByText('Opacity 45%')).toBeVisible()
  await panel.getByRole('button', { name: 'Move Development index up' }).click()
  await expect(page.getByRole('list', { name: 'Recent map events' })).toContainText(
    'layerStateChange',
  )
})

test('animates and steps through time-linked layers', async ({ page }) => {
  await page.goto('/?scenario=time')
  await expect(page.getByRole('slider', { name: 'Selected time' })).toHaveValue('0')
  await page.getByRole('button', { name: 'Next time' }).click()
  await expect(page.getByRole('slider', { name: 'Selected time' })).toHaveValue('1')
  await expect(page.getByText(/Time 2022/)).toBeVisible()
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('400')
  await page.getByRole('button', { name: 'Play time animation', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause time animation' })).toBeVisible()
})

test('renders the 3 by 2 comparison grid and identifies each map', async ({ page }) => {
  await page.goto('/?scenario=grid')
  await expect(page.getByRole('application')).toHaveCount(6)
  await expect(page.locator('.geo-map-grid-cell')).toHaveCount(6)
  await expect(page.getByRole('heading', { name: 'Europe' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Oceania' })).toBeVisible()
  await page.getByRole('button', { name: 'Focus Europe' }).click()
  await expect(page.getByRole('application')).toHaveCount(1)
  await page.getByRole('button', { name: 'Return to grid' }).click()
  await expect(page.getByRole('application')).toHaveCount(6)
})

test('exposes two independently controlled raster layers', async ({ page }) => {
  await page.goto('/?scenario=raster')
  await page.getByRole('button', { name: 'Layers' }).click()
  const panel = page.getByLabel('Map layers')
  const surface = panel.getByRole('checkbox', { name: /Raster surface · indicator/ })
  const uncertainty = panel.getByRole('checkbox', { name: /Raster uncertainty · indicator/ })
  await expect(surface).toBeChecked()
  await expect(uncertainty).toBeChecked()
  await uncertainty.click()
  await expect(uncertainty).not.toBeChecked()
  await expect(page.getByText('Raster surface', { exact: true }).first()).toBeVisible()
})

test('provides a keyboard-accessible data equivalent and safe embed output', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Accessible indicator data table').click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  await page.getByRole('button', { name: 'Copy approved embed' }).click()
  await expect(page.getByTestId('serialized-state')).toContainText('development-index-public-v1')
  await expect(page.getByTestId('serialized-state')).toContainText('<iframe')
  await expect(page.getByTestId('serialized-state')).not.toContainText('callback')
})

test('exports a report-ready PNG', async ({ page }) => {
  await page.goto('/')
  const download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('png')
  const result = await download
  expect(result.suggestedFilename()).toBe('map.png')
})

test('exports vector-native SVG and labels raster fallbacks', async ({ page }) => {
  await page.goto('/')
  let download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('svg')
  let result = await download
  const vectorPath = await result.path()
  expect(vectorPath && readFileSync(vectorPath, 'utf8')).toContain('vector-native')

  await page.goto('/?scenario=raster')
  download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('svg')
  result = await download
  const rasterPath = await result.path()
  expect(rasterPath && readFileSync(rasterPath, 'utf8')).toContain('svg-wrapper')
})

test('reports an optional source error without losing the map', async ({ page }) => {
  await page.goto('/?scenario=errors')
  await expect(page.getByRole('alert')).toContainText('Could not load Unavailable optional source')
  await expect(page.getByRole('application', { name: 'Indicator geospatial map' })).toBeVisible()
})

test('loads every supported source through deterministic fixtures', async ({ page }) => {
  await page.route('**/fixtures/data.geojson', (route) =>
    route.fulfill({
      contentType: 'application/geo+json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Fixture' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      }),
    }),
  )
  await page.route(/\/fixtures\/(xyz|wms|wmts)\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: transparentPng }),
  )
  await page.route('**/fixtures/wms**', (route) =>
    route.fulfill({ contentType: 'image/png', body: transparentPng }),
  )
  await page.route('**/fixtures/mvt/**', (route) =>
    route.fulfill({ contentType: 'application/vnd.mapbox-vector-tile', body: Buffer.alloc(0) }),
  )

  await page.goto('/?sources=1')
  await page.getByRole('button', { name: 'Layers' }).click()
  await expect(page.getByLabel('Map layers').getByRole('checkbox')).toHaveCount(5)
  await expect(page.getByRole('application', { name: 'Indicator geospatial map' })).toBeVisible()
})

test('recovers from an initially hidden container', async ({ page }) => {
  await page.goto('/?hidden=1')
  const map = page.getByRole('application', { name: 'Indicator geospatial map' })
  await expect(map).toBeHidden()
  await page.getByRole('button', { name: 'Reveal map' }).click()
  await expect(map).toBeVisible()
  await expect
    .poll(() => map.evaluate((element) => element.clientWidth * element.clientHeight))
    .toBeGreaterThan(0)
})

test('renders the 50,000-point performance fixture', async ({ page, browserName }) => {
  await page.goto('/?points=50000')
  await expect(page.getByText('Benchmark mode: 50,000 points.')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => performance.getEntriesByName('geospatial-map-stable-render')[0]?.startTime,
      ),
    )
    .toBeLessThan(browserName === 'chromium' ? 4_000 : 6_000)
})
