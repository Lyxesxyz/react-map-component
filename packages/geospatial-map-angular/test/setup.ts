import '@angular/compiler'
import '@analogjs/vitest-angular/setup-snapshots'
import '@analogjs/vitest-angular/setup-serializers'
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed'

// A zoneless TestBed for the jsdom tests. Server-rendering tests (`// @vitest-environment node`)
// bootstrap platform-server themselves and skip it: the browser testing platform would install
// the browser DOM adapter.
if (typeof document !== 'undefined') {
  setupTestBed({ zoneless: true, errorOnUnknownElements: true, errorOnUnknownProperties: true })
}

// The unit tests never reach the network. A map configured without basemaps starts on Esri's
// World Basemap, so its service is answered with a small Web Mercator stand-in (as the browser
// suite does with tests/browser/fixtures/esri-world); any other ArcGIS request fails, as offline.
const ESRI_WORLD = '/World_Basemap_v2/VectorTileServer'
const mercator = { wkid: 102100, latestWkid: 3857 }
const esriWorldStandIn = {
  name: 'World_Basemap_v2',
  copyrightText: 'Test stand-in for Esri World Basemap',
  spatialReference: mercator,
  tileInfo: {
    rows: 512,
    cols: 512,
    origin: { x: -20037508.342787, y: 20037508.342787 },
    spatialReference: mercator,
    lods: [0, 1, 2].map((level) => ({ level, resolution: 78271.51696402048 / 2 ** level })),
  },
  tiles: ['tile/{z}/{y}/{x}.pbf'],
  defaultStyles: 'resources/styles',
}
const esriWorldStyle = {
  version: 8,
  sources: { esri: { type: 'vector', url: '../../' } },
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#a9d3ec' } }],
}
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes(ESRI_WORLD)) {
    const body = url.includes('/root.json')
      ? esriWorldStyle
      : /VectorTileServer\/?(\?|$)/.test(url)
        ? esriWorldStandIn
        : undefined
    return body
      ? new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
      : new Response('', { status: 404 })
  }
  if (/arcgis\.com|\/VectorTileServer/i.test(url))
    throw new TypeError(`The unit tests do not reach the network (${url})`)
  return realFetch(input, init)
}
