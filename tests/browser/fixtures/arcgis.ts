import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'

// The ArcGIS scenario's service, served from fixtures (one z0 tile, a WKT projection with a
// central meridian of 11°) so the tests need no network. Used by arcgis.spec.ts and the DOM
// parity spec.

const fixtures = new URL('./arcgis/', import.meta.url)
const fixture = (name: string) => readFileSync(new URL(name, fixtures))

export async function mockArcgisService(page: Page) {
  await page.route('**/EqualEarthBasemap/VectorTileServer**', (route) => {
    const url = route.request().url()
    if (url.includes('/resources/styles/root.json'))
      return route.fulfill({ contentType: 'application/json', body: fixture('style.json') })
    if (url.includes('/tile/0/0/0.pbf'))
      return route.fulfill({
        contentType: 'application/x-protobuf',
        body: fixture('tile-0-0-0.pbf'),
      })
    if (url.includes('f=json'))
      return route.fulfill({ contentType: 'application/json', body: fixture('service.json') })
    return route.fulfill({ status: 404, body: '' })
  })
}
