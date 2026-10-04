import Feature from 'ol/Feature.js'
import LineString from 'ol/geom/LineString.js'
import Point from 'ol/geom/Point.js'
import Polygon from 'ol/geom/Polygon.js'
import { describe, expect, it } from 'vitest'
import { defaultCanvasTheme } from '../../src/core/canvas-theme'
import { vectorFeaturesSvg } from '../../src/core/svg-export'
import type { SvgFeatureOptions } from '../../src/core/svg-export'
import type { GeoJsonLayerConfig, ThematicStyleSpec } from '../../src/types'

const layer = (id: string, style: ThematicStyleSpec): GeoJsonLayerConfig => ({
  id,
  title: id,
  kind: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
  style,
  selectable: true,
})

const feature = (id: string, geometry: Point | LineString | Polygon) => {
  const item = new Feature({ geometry })
  item.setId(id)
  return item
}

/** The SVG of `layers` drawn with map coordinates as pixels. */
const svg = (layers: SvgFeatureOptions['layers'], options: Partial<SvgFeatureOptions> = {}) =>
  vectorFeaturesSvg({
    layers,
    time: null,
    zoom: 4,
    selection: null,
    coordinateToPixel: (coordinate) => coordinate,
    pixelRatio: 1,
    theme: { ...defaultCanvasTheme, selectionLine: '#ffc400' },
    ...options,
  })

describe('SVG export', () => {
  it('draws a selected line as a line, as the canvas does', () => {
    const roads = layer('roads', { type: 'constant', symbol: { kind: 'line', color: '#111111' } })
    const road = feature(
      'r1',
      new LineString([
        [0, 0],
        [10, 10],
      ]),
    )
    const markup = svg([{ config: roads, features: [road], opacity: 1 }], {
      selection: { layerId: 'roads', featureId: 'r1' },
    })
    expect(markup).toContain('fill="none" stroke="#ffc400" stroke-width="5"')
  })

  it('sizes symbols for the current zoom and applies the layer opacity', () => {
    const sites = layer('sites', {
      type: 'constant',
      symbol: {
        kind: 'point',
        fillColor: '#222222',
        radiusStops: [
          { zoom: 0, value: 2 },
          { zoom: 8, value: 10 },
        ],
      },
    })
    const markup = svg([
      { config: sites, features: [feature('s', new Point([5, 5]))], opacity: 0.5 },
    ])
    expect(markup).toContain('r="6"')
    expect(markup).toMatch(/^<g opacity="0.5">/)
  })

  it('draws squares with the canvas radius (to the corners), in drawing order', () => {
    const squares = layer('squares', {
      type: 'constant',
      symbol: { kind: 'point', shape: 'square', radius: 10, fillColor: '#333333' },
    })
    const areas = layer('areas', {
      type: 'constant',
      symbol: { kind: 'polygon', fillColor: '#444444' },
    })
    const markup = svg([
      {
        config: areas,
        features: [
          feature(
            'a',
            new Polygon([
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ]),
          ),
        ],
        opacity: 1,
      },
      { config: squares, features: [feature('q', new Point([0, 0]))], opacity: 1 },
    ])
    expect(markup.indexOf('<path')).toBeLessThan(markup.indexOf('<polygon'))
    // A corner at 45°: x = sin(45°) × 10 ≈ 7.07, the square's half side.
    expect(markup).toContain('points="7.07,-7.07 7.07,7.07 -7.07,7.07 -7.07,-7.07"')
  })
})
