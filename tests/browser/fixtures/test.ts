import { readFileSync } from 'node:fs'
import { test as base } from '@playwright/test'
import type { BrowserContext, Page, Route } from '@playwright/test'

// The browser suite's `test` and `expect`: every spec imports them from here, not from
// @playwright/test. Every page of every test is served the offline stand-in for Esri's World
// Basemap (the default basemap since 0.11.0): a Web Mercator vector tile service built by
// scripts/build-esri-fixture.mjs into ./esri-world/. No test reaches basemaps.arcgis.com.
//
// A test that wants the service to fail routes the same URLs on its page, which wins over the
// context's route: `failEsriWorldBasemap(page, 'service' | 'style' | 'tiles')`.

export { expect } from '@playwright/test'

/** The URLs of the default basemap's service, its style and its tiles. */
export const ESRI_WORLD_URLS = '**/World_Basemap_v2/VectorTileServer**'

/** The copyright text of the stand-in, shown in the attribution bar. */
export const ESRI_WORLD_COPYRIGHT = 'Test stand-in for Esri World Basemap · Natural Earth'

const fixtures = new URL('./esri-world/', import.meta.url)
const fixture = (name: string) => readFileSync(new URL(name, fixtures))

/** Answers one request for the service, its style or a tile from the fixtures. */
export function serveEsriWorld(route: Route) {
  const url = new URL(route.request().url())
  const path = url.pathname.replace(/^.*\/VectorTileServer/, '')
  if (path === '' || path === '/')
    return route.fulfill({ contentType: 'application/json', body: fixture('service.json') })
  if (path === '/resources/styles/root.json')
    return route.fulfill({ contentType: 'application/json', body: fixture('style.json') })
  const tile = /^\/tile\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(path)
  if (tile) {
    try {
      return route.fulfill({
        contentType: 'application/x-protobuf',
        body: fixture(`tile/${tile[1]}-${tile[2]}-${tile[3]}.pbf`),
      })
    } catch {
      return route.fulfill({ status: 404, body: '' })
    }
  }
  return route.fulfill({ status: 404, body: '' })
}

/** Serves the stand-in to every page of `context`. */
export async function mockEsriWorldBasemap(context: BrowserContext | Page) {
  await context.route(ESRI_WORLD_URLS, serveEsriWorld)
}

/**
 * Makes the default basemap fail on `page`: its service can't be reached (`'service'`), or the
 * service is read but its style (`'style'`) or every tile (`'tiles'`) fails.
 */
export async function failEsriWorldBasemap(page: Page, part: 'service' | 'style' | 'tiles') {
  await page.route(ESRI_WORLD_URLS, (route) => {
    const path = new URL(route.request().url()).pathname
    if (part === 'service') return route.abort('connectionrefused')
    if (part === 'style' && path.endsWith('/root.json'))
      return route.fulfill({ status: 404, body: 'Not found' })
    if (part === 'tiles' && path.includes('/tile/'))
      return route.fulfill({ status: 500, body: 'Server error' })
    return serveEsriWorld(route)
  })
}

export const test = base.extend<{ esriWorldBasemap: void }>({
  esriWorldBasemap: [
    async ({ context }, use) => {
      await mockEsriWorldBasemap(context)
      await use()
    },
    { auto: true },
  ],
})
