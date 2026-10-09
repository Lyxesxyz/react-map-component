import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { injectMapRuntime, injectMapStatic } from './map-context'
import { ShapeBadge } from './shapes'
import { optionalBooleanAttribute } from './signals'
import type { MapPlacement } from './types'

/**
 * Non-blocking status chips: loading, no data for the selected time, unavailable at scale.
 * Project `[geoMapLoading]` to replace the "Loading" chip, and `[geoMapEmpty]` for content shown
 * while the map has no layers:
 *
 * ```html
 * <geo-map-status-chips>
 *   <span geoShapeBadge geoMapLoading>Loading indicator statistics…</span>
 *   <p geoMapEmpty>Choose a dataset to start.</p>
 * </geo-map-status-chips>
 * ```
 */
@Component({
  selector: 'geo-map-status-chips',
  imports: [ShapeBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'geo-status-chips',
    'data-slot': 'map-status-chips',
    '[attr.data-placement]': 'placement() ?? map().ui.statusChips.placement',
  },
  template: `
    @let messages = map().messages;
    @if (loading() && (showLoading() ?? map().ui.statusChips.showLoading)) {
      <ng-content select="[geoMapLoading]"
        ><span geoShapeBadge>{{ messages.loading }}</span></ng-content
      >
    }
    @if (noData() && (showNoData() ?? map().ui.statusChips.showNoData)) {
      <span geoShapeBadge>{{ messages.noDataForTime }}</span>
    }
    @if (
      scaleUnavailable() && (showScaleUnavailable() ?? map().ui.statusChips.showScaleUnavailable)
    ) {
      <span geoShapeBadge>{{ messages.unavailableAtScale }}</span>
    }
    @if (!hasLayers()) {
      <ng-content select="[geoMapEmpty]" />
    }
  `,
})
export class MapStatusChips {
  /** Corner of the map; defaults to `ui.statusChips.placement`. */
  readonly placement = input<MapPlacement>()
  /** Shows in-progress layer loads; defaults to `ui.statusChips.showLoading`. */
  readonly showLoading = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Shows layers with no data for the current time; defaults to `ui.statusChips.showNoData`. */
  readonly showNoData = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /**
   * Shows layers outside their configured zoom range; defaults to
   * `ui.statusChips.showScaleUnavailable`.
   */
  readonly showScaleUnavailable = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })

  protected readonly map = injectMapStatic()
  readonly #statuses = injectMapRuntime((map) => map.statuses)
  protected readonly hasLayers = injectMapRuntime((map) => map.layers.length > 0)
  protected readonly loading = computed(() => this.#statuses().some((item) => item.loading))
  protected readonly noData = computed(() => this.#statuses().some((item) => item.noData))
  protected readonly scaleUnavailable = computed(() =>
    this.#statuses().some((item) => item.scaleUnavailable),
  )
}
