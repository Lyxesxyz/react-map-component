import { NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core'
import type {
  MapConfigErrorContext,
  MapConfigValidator,
  MapIcons,
  MapOpenLayersHook,
  MapStateChangeEvent,
} from './component-types'
import { MAP_CONTEXT } from './map-context'
import { createMapEngine } from './map-engine'
import { MapConfigErrorTemplate } from './map-templates'
import { partHostStyle } from './signals'
import { mapThemeStyle } from './theme'
import type {
  FeatureEvent,
  GeoJsonLoader,
  LayerStateEvent,
  LayerStatus,
  MapActions,
  MapConfigInput,
  MapError,
  MapMetric,
  MapPanelId,
  MapState,
  MapViewState,
  TimeChangeEvent,
  ViewChangeEvent,
} from './types'

/**
 * The inputs and outputs `<geo-map-root>` and the `<geo-map>` preset share, and the map element
 * itself: the host carries the root's classes, `data-*` state and theme tokens. Not used on its
 * own.
 */
@Directive({
  host: {
    class: 'geo-map-root',
    'data-slot': 'map',
    '[attr.data-map-id]': 'engine.mapId()',
    '[attr.data-density]': 'engine.valid() ? (engine.theme()?.density ?? "comfortable") : null',
    '[attr.data-fill]': 'engine.valid() && fill() ? "" : null',
    '[attr.data-status]': 'engine.mapStatus()',
    '[attr.data-layer-errors]':
      'engine.valid() && engine.layerErrors() ? engine.layerErrors() : null',
    '[style]': 'hostStyle()',
  },
})
export abstract class MapRootBase {
  /** Map configuration: the short `MapConfigInput` form or a complete `MapConfig`. */
  readonly config = input.required<MapConfigInput>()
  /** Complete controlled state, with `(stateChange)` (or `[(state)]`); omit for map-owned state. */
  readonly state = input<MapState | undefined>(undefined)
  /** The open panel, when you control it (`[(openPanel)]`); omit to let the map keep it. */
  readonly openPanel = input<MapPanelId | null | undefined>(undefined)
  /** Fill the parent element's height instead of using `--geo-height`. */
  readonly fill = input(false, { transform: booleanAttribute })
  /**
   * Icons for this map, by role (`{ ZoomIn: Plus, Close: X }`); the rest come from `icons.ts`
   * and `provideMapIcons()`.
   */
  readonly icons = input<Partial<MapIcons> | undefined>(undefined)
  /** Custom loader for GeoJSON `data: { url }` layers (auth headers, credentials, caching). */
  readonly loadGeoJson = input<GeoJsonLoader | undefined>(undefined)
  /**
   * Receives the OpenLayers map once it exists, for integrations the configuration does not
   * cover (drawing, measuring, your own layers). Return a function to undo your changes; it
   * runs before the map is destroyed or recreated.
   */
  readonly onOpenLayersMap = input<MapOpenLayersHook | undefined>(undefined)

  /** Every proposed complete state (`[(state)]`). */
  readonly stateChange = output<MapState>()
  /** Every proposed complete state, with why it changed. */
  readonly stateChangeDetails = output<MapStateChangeEvent>()
  /** A control or a panel asks to open or close a panel (`[(openPanel)]`). */
  readonly openPanelChange = output<MapPanelId | null>()
  /** The OpenLayers renderer completed initialization. */
  readonly ready = output<MapViewState>()
  /** The visible view changed. */
  readonly viewChange = output<ViewChangeEvent>()
  /** The feature under the pointer changed. */
  readonly featureHover = output<FeatureEvent | null>()
  /** A selectable feature was selected or the selection cleared. */
  readonly featureSelect = output<FeatureEvent | null>()
  /** Visibility, opacity or order of a layer changed. */
  readonly layerStateChange = output<LayerStateEvent>()
  /** The selected time changed. */
  readonly timeChange = output<TimeChangeEvent>()
  /** Configuration, source, rendering and export failures (React's `onError`). */
  readonly mapError = output<MapError>()
  /** Aggregate layer loading and availability changed. */
  readonly statusChange = output<LayerStatus[]>()
  /** Renderer timing measurements. */
  readonly metric = output<MapMetric>()

  /** The OpenLayers target, while the configuration is valid. */
  protected readonly viewportRef = viewChild<ElementRef<HTMLDivElement>>('viewport')
  protected readonly engine = createMapEngine({
    config: this.config,
    state: this.state,
    openPanel: this.openPanel,
    fill: this.fill,
    icons: this.icons,
    loadGeoJson: this.loadGeoJson,
    onOpenLayersMap: this.onOpenLayersMap,
    validate: () => this.configValidator(),
    viewport: computed(() => this.viewportRef()?.nativeElement),
    root: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
    outputs: {
      onStateChange: (state, change) => {
        this.stateChange.emit(state)
        this.stateChangeDetails.emit({ state, change })
      },
      onOpenPanelChange: (panel) => this.openPanelChange.emit(panel),
      onReady: (view) => this.ready.emit(view),
      onViewChange: (event) => this.viewChange.emit(event),
      onFeatureHover: (event) => this.featureHover.emit(event),
      onFeatureSelect: (event) => this.featureSelect.emit(event),
      onLayerStateChange: (event) => this.layerStateChange.emit(event),
      onTimeChange: (event) => this.timeChange.emit(event),
      onError: (error) => this.mapError.emit(error),
      onStatusChange: (statuses) => this.statusChange.emit(statuses),
      onMetric: (metric) => this.metric.emit(metric),
    },
  })

  /**
   * Every map action (`fit`, `select`, `exportImage`, `getState`, …), stable for the life of the
   * map: `<geo-map #map="geoMap">` then `map.actions.fit(…)`, or `viewChild.required(GeospatialMap).actions`.
   */
  readonly actions: MapActions = this.engine.actions
  /** What the parts inject as MAP_CONTEXT (through `injectMapStatic()` and the others). */
  readonly mapContext = this.engine.context

  /** Theme tokens, then the consumer's static `style` (which wins), as in React. */
  protected readonly hostStyle = partHostStyle(
    () => false,
    () => mapThemeStyle(this.engine.theme()),
  )
  protected readonly valid = this.engine.valid
  protected readonly liveMessage = this.engine.liveMessage
  protected readonly messages = this.engine.messages

  /** Extra semantic checks; `<geo-map-root>` takes them as its `validate` input. */
  protected configValidator(): MapConfigValidator | undefined {
    return undefined
  }
}

/**
 * The map frame. Renders the OpenLayers viewport and provides the map to the parts inside it,
 * so you can compose exactly the controls and panels you need:
 *
 * ```html
 * <geo-map-root [config]="config" #map="geoMap">
 *   <geo-map-controls />
 *   <geo-map-legend />
 * </geo-map-root>
 * ```
 *
 * `map.actions` gives the map's actions (`fit`, `exportImage`, `getState`, …). An invalid
 * configuration shows an accessible error panel; `<ng-template geoMapConfigError let-error>`
 * replaces its content.
 */
@Component({
  selector: 'geo-map-root',
  exportAs: 'geoMap',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAP_CONTEXT, useFactory: () => inject(MapRoot).mapContext }],
  template: `
    @if (valid()) {
      <div class="geo-map-stage" data-slot="map-stage">
        <div #viewport class="geo-map-viewport" data-slot="map-viewport"></div>
        <ng-content />
      </div>
      <span class="geo-sr-only" aria-live="polite">{{ liveMessage() }}</span>
    } @else {
      <div class="geo-config-error" data-slot="map-config-error" role="alert">
        @if (configErrorContext(); as context) {
          @if (configErrorTemplate(); as custom) {
            <ng-container *ngTemplateOutlet="custom.template; context: context" />
          } @else {
            <h2 class="geo-config-error-title">{{ messages().invalidConfiguration }}</h2>
            <p class="geo-config-error-message">{{ context.error.message }}</p>
          }
        }
      </div>
    }
  `,
})
export class MapRoot extends MapRootBase {
  /** Extra semantic checks; any issue renders the configuration-error panel. */
  readonly validate = input<MapConfigValidator | undefined>(undefined)

  protected readonly configErrorTemplate = contentChild(MapConfigErrorTemplate)
  protected readonly configErrorContext = computed<MapConfigErrorContext | null>(() => {
    const error = this.engine.configError()
    if (!error) return null
    return { $implicit: error, error, state: this.engine.runtime().state, actions: this.actions }
  })

  protected override configValidator(): MapConfigValidator | undefined {
    return this.validate()
  }
}
