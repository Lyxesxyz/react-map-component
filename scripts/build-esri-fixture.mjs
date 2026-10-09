// Writes tests/browser/fixtures/esri-world/: an offline stand-in for Esri's World Basemap v2
// (https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer), the
// default basemap, which the browser suite serves in its place (tests/browser/fixtures/test.ts).
// Like the real service it is Web Mercator (wkid 102100) with 512-pixel tiles from level 0 at
// 78271.517 m/px, a root.json style whose source points at the service ("../../"), and Mapbox
// vector tiles with "Land", "Boundary line" and "Admin0 point" layers. The tiles (levels 0 to 2)
// are drawn from Natural Earth 1:110m (public domain) through the world-atlas package, with a
// buffer around each tile that repeats the world across the antimeridian, as tilers do.
// Run: node scripts/build-esri-fixture.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import prettier from 'prettier'

const demo = createRequire(new URL('../apps/demo-shared/package.json', import.meta.url))
const { feature, mesh } = demo('topojson-client')
const land = demo('world-atlas/land-110m.json')
const countries = demo('world-atlas/countries-110m.json')
// The protocol buffer writer OpenLayers itself reads tiles with (no package of our own).
const core = createRequire(new URL('../packages/geospatial-map-core/package.json', import.meta.url))
const ol = createRequire(core.resolve('ol/package.json'))
const pbfModule = await import(pathToFileURL(ol.resolve('pbf')).href)
const Pbf = pbfModule.PbfWriter ?? pbfModule.default

const out = new URL('../tests/browser/fixtures/esri-world/', import.meta.url)
const MAX_ZOOM = 2
const EXTENT = 4096
const BUFFER = 64
const MAX_LATITUDE = 85.0511287798066
const LEVEL_0_RESOLUTION = 78271.51696402048

// ---------------------------------------------------------------------------------------------
// Geometry in longitude/latitude

const jumps = (ring) =>
  ring.filter((point, index) => index > 0 && Math.abs(point[0] - ring[index - 1][0]) > 180).length

/** The ring without jumps across the antimeridian: longitudes past ±180° continue beyond it. */
function unwrap(ring) {
  let offset = 0
  return ring.map((point, index) => {
    if (index > 0) {
      const step = point[0] - ring[index - 1][0]
      if (step > 180) offset -= 360
      else if (step < -180) offset += 360
    }
    return [point[0] + offset, point[1]]
  })
}

/** Keeps the part of a closed ring on one side of the meridian `x` (Sutherland–Hodgman). */
function clipAt(ring, x, keepWest) {
  const inside = (point) => (keepWest ? point[0] <= x : point[0] >= x)
  const result = []
  for (let index = 0; index < ring.length - 1; index++) {
    const current = ring[index]
    const next = ring[index + 1]
    if (inside(current)) result.push(current)
    if (inside(current) !== inside(next)) {
      const ratio = (x - current[0]) / (next[0] - current[0])
      result.push([x, current[1] + ratio * (next[1] - current[1])])
    }
  }
  if (result.length) result.push(result[0])
  return result
}

/**
 * Polygons that cross the antimeridian and come back (Eurasia, Fiji) are made continuous and cut
 * at ±180°, each piece moved into the world. Antarctica crosses once, along its southern edge:
 * that edge is moved to the pole.
 */
function splitPolygon(polygon) {
  const outer = polygon[0]
  if (jumps(outer) === 1) {
    const at = outer.findIndex(
      (point, index) => index > 0 && Math.abs(point[0] - outer[index - 1][0]) > 180,
    )
    const before = outer[at - 1]
    const after = outer[at]
    const ring = [...outer.slice(0, at), [before[0], -90], [after[0], -90], ...outer.slice(at)]
    return [[ring, ...polygon.slice(1)]]
  }
  if (!jumps(outer)) return [polygon]
  // The holes in the same continuous longitudes as the outer ring (it may now start past 180°).
  const continuous = unwrap(outer)
  const west = Math.min(...continuous.map(([x]) => x))
  const rings = [
    continuous,
    ...polygon.slice(1).map((hole) => {
      const ring = unwrap(hole)
      const shift = Math.ceil((west - ring[0][0]) / 360) * 360
      return ring.map(([x, y]) => [x + shift, y])
    }),
  ]
  return [-360, 0, 360].flatMap((shift) => {
    const [outerPiece, ...holes] = rings.map((ring) =>
      clipAt(clipAt(ring, shift - 180, false), shift + 180, true).map(([x, y]) => [x - shift, y]),
    )
    return outerPiece.length >= 4 ? [[outerPiece, ...holes.filter((ring) => ring.length >= 4)]] : []
  })
}

function splitLine(line) {
  const parts = []
  let part = []
  for (const point of line) {
    const previous = part.at(-1)
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      if (part.length > 1) parts.push(part)
      part = []
    }
    part.push(point)
  }
  if (part.length > 1) parts.push(part)
  return parts
}

const landGeometry = feature(land, land.objects.land).features[0].geometry
const landPolygons = landGeometry.coordinates.flatMap(splitPolygon)
const borderLines = mesh(
  countries,
  countries.objects.countries,
  (a, b) => a !== b,
).coordinates.flatMap(splitLine)

/** A few country labels, as in the service's "Admin0 point" layer. */
const labels = [
  ['Canada', -100, 58],
  ['United States', -98, 39],
  ['Brazil', -52, -10],
  ['Algeria', 2.6, 28],
  ['Kenya', 37.9, 0.4],
  ['Russia', 96, 62],
  ['India', 79, 22],
  ['China', 103, 35],
  ['Australia', 134, -25],
  ['Fiji', 178, -17.8],
]

// ---------------------------------------------------------------------------------------------
// Web Mercator tile coordinates

/** World pixel coordinates at zoom `z` (tile extent units), latitude clamped to ±85.0511°. */
function project([lon, lat], z) {
  const size = EXTENT * 2 ** z
  const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat))
  const sin = Math.sin((clamped * Math.PI) / 180)
  return [
    ((lon + 180) / 360) * size,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  ]
}

/** Clips a closed ring to a rectangle (Sutherland–Hodgman, one edge at a time). */
function clipRing(ring, [minX, minY, maxX, maxY]) {
  const edges = [
    [(p) => p[0] >= minX, (a, b) => [minX, a[1] + ((minX - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[0] <= maxX, (a, b) => [maxX, a[1] + ((maxX - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[1] >= minY, (a, b) => [a[0] + ((minY - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), minY]],
    [(p) => p[1] <= maxY, (a, b) => [a[0] + ((maxY - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), maxY]],
  ]
  let points = ring.slice(0, -1)
  for (const [inside, cross] of edges) {
    if (!points.length) break
    const next = []
    for (let index = 0; index < points.length; index++) {
      const current = points[index]
      const following = points[(index + 1) % points.length]
      if (inside(current)) next.push(current)
      if (inside(current) !== inside(following)) next.push(cross(current, following))
    }
    points = next
  }
  return points
}

/** Clips a line to a rectangle (Liang–Barsky per segment), as one or more lines. */
function clipLine(line, [minX, minY, maxX, maxY]) {
  const parts = []
  let part = []
  for (let index = 0; index < line.length - 1; index++) {
    const [x0, y0] = line[index]
    const [x1, y1] = line[index + 1]
    const dx = x1 - x0
    const dy = y1 - y0
    let t0 = 0
    let t1 = 1
    let visible = true
    for (const [p, q] of [
      [-dx, x0 - minX],
      [dx, maxX - x0],
      [-dy, y0 - minY],
      [dy, maxY - y0],
    ]) {
      if (p === 0) {
        if (q < 0) visible = false
      } else {
        const t = q / p
        if (p < 0) t0 = Math.max(t0, t)
        else t1 = Math.min(t1, t)
      }
    }
    if (!visible || t0 > t1) {
      if (part.length > 1) parts.push(part)
      part = []
      continue
    }
    const start = [x0 + t0 * dx, y0 + t0 * dy]
    const end = [x0 + t1 * dx, y0 + t1 * dy]
    if (!part.length) part.push(start)
    part.push(end)
    if (t1 < 1) {
      if (part.length > 1) parts.push(part)
      part = []
    }
  }
  if (part.length > 1) parts.push(part)
  return parts
}

/** Integer points without repeats (and, for a ring, without the first point again at the end). */
function rounded(points, ring = false) {
  const result = []
  for (const [x, y] of points) {
    const point = [Math.round(x), Math.round(y)]
    const last = result.at(-1)
    if (!last || last[0] !== point[0] || last[1] !== point[1]) result.push(point)
  }
  const [first, last] = [result[0], result.at(-1)]
  if (ring && result.length > 1 && first[0] === last[0] && first[1] === last[1]) result.pop()
  return result
}

/** Twice the signed area in tile coordinates (y down): positive for an exterior ring. */
const signedArea = (ring) =>
  ring.reduce((sum, [x, y], index) => {
    const [nx, ny] = ring[(index + 1) % ring.length]
    return sum + x * ny - nx * y
  }, 0)

/** The geometries of one tile: the world and its copies east and west, clipped with a buffer. */
function tileFeatures(z, x, y) {
  const worldSize = EXTENT * 2 ** z
  const box = [-BUFFER, -BUFFER, EXTENT + BUFFER, EXTENT + BUFFER]
  const offsets = [-1, 0, 1].map((copy) => [copy * worldSize - x * EXTENT, -y * EXTENT])
  const toTile = (points, [ox, oy]) =>
    points.map((point) => {
      const [px, py] = project(point, z)
      return [px + ox, py + oy]
    })
  const polygons = []
  for (const offset of offsets)
    for (const polygon of landPolygons) {
      const rings = polygon.map((ring, index) => {
        const clipped = rounded(clipRing(toTile(ring, offset), box), true)
        if (clipped.length < 3) return undefined
        // Exterior rings positive, holes negative.
        const area = signedArea(clipped)
        if (area === 0) return undefined
        return area > 0 === (index === 0) ? clipped : clipped.reverse()
      })
      if (rings[0]) polygons.push(rings.filter(Boolean))
    }
  const lines = []
  for (const offset of offsets)
    for (const line of borderLines)
      for (const part of clipLine(toTile(line, offset), box)) {
        const points = rounded(part)
        if (points.length > 1) lines.push(points)
      }
  const points = []
  for (const offset of offsets)
    for (const [name, lon, lat] of labels) {
      const [px, py] = toTile([[lon, lat]], offset)[0]
      if (px >= 0 && px < EXTENT && py >= 0 && py < EXTENT)
        points.push({ point: [Math.round(px), Math.round(py)], name })
    }
  return { polygons, lines, points }
}

// ---------------------------------------------------------------------------------------------
// Mapbox Vector Tile encoding (https://github.com/mapbox/vector-tile-spec, version 2)

const command = (id, count) => (id & 0x7) | (count << 3)
const zigzag = (value) => (value << 1) ^ (value >> 31)

function encodeGeometry(parts, closed) {
  const result = []
  let cx = 0
  let cy = 0
  for (const points of parts) {
    result.push(command(1, 1), zigzag(points[0][0] - cx), zigzag(points[0][1] - cy))
    ;[cx, cy] = points[0]
    result.push(command(2, points.length - 1))
    for (const [px, py] of points.slice(1)) {
      result.push(zigzag(px - cx), zigzag(py - cy))
      cx = px
      cy = py
    }
    if (closed) result.push(command(7, 1))
  }
  return result
}

function writeLayer({ name, features, keys, values }, pbf) {
  pbf.writeVarintField(15, 2)
  pbf.writeStringField(1, name)
  for (const item of features) pbf.writeMessage(2, writeFeature, item)
  for (const key of keys) pbf.writeStringField(3, key)
  for (const value of values)
    pbf.writeMessage(4, (text, writer) => writer.writeStringField(1, text), value)
  pbf.writeVarintField(5, EXTENT)
}

function writeFeature({ id, type, tags, geometry }, pbf) {
  pbf.writeVarintField(1, id)
  if (tags.length) pbf.writePackedVarint(2, tags)
  pbf.writeVarintField(3, type)
  pbf.writePackedVarint(4, geometry)
}

function encodeTile(z, x, y) {
  const { polygons, lines, points } = tileFeatures(z, x, y)
  const layers = []
  if (polygons.length)
    layers.push({
      name: 'Land',
      keys: [],
      values: [],
      features: polygons.map((rings, index) => ({
        id: index + 1,
        type: 3,
        tags: [],
        geometry: encodeGeometry(rings, true),
      })),
    })
  if (lines.length)
    layers.push({
      name: 'Boundary line',
      keys: [],
      values: [],
      features: lines.map((line, index) => ({
        id: index + 1,
        type: 2,
        tags: [],
        geometry: encodeGeometry([line], false),
      })),
    })
  if (points.length)
    layers.push({
      name: 'Admin0 point',
      keys: ['_name'],
      values: points.map((item) => item.name),
      features: points.map((item, index) => ({
        id: index + 1,
        type: 1,
        tags: [0, index],
        geometry: encodeGeometry([[item.point]], false),
      })),
    })
  const pbf = new Pbf()
  for (const layer of layers) pbf.writeMessage(3, writeLayer, layer)
  return pbf.finish()
}

// ---------------------------------------------------------------------------------------------
// The service description and its style

const spatialReference = { wkid: 102100, latestWkid: 3857 }
const service = {
  currentVersion: 11.3,
  name: 'World_Basemap_v2',
  copyrightText: 'Test stand-in for Esri World Basemap · Natural Earth',
  capabilities: 'TilesOnly',
  type: 'indexedVector',
  tileMap: 'tilemap',
  defaultStyles: 'resources/styles',
  tiles: ['tile/{z}/{y}/{x}.pbf'],
  exportTilesAllowed: false,
  initialExtent: {
    xmin: -20037508.342787,
    ymin: -20037508.342787,
    xmax: 20037508.342787,
    ymax: 20037508.342787,
    spatialReference,
  },
  fullExtent: {
    xmin: -20037508.342787,
    ymin: -20037508.342787,
    xmax: 20037508.342787,
    ymax: 20037508.342787,
    spatialReference,
  },
  minScale: 0,
  maxScale: 0,
  tileInfo: {
    rows: 512,
    cols: 512,
    dpi: 96,
    format: 'pbf',
    origin: { x: -20037508.342787, y: 20037508.342787 },
    spatialReference,
    lods: Array.from({ length: MAX_ZOOM + 1 }, (_, level) => ({
      level,
      resolution: LEVEL_0_RESOLUTION / 2 ** level,
      scale: 295828763.795777 / 2 ** level,
    })),
  },
  maxzoom: MAX_ZOOM,
  resourceInfo: { styleVersion: 8, tileCompression: 'gzip', cacheInfo: { storageInfo: {} } },
  spatialReference,
}

// Colours unlike the World outlines' tokens, so tests can tell the two basemaps apart.
const style = {
  version: 8,
  sources: { esri: { type: 'vector', url: '../../' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#a9d3ec' } },
    {
      id: 'Land/0',
      type: 'fill',
      source: 'esri',
      'source-layer': 'Land',
      layout: {},
      paint: { 'fill-color': '#e6d8ad' },
    },
    {
      id: 'Boundary line/Admin0/0',
      type: 'line',
      source: 'esri',
      'source-layer': 'Boundary line',
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': '#8f7f6a',
        'line-width': {
          stops: [
            [0, 0.6],
            [3, 1.2],
            [6, 2],
          ],
        },
      },
    },
    {
      id: 'Admin0 point/large',
      type: 'symbol',
      source: 'esri',
      'source-layer': 'Admin0 point',
      minzoom: 1,
      layout: {
        'text-field': '{_name}',
        'text-font': ['Arial Regular'],
        'text-size': {
          stops: [
            [1, 10],
            [5, 15],
          ],
        },
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: {
        'text-color': '#4d4337',
        'text-halo-color': '#f7f2e4',
        'text-halo-width': 1.2,
      },
    },
  ],
}

// ---------------------------------------------------------------------------------------------

const config = await prettier.resolveConfig(fileURLToPath(new URL('service.json', out)))
const json = (value) => prettier.format(JSON.stringify(value), { ...config, parser: 'json' })

rmSync(out, { recursive: true, force: true })
mkdirSync(new URL('tile/', out), { recursive: true })
writeFileSync(new URL('service.json', out), await json(service))
writeFileSync(new URL('style.json', out), await json(style))
let bytes = 0
let count = 0
for (let z = 0; z <= MAX_ZOOM; z++)
  for (let x = 0; x < 2 ** z; x++)
    for (let y = 0; y < 2 ** z; y++) {
      const tile = encodeTile(z, x, y)
      if (!tile.length) continue
      writeFileSync(new URL(`tile/${z}-${y}-${x}.pbf`, out), tile)
      bytes += tile.length
      count += 1
    }
console.log(`Wrote ${fileURLToPath(out)}: ${count} tiles, ${Math.round(bytes / 1024)} KB`)
