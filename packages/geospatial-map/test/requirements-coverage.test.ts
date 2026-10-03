import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const idPattern = /\b(?:INT|PROJ|VEC|RAS|LAY|SYM|LOD|NAV|SEL|TIME|GRID|EXP|ATT|UX|PERF)-\d{2}\b/g

describe('requirements traceability', () => {
  it('maps every requirement ID exactly once into repository evidence', () => {
    const requirements = readFileSync('requirements.md', 'utf8').match(idPattern) ?? []
    const matrix = readFileSync('tests/requirements-matrix.md', 'utf8').match(idPattern) ?? []
    expect(new Set(matrix)).toEqual(new Set(requirements))
    expect(matrix).toHaveLength(new Set(matrix).size)
  })
})
