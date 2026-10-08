import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core'
import { injectMapRuntime, injectMapStatic } from './map-context'
import { formatMapMessage } from './messages'
import { ShapeCard } from './shapes'
import {
  injectHostAttribute,
  injectUniqueId,
  optionalBooleanAttribute,
  partHostStyle,
} from './signals'
import type { LegendEntry, LegendPanelConfig, MapPlacement, SymbolSpec } from './types'

// Symbol outlines without a configured stroke use `currentColor`; the stylesheet sets it from
// the `--geo-symbol-stroke` token.

function symbolColors(symbol: SymbolSpec): { fill: string; stroke: string; width: number } {
  if (symbol.kind === 'line')
    return { fill: 'none', stroke: symbol.color, width: symbol.width ?? 2 }
  return {
    fill: symbol.fillColor ?? 'transparent',
    stroke: symbol.strokeColor ?? symbol.fillColor ?? 'currentColor',
    width: symbol.strokeWidth ?? 1,
  }
}

type SymbolView =
  | { kind: 'gradient'; stops: { offset: number; color: string }[] }
  | { kind: 'line'; stroke: string; width: number }
  | {
      kind: 'circle' | 'triangle' | 'square' | 'diamond' | 'polygon'
      fill: string
      stroke: string
      width: number
      radius: number
    }

/**
 * `<svg geoMapLegendSymbol [entry]="entry">`: the small SVG swatch for one legend entry (point,
 * line, polygon, or gradient).
 */
@Component({
  selector: 'svg[geoMapLegendSymbol]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.viewBox]': 'symbol().kind === "gradient" ? "0 0 72 14" : "0 0 28 18"',
    '[class.geo-legend-gradient]': 'symbol().kind === "gradient"',
    '[class.geo-legend-symbol]': 'symbol().kind !== "gradient"',
  },
  template: `
    @let view = symbol();
    @if (view.kind === 'gradient') {
      <svg:defs>
        <svg:linearGradient [attr.id]="gradientId" x1="0" x2="1">
          @for (stop of view.stops; track $index) {
            <svg:stop [attr.offset]="stop.offset" [attr.stop-color]="stop.color" />
          }
        </svg:linearGradient>
      </svg:defs>
      <svg:rect
        x="0.5"
        y="0.5"
        width="71"
        height="13"
        rx="2"
        [attr.fill]="gradientFill"
        stroke="currentColor"
      />
    } @else if (view.kind === 'line') {
      <svg:line
        x1="2"
        y1="9"
        x2="26"
        y2="9"
        [attr.stroke]="view.stroke"
        [attr.stroke-width]="view.width"
      />
    } @else if (view.kind === 'circle') {
      <svg:circle
        cx="14"
        cy="9"
        [attr.r]="view.radius"
        [attr.fill]="view.fill"
        [attr.stroke]="view.stroke"
        [attr.stroke-width]="view.width"
      />
    } @else if (view.kind === 'triangle') {
      <svg:path
        d="M14 2 22 16 6 16Z"
        [attr.fill]="view.fill"
        [attr.stroke]="view.stroke"
        [attr.stroke-width]="view.width"
      />
    } @else if (view.kind === 'polygon') {
      <svg:rect
        x="3"
        y="3"
        width="22"
        height="12"
        [attr.fill]="view.fill"
        [attr.stroke]="view.stroke"
        [attr.stroke-width]="view.width"
      />
    } @else {
      <svg:rect
        x="8"
        y="3"
        width="12"
        height="12"
        [attr.transform]="view.kind === 'diamond' ? 'rotate(45 14 9)' : null"
        [attr.fill]="view.fill"
        [attr.stroke]="view.stroke"
        [attr.stroke-width]="view.width"
      />
    }
  `,
})
export class MapLegendSymbol {
  readonly entry = input.required<LegendEntry>()

  protected readonly gradientId = `${injectUniqueId('geo-legend')}-gradient`
  protected readonly gradientFill = `url(#${this.gradientId})`
  protected readonly symbol = computed<SymbolView>(() => {
    const symbol = this.entry().symbol
    if (symbol.kind === 'gradient') {
      const min = symbol.stops[0]?.value ?? 0
      const max = symbol.stops.at(-1)?.value ?? 1
      return {
        kind: 'gradient',
        stops: symbol.stops.map((stop) => ({
          offset: max === min ? 0 : (stop.value - min) / (max - min),
          color: stop.color,
        })),
      }
    }
    const colors = symbolColors(symbol)
    if (symbol.kind === 'line') return { kind: 'line', stroke: colors.stroke, width: colors.width }
    const radius = symbol.kind === 'point' ? Math.min(8, Math.max(2, symbol.radius ?? 6)) : 0
    return {
      kind: symbol.kind === 'point' ? (symbol.shape ?? 'circle') : 'polygon',
      fill: colors.fill,
      stroke: colors.stroke,
      width: colors.width,
      radius,
    }
  })
}

/**
 * Legends for every visible layer. Hidden (with no classes or ARIA) while no layer has a
 * legend. Project `[geoMapPanelHeader]` to replace the "Legend" heading, and
 * `[geoMapPanelFooter]` to add content after the legends.
 */
@Component({
  selector: 'geo-map-legend',
  imports: [MapLegendSymbol],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeCard],
  host: {
    '[class]': 'hostClasses()',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "region")',
    '[attr.data-slot]': 'hidden() ? null : "map-legend"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.legend.placement)',
    '[attr.data-layout]': 'hidden() ? null : resolvedLayout()',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? map().messages.legend)',
    '[style]': 'hostStyle()',
  },
  template: `
    @if (!hidden()) {
      <ng-content select="[geoMapPanelHeader]">
        <h2 class="geo-legend-heading">{{ map().messages.legend }}</h2>
      </ng-content>
      @for (legend of visible(); track legend.layerId) {
        <details class="geo-legend-layer" [open]="expanded() ?? map().ui.legend.expanded">
          <summary class="geo-legend-title">{{ legend.title }}</summary>
          @if (legend.subtitle) {
            <p class="geo-legend-subtitle">{{ legend.subtitle }}</p>
          }
          @if (legend.description) {
            <p class="geo-legend-description">{{ legend.description }}</p>
          }
          <ul class="geo-legend-entries">
            @for (entry of legend.entries; track entry.id) {
              <li class="geo-legend-entry">
                <svg geoMapLegendSymbol [entry]="entry"></svg>
                <span class="geo-legend-label">{{ entry.label }}</span>
              </li>
            }
          </ul>
          @if (legend.units) {
            <p class="geo-legend-units">{{ units(legend.units) }}</p>
          }
          @if (legend.sourceNote) {
            <p class="geo-legend-source">{{ legend.sourceNote }}</p>
          }
        </details>
      }
      <ng-content select="[geoMapPanelFooter]" />
    }
  `,
})
export class MapLegend {
  /** Corner of the map; defaults to `ui.legend.placement`. */
  readonly placement = input<MapPlacement>()
  /** Standard or space-efficient rows; defaults to `ui.legend.layout`. */
  readonly layout = input<LegendPanelConfig['layout']>()
  /** Opens each layer's entries; defaults to `ui.legend.expanded`. */
  readonly expanded = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })

  protected readonly map = injectMapStatic()
  /** A static `role` or `aria-label` on the element replaces the default (while shown). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #legends = injectMapRuntime((map) => map.legends)
  protected readonly visible = computed(() => this.#legends().filter((legend) => legend.visible))
  protected readonly hidden = computed(() => !this.visible().length)
  protected readonly resolvedLayout = computed(() => this.layout() ?? this.map().ui.legend.layout)
  protected readonly hostClasses = computed(() =>
    this.hidden() ? {} : { 'geo-legend': true, [`geo-legend-${this.resolvedLayout()}`]: true },
  )
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeCard, { self: true }).hideWhen(() => this.hidden())
  }

  protected units(units: string): string {
    return formatMapMessage(this.map().messages.units, { units })
  }
}
