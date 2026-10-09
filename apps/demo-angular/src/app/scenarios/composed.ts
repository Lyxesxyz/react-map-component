import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core'
import {
  MapAttribution,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapFitButton,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapPopupTemplate,
  MapRoot,
  MapSettings,
  MapSettingsButton,
  MapZoomInButton,
  MapZoomOutButton,
  injectMapActions,
  injectMapRuntime,
  type MapActions,
  type MapConfig,
} from '@/components/geospatial-map'
import {
  composedPopupValue,
  featureTitle,
  selectionBadgeText,
  worldBounds,
  type HarnessCallbacks,
} from '@demo-shared/src/fixtures'

// A hand-composed map: the same parts the <geo-map> preset uses, arranged and styled by the
// host. Styling comes only from the harness stylesheet, apps/demo-shared/styles/app.css (tokens
// and classes); nothing in the component folder is edited.

/**
 * `<button geoMapControl appFitWorld>`: a custom control. It fits the world through
 * injectMapActions(); `geoMapControl` gives it the rail's button styling, label and type.
 */
@Directive({
  selector: 'button[appFitWorld]',
  host: { '(click)': 'fitWorld()' },
})
export class FitWorldButton {
  readonly #actions = injectMapActions()

  protected fitWorld(): void {
    this.#actions.fit(worldBounds)
  }
}

/**
 * A custom part: reads map state through injectMapRuntime() and renders anywhere inside the map.
 * On the `<p>` itself (an attribute selector), so the DOM is the React part's.
 */
@Component({
  selector: 'p[appSelectionBadge]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'demo-selection-badge', 'data-slot': 'demo-selection-badge' },
  template: '{{ text() }}',
})
export class SelectionBadge {
  readonly #selectedFeature = injectMapRuntime((map) => map.selectedFeature)
  protected readonly text = computed(() => selectionBadgeText(this.#selectedFeature()))
}

@Component({
  selector: 'app-composed',
  imports: [
    FitWorldButton,
    MapAttribution,
    MapControlButton,
    MapControlGroup,
    MapControls,
    MapFitButton,
    MapLayerPanel,
    MapLayersButton,
    MapLegend,
    MapPopup,
    MapPopupTemplate,
    MapRoot,
    MapSettings,
    MapSettingsButton,
    MapZoomInButton,
    MapZoomOutButton,
    SelectionBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-composed-toolbar" role="group" aria-label="Styling playground">
      <label>
        <input
          #brandBox
          type="checkbox"
          [checked]="brand()"
          (change)="brand.set(brandBox.checked)"
        />
        Brand tokens
      </label>
      <label>
        <input #darkBox type="checkbox" [checked]="dark()" (change)="dark.set(darkBox.checked)" />
        Dark mode
      </label>
    </div>
    <div class="demo-composed" [class.dark]="dark()">
      <geo-map-root
        class="demo-composed-map"
        [class.demo-brand]="brand()"
        [config]="config()"
        (featureSelect)="callbacks().onFeatureSelect($event)"
        (viewChange)="callbacks().onViewChange($event)"
        (layerStateChange)="callbacks().onLayerStateChange($event)"
        (timeChange)="callbacks().onTimeChange($event)"
        (metric)="callbacks().onMetric($event)"
        (mapError)="callbacks().onError($event)"
      >
        <geo-map-controls placement="top-left">
          <geo-map-control-group>
            <button geoMapZoomIn></button>
            <button geoMapZoomOut></button>
          </geo-map-control-group>
          <geo-map-control-group>
            <button geoMapLayers></button>
            <button geoMapSettings></button>
            <button geoMapFit fitTarget="data" label="Fit data"></button>
            <button geoMapControl appFitWorld label="Fit world">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
              </svg>
            </button>
          </geo-map-control-group>
        </geo-map-controls>
        <geo-map-settings placement="top-left" />
        <geo-map-layer-panel placement="top-left" [allowReorder]="false" />
        <geo-map-legend placement="top-right" class="demo-legend-card">
          <h2 geoMapPanelHeader class="demo-legend-heading">Legend</h2>
        </geo-map-legend>
        <geo-map-popup placement="bottom-right">
          <ng-template geoMapPopup let-feature let-close="close">
            <div class="demo-popup">
              <h2>{{ featureTitle(feature) }}</h2>
              <p class="demo-statistic">{{ composedPopupValue(feature) }}</p>
              <!-- No type, as in the React demo: the DOM parity check compares it. -->
              <!-- eslint-disable-next-line @angular-eslint/template/button-has-type -->
              <button class="demo-link-button" (click)="close()">Done</button>
            </div>
          </ng-template>
        </geo-map-popup>
        <p appSelectionBadge></p>
        <geo-map-attribution compact />
      </geo-map-root>
    </div>
  `,
})
export class ComposedScenario {
  /** The harness configuration (the main map's, for `?scenario=composed`). */
  readonly config = input.required<MapConfig>()
  /** The harness's event log callbacks, as React spreads them on `<MapRoot>`. */
  readonly callbacks = input.required<HarnessCallbacks>()

  protected readonly brand = signal(true)
  protected readonly dark = signal(false)
  private readonly root = viewChild.required(MapRoot)

  /** The composed map's actions, for the harness's integration inspector (React's `ref`). */
  get actions(): MapActions {
    return this.root().actions
  }

  protected readonly featureTitle = featureTitle
  protected readonly composedPopupValue = composedPopupValue
}
