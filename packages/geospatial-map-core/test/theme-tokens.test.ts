import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mapThemeTokenNames, themeVariable } from '../src/theme'

const css = readFileSync(new URL('../src/geospatial-map.css', import.meta.url), 'utf8')
const lightTokens = css.slice(css.indexOf(':root,'), css.indexOf('.dark,'))

describe('stylesheet tokens', () => {
  it('uses every token config.theme can set (the font is inherited unless you set it)', () => {
    for (const token of mapThemeTokenNames)
      expect(token === 'fontFamily' ? css : lightTokens, token).toMatch(
        new RegExp(`${themeVariable(token)}${token === 'fontFamily' ? ',' : ':'}`),
      )
  })

  it('keeps every component rule at single-class specificity so host classes win', () => {
    expect(selectorsAbove(css, 1)).toEqual([])
  })

  it('leaves a map root with the hidden attribute hidden', () => {
    // Any author `display` beats the browser's own `[hidden] { display: none }`, so a rule that
    // sets `display` on the root itself must skip hidden roots.
    const rootDisplay = [...withoutComments(css).matchAll(/([^{}@;]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => /(?:^|[;\s])display\s*:/.test(body!))
      .flatMap(([, prelude]) => prelude!.split(','))
      .map((selector) => selector.trim())
      .filter((selector) => /(?:^|[\s>])\.geo-map-root(?::where\(.*\))?$/.test(selector))
    expect(rootDisplay.length).toBeGreaterThan(0)
    for (const selector of rootDisplay) expect(selector).toContain(':not([hidden])')
  })

  it('takes every size, weight, radius, blur, duration and colour in component rules from tokens', () => {
    const rules = withoutComments(css)
      .replace(/:root,\s*\.light,[\s\S]*?\n\}/, '')
      .replace(/\.dark,\s*\[data-theme='dark'\][\s\S]*?\n\}/, '')
      .replace(/@media \(prefers-reduced-motion[\s\S]*$/, '')
    const literals = [
      ...rules.matchAll(/(?<![\w-])(?:font-size|font-weight):\s*\d[^;]*;/g),
      ...rules.matchAll(/(?<![\w-])border-radius:\s*[1-9][^;]*;|backdrop-filter:\s*blur[^;]*;/g),
      // Transition timings (the loading spinner's rotation speed is not a theme decision).
      ...rules.matchAll(/transition[^;]*\b\d+m?s\b[^;]*;/g),
      ...rules.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g),
    ].map((match) => match[0])
    // The select chevron is an inline SVG mask (its colour is `currentColor`).
    expect(literals.filter((literal) => !literal.startsWith('#'))).toEqual([])
    expect(rules.match(/(?<!%23)#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })
})

describe('demo themes', () => {
  const folder = new URL('../../../apps/demo/src/themes/', import.meta.url)
  const files = readdirSync(folder).filter((name) => name.endsWith('.css'))

  it('restyle the map with tokens and at most one class under the theme scope', () => {
    expect(files.sort()).toEqual(['carbon.css', 'editorial.css', 'material.css'])
    for (const name of files) {
      const source = readFileSync(new URL(name, folder), 'utf8')
      expect(source, name).not.toContain('!important')
      // `.theme-x.dark` and `.theme-x .geo-part` are the two shapes a theme needs.
      expect(selectorsAbove(source, 2), name).toEqual([])
    }
  })
})

function withoutComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, '')
}

/** Selectors whose class-level specificity is above `limit` (qualifiers in `:where()` are free). */
function selectorsAbove(source: string, limit: number): string[] {
  const preludes = [...withoutComments(source).matchAll(/([^{}@;]+)\{/g)].map((match) =>
    match[1]!.trim(),
  )
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
      if (ids || classLevel > limit) tooSpecific.push(selector)
    }
  }
  return tooSpecific
}

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
