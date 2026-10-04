import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import LineString from 'ol/geom/LineString.js'
import type CircleStyle from 'ol/style/Circle.js'
import { describe, expect, it } from 'vitest'
import { defaultCanvasTheme } from '../../src/core/canvas-theme'
import { legendEntriesForStyle } from '../../src/core/legend-model'
import { compileThematicStyle } from '../../src/core/style-compiler'
import { symbolPicker, withOpacity } from '../../src/core/symbols'
import { matchRule, symbolRules } from '../../src/core/symbol-rules'
import { compileWebglStyle, RULE_PROPERTY, ruleStamper } from '../../src/core/webgl-style'
import type { GeoJsonLayerConfig, PointSymbol, ThematicStyleSpec } from '../../src/types'

const dot = (fillColor: string): PointSymbol => ({ kind: 'point', fillColor })

const graduated: ThematicStyleSpec = {
  type: 'graduated',
  field: 'value',
  classes: [
    { label: 'Low', min: 0, max: 10, symbol: dot('#111111') },
    { label: 'High', min: 10, max: 100, symbol: dot('#222222') },
  ],
  missing: { label: 'No data', symbol: dot('#333333') },
  outOfRange: { label: 'Off scale', symbol: dot('#444444') },
  specialValues: [{ label: 'Suppressed', value: -1, symbol: dot('#555555') }],
}

const continuous: ThematicStyleSpec = {
  type: 'continuous',
  field: 'value',
  domain: [0, 10],
  clamp: false,
  stops: [
    { value: 0, color: '#000000' },
    { value: 10, color: '#ffffff' },
  ],
  symbol: dot('#000000'),
  missing: { label: 'No data', symbol: dot('#333333') },
  outOfRange: { label: 'Off scale', symbol: dot('#444444') },
}

const categorical: ThematicStyleSpec = {
  type: 'categorical',
  field: 'value',
  categories: [{ label: 'A', value: 'a', symbol: dot('#111111') }],
  fallback: { label: 'Other', symbol: dot('#999999') },
  specialValues: [{ label: 'Unknown', value: null, symbol: dot('#555555') }],
}

/** The symbol the canvas draws for one value. */
const symbolForValue = (style: ThematicStyleSpec, value: unknown) => symbolPicker(style)(value)

const values = [5, 50, 500, -1, null, undefined, '', 'text', '7', 'a', 'b']

/** The fill colour the GPU style gives a feature, after the stamper has classified it. */
function gpuFill(style: ThematicStyleSpec, value: unknown): unknown {
  const config = { id: 'points', style } as unknown as GeoJsonLayerConfig
  const rules = compileWebglStyle(config, defaultCanvasTheme)
  const feature = new Feature({ geometry: new Point([0, 0]), value })
  ruleStamper(style)(feature)
  const index = feature.get(RULE_PROPERTY) as number
  if (index < 0) return undefined
  const fill = rules[index]!.style as Record<string, unknown>
  return fill['circle-fill-color']
}

describe('symbol rules', () => {
  it('the canvas, the GPU and the legend use the same rules for every kind of value', () => {
    for (const style of [graduated, continuous, categorical]) {
      for (const value of values) {
        const canvas = symbolForValue(style, value)
        const gpu = gpuFill(style, value)
        if (style.type === 'continuous' && matchRule(symbolRules(style), value) === 1) {
          // The ramp: the GPU interpolates the colour itself.
          expect(Array.isArray(gpu), `ramp for ${String(value)}`).toBe(true)
          continue
        }
        expect(gpu, `${style.type} ${JSON.stringify(value)}`).toBe(
          canvas?.kind === 'point' ? canvas.fillColor : undefined,
        )
      }
    }
  })

  it('absent and empty values are missing, numbers outside every class are out of range', () => {
    expect(symbolForValue(graduated, null)).toMatchObject({ fillColor: '#333333' })
    expect(symbolForValue(graduated, '')).toMatchObject({ fillColor: '#333333' })
    expect(symbolForValue(graduated, 500)).toMatchObject({ fillColor: '#444444' })
    expect(symbolForValue(graduated, '7')).toMatchObject({ fillColor: '#111111' })
    expect(symbolForValue(graduated, -1)).toMatchObject({ fillColor: '#555555' })
    expect(symbolForValue(continuous, 50)).toMatchObject({ fillColor: '#444444' })
    expect(symbolForValue(categorical, undefined)).toMatchObject({ fillColor: '#555555' })
    expect(symbolForValue(categorical, 'b')).toMatchObject({ fillColor: '#999999' })
  })

  it('the legend lists classes first, then catch-alls, then special values', () => {
    expect(legendEntriesForStyle(graduated).map((entry) => entry.label)).toEqual([
      'Low',
      'High',
      'No data',
      'Off scale',
      'Suppressed',
    ])
  })
})

describe('opacity', () => {
  it('multiplies the alpha of hex, rgb and rgba colours', () => {
    expect(withOpacity('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
    expect(withOpacity('rgba(0, 0, 255, 0.5)', 0.5)).toBe('rgba(0, 0, 255, 0.25)')
    expect(withOpacity('#00ff0080', 1)).toBe('#00ff0080')
  })

  it('applies to points and lines, and to colours from CSS variables', () => {
    const theme = { ...defaultCanvasTheme, colors: { 'var(--brand)': 'rgb(10, 20, 30)' } }
    const point = compileThematicStyle(
      { type: 'constant', symbol: { kind: 'point', fillColor: 'var(--brand)', opacity: 0.5 } },
      { zoom: 3, theme },
    )(new Feature(new Point([0, 0])))!
    expect((point.getImage() as CircleStyle).getFill()!.getColor()).toBe('rgba(10, 20, 30, 0.5)')
    const line = compileThematicStyle(
      { type: 'constant', symbol: { kind: 'line', color: '#000000', opacity: 0.25 } },
      { zoom: 3, theme: defaultCanvasTheme },
    )(
      new Feature(
        new LineString([
          [0, 0],
          [1, 1],
        ]),
      ),
    )!
    expect(line.getStroke()!.getColor()).toBe('rgba(0, 0, 0, 0.25)')
  })
})
