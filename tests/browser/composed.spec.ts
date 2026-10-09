import { expect, test } from './fixtures/test'
import { readFileSync } from 'node:fs'

// The composed scenario builds a map from the copy-paste parts and styles it only from the
// host stylesheet (apps/demo-shared/styles/app.css). These tests prove the styling contract holds.

test('renders only the parts the host composes, where the host places them', async ({ page }) => {
  await page.goto('/?scenario=composed')
  await expect(page.getByRole('application', { name: 'Indicator geospatial map' })).toBeVisible()
  await expect(page.locator('.geo-map-controls')).toHaveAttribute('data-placement', 'top-left')
  await expect(page.getByRole('button', { name: 'Fit world' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Find my location' })).toHaveCount(0)
  await expect(page.locator('.geo-time-controls')).toHaveCount(0)
  await expect(page.locator('.geo-legend.demo-legend-card')).toHaveAttribute(
    'data-placement',
    'top-right',
  )
  await expect(page.getByText('Click an area to select it')).toBeVisible()

  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  await expect(page.locator('.geo-layer-panel')).toHaveAttribute('data-placement', 'top-left')
  await expect(page.getByRole('button', { name: /Move .* up/ })).toHaveCount(0)
})

test('host tokens and classes restyle every part without touching the component', async ({
  page,
}) => {
  await page.goto('/?scenario=composed')
  const root = page.locator('.geo-map-root')
  const legend = page.locator('.geo-legend')
  await expect(legend).toBeVisible()
  await expect
    .poll(() =>
      root.evaluate((element) => getComputedStyle(element).getPropertyValue('--geo-primary')),
    )
    .toBe('#7c3aed')
  await expect
    .poll(() => legend.evaluate((element) => getComputedStyle(element).borderRadius))
    .toBe('6px')
  await expect
    .poll(() => legend.evaluate((element) => getComputedStyle(element).borderLeftColor))
    .toBe('rgb(124, 58, 237)')

  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  const track = page.locator('.geo-shape-switch-track').first()
  await expect
    .poll(() => track.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(124, 58, 237)')

  await page.getByLabel('Brand tokens').uncheck()
  await expect
    .poll(() => track.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(15, 118, 110)')
})

test('dark mode swaps the tokens for every surface', async ({ page }) => {
  await page.goto('/?scenario=composed')
  const legend = page.locator('.geo-legend')
  await expect(legend).toBeVisible()
  const lightBackground = await legend.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  await page.getByLabel('Dark mode').check()
  await expect
    .poll(() => legend.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgba(24, 24, 27, 0.9)')
  expect(lightBackground).toBe('rgba(255, 255, 255, 0.94)')
  await expect
    .poll(() => legend.evaluate((element) => getComputedStyle(element).color))
    .toBe('rgb(250, 250, 250)')
})

test('canvas highlight and exports follow the host tokens', async ({ page }) => {
  // The reference basemap: with only vector layers on the map the SVG export is vector-native
  // (a vector tile basemap, like the harness's default Esri one, is exported as an image).
  await page.goto('/?scenario=composed&basemap=reference-equal-earth')
  const map = page.getByRole('application', { name: 'Indicator geospatial map' })
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await page.getByRole('combobox', { name: 'Zoom to area' }).selectOption('bulgaria')
  await expect
    .poll(() => page.getByRole('list', { name: 'Recent map events' }).textContent())
    .toContain('viewChange')
  await page.waitForTimeout(350)
  const box = await map.boundingBox()
  if (!box) throw new Error('Map has no visible bounds')
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } })
  const popup = page.getByRole('dialog', { name: 'Selected feature details' })
  await expect(popup).toBeVisible()
  await expect(popup.getByRole('button', { name: 'Done' })).toBeVisible()
  await expect(page.getByText(/^Selected: /)).toBeVisible()

  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('SVG')
  const file = await (await download).path()
  const svg = file ? readFileSync(file, 'utf8') : ''
  expect(svg).toContain('stroke="rgb(124, 58, 237)"')
  expect(svg).toContain('Inter Variable')

  await popup.getByRole('button', { name: 'Done' }).click()
  await expect(popup).toHaveCount(0)
  await expect(page.getByText('Click an area to select it')).toBeVisible()
})
