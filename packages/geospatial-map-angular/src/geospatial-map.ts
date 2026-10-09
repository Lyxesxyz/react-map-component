import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  inject,
} from '@angular/core'
import type { CustomControls } from './component-types'
import { MapAttribution } from './map-attribution'
import { MapBreadcrumbs } from './map-breadcrumbs'
import { MAP_CONTEXT } from './map-context'
import { MapControls } from './map-controls'
import { MapDisclaimer } from './map-disclaimer'
import { MapErrorAlert } from './map-error-alert'
import { MapLayerPanel } from './map-layer-panel'
import { MapLegend } from './map-legend'
import { MapPopup } from './map-popup'
import { MapRootBase } from './map-root'
import { MapSettings } from './map-settings'
import { MapStatusChips } from './map-status-chips'
import { MapTimeControls } from './map-time-controls'
import { MapControlTemplate, MapPopupTemplate, MapTooltipTemplate } from './map-templates'
import { MapTooltip } from './map-tooltip'

/**
 * The complete map UI, laid out from `config.ui` (profiles, placements, enabled parts). Put
 * `<ng-template geoMapPopup>`, `geoMapTooltip` and `geoMapControl="custom:…"` inside it for
 * the popup, tooltip and custom controls, and your own parts after them; or build a custom
 * layout with `<geo-map-root>` and the parts.
 *
 * ```html
 * <geo-map [config]="config" fill (featureSelect)="selected.set($event)">
 *   <ng-template geoMapPopup let-feature let-close="close">…</ng-template>
 * </geo-map>
 * ```
 */
@Component({
  selector: 'geo-map',
  exportAs: 'geoMap',
  imports: [
    MapAttribution,
    MapBreadcrumbs,
    MapControls,
    MapDisclaimer,
    MapErrorAlert,
    MapLayerPanel,
    MapLegend,
    MapPopup,
    MapSettings,
    MapStatusChips,
    MapTimeControls,
    MapTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAP_CONTEXT, useFactory: () => inject(GeospatialMap).mapContext }],
  // The preset's parts, in drawing order (React's GeospatialMapLayout), each enabled by
  // `config.ui`.
  template: `
    @if (valid()) {
      <div class="geo-map-stage" data-slot="map-stage">
        <div #viewport class="geo-map-viewport" data-slot="map-viewport"></div>
        @let ui = map().ui;
        @if (ui.controls.enabled) {
          <geo-map-controls [customControls]="customControls()" />
        }
        @if (ui.settings.enabled) {
          <geo-map-settings />
        }
        @if (ui.breadcrumbs.enabled) {
          <geo-map-breadcrumbs />
        }
        @if (ui.layerPanel.enabled) {
          <geo-map-layer-panel />
        }
        @if (ui.legend.enabled) {
          <geo-map-legend />
        }
        @if (ui.popup.enabled) {
          <geo-map-popup [template]="popupTemplate()?.template" />
        }
        @if (ui.tooltip.enabled) {
          <geo-map-tooltip [template]="tooltipTemplate()?.template" />
        }
        @if (ui.disclaimer.enabled) {
          <geo-map-disclaimer />
        }
        @if (ui.statusChips.enabled) {
          <geo-map-status-chips />
        }
        @if (ui.time.enabled) {
          <geo-map-time-controls />
        }
        @if (ui.errorAlert.enabled) {
          <geo-map-error-alert />
        }
        @if (ui.attribution.enabled) {
          <geo-map-attribution />
        }
        <ng-content />
      </div>
      <span class="geo-sr-only" aria-live="polite">{{ liveMessage() }}</span>
    } @else {
      <div class="geo-config-error" data-slot="map-config-error" role="alert">
        @if (engine.configError(); as error) {
          <h2 class="geo-config-error-title">{{ messages().invalidConfiguration }}</h2>
          <p class="geo-config-error-message">{{ error.message }}</p>
        }
      </div>
    }
  `,
})
export class GeospatialMap extends MapRootBase {
  protected readonly map = this.engine.staticValue
  protected readonly popupTemplate = contentChild(MapPopupTemplate, { descendants: false })
  protected readonly tooltipTemplate = contentChild(MapTooltipTemplate, { descendants: false })
  private readonly controlTemplates = contentChildren(MapControlTemplate)
  protected readonly customControls = computed(() => {
    const templates: CustomControls = {}
    for (const item of this.controlTemplates()) templates[item.id()] = item.template
    return templates
  })
}
