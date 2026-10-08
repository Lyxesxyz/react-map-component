// Example: checking a page with a map in an end-to-end test (Playwright). The map element has
// `data-status` (`loading`, `ready`, `error`) and `data-layer-errors` when layers failed.
// Task: "verify the map works after my change". See AGENTS.md → Verify your change.
//
// In a Playwright test, import `waitForMapReady` from this folder's `testing.ts` module (for
// example `src/components/geospatial-map/testing`), not from the index, so the test doesn't
// load the map itself:
//
//   test('regions map loads', async ({ page }) => {
//     const hints: string[] = []
//     page.on('console', (message) => {
//       if (message.text().includes('[geospatial-map]')) hints.push(message.text())
//     })
//     await page.goto('/regions')
//     await waitForMapReady(page)
//     await expect(page.locator('[data-slot="map"]')).not.toHaveAttribute('data-layer-errors')
//     expect(hints).toEqual([]) // setup and data problems are logged with this prefix
//   })

import { mapReadySelector, waitForMapReady, type MapTestPage } from '../testing'

/** Waits for two maps on one page, by their config `id`. */
export async function waitForComparisonMaps(page: MapTestPage): Promise<void> {
  await Promise.all([
    waitForMapReady(page, { mapId: 'before' }),
    waitForMapReady(page, { mapId: 'after' }),
  ])
}

/** The selector for a ready map, for tools that take a CSS selector. */
export const readyMapSelector = mapReadySelector()
