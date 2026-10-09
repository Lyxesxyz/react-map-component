// Example: your own layout from the parts, a custom popup and tooltip, a custom control, a legend
// footer, and a custom part that reads map state. Nothing here edits the component; parts take
// `class` and `placement`. Task: "change the popup / move the controls / add our own panel". See
// README.md → Build your own layout, and docs/state-events-templates.md.

import { ChangeDetectionStrategy, Component, Directive, computed } from '@angular/core'
import {
  MapAttribution,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapIconView,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapPopupTemplate,
  MapRoot,
  MapTooltip,
  MapTooltipTemplate,
  MapZoomInButton,
  MapZoomOutButton,
  ShapeButton,
  ShapeCard,
  defineMapConfig,
  injectMapActions,
  injectMapIcons,
  injectMapRuntime,
  type FeatureEvent,
} from '../index'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Regional statistics' },
  data: {
    layers: [
      {
        id: 'regions',
        title: 'Regions',
        data: { url: '/data/regions.geojson' },
        featureIdField: 'code',
      },
    ],
  },
})

/**
 * A custom part: any component inside <geo-map-root> can read the map through injectMapRuntime().
 * It places itself (absolute, in a corner the other parts leave free; unplaced, it would sit below
 * the map, hidden by the frame), and `geoShapeCard` gives it the surface of the map's panels.
 */
@Component({
  selector: 'app-selection-summary',
  imports: [ShapeCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <p geoShapeCard class="regions-summary">{{ summary() }}</p>
    }
  `,
  styles: `
    .regions-summary {
      position: absolute;
      top: var(--geo-inset);
      right: var(--geo-inset);
      margin: 0;
      padding: var(--geo-panel-padding);
    }
  `,
})
class SelectionSummary {
  // Each signal changes only when its piece of the map changes, not while the map moves.
  protected readonly ready = injectMapRuntime((map) => map.mapStatus === 'ready')
  readonly #selected = injectMapRuntime((map) => map.selectedFeature)
  protected readonly summary = computed(() => {
    const feature = this.#selected()
    return feature ? String(feature.properties['name']) : 'Select a region'
  })
}

/**
 * `<button geoMapControl appFitWorld label="…">`: a custom control. `geoMapControl` gives it the
 * rail's styling, type and label; this directive gives it the action.
 */
@Directive({ selector: 'button[appFitWorld]', host: { '(click)': 'fitWorld()' } })
class FitWorldButton {
  readonly #actions = injectMapActions() // stable; the button doesn't update when the map moves

  protected fitWorld(): void {
    this.#actions.fit([-180, -90, 180, 90])
  }
}

@Component({
  selector: 'app-regions-map',
  imports: [
    FitWorldButton,
    MapAttribution,
    MapControlButton,
    MapControlGroup,
    MapControls,
    MapIconView,
    MapLayerPanel,
    MapLayersButton,
    MapLegend,
    MapPopup,
    MapPopupTemplate,
    MapRoot,
    MapTooltip,
    MapTooltipTemplate,
    MapZoomInButton,
    MapZoomOutButton,
    SelectionSummary,
    ShapeButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map-root [config]="config" class="regions-map">
      <geo-map-controls placement="top-left">
        <geo-map-control-group>
          <button geoMapZoomIn></button>
          <button geoMapZoomOut></button>
        </geo-map-control-group>
        <geo-map-control-group>
          <button geoMapLayers></button>
          <button geoMapControl appFitWorld label="Whole world">
            <geo-map-icon [icon]="icons().Fit" />
          </button>
        </geo-map-control-group>
      </geo-map-controls>
      <geo-map-layer-panel placement="top-left" [allowReorder]="false" />
      <!-- bottom-left: the attribution takes bottom-right -->
      <geo-map-legend placement="bottom-left">
        <!-- Projected after the legends; [geoMapPanelHeader] would replace the heading. -->
        <p geoMapPanelFooter class="regions-source">Source: national statistics offices</p>
      </geo-map-legend>
      <geo-map-tooltip>
        <ng-template geoMapTooltip let-feature>{{ name(feature) }}</ng-template>
      </geo-map-tooltip>
      <geo-map-popup anchor="feature">
        <ng-template geoMapPopup let-feature let-close="close">
          <div class="regions-popup">
            <h2>{{ name(feature) }}</h2>
            <p>Population: {{ feature.properties['population'] ?? '—' }}</p>
            <button geoShapeButton (click)="close()">Close</button>
          </div>
        </ng-template>
      </geo-map-popup>
      <app-selection-summary />
      <geo-map-attribution compact />
    </geo-map-root>
  `,
})
export class RegionsMap {
  protected readonly config = config
  // Outside a map, injectMapIcons() returns the app's icons (icons.ts and provideMapIcons()),
  // which this map uses: it has no [icons]. Inside the map, a part gets the map's own set.
  protected readonly icons = injectMapIcons()

  protected name(feature: FeatureEvent): string {
    return String(feature.properties['name'] ?? feature.featureId)
  }
}
