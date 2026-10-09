// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// These checks keep the promise of the folder: copy `src/` into any Angular 21 or 22 app,
// install the listed packages, and it works — no aliases, no build step, no files from elsewhere
// in this repo — and keep it to the Angular conventions of angular-plan.md (section 4.2) and
// CONTRIBUTING.md. The React folder has the same checks (packages/geospatial-map/test).

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const folder = path.join(packageRoot, 'src')
const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
  version: string
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    return statSync(file).isDirectory() ? walk(file) : [file]
  })
}

const files = walk(folder)
const sources = files.filter((file) => file.endsWith('.ts'))
const read = (file: string) => readFileSync(file, 'utf8')
const relative = (file: string) => path.relative(folder, file).split(path.sep).join('/')

function specifiers(source: string): string[] {
  const patterns = [
    /\bfrom\s+'([^']+)'/g,
    /^\s*import\s+'([^']+)'/gm,
    /\bimport\(\s*'([^']+)'\s*\)/g,
  ]
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]!))
}

function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
}

/** The source without comments (URLs keep their `//`), for checks that comments may mention. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/** The inline templates (`template: \`…\``) of a source file. */
function templates(source: string): string[] {
  return [...source.matchAll(/\btemplate:\s*`([^`]*)`/g)].map((match) => match[1]!)
}

/** The `host: { … }` objects of a source file: their binding expressions are template syntax. */
function hostObjects(source: string): string[] {
  return [...source.matchAll(/\bhost:\s*\{/g)].map((match) => {
    let depth = 0
    for (let index = match.index + match[0].length - 1; index < source.length; index++) {
      if (source[index] === '{') depth++
      else if (source[index] === '}' && --depth === 0) return source.slice(match.index, index + 1)
    }
    return source.slice(match.index)
  })
}

/** Each `@Component({ … })` decorator, up to the class it decorates. */
function componentDecorators(source: string): string[] {
  return source
    .split('@Component(')
    .slice(1)
    .map((part) => part.split(/\n(?:export\s+)?(?:abstract\s+)?class\s/)[0]!)
}

const engineHeader = [
  "// Engine internals: read freely, but don't edit to customise the map. Change behaviour through",
  '// the config, CSS tokens and classes, the map-* parts, or onOpenLayersMap (see AGENTS.md).',
  '// Edits here are the most likely to conflict when the folder is updated.',
].join('\n')
/** The Angular folder's own engine files (CONTRIBUTING.md, "Engine header"). */
const angularEngineFiles = [
  'map-engine.ts',
  'arcgis-config.ts',
  'world-fit.ts',
  'map-context.ts',
  'signals.ts',
]
const isEngineFile = (file: string) =>
  file.startsWith('core/') ||
  file.startsWith('config/') ||
  ['map-state.ts', 'map-bridges.ts', ...angularEngineFiles].includes(file)

describe('copy-paste folder', () => {
  it('contains only component source, styles, docs, examples and agent guides', () => {
    const unexpected = files
      .map(relative)
      .filter(
        (file) =>
          !file.endsWith('.ts') &&
          !['geospatial-map.css', 'README.md', 'CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md'].includes(
            file,
          ) &&
          !/^docs\/[\w-]+\.md$/.test(file) &&
          !/^examples\/[\w-]+\.css$/.test(file),
      )
    expect(unexpected).toEqual([])
    expect(files.map(relative).filter((file) => /\.(test|spec)\./.test(file))).toEqual([])
  })

  it('resolves every relative import inside the folder, without file extensions', () => {
    const problems: string[] = []
    for (const file of sources) {
      for (const specifier of specifiers(read(file)).filter((item) => item.startsWith('.'))) {
        if (/\.(js|ts|tsx|css)$/.test(specifier)) problems.push(`${relative(file)}: ${specifier}`)
        const target = path.resolve(path.dirname(file), specifier)
        const resolved = [`${target}.ts`, path.join(target, 'index.ts')].find(existsSync)
        if (!resolved || !resolved.startsWith(folder))
          problems.push(`${relative(file)}: ${specifier}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('imports only the packages listed in package.json', () => {
    const allowed = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
      'geojson', // types only, from @types/geojson
    ])
    const used = new Set(
      sources.flatMap((file) =>
        specifiers(read(file))
          .filter((item) => !item.startsWith('.'))
          .map(packageName),
      ),
    )
    expect([...used].filter((name) => !allowed.has(name))).toEqual([])
    for (const dependency of Object.keys(manifest.dependencies)) expect(used).toContain(dependency)
  })

  // TODO(docs phase, angular-plan.md phase 6): src/README.md doesn't exist yet. Once it does,
  // this test runs: the README's install commands must match package.json, as in React.
  it.skipIf(!existsSync(path.join(folder, 'README.md')))(
    'documents the exact install command in the README that travels with the folder',
    () => {
      const readme = read(path.join(folder, 'README.md'))
      const install = readme.match(/npm install ([^\n]+)\nnpm install -D ([^\n]+)/)
      expect(install, 'README install commands').not.toBeNull()
      expect(install![1]!.split(' ').sort()).toEqual(Object.keys(manifest.dependencies).sort())
      expect(install![2]!.split(' ')).toEqual(['@types/geojson'])
    },
  )

  it('stamps the folder with the package version', () => {
    expect(read(path.join(folder, 'version.ts'))).toContain(`'${manifest.version}'`)
  })

  // TODO(docs phase): CHANGELOG.md arrives with the guides; then it needs the version heading.
  it.skipIf(!existsSync(path.join(folder, 'CHANGELOG.md')))(
    'has a changelog entry for the package version',
    () => {
      expect(read(path.join(folder, 'CHANGELOG.md'))).toMatch(
        new RegExp(`^## ${manifest.version.replaceAll('.', '\\.')}$`, 'm'),
      )
    },
  )

  it('never imports CSS from TypeScript or relies on bundler or Node globals', () => {
    const problems = sources.flatMap((file) => {
      const source = read(file)
      return [
        ...specifiers(source).filter((item) => item.endsWith('.css')),
        ...(source.match(/\bimport\.meta\b|\bprocess\.env\b|\brequire\(/g) ?? []),
      ].map((match) => `${relative(file)}: ${match}`)
    })
    expect(problems).toEqual([])
  })

  it('marks every engine file as internals, so agents customise elsewhere', () => {
    const engine = sources.map(relative).filter(isEngineFile)
    expect(engine.length).toBeGreaterThan(20)
    const unmarked = engine.filter(
      (file) =>
        !read(path.join(folder, file)).startsWith(
          "// Engine internals: read freely, but don't edit",
        ),
    )
    expect(unmarked).toEqual([])
    // The Angular engine files carry the three-line header exactly (naming the map-* parts).
    for (const file of angularEngineFiles)
      expect(read(path.join(folder, file)).startsWith(`${engineHeader}\n`), file).toBe(true)
  })

  it('keeps the engine header off the parts, which teams may edit', () => {
    const marked = sources
      .map(relative)
      .filter((file) => !isEngineFile(file))
      .filter((file) => read(path.join(folder, file)).startsWith('// Engine internals'))
    expect(marked).toEqual([])
  })
})

describe('Angular conventions (angular-plan.md 4.2, D5, D6)', () => {
  /** `file: match` for every match of `pattern` in the code (not the comments) of each file. */
  function findInCode(pattern: RegExp, only: (file: string) => boolean = () => true) {
    return sources
      .filter((file) => only(relative(file)))
      .flatMap((file) =>
        [...code(read(file)).matchAll(pattern)].map((match) => `${relative(file)}: ${match[0]}`),
      )
  }

  it('sets changeDetection: ChangeDetectionStrategy.OnPush on every component', () => {
    const components = sources.flatMap((file) =>
      componentDecorators(code(read(file))).map((decorator) => ({ file, decorator })),
    )
    expect(components.length).toBeGreaterThan(20)
    const missing = components
      .filter(
        ({ decorator }) =>
          !/\bchangeDetection:\s*ChangeDetectionStrategy\.OnPush\b/.test(decorator),
      )
      .map(
        ({ file, decorator }) =>
          `${relative(file)}: ${/selector:\s*'([^']+)'/.exec(decorator)?.[1]}`,
      )
    expect(missing).toEqual([])
  })

  it('uses standalone components and directives only (no NgModule, no standalone: false)', () => {
    expect(findInCode(/\bNgModule\b|\bstandalone:\s*false\b/g)).toEqual([])
  })

  it('uses signal inputs, outputs, queries and host bindings, not the decorators', () => {
    expect(
      findInCode(
        /@(?:Input|Output|ViewChild|ViewChildren|ContentChild|ContentChildren)\(|@HostBinding\b|@HostListener\b/g,
      ),
    ).toEqual([])
  })

  it('uses no API that was experimental in Angular 21 or is new in 22 (resource(), @Service)', () => {
    // Signal Forms and @angular/aria fail the package check above; these come from @angular/core.
    expect(findInCode(/\b(?:resource|httpResource|rxResource)\s*\(|@Service\b/g)).toEqual([])
  })

  it('never uses ChangeDetectorRef or NgZone.run (signals drive change detection)', () => {
    expect(findInCode(/\bChangeDetectorRef\b|\bNgZone\.run\(/g)).toEqual([])
    // `const zone = inject(NgZone)` may run outside Angular, never back inside it.
    const problems = sources.flatMap((file) => {
      const source = code(read(file))
      const zones = [
        ...source.matchAll(
          /(?:const|let|readonly|private|protected)\s+(#?\w+)\s*=\s*inject\(NgZone\)/g,
        ),
      ].map((match) => match[1]!)
      return zones
        .filter((name) => source.includes(`${name}.run(`))
        .map((name) => `${relative(file)}: ${name}.run(`)
    })
    expect(problems).toEqual([])
  })

  it('imports nothing from RxJS', () => {
    const problems = sources.flatMap((file) =>
      specifiers(read(file))
        .filter(
          (item) => item === 'rxjs' || item.startsWith('rxjs/') || item.endsWith('/rxjs-interop'),
        )
        .map((item) => `${relative(file)}: ${item}`),
    )
    expect(problems).toEqual([])
  })

  it('never writes HTML strings (no innerHTML)', () => {
    expect(findInCode(/innerHTML/gi)).toEqual([])
  })

  it('takes icons from the map: lucide is imported (for values) only in icons.ts', () => {
    const problems = sources
      .filter((file) => relative(file) !== 'icons.ts')
      .flatMap((file) =>
        [...read(file).matchAll(/^import\s+(type\s+)?[^;]*?\bfrom\s+'(lucide(?:\/[^']*)?)'/gm)]
          .filter((match) => !match[1])
          .map((match) => `${relative(file)}: ${match[2]}`),
      )
    expect(problems).toEqual([])
  })

  it('keeps templates and host bindings to the syntax Angular 21.0 compiles (no arrow functions or spread)', () => {
    // Angular 21.2 (the v21 paste test) already compiles template arrow functions; the peer
    // range starts at 21.0, so this check stands in for an older compiler. Host binding
    // expressions (`host: { '[attr.x]': '…' }`) go through the same expression parser.
    const problems = sources.flatMap((file) =>
      [...templates(read(file)), ...hostObjects(code(read(file)))].flatMap((template) =>
        [...template.matchAll(/=>|\.\.\.\s*[\w([]/g)].map(
          (match) =>
            `${relative(file)}: ${template.slice(Math.max(0, match.index - 30), match.index + 20).trim()}`,
        ),
      ),
    )
    expect(problems).toEqual([])
  })
})
