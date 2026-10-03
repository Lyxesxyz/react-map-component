import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { defaultMapTheme, mapThemeVariables } from '../src/theme'

const css = readFileSync(new URL('../src/geospatial-map.css', import.meta.url), 'utf8')
const lightTokens = css.slice(css.indexOf(':root,'), css.indexOf('.dark,'))

describe('stylesheet tokens', () => {
  it('declares every JSON theme key with the documented light default', () => {
    for (const [key, variable] of Object.entries(mapThemeVariables)) {
      const value = defaultMapTheme[key as keyof typeof mapThemeVariables]
      if (key === 'fontFamily') {
        expect(value).toBe('inherit')
        continue
      }
      expect(lightTokens, `${variable} for ${key}`).toContain(`${variable}: ${value};`)
    }
  })

  it('keeps every component rule at single-class specificity so host classes win', () => {
    const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
    const preludes = [...withoutComments.matchAll(/([^{}@;]+)\{/g)].map((match) => match[1]!.trim())
    const tooSpecific: string[] = []
    for (const prelude of preludes) {
      if (!prelude || prelude === 'to' || prelude === 'from') continue
      for (const raw of prelude.split(',')) {
        const selector = raw.trim()
        if (selector.includes('.ol-')) continue // OpenLayers essentials are deliberately strong
        const counted = stripWhere(selector).replaceAll(/::[a-z-]+/g, '')
        const ids = (counted.match(/#/g) ?? []).length
        const classLevel =
          (counted.match(/\.[a-zA-Z_-]/g) ?? []).length +
          (counted.match(/\[/g) ?? []).length +
          (counted.match(/(?<!:):[a-z-]+/g) ?? []).length
        if (ids || classLevel > 1) tooSpecific.push(selector)
      }
    }
    expect(tooSpecific).toEqual([])
  })
})

function stripWhere(selector: string): string {
  let result = ''
  for (let index = 0; index < selector.length; index++) {
    if (!selector.startsWith(':where(', index)) {
      result += selector[index]
      continue
    }
    let depth = 0
    for (index += 6; index < selector.length; index++) {
      if (selector[index] === '(') depth++
      else if (selector[index] === ')' && --depth === 0) break
    }
  }
  return result
}
