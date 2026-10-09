import { expect, test } from '@playwright/test'
import { waitForMapReady } from '../../../packages/geospatial-map/src/testing'

// Runs only in the chromium-angular-zone project. Its server is built with angular.json's `zone`
// configuration, so every route of the Angular demo runs with zone.js change detection: this
// guards that the quickstart and map specs there really cover zone-based apps.

test('the zone project serves the Angular demo with zone.js change detection', async ({ page }) => {
  await page.goto('/?scenario=quickstart')
  await waitForMapReady(page)
  // zone.js is loaded, and Angular runs on a real NgZone, not the NoopNgZone of zoneless apps
  // (zone.js loaded beside provideZonelessChangeDetection() would pass the first check alone):
  // zone.js records each listener's zone, and Angular's own listeners belong to the `angular`
  // zone that only a real NgZone forks.
  const zones = await page.evaluate(() => {
    type Task = { zone: { name: string } }
    const zone = (window as { Zone?: { __symbol__(name: string): string } }).Zone
    const button = document.querySelector('button[aria-label="Zoom in"]')
    const tasks =
      zone && button
        ? (button as unknown as Record<string, Task[] | undefined>)[zone.__symbol__('clickfalse')]
        : undefined
    return { zoneJs: typeof zone, listeners: tasks?.map((task) => task.zone.name) ?? [] }
  })
  expect(zones.zoneJs).toBe('function')
  expect(zones.listeners).toContain('angular')
  // Change detection still follows the map: a zoom enables "Reset zoom".
  const reset = page.getByRole('button', { name: 'Reset zoom' })
  await expect(reset).toBeDisabled()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(reset).toBeEnabled()
})
