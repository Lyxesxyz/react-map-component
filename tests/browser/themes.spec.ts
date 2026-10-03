import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// The themes scenario restyles one map as Material, Carbon and Editorial look-alikes, from
// stylesheets in apps/demo/src/themes and the `icons` prop. Nothing in the component is edited.

const style = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element)[name as never], property)

/** The canvas colour at a fraction of the map viewport. */
async function mapPixel(page: Page, x: number, y: number) {
  return page.evaluate(
    ([fx, fy]) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.geo-map-viewport canvas')!
      const context = canvas.getContext('2d')!
      const pixel = context.getImageData(
        Math.round(canvas.width * fx!),
        Math.round(canvas.height * fy!),
        1,
        1,
      ).data
      return [pixel[0]!, pixel[1]!, pixel[2]!]
    },
    [x, y],
  )
}

test('each theme restyles every part from its stylesheet and icon set', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?scenario=themes&theme=material')
  await expect(page.locator('.geo-legend')).toBeVisible()
  expect(await style(page, '.geo-map-root', 'fontFamily')).toContain('Roboto')
  expect(await style(page, '.geo-control-group', 'backgroundColor')).toBe('rgb(234, 221, 255)')
  expect(await style(page, '.geo-legend', 'borderTopLeftRadius')).toBe('16px')
  // Material icons (filled) replace lucide's outline icons in the rail.
  await expect(page.getByRole('button', { name: 'Zoom in' }).locator('svg.lucide')).toHaveCount(0)
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  expect(await style(page, '.geo-shape-switch-track', 'width')).toBe('52px')

  await page.getByLabel('Carbon').check()
  expect(await style(page, '.geo-map-root', 'fontFamily')).toContain('IBM Plex Sans')
  expect(await style(page, '.geo-legend', 'borderTopLeftRadius')).toBe('0px')
  expect(await style(page, '.geo-legend', 'boxShadow')).not.toBe('none')
  expect(
    await style(
      page,
      '.geo-shape-switch-input:checked + .geo-shape-switch-track',
      'backgroundColor',
    ),
  ).toBe('rgb(36, 161, 72)')
  expect(await style(page, '.geo-control-group .geo-shape-icon-button svg', 'width')).toBe('16px')
  // The select draws its own chevron and the Carbon bottom rule.
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  expect(await style(page, '.geo-shape-select', 'appearance')).toBe('none')
  expect(await style(page, '.geo-shape-select', 'borderTopWidth')).toBe('0px')
  expect(await style(page, '.geo-shape-select', 'borderBottomWidth')).toBe('1px')

  await page.getByLabel('Editorial').check()
  expect(await style(page, '.geo-map-root', 'fontFamily')).toContain('Source Serif 4')
  expect(await style(page, '.geo-legend', 'backdropFilter')).toBe('none')
  expect(await style(page, '.geo-legend', 'boxShadow')).toBe('none')
  expect(await style(page, '.geo-legend', 'borderTopWidth')).toBe('3px')
  expect(await style(page, '.geo-panel-kicker', 'fontVariantCaps')).toBe('all-small-caps')
  // Editorial keeps lucide, with a thinner stroke.
  expect(await style(page, '.geo-control-group .geo-shape-icon-button svg', 'strokeWidth')).toBe(
    '1.25px',
  )

  expect(errors).toEqual([])
})

test('switching theme on a wrapper repaints the map data in the theme colours', async ({
  page,
}) => {
  await page.goto('/?scenario=themes&theme=material')
  await expect(page.locator('.geo-legend')).toBeVisible()
  // A point inside Russia (the choropleth), away from the panels.
  const spot = [0.62, 0.17] as const
  await expect.poll(() => mapPixel(page, ...spot)).not.toEqual([0, 0, 0])
  const material = await mapPixel(page, ...spot)

  await page.getByLabel('Carbon').check()
  await expect.poll(() => mapPixel(page, ...spot)).not.toEqual(material)
  const carbon = await mapPixel(page, ...spot)
  // Carbon's palette is blue; Material's is violet.
  expect(carbon[2]).toBeGreaterThan(carbon[0] + 60)
  expect(material[0]).toBeGreaterThan(material[1])

  await page.getByLabel('Dark').check()
  await expect.poll(() => mapPixel(page, ...spot)).not.toEqual(carbon)
  expect(await style(page, '.geo-legend', 'backgroundColor')).toBe('rgb(38, 38, 38)')
})
