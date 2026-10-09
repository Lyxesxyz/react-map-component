import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buffer, containsXY, intersects } from 'ol/extent.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'
import {
  fromLonLat,
  get as getProjection,
  getTransform,
  toLonLat,
  transformExtent,
} from 'ol/proj.js'
import type VectorTileLayer from 'ol/layer/VectorTile.js'
import RenderFeature from 'ol/render/Feature.js'
import type VectorTileSource from 'ol/source/VectorTile.js'
import TileState from 'ol/TileState.js'
import type { TileCoord } from 'ol/tilecoord.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import type { Extent } from 'ol/extent.js'
import {
  areaOutline,
  clipLine,
  clipRing,
  densify,
  featuresIn,
  lastSourceLevel,
  reprojectableFeatures,
  reprojectedTileSource,
  tileGridOptions,
  withoutCutOutlines,
} from '../../src/core/layers/vector-tile-layer'
import { LayerRegistry } from '../../src/core/layer-registry'
import {
  ensureConfiguredProjection,
  equalEarth,
  MERCATOR_EXTENT,
  registerReprojection,
} from '../../src/core/projections'
import type { TileGridSpec, VectorTileLayerConfig } from '../../src/types'

// Web Mercator vector tiles drawn in Equal Earth (the default Esri basemap): what a tile carries
// is clipped to the tile, long edges follow their curve, and only the data's own edges of areas
// are outlined.

const mercator = getProjection('EPSG:3857')!
const view = ensureConfiguredProjection(equalEarth('EPSG:8857'))
const toView = getTransform(mercator, view)

/** The largest distance (in metres of the view) between `flat`'s segments and the true curve. */
function chordError(flat: number[]) {
  let error = 0
  for (let index = 0; index + 3 < flat.length; index += 2) {
    const [x0, y0, x1, y1] = flat.slice(index, index + 4) as [number, number, number, number]
    const [ax, ay] = toView([x0, y0])
    const [bx, by] = toView([x1, y1])
    const [mx, my] = toView([(x0 + x1) / 2, (y0 + y1) / 2])
    error = Math.max(error, Math.hypot(mx! - (ax! + bx!) / 2, my! - (ay! + by!) / 2))
  }
  return error
}

/** A z2 Web Mercator tile (x 1, y 0: 90° W to 0°, 0° to 66.5° N) and its box one pixel wider. */
const tile: Extent = [-10_018_754.17, 0, 0, 10_018_754.17]
const margin = (tile[2]! - tile[0]!) / 512
const box: Extent = [tile[0]! - margin, -margin, margin, tile[3]! + margin]

describe('reprojected vector tiles', () => {
  it('adds vertices along long edges, so they follow their curve in the map', () => {
    // The western edge of the tile, along the meridian at 90° W: one straight segment.
    const edge = [tile[0]!, tile[3]!, tile[0]!, 0]
    expect(chordError(edge)).toBeGreaterThan(100_000)
    const step = (tile[2]! - tile[0]!) / 64
    const densified = densify(edge, [4], step, [tile[0]!, tile[3]!])
    expect(densified.flat.length / 2).toBe(65)
    expect(densified.ends).toEqual([densified.flat.length])
    expect(chordError(densified.flat)).toBeLessThan(500)
  })

  it('gives edges along the same line the same vertices, so they still coincide', () => {
    const x = tile[0]!
    const step = 1000
    // Down the whole line, then back up part of it from another point (a zero-width bridge).
    const down = densify([x, 9_500, x, 120], [4], step, [x, 10_000]).flat
    const up = densify([x, 2_345, x, 7_890], [4], step, [x, 10_000]).flat
    const pointsOf = (flat: number[]) =>
      new Set(flat.flatMap((value, index) => (index % 2 ? [`${flat[index - 1]},${value}`] : [])))
    const shared = [...pointsOf(up)].filter((point) => pointsOf(down).has(point))
    // The grid vertices between 2,345 and 7,890: 3,000 to 7,000.
    expect(shared).toEqual([3000, 4000, 5000, 6000, 7000].map((y) => `${x},${y}`))
  })

  it('clips areas and lines to the tile', () => {
    // A square reaching past the tile's western edge.
    const ring = [-11e6, 5e6, -5e6, 5e6, -5e6, 1e6, -11e6, 1e6, -11e6, 5e6]
    const clipped = clipRing(ring, box)!
    expect(Math.min(...clipped.filter((_, index) => index % 2 === 0))).toBe(box[0])
    expect(clipped.slice(0, 2)).toEqual(clipped.slice(-2))
    expect(clipRing([-20e6, 5e6, -19e6, 5e6, -19e6, 1e6, -20e6, 5e6], box)).toBeUndefined()
    // A ring around the whole tile becomes the box.
    const around = clipRing([-30e6, 30e6, 30e6, 30e6, 30e6, -30e6, -30e6, -30e6, -30e6, 30e6], box)!
    expect(new Set(around.map((value) => Math.abs(value)))).toEqual(
      new Set([Math.abs(box[0]!), Math.abs(box[3]!), margin]),
    )
    // A line that leaves the tile and comes back: two parts.
    const parts = clipLine([-9e6, 1e6, -12e6, 2e6, -9e6, 3e6, -8e6, 3e6], box)
    expect(parts).toHaveLength(2)
    expect(parts[0]!.slice(0, 2)).toEqual([-9e6, 1e6])
    expect(parts[1]!.slice(-2)).toEqual([-8e6, 3e6])
  })

  it('leaves out what a tile carries past its edges, such as place names across the antimeridian', () => {
    const name = (x: number, y: number) =>
      new RenderFeature('Point', [x, y], [2], 2, { _name: 'Anadyr' }, 1)
    const features = reprojectableFeatures(
      [
        name(-5e6, 5e6),
        // A copy of a place across the antimeridian, in the tile's buffer past 180° W.
        name(-20_200_000, 5e6),
        new RenderFeature('LineString', [-9e6, 1e6, -12e6, 2e6, -9e6, 3e6], [6], 2, {}, 2),
        new RenderFeature(
          'Polygon',
          [-12e6, 2e6, -11e6, 2e6, -11e6, 1e6, -12e6, 2e6],
          [8],
          2,
          {},
          3,
        ),
      ],
      tile,
      box,
    )
    expect(features.map((feature) => [feature.getType(), feature.getId()])).toEqual([
      ['Point', 1],
      ['MultiLineString', 2],
    ])
    const points = reprojectableFeatures(
      [name(-20_200_000, 5e6)],
      [-20_037_508.34, 0, -10_018_754.17, 10_018_754.17],
      [-20_057_078, -19_570, -9_999_184, 10_038_324],
    )
    expect(points).toEqual([])
  })

  it('outlines only the data edges of an area, also once OpenLayers has copied it', () => {
    // Land reaching past the tile's western edge and across its southern edge.
    const land = new RenderFeature(
      'Polygon',
      [-11e6, 5e6, -5e6, 5e6, -5e6, -1e6, -11e6, -1e6, -11e6, 5e6],
      [10],
      2,
      { layer: 'Land' },
      7,
    )
    const [clipped] = reprojectableFeatures([land], tile, box)
    const outline = areaOutline(clipped!.clone())!
    expect(outline.getType()).toBe('MultiLineString')
    const flat = outline.getFlatCoordinates()
    // No segment of the outline runs along the western or southern edge of the box: those are cuts.
    let start = 0
    for (const end of outline.getEnds()!) {
      for (let index = start; index + 3 < end; index += 2) {
        const [x0, y0, x1, y1] = flat.slice(index, index + 4)
        expect(x0 === box[0] && x1 === box[0]).toBe(false)
        expect(y0 === box[1] && y1 === box[1]).toBe(false)
      }
      start = end
    }
    // The data edges (east and north) are there.
    expect(flat).toContain(-5e6)
    expect(flat).toContain(5e6)
    expect(clipped!.get('layer')).toBe('Land')
  })

  it('does not outline the edge of a tile that its tiler cut areas along (no buffer)', () => {
    // Land cut by the tiler exactly along the tile's western edge.
    const land = new RenderFeature(
      'Polygon',
      [tile[0]!, 5e6, -5e6, 5e6, -5e6, 1e6, tile[0]!, 1e6, tile[0]!, 5e6],
      [10],
      2,
      {},
      8,
    )
    const [clipped] = reprojectableFeatures([land], tile, box)
    const flat = areaOutline(clipped!)!.getFlatCoordinates()
    // Three data edges remain, as one line: the cut along the western edge is left out.
    expect(flat.slice(0, 2)).toEqual([tile[0], 5e6])
    expect(flat.slice(-2)).toEqual([tile[0], 1e6])
    expect(areaOutline(clipped!)!.getEnds()).toHaveLength(1)
  })

  it('draws the fill of an area whole and its outline along the data edges', () => {
    const fill = new Fill({ color: '#e6d8ad' })
    const stroke = new Stroke({ color: '#e6d8ad', width: 0.5 })
    const line = new Stroke({ color: '#8f7f6a', width: 1 })
    const style = withoutCutOutlines((feature) =>
      (feature as RenderFeature).getType() === 'Polygon'
        ? new Style({ fill, stroke, zIndex: 3 })
        : new Style({ stroke: line }),
    )
    const area = new RenderFeature('Polygon', [0, 0, 1, 0, 1, 1, 0, 0], [8], 2, {}, 1)
    const styles = style(area, 1) as Style[]
    expect(styles).toHaveLength(2)
    expect(styles[0]!.getFill()).toBe(fill)
    expect(styles[0]!.getStroke()).toBeFalsy()
    expect(styles[1]!.getStroke()).toBe(stroke)
    expect(styles[1]!.getFill()).toBeFalsy()
    expect(styles[1]!.getGeometryFunction()).toBe(areaOutline)
    expect(styles.map((item) => item.getZIndex())).toEqual([3, 3])
    const border = new RenderFeature('LineString', [0, 0, 1, 1], [4], 2, {}, 2)
    expect((style(border, 1) as Style).getStroke()).toBe(line)
  })
})

/** A tile of the offline stand-in of Esri's World Basemap (tests/browser/fixtures/esri-world). */
const standInTile = (z: string, y: string, x: string) =>
  readFileSync(
    new URL(
      `../../../../tests/browser/fixtures/esri-world/tile/${z}-${y}-${x}.pbf`,
      import.meta.url,
    ),
  )

/** The stand-in's tile grid: Web Mercator, 512-pixel tiles, levels listed to 22. */
const mercatorGrid: TileGridSpec = {
  extent: [...MERCATOR_EXTENT],
  origin: [-20_037_508.342787, 20_037_508.342787],
  resolutions: Array.from({ length: 23 }, (_, level) => 78_271.51696402048 / 2 ** level),
  tileSize: 512,
}

/** The stand-in's level-2 tile URLs under `extent` (of the map), as the source reads them. */
function reprojectedServiceTiles(extent: number[]): string[] {
  const grid = new TileGrid(tileGridOptions(mercatorGrid))
  const urls: string[] = []
  grid.forEachTileCoord(transformExtent(extent, view, mercator, 8), 2, ([z, x, y]) =>
    urls.push(`https://tiles.example.com/tile/${z}/${y}/${x}.pbf`),
  )
  return urls
}

describe('reprojected vector tile sources', () => {
  const template = 'https://tiles.example.com/tile/{z}/{y}/{x}.pbf'
  const config = (maxSourceZoom: number): VectorTileLayerConfig => ({
    id: 'esri',
    title: 'Esri',
    kind: 'mvt',
    url: template,
    sourceProjection: 'EPSG:3857',
    maxSourceZoom,
    tileGrid: mercatorGrid,
  })
  let requests: string[]
  let failing: Set<string>

  beforeEach(() => {
    registerReprojection(mercator, view)
    requests = []
    failing = new Set()
    vi.stubGlobal('fetch', async (url: string) => {
      requests.push(url)
      const [, z, y, x] = /\/tile\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(url)!
      return failing.has(url)
        ? new Response('', { status: 500 })
        : new Response(standInTile(z!, y!, x!))
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  /** The tile of the map at `lonLat` and zoom level `z`, loaded, with what its tiles hold. */
  async function load(source: VectorTileSource<RenderFeature>, lonLat: number[], z: number) {
    const coord = source.getTileGrid()!.getTileCoordForCoordAndZ(fromLonLat(lonLat, view), z)
    const tile = source.getTile(coord[0]!, coord[1]!, coord[2]!, 1, view)
    tile.load()
    await vi.waitFor(() => expect([TileState.LOADED, TileState.ERROR]).toContain(tile.getState()))
    const pieces = source.getSourceTiles(1, view, tile)
    return {
      coord: coord as TileCoord,
      extent: source.getTileGrid()!.getTileCoordExtent(coord),
      state: tile.getState(),
      pieces,
      features: pieces.flatMap((piece) => piece.getFeatures() ?? []),
    }
  }

  it('puts each tile of the map together from the service tiles it covers, in its projection', async () => {
    const source = reprojectedTileSource(config(2), view, () => template)
    // Around Brazil's label, where the stand-in's level-2 tiles meet along the equator.
    const { extent, state, pieces, features } = await load(source, [-52, -10], 3)
    expect(state).toBe(TileState.LOADED)
    // One tile to OpenLayers, already in the map's projection: it draws its features as they are,
    // layer by layer across the service tiles it is made of.
    expect(pieces).toHaveLength(1)
    expect(pieces[0]!.projection).toBe(view)
    expect(requests.length).toBeGreaterThan(1)
    expect(new Set(requests).size).toBe(requests.length)
    expect(requests.every((url) => url.includes('/tile/2/'))).toBe(true)
    // Its land, sea and borders reach into it; its labels are the ones inside it.
    const layers = new Set(features.map((feature) => feature.get('layer') as string))
    expect([...layers].sort()).toEqual([
      'Admin0 point',
      'Bathymetry',
      'Boundary line',
      'Land',
      'Marine area',
    ])
    // (Lines and areas within OpenLayers' render buffer of 100 pixels, for wide strokes.)
    const around = buffer(extent, 100 * source.getTileGrid()!.getResolution(3))
    for (const feature of features) {
      const flat = feature.getFlatCoordinates()
      if (feature.getType() === 'Point') expect(containsXY(extent, flat[0]!, flat[1]!)).toBe(true)
      else expect(intersects(around, feature.getExtent())).toBe(true)
    }
    const brazil = features.find((feature) => feature.get('_name') === 'Brazil')!
    const [x, y] = fromLonLat([-52, -10], view)
    // Within the stand-in's precision (a 4096th of a level-2 tile: about 2.4 km).
    expect(Math.abs(brazil.getFlatCoordinates()[0]! - x!)).toBeLessThan(5_000)
    expect(Math.abs(brazil.getFlatCoordinates()[1]! - y!)).toBeLessThan(5_000)
  })

  it('reads each service tile once for the tiles of the map that share it', async () => {
    const source = reprojectedTileSource(config(2), view, () => template)
    const first = await load(source, [-52, -10], 3)
    const read = new Set(requests)
    // The tile of the map to the east: it shares the service tiles along their common edge.
    const [z, x, y] = first.coord as [number, number, number]
    const east = toLonLat(source.getTileGrid()!.getTileCoordCenter([z, x + 1, y]), view)
    const second = await load(source, east, 3)
    expect(second.state).toBe(TileState.LOADED)
    expect(new Set(requests).size).toBe(requests.length)
    const shared = new Set(reprojectedServiceTiles(second.extent).filter((url) => read.has(url)))
    expect(shared.size).toBeGreaterThan(0)
  })

  it('fails a tile of the map whose service tile fails, and asks for that tile again later', async () => {
    const source = reprojectedTileSource(config(2), view, () => template)
    failing.add('https://tiles.example.com/tile/2/2/1.pbf')
    const failed = await load(source, [-52, -10], 3)
    expect(failed.state).toBe(TileState.ERROR)
    failing.clear()
    // Brazil's label lies in level-2 tile x 1, y 2: a tile of the map one level deeper needs it too.
    const again = await load(source, [-52, -10], 4)
    expect(again.state).toBe(TileState.LOADED)
    expect(requests.filter((url) => url.endsWith('/tile/2/2/1.pbf'))).toHaveLength(2)
  })

  it('asks for no tile past the last level the service has, however far the map zooms', async () => {
    const source = reprojectedTileSource(config(1), view, () => template)
    // The deepest tiles of the map's grid; past them the map draws these overzoomed.
    const deepest = source.getTileGrid()!.getMaxZoom()
    expect(deepest).toBe(3)
    const { state, features } = await load(source, [-52, -10], deepest)
    expect(state).toBe(TileState.LOADED)
    expect(features.length).toBeGreaterThan(0)
    expect(requests.length).toBeGreaterThan(0)
    expect(requests.every((url) => url.includes('/tile/1/'))).toBe(true)
  })

  it('gives a tile of the map the strokes just past it, and only its own labels', () => {
    const tile: Extent = [0, 0, 1000, 1000]
    const resolution = 2
    const line = (x: number, id: number) =>
      new RenderFeature('LineString', [x, 0, x, 1000], [4], 2, {}, id)
    const label = (x: number, id: number) => new RenderFeature('Point', [x, 500], [2], 2, {}, id)
    const kept = featuresIn(
      [[line(500, 1), line(1100, 2), line(1300, 3), label(500, 4), label(1100, 5)]],
      tile,
      resolution,
    )
    // A road 50 pixels past the edge can still be drawn into it; one 150 pixels away can't.
    expect(kept.map((feature) => feature.getId())).toEqual([1, 2, 4])
  })

  it('goes as deep as the last level the service has', () => {
    // Esri's World Basemap: tiles to level 16 (`maxLOD`), drawn in 256-pixel tiles of Equal Earth.
    const source = reprojectedTileSource(config(16), view, () => template)
    const grid = source.getTileGrid()!
    const deepest = grid.getResolution(grid.getMaxZoom())
    expect(deepest).toBeLessThan(mercatorGrid.resolutions[16]!)
    expect(grid.getResolution(grid.getMaxZoom() - 2)).toBeGreaterThan(mercatorGrid.resolutions[16]!)
  })

  it('asks a source in its own projection for no tile past `maxSourceZoom` either', () => {
    const registry = new LayerRegistry(
      mercator,
      {
        loadGeoJson: () => Promise.reject(new Error('not used')),
        onError: () => undefined,
        onStatus: () => undefined,
      },
      null,
    )
    const [layer] = registry.reconcile([
      {
        ...config(16),
        id: 'own-projection',
        style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#e6d8ad' } },
      },
    ])
    const source = (layer as VectorTileLayer).getSource()!
    // OpenLayers ignores a source's `maxZoom` when it has a tile grid: the grid stops at 16, and
    // the map draws its deeper levels from there.
    expect(source.getTileGrid()!.getMaxZoom()).toBe(16)
    expect(source.getTileGridForProjection(mercator).getMaxZoom()).toBeGreaterThan(20)
    registry.destroy()
  })

  it('leaves the levels past `maxSourceZoom` out of a tile grid', () => {
    expect(lastSourceLevel(mercatorGrid, 16).resolutions).toEqual(
      mercatorGrid.resolutions.slice(0, 17),
    )
    expect(lastSourceLevel(mercatorGrid, undefined)).toBe(mercatorGrid)
    expect(lastSourceLevel(mercatorGrid, 22)).toBe(mercatorGrid)
  })
})
