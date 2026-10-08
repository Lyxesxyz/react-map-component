// Helpers for end-to-end tests of pages with a map (Playwright and similar). Server-safe, with no
// imports, so they can be used from test files without bundling the map.
//
// The map element carries `data-status`: `loading` until the first frame is drawn and while
// any layer loads, `ready` after that, `error` for an invalid configuration. It also carries
// `data-layer-errors="<count>"` when layers failed to load (the map still works).

/** CSS selector for a map that is ready; pass `mapId` (the config `id`) to pick one map. */
export function mapReadySelector(mapId?: string): string {
  const map = mapId ? `[data-slot="map"][data-map-id="${mapId}"]` : '[data-slot="map"]'
  return `${map}[data-status="ready"]`
}

/** The part of a Playwright `Page` that `waitForMapReady` uses. */
export type MapTestPage = {
  locator(selector: string): {
    first(): { waitFor(options?: { state?: 'attached'; timeout?: number }): Promise<void> }
  }
}

/**
 * Resolves once the map (the first one, or the one with `mapId`) has drawn and every visible
 * layer has loaded. Rejects after `timeout` milliseconds (default 15 000).
 *
 * ```ts
 * await page.goto('/regions')
 * await waitForMapReady(page)
 * await expect(page.locator('[data-slot="map"]')).not.toHaveAttribute('data-layer-errors')
 * ```
 */
export async function waitForMapReady(
  page: MapTestPage,
  options: { mapId?: string; timeout?: number } = {},
): Promise<void> {
  await page
    .locator(mapReadySelector(options.mapId))
    .first()
    .waitFor({ state: 'attached', timeout: options.timeout ?? 15_000 })
}
