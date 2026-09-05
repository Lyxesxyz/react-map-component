import { expect, test } from '@playwright/test'

test('meets desktop reference interaction, frame, memory, and export budgets', async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'The automated reference budget is Chromium-specific')
  await page.goto('/')
  const readyMs = await expect
    .poll(() =>
      page.evaluate(
        () => performance.getEntriesByName('geospatial-map-stable-render')[0]?.startTime,
      ),
    )
    .toBeTruthy()
    .then(() =>
      page.evaluate(
        () => performance.getEntriesByName('geospatial-map-stable-render')[0]!.startTime,
      ),
    )

  await page.getByRole('button', { name: 'Map settings' }).click()
  const interactionMs = await page
    .getByRole('combobox', { name: 'Projection' })
    .evaluate((node) => {
      const select = node as HTMLSelectElement
      return new Promise<number>((resolve) => {
        const started = performance.now()
        requestAnimationFrame(() => resolve(performance.now() - started))
        select.value = 'EPSG:3857'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })
    })
  await expect(page.getByRole('combobox', { name: 'Basemap' })).toHaveValue('reference-mercator')

  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0
        const started = performance.now()
        const frame = (now: number) => {
          frames += 1
          if (now - started >= 1000) resolve((frames * 1000) / (now - started))
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
  )

  const heapMb = await page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    return memory ? memory.usedJSHeapSize / 1024 / 1024 : 0
  })

  const exportStarted = performance.now()
  const download = page.waitForEvent('download')
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('png')
  await download
  const exportMs = performance.now() - exportStarted

  await testInfo.attach('performance.json', {
    body: JSON.stringify({ readyMs, interactionMs, fps, heapMb, exportMs }, null, 2),
    contentType: 'application/json',
  })
  expect(readyMs).toBeLessThan(2500)
  expect(interactionMs).toBeLessThan(100)
  expect(fps).toBeGreaterThanOrEqual(50)
  if (heapMb) expect(heapMb).toBeLessThan(200)
  expect(exportMs).toBeLessThan(3000)
})
