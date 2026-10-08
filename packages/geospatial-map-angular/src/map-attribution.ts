import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { injectMapRuntime, injectMapStatic } from './map-context'
import { formatMapMessage } from './messages'
import { injectHostAttribute, optionalBooleanAttribute, partHostStyle } from './signals'
import type { MapPlacement } from './types'

type AttributionItem = {
  /** `' · '` between items. */
  prefix: string
  label: string
  url: string | undefined
  /** Version, authority, date, official status and restrictions. */
  suffix: string
}

/**
 * Source attribution for the active basemap and layers. Keep it visible when sources require
 * it. Hidden (with no classes or ARIA) while there is nothing to attribute.
 */
@Component({
  selector: 'geo-map-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.geo-attribution]': '!hidden()',
    '[class.geo-attribution-compact]': '!hidden() && isCompact()',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "group")',
    '[attr.data-slot]': 'hidden() ? null : "map-attribution"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.attribution.placement)',
    '[attr.data-compact]': '!hidden() && isCompact() ? "" : null',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? map().messages.attribution)',
    '[style]': 'hostStyle()',
  },
  template: `
    @for (item of items(); track $index) {
      @if (item.url) {
        <span class="geo-attribution-item"
          >{{ item.prefix
          }}<a class="geo-attribution-link" [href]="item.url" target="_blank" rel="noreferrer">{{
            item.label
          }}</a
          >{{ item.suffix }}</span
        >
      } @else {
        <span class="geo-attribution-item">{{ item.prefix + item.label + item.suffix }}</span>
      }
    }
  `,
})
export class MapAttribution {
  /** Corner of the map; defaults to `ui.attribution.placement`. */
  readonly placement = input<MapPlacement>()
  /** Smaller single-line presentation; defaults to `ui.attribution.compact`. */
  readonly compact = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })

  protected readonly map = injectMapStatic()
  /** A static `role` or `aria-label` on the element replaces the default (while shown). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #attributions = injectMapRuntime((map) => map.attributions)
  protected readonly hidden = computed(() => !this.#attributions().length)
  protected readonly isCompact = computed(() => this.compact() ?? this.map().ui.attribution.compact)
  protected readonly hostStyle = partHostStyle(() => this.hidden())
  protected readonly items = computed<AttributionItem[]>(() => {
    const { messages } = this.map()
    return this.#attributions().map((item, index) => ({
      prefix: index > 0 ? ' · ' : '',
      label: item.label,
      url: item.url,
      suffix:
        (item.version ? ` ${item.version}` : '') +
        (item.authority ? ` · ${item.authority}` : '') +
        (item.publishedAt
          ? ` · ${formatMapMessage(messages.publishedOn, { date: item.publishedAt })}`
          : '') +
        (item.official === false ? ` ${messages.nonOfficial}` : '') +
        (item.usageRestrictions ? ` · ${item.usageRestrictions}` : ''),
    }))
  })
}
