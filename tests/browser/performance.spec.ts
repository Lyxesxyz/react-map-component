import { expect, test } from './fixtures/test'

// The page asks for the bundled reference basemap, so no request goes to the Esri service and the
// stand-in's routing (which slows every request down) is left off.
test.use({ esriWorldStandIn: false })

test('meets desktop reference interaction, frame, memory, and export budgets', async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'The automated reference budget is Chromium-specific')
  // The budgets are for the bundled fixtures (performance-budgets.md): the reference basemap,
  // not the harness's default Esri basemap, which is read from a service.
  await page.goto('/?basemap=reference-equal-earth')
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

  const interactionMs = await page.getByRole('button', { name: 'Zoom in' }).evaluate(
    (button) =>
      new Promise<number>((resolve) => {
        const started = performance.now()
        requestAnimationFrame(() => resolve(performance.now() - started))
        ;(button as HTMLButtonElement).click()
      }),
  )
  await page.getByRole('button', { name: 'Map settings' }).click()

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
  await page.getByRole('combobox', { name: 'Export map' }).selectOption('PNG')
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
