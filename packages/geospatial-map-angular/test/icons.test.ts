import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { Signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { Eye, Globe, Plus, X } from 'lucide'
import { describe, expect, it, vi } from 'vitest'
import {
  GeospatialMap,
  MapIconView,
  SvgIcon,
  defineMapConfig,
  injectMapIcons,
  provideMapIcons,
  type MapIcons,
  type MapSvgIcon,
} from '../src/index'
import { defaultMapIcons } from '../src/icons'
import { resetControllers } from './fake-controller'

vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)

// SVG node icons: lucide's shape by default, and a leading ['svg', attributes] entry for other
// node sets (Carbon's `@carbon/icons` descriptors, filled 16/32 view boxes): its attributes
// replace lucide's defaults on the svg, so filled icons draw as their own set renders them.

/** Carbon's "add" icon (16), as a node list with the svg's own attributes first. */
const carbonAdd: MapSvgIcon = [
  [
    'svg',
    {
      viewBox: '0 0 32 32',
      fill: 'currentColor',
      width: 16,
      height: 16,
      focusable: 'false',
      preserveAspectRatio: 'xMidYMid meet',
    },
  ],
  ['path', { d: 'M17 15 17 8 15 8 15 15 8 15 8 17 15 17 15 24 17 24 17 17 24 17 24 15z' }],
]

const lucideAttributes = {
  width: '24',
  height: '24',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}

/** The svg's attributes by name. */
function attributes(svg: Element): Record<string, string> {
  return Object.fromEntries(
    [...svg.attributes].map((attribute) => [attribute.name, attribute.value]),
  )
}

@Component({
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map-icon [icon]="icon()" [iconClass]="iconClass()" />`,
})
class Host {
  readonly icon = signal<MapSvgIcon>(carbonAdd)
  readonly iconClass = signal<string | undefined>(undefined)
}

async function render() {
  const fixture = TestBed.createComponent(Host)
  await fixture.whenStable()
  const element = fixture.nativeElement as HTMLElement
  return { fixture, svg: () => element.querySelector('geo-map-icon > svg')! }
}

describe('SVG node icons', () => {
  it("draws lucide's nodes with lucide's svg attributes", async () => {
    const { fixture, svg } = await render()
    fixture.componentInstance.icon.set(Plus)
    await fixture.whenStable()
    expect(attributes(svg())).toEqual({
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      ...lucideAttributes,
    })
    expect([...svg().children].map((node) => node.getAttribute('d'))).toEqual([
      'M5 12h14',
      'M12 5v14',
    ])
  })

  it('takes the svg attributes from a leading svg entry instead of lucide defaults', async () => {
    const { svg } = await render()
    expect(attributes(svg())).toEqual({
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      viewBox: '0 0 32 32',
      fill: 'currentColor',
      width: '16',
      height: '16',
      focusable: 'false',
      preserveAspectRatio: 'xMidYMid meet',
    })
    // The entry describes the svg itself: it is not drawn as a nested svg.
    expect(svg().querySelector('svg')).toBeNull()
    expect([...svg().children].map((node) => node.tagName)).toEqual(['path'])
    expect(svg().firstElementChild?.namespaceURI).toBe('http://www.w3.org/2000/svg')
  })

  it("switches between the two kinds and keeps the map's class", async () => {
    const { fixture, svg } = await render()
    fixture.componentInstance.iconClass.set('geo-spin')
    fixture.componentInstance.icon.set(Plus)
    await fixture.whenStable()
    expect(attributes(svg())).toEqual({
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      class: 'geo-spin',
      ...lucideAttributes,
    })

    fixture.componentInstance.icon.set(carbonAdd)
    await fixture.whenStable()
    const carbon = attributes(svg())
    expect(carbon['viewBox']).toBe('0 0 32 32')
    expect(carbon['class']).toBe('geo-spin')
    expect(carbon['aria-hidden']).toBe('true')
    // None of lucide's stroke attributes stay behind.
    expect(Object.keys(carbon).filter((name) => name.startsWith('stroke'))).toEqual([])
    expect(svg().children).toHaveLength(1)
  })

  it('keeps the attributes a consumer writes on svg[geoIcon], for both kinds', async () => {
    @Component({
      imports: [SvgIcon],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<svg
        [geoIcon]="icon()"
        width="16"
        height="16"
        [attr.stroke-width]="stroke()"
      ></svg>`,
    })
    class OwnAttributes {
      readonly icon = signal<MapSvgIcon>(Plus)
      readonly stroke = signal('1.5')
    }
    const fixture = TestBed.createComponent(OwnAttributes)
    await fixture.whenStable()
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!
    // A static attribute and a binding win over lucide's defaults, as over static host attributes.
    expect(attributes(svg)).toMatchObject({
      ...lucideAttributes,
      width: '16',
      height: '16',
      'stroke-width': '1.5',
    })

    // And over a leading svg entry; lucide's attributes the entry doesn't name are still removed.
    fixture.componentInstance.icon.set(carbonAdd)
    await fixture.whenStable()
    expect(attributes(svg)).toMatchObject({
      viewBox: '0 0 32 32',
      fill: 'currentColor',
      width: '16',
      height: '16',
      'stroke-width': '1.5',
    })
    expect(svg.hasAttribute('stroke')).toBe(false)

    // Switching back keeps them, with the binding's new value.
    fixture.componentInstance.stroke.set('1')
    fixture.componentInstance.icon.set(Plus)
    await fixture.whenStable()
    expect(attributes(svg)).toMatchObject({
      ...lucideAttributes,
      width: '16',
      height: '16',
      'stroke-width': '1',
    })
  })
})

// The README's icon levels: provideMapIcons() in the app's or a (deferred) component's
// providers, merged with the ones above it, and [icons] on one map over both.
describe('provideMapIcons', () => {
  const config = defineMapConfig({
    accessibility: { ariaLabel: 'Icons map' },
    initialState: { view: { center: [0, 0], zoom: 1 } },
    data: {
      layers: [],
      basemaps: [
        {
          id: 'empty',
          title: 'Empty',
          supportedProjections: ['EPSG:8857'],
          layers: [],
          backgroundColor: '#ffffff',
        },
      ],
    },
  })

  /** A custom part that keeps the map's icons, as `injectMapIcons()` gives them. */
  let mapIcons: Signal<MapIcons> | undefined
  @Component({
    selector: 'app-icons-probe',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: '',
  })
  class IconsProbe {
    constructor() {
      mapIcons = injectMapIcons()
    }
  }

  @Component({
    imports: [GeospatialMap, IconsProbe],
    providers: [provideMapIcons({ Fit: Globe })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<geo-map [config]="config" [icons]="icons()"><app-icons-probe /></geo-map>`,
  })
  class DeferredMap {
    readonly config = config
    readonly icons = signal<Partial<MapIcons> | undefined>(undefined)
  }

  async function iconsOf(appIcons?: Partial<MapIcons>, mapInput?: Partial<MapIcons>) {
    resetControllers()
    if (appIcons) TestBed.configureTestingModule({ providers: [provideMapIcons(appIcons)] })
    const fixture = TestBed.createComponent(DeferredMap)
    fixture.componentInstance.icons.set(mapInput)
    await fixture.whenStable()
    return mapIcons!()
  }

  it("reaches a map from its component's providers; the other icons stay", async () => {
    const icons = await iconsOf()
    expect(icons.Fit).toBe(Globe)
    expect(icons.ZoomIn).toBe(defaultMapIcons.ZoomIn)
  })

  it("merges a component's icons with the app's", async () => {
    const icons = await iconsOf({ ZoomIn: X, Fit: Eye })
    expect(icons.ZoomIn).toBe(X)
    expect(icons.Fit).toBe(Globe)
  })

  it('lets [icons] on the map win', async () => {
    const icons = await iconsOf({ ZoomIn: X }, { Fit: Eye })
    expect(icons.Fit).toBe(Eye)
    expect(icons.ZoomIn).toBe(X)
  })
})
