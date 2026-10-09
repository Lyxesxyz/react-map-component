import { NgComponentOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  reflectComponentType,
} from '@angular/core'
import type { MapIcon, MapSvgIcon } from './component-types'

/** Whether an icon is an SVG node list (lucide's shape) rather than an icon component. */
export function isSvgIcon(icon: MapIcon): icon is MapSvgIcon {
  return Array.isArray(icon)
}

/** lucide's svg attributes, for icons without a leading `['svg', attributes]` entry. */
const lucideSvgAttributes: MapSvgIcon[number][1] = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}

/** The host's own attributes, which an icon's svg entry doesn't change. */
const hostAttributes = new Set(['xmlns', 'aria-hidden', 'class'])

/**
 * `<svg [geoIcon]="Plus">`: draws an SVG node list into its host `<svg>` with Renderer2 (never
 * innerHTML). The host gets lucide's default attributes, so CSS that targets `svg` (size,
 * `stroke-width` for `fill="none"` icons) works as with lucide-react. A leading
 * `['svg', attributes]` entry (another set's view box, `fill="currentColor"` for filled icons)
 * replaces those defaults; `xmlns`, `aria-hidden` and the map's `class` stay, and so does any
 * attribute written on the svg itself (`width="16"`). The attributes and nodes are set in an
 * `effect`, so server-rendered HTML has them too.
 */
@Component({
  selector: 'svg[geoIcon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' },
})
export class SvgIcon {
  /** The icon's nodes: `[tag, attributes][]`. */
  readonly geoIcon = input.required<MapSvgIcon>()
  readonly #renderer = inject(Renderer2)
  readonly #host = inject<ElementRef<SVGSVGElement>>(ElementRef).nativeElement

  constructor() {
    effect((onCleanup) => {
      const [first, ...rest] = this.geoIcon()
      const own = first?.[0] === 'svg' ? first[1] : undefined
      // An attribute the svg already has is the consumer's (`<svg [geoIcon] width="16">`, or a
      // binding): it wins, as it did over the static host attributes these replace. This run's
      // own attributes are gone by the next run (see onCleanup).
      const svgAttributes = Object.entries(own ?? lucideSvgAttributes).flatMap(([name, value]) =>
        value === undefined || hostAttributes.has(name) || this.#host.hasAttribute(name)
          ? []
          : [[name, String(value)] as const],
      )
      for (const [name, value] of svgAttributes) {
        this.#renderer.setAttribute(this.#host, name, value)
      }
      const nodes = (own ? rest : this.geoIcon()).map(([tag, attributes]) => {
        const node = this.#renderer.createElement(tag, 'svg') as Element
        for (const [name, value] of Object.entries(attributes)) {
          if (value !== undefined) this.#renderer.setAttribute(node, name, String(value))
        }
        this.#renderer.appendChild(this.#host, node)
        return node
      })
      onCleanup(() => {
        for (const node of nodes) this.#renderer.removeChild(this.#host, node)
        // Only what is still this icon's: a consumer binding may have changed it since.
        for (const [name, value] of svgAttributes) {
          if (this.#host.getAttribute(name) === value) {
            this.#renderer.removeAttribute(this.#host, name)
          }
        }
      })
    })
  }
}

/**
 * `<geo-map-icon [icon]="icons().ZoomIn">`: an icon of the map's set, either an SVG node list
 * (drawn by `svg[geoIcon]`) or an icon component (through NgComponentOutlet; the map sets its
 * `class` and `ariaHidden` inputs when it declares them). The host adds no box of its own
 * (`.geo-icon { display: contents }`), so the svg sizes as if it were the button's child.
 */
@Component({
  selector: 'geo-map-icon',
  imports: [SvgIcon, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'geo-icon', 'aria-hidden': 'true' },
  template: `
    @let nodes = svgIcon();
    @if (nodes) {
      <svg [geoIcon]="nodes" [attr.class]="iconClass() ?? null"></svg>
    } @else {
      <ng-container *ngComponentOutlet="iconComponent(); inputs: componentInputs()" />
    }
  `,
})
export class MapIconView {
  /** The icon to draw. */
  readonly icon = input.required<MapIcon>()
  /** A class for the svg (or the icon component's `class` input), for example `geo-spin`. */
  readonly iconClass = input<string>()

  protected readonly svgIcon = computed(() => {
    const icon = this.icon()
    return isSvgIcon(icon) ? icon : null
  })
  protected readonly iconComponent = computed(() => {
    const icon = this.icon()
    return isSvgIcon(icon) ? null : icon
  })
  /** Only the inputs the icon component declares: setting another one is an error (NG0303). */
  protected readonly componentInputs = computed(() => {
    const component = this.iconComponent()
    const declared = new Set(
      (component ? reflectComponentType(component)?.inputs : undefined)?.map(
        (item) => item.templateName,
      ),
    )
    const inputs: Record<string, unknown> = {}
    const iconClass = this.iconClass()
    if (iconClass !== undefined && declared.has('class')) inputs['class'] = iconClass
    if (declared.has('ariaHidden')) inputs['ariaHidden'] = true
    return inputs
  })
}
