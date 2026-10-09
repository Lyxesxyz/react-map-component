import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/test'
import { readFileSync } from 'node:fs'
import { waitForMapReady } from '../../packages/geospatial-map/src/testing'

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+/VDFUgAAAABJRU5ErkJggg==',
  'base64',
)

async function openMapSettings(page: Page) {
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await expect(page.locator('.geo-map-settings')).toBeVisible()
}

test('renders a visible Equal Earth choropleth and switches to Mercator', async ({ page }) => {
  await page.goto('/')
  const map = page.getByRole('application', { name: 'Indicator geospatial map' })
  await expect(map).toBeVisible()
  await expect
    .poll(() => page.locator('.ol-viewport').evaluate((element) => element.clientHeight))
    .toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: 'Legend' })).toBeVisible()
  await expect(page.getByText('Development index', { exact: true }).first()).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole('application', { name: 'Indicator geospatial map' })
        .evaluate((element) => getComputedStyle(element).fontFamily),
    )
    .toContain('Inter')
  await expect
    .poll(() =>
      page
        .getByRole('heading', { name: 'Indicator geospatial map' })
        .evaluate((element) => getComputedStyle(element).fontFamily),
    )
    .toContain('Inter')
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

  // The projection is a developer setting: users get no picker, only basemaps in that projection.
  await openMapSettings(page)
  await expect(page.getByRole('combobox', { name: 'Projection' })).toHaveCount(0)
  await page.goto('/?scenario=global&projection=EPSG:3857')
  await openMapSettings(page)
  await expect(page.getByRole('combobox', { name: 'Basemap' })).toHaveValue('reference-mercator')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('resets zoom to the configured initial level', async ({ page }) => {
  await page.goto('/')
  const resetZoom = page.getByRole('button', { name: 'Reset zoom' })
  await expect(resetZoom).toBeDisabled()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(resetZoom).toBeEnabled()
  await page.getByRole('button', { name: 'Inspect state' }).click()
  const zoom = async () => {
    const state = JSON.parse(await page.getByTestId('serialized-state').innerText()) as {
      view: { zoom: number }
    }
    return state.view.zoom
  }
  await expect.poll(zoom).toBeCloseTo(3.35, 2)

  await resetZoom.click()
  await expect(resetZoom).toBeDisabled()
  await page.getByRole('button', { name: 'Inspect state' }).click()
  await expect.poll(zoom).toBeCloseTo(2.35, 2)
})

test('loads the ArcGIS Equal Earth basemap through its custom tile grid and style', async ({
  page,
}) => {
  await page.route('**/EqualEarthBasemap/VectorTileServer/resources/styles/root.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        sources: { esri: { type: 'vector', url: '../../' } },
        layers: [
          {
            id: 'land',
            type: 'fill',
            source: 'esri',
            'source-layer': 'land',
            paint: { 'fill-color': '#ffffff' },
          },
        ],
      }),
    }),
  )
  await page.route('**/EqualEarthBasemap/VectorTileServer/tile/**', (route) =>
    route.fulfill({ contentType: 'application/vnd.mapbox-vector-tile', body: Buffer.alloc(0) }),
  )

  await page.goto('/?scenario=global&basemap=arcgis-equal-earth')
  await expect(page.getByText('Equal Earth Global Vector Basemap')).toBeVisible()
  // The only basemap in this projection: no basemap picker to show.
  await openMapSettings(page)
  await expect(page.getByRole('combobox', { name: 'Basemap' })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('selects and highlights a region and exposes host statistics', async ({ page }) => {
  await page.goto('/')
  const map = page.getByRole('application', { name: 'Indicator geospatial map' })
  await openMapSettings(page)
  await page.getByRole('combobox', { name: 'Zoom to area' }).selectOption('bulgaria')
  await expect
    .poll(() => page.getByRole('list', { name: 'Recent map events' }).textContent())
    .toContain('viewChange')
  await page.waitForTimeout(350)
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
  await expect(panel.getByRole('heading', { name: 'Indicators', exact: true })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Reference features' })).toBeVisible()
  const cities = panel.getByRole('checkbox', { name: /Cities/ })
  await expect(cities).toBeChecked()
  await cities.click()
  await expect(cities).not.toBeChecked()
  await panel.getByRole('button', { name: 'Show options for Development index' }).click()
  await panel.getByRole('slider', { name: 'Development index opacity' }).fill('0.45')
  await expect(panel.getByText('Opacity 45%')).toBeVisible()
  await panel.getByRole('button', { name: 'Move Development index up' }).click()
  await expect(page.getByRole('list', { name: 'Recent map events' })).toContainText(
    'layerStateChange',
  )
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await expect(panel.getByText('GEOJSON · unavailable at this scale')).toBeVisible()
  await expect(cities).toBeEnabled()
})

test('compares graduated bubbles, categorical points, and a weighted heatmap', async ({ page }) => {
  await page.goto('/?scenario=points')
  const panel = page.getByLabel('Map layers')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Point visualizations' })).toBeVisible()
  await expect(panel.getByText('1 of 3 visible')).toBeVisible()

  const bubbles = panel.getByRole('checkbox', { name: /Graduated bubbles/ })
  const categories = panel.getByRole('checkbox', { name: /Categorical point symbols/ })
  const heatmap = panel.getByRole('checkbox', { name: /Weighted density heatmap/ })
  await expect(bubbles).toBeChecked()
  await expect(categories).not.toBeChecked()
  await expect(heatmap).not.toBeChecked()
  await expect(panel.getByRole('slider', { name: 'Graduated bubbles opacity' })).toBeVisible()

  const categoryOptions = panel.getByRole('button', {
    name: 'Show options for Categorical point symbols',
  })
  await categoryOptions.focus()
  await page.keyboard.press('Enter')
  await expect(
    panel.getByRole('slider', { name: 'Categorical point symbols opacity' }),
  ).toBeVisible()
  const iconOffsets = await panel.locator('.geo-shape-icon-button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const buttonRect = button.getBoundingClientRect()
      const iconRect = button.querySelector('svg')!.getBoundingClientRect()
      return [
        iconRect.left + iconRect.width / 2 - (buttonRect.left + buttonRect.width / 2),
        iconRect.top + iconRect.height / 2 - (buttonRect.top + buttonRect.height / 2),
      ]
    }),
  )
  expect(iconOffsets.every(([x, y]) => Math.abs(x) < 0.6 && Math.abs(y) < 0.6)).toBe(true)

  await heatmap.click()
  await expect(heatmap).toBeChecked()
  await expect(bubbles).not.toBeChecked()
  await expect(page.locator('.geo-legend')).toContainText('Weighted density heatmap')
  await expect(page.locator('.geo-legend .geo-legend-gradient')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/?scenario=points&projection=EPSG:3857')
  await expect(page.locator('.geo-legend')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('animates and steps through time-linked layers', async ({ page }) => {
  await page.goto('/?scenario=time')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Play time animation', exact: true })).toBeEnabled()
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
  await expect(
    page.getByRole('application', { name: 'Indicator geospatial map: Europe' }),
  ).toBeVisible()
  await expect(page.locator('.geo-map-grid-cell')).toHaveCount(6)
  await expect(page.getByRole('heading', { name: 'Europe' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Oceania' })).toBeVisible()
  await page.getByRole('button', { name: 'Focus Europe' }).click()
  await expect(page.getByRole('application')).toHaveCount(1)
  await page.getByRole('button', { name: 'Layers' }).click()
  await page.getByRole('checkbox', { name: /Development index/ }).uncheck()
  await page.getByRole('button', { name: 'Return to grid' }).click()
  await expect(page.getByRole('application')).toHaveCount(6)
  await page.getByRole('button', { name: 'Focus Africa' }).click()
  await page.getByRole('button', { name: 'Layers' }).click()
  await expect(page.getByRole('checkbox', { name: /Development index/ })).not.toBeChecked()
})

test('exposes two independently controlled raster layers', async ({ page }) => {
  await page.goto('/?scenario=raster')
  await page.getByRole('button', { name: 'Layers' }).click()
  const panel = page.getByLabel('Map layers')
  const surface = panel.getByRole('checkbox', { name: 'Raster surface', exact: true })
  const uncertainty = panel.getByRole('checkbox', { name: 'Raster uncertainty', exact: true })
  await expect(surface).toBeChecked()
  await expect(uncertainty).toBeChecked()
  await uncertainty.click()
  await expect(uncertainty).not.toBeChecked()
  await expect(page.getByText('Raster surface', { exact: true }).first()).toBeVisible()
})

test('provides a keyboard-accessible data equivalent and JSON-safe state', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Accessible indicator data table').click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  await page.getByRole('button', { name: 'Inspect state' }).click()
  const state = JSON.parse((await page.getByTestId('serialized-state').textContent()) ?? '{}')
  expect(state).toMatchObject({ view: { projection: 'EPSG:8857' }, selection: null })
  expect(Object.keys(state.layers)).toContain('development-index')
})

test('exports a report-ready PNG', async ({ page }) => {
  await page.goto('/')
  await openMapSettings(page)
  const download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('PNG')
  const result = await download
  expect(result.suggestedFilename()).toBe('map.png')
})

test('exports vector-native SVG and labels raster fallbacks', async ({ page }) => {
  // The reference basemap is vector data; the harness's default Esri basemap is vector tiles,
  // which are exported as an image.
  await page.goto('/?basemap=reference-equal-earth')
  await openMapSettings(page)
  let download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('SVG')
  let result = await download
  const vectorPath = await result.path()
  expect(vectorPath && readFileSync(vectorPath, 'utf8')).toContain('vector-native')
  expect(vectorPath && readFileSync(vectorPath, 'utf8')).toContain('Inter Variable')

  await page.goto('/?scenario=raster')
  await openMapSettings(page)
  download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('SVG')
  result = await download
  const rasterPath = await result.path()
  expect(rasterPath && readFileSync(rasterPath, 'utf8')).toContain('svg-wrapper')

  await page.goto('/?scenario=points')
  await page.getByRole('checkbox', { name: /Weighted density heatmap/ }).click()
  await openMapSettings(page)
  download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('SVG')
  result = await download
  const heatmapPath = await result.path()
  expect(heatmapPath && readFileSync(heatmapPath, 'utf8')).toContain('svg-wrapper')
})

test('reports an optional source error without losing the map', async ({ page }) => {
  await page.goto('/?scenario=errors')
  await expect(page.getByRole('alert')).toContainText('Could not load Unavailable optional source')
  await expect(page.getByRole('application', { name: 'Indicator geospatial map' })).toBeVisible()
  // The map still works, and says how many layers failed.
  const map = page.locator('[data-slot="map"]')
  await expect(map).toHaveAttribute('data-status', 'ready')
  await expect(map).toHaveAttribute('data-layer-errors', '1')
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

test('keeps the floating map UI usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('application', { name: 'Indicator geospatial map' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Layers' })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        mapHeight: document.querySelector<HTMLElement>('.ol-viewport')?.clientHeight ?? 0,
      })),
    )
    .toEqual({ overflow: 0, mapHeight: 700 })
})

test('uses compact vertically grouped MapCN-style map controls', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.geo-map-settings')).toHaveCount(0)
  const zoomIn = await page.getByRole('button', { name: 'Zoom in' }).boundingBox()
  const zoomOut = await page.getByRole('button', { name: 'Zoom out' }).boundingBox()
  if (!zoomIn || !zoomOut) throw new Error('Zoom controls are not visible')
  expect(Math.abs(zoomIn.x - zoomOut.x)).toBeLessThan(1)
  expect(zoomOut.y).toBeGreaterThan(zoomIn.y)
  expect(zoomIn.width).toBeLessThanOrEqual(44)
  const iconOffsets = await page
    .locator('.geo-map-controls .geo-shape-icon-button')
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const buttonRect = button.getBoundingClientRect()
        const iconRect = button.querySelector('svg')!.getBoundingClientRect()
        return [
          iconRect.left + iconRect.width / 2 - (buttonRect.left + buttonRect.width / 2),
          iconRect.top + iconRect.height / 2 - (buttonRect.top + buttonRect.height / 2),
        ]
      }),
    )
  expect(iconOffsets.every(([x, y]) => x === 0 && y === 0)).toBe(true)
  await openMapSettings(page)
  await expect(page.getByRole('combobox', { name: 'Export map' })).toBeVisible()
})

test('applies profiles, placements, themes, messages, and JSON UI overrides', async ({ page }) => {
  await page.goto('/?scenario=configuration')
  await expect(page.getByRole('button', { name: 'Fit world' })).toBeVisible()
  await page.getByLabel('Control placement').selectOption('top-left')
  await expect
    .poll(() =>
      page
        .locator('.geo-map-controls')
        .evaluate((element) => element.getAttribute('data-placement')),
    )
    .toBe('top-left')
  await page.getByLabel('Control placement').selectOption('bottom-left')
  await expect(page.locator('.geo-map-controls')).toHaveAttribute('data-placement', 'bottom-left')
  await page.getByLabel('Control placement').selectOption('bottom-right')
  await expect(page.locator('.geo-map-controls')).toHaveAttribute('data-placement', 'bottom-right')

  await page.getByRole('checkbox', { name: 'Legend', exact: true }).uncheck()
  await expect(page.getByRole('heading', { name: 'Legend' })).toHaveCount(0)
  await page.getByLabel('Layer panel').uncheck()
  await expect(page.getByRole('button', { name: 'Layers' })).toHaveCount(0)

  await page.getByLabel('Compact density').check()
  await expect(page.locator('.geo-map-root')).toHaveAttribute('data-density', 'compact')
  await page.getByLabel('Bulgarian labels').check()
  await expect(page.getByRole('button', { name: 'Настройки на картата' })).toBeVisible()

  await page.getByLabel('UI override JSON').fill('{"legend":{"enabled":true,"layout":"compact"}}')
  await page.getByRole('button', { name: 'Apply JSON' }).click()
  await expect(page.getByRole('status')).toContainText('Configuration valid')
  await expect(page.locator('.geo-legend-compact')).toBeVisible()
})

test('supports a host-controlled complete map state', async ({ page }) => {
  await page.goto('/?controlled=1')
  await waitForMapReady(page)
  const resetZoom = page.getByRole('button', { name: 'Reset zoom' })
  await expect(resetZoom).toBeDisabled()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByRole('list', { name: 'Recent map events' })).toContainText('stateChange')
  // The host owns the state: the zoom survives opening and closing a panel.
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await expect(resetZoom).toBeEnabled()
})

test.describe('point benchmark', () => {
  // On the bundled reference basemap, as the budget is measured (performance-budgets.md): no
  // request goes to the Esri service, so the stand-in's routing (which slows every request
  // down) is left off.
  test.use({ esriWorldStandIn: false })

  test('renders the 50,000-point performance fixture', async ({ page, browserName }) => {
    await page.goto('/?points=50000&basemap=reference-equal-earth')
    await expect(page.getByText('Benchmark mode: 50,000 points.')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () => performance.getEntriesByName('geospatial-map-stable-render')[0]?.startTime,
        ),
      )
      .toBeLessThan(browserName === 'chromium' ? 4_000 : 6_000)
  })
})
