import { NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  input,
  output,
} from '@angular/core'
import type { MapGridEvent, MapGridStateChangeEvent, MapIcons } from './component-types'
import { normalizeMapConfig } from './config/normalize'
import { GeospatialMap } from './geospatial-map'
import { MapControlTemplate, MapPopupTemplate, MapTooltipTemplate } from './map-templates'
import { formatMapMessage, resolveMapMessages } from './messages'
import { ShapeButton } from './shapes'
import { controllableSignal, injectHostAttribute, partHostStyle } from './signals'
import type { StyleMap } from './signals'
import type {
  FeatureEvent,
  LayerStateEvent,
  LayerStatus,
  MapConfigInput,
  MapError,
  MapGridConfig,
  MapGridItem,
  MapGridState,
  MapMetric,
  MapState,
  MapStateChange,
  MapViewState,
  TimeChangeEvent,
  ViewChangeEvent,
} from './types'
import { cn, fingerprint } from './utils'

const MAX_MAPS = 6

/** The configuration of one cell: the shared one, with the cell's id, title, state and layers. */
function cellConfig(config: MapGridConfig, item: MapGridItem, focused: boolean): MapConfigInput {
  const { shared } = config
  return {
    ...shared,
    id: item.id,
    accessibility: {
      ...shared.accessibility,
      ariaLabel: `${shared.accessibility.ariaLabel}: ${item.title}`,
    },
    initialState: {
      ...shared.initialState,
      ...item.initialState,
      view: { ...shared.initialState?.view, ...item.initialState?.view },
    },
    data: { ...shared.data, layers: item.layers ?? shared.data.layers },
    // Unfocused cells show the compact grid UI, keeping your other `ui` settings.
    ui: focused ? (shared.ui ?? {}) : { ...shared.ui, profile: 'grid' },
  }
}

/** A change in one map applied to another, for the domains the grid synchronises. */
function synced(
  config: MapGridConfig,
  change: MapStateChange,
  source: MapState,
  target: MapState,
): MapState {
  const sync = config.sync ?? {}
  if (change.domain === 'view' && sync.view) return { ...target, view: source.view }
  if (change.domain === 'layers' && sync.layers) return { ...target, layers: source.layers }
  if (change.domain === 'time' && sync.time) return { ...target, time: source.time }
  if (change.domain === 'selection' && sync.selection)
    return { ...target, selection: source.selection }
  return target
}

/** Two grid configurations with the same content (one rebuilt inline, for example). */
const sameContent = (left: MapGridConfig, right: MapGridConfig) =>
  left === right || fingerprint(left) === fingerprint(right)

/** One cell on screen: its map, whether it is focused, its configuration and its button's text. */
type GridCell = {
  item: MapGridItem
  focused: boolean
  config: MapConfigInput
  focusLabel: string
}

/**
 * Up to six maps side by side, optionally synchronised, each of which can be focused. The
 * `geoMapPopup`, `geoMapTooltip` and `geoMapControl` templates inside it go to every map, and
 * each per-map output carries the id of the map it came from (`$event.mapId`).
 *
 * ```html
 * <geo-map-grid [config]="grid" [(state)]="gridState" (featureSelect)="select($event)">
 *   <ng-template geoMapPopup let-feature>{{ feature.featureId }}</ng-template>
 * </geo-map-grid>
 * ```
 */
@Component({
  selector: 'geo-map-grid',
  imports: [
    GeospatialMap,
    MapControlTemplate,
    MapPopupTemplate,
    MapTooltipTemplate,
    NgTemplateOutlet,
    ShapeButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // The host is the grid; with more than six maps, it is the error message instead.
    '[class]': 'hostClasses()',
    '[attr.data-slot]': 'tooManyMaps() ? "map-grid-error" : "map-grid"',
    '[attr.data-focused]': '!tooManyMaps() && focusedMapId() ? "" : null',
    // The error is always an alert, as React's error <div>; the grid keeps a consumer's role.
    '[attr.role]': 'tooManyMaps() ? "alert" : consumerRole',
    '[style]': 'hostStyle()',
  },
  // The templates given to the grid are forwarded to each map as templates of its own, which
  // render them with the same context.
  template: `
    @if (tooManyMaps()) {
      <ng-container>{{ messages().tooManyGridMaps }}</ng-container>
    } @else {
      @for (cell of cells(); track cell.item.id) {
        <article data-slot="map-grid-cell" [class]="cellClass()">
          <header class="geo-map-grid-cell-header">
            <h2 class="geo-map-grid-cell-title">{{ cell.item.title }}</h2>
            @if (focusEnabled()) {
              <button
                geoShapeButton
                [textContent]="cell.focusLabel"
                (click)="toggleFocus(cell.item.id)"
              ></button>
            }
          </header>
          <geo-map
            [config]="cell.config"
            [state]="mapState(cell.item.id)"
            [icons]="icons()"
            (stateChangeDetails)="update(cell.item.id, $event.state, $event.change)"
            (ready)="ready.emit({ mapId: cell.item.id, event: $event })"
            (viewChange)="viewChange.emit({ mapId: cell.item.id, event: $event })"
            (featureHover)="featureHover.emit({ mapId: cell.item.id, event: $event })"
            (featureSelect)="featureSelect.emit({ mapId: cell.item.id, event: $event })"
            (layerStateChange)="layerStateChange.emit({ mapId: cell.item.id, event: $event })"
            (timeChange)="timeChange.emit({ mapId: cell.item.id, event: $event })"
            (mapError)="mapError.emit({ mapId: cell.item.id, event: $event })"
            (statusChange)="statusChange.emit({ mapId: cell.item.id, event: $event })"
            (metric)="metric.emit({ mapId: cell.item.id, event: $event })"
          >
            @if (popupTemplate(); as popup) {
              <ng-template
                geoMapPopup
                let-feature
                let-close="close"
                let-state="state"
                let-actions="actions"
              >
                <ng-container
                  *ngTemplateOutlet="
                    popup.template;
                    context: {
                      $implicit: feature,
                      feature: feature,
                      close: close,
                      state: state,
                      actions: actions,
                    }
                  "
                />
              </ng-template>
            }
            @if (tooltipTemplate(); as tooltip) {
              <ng-template geoMapTooltip let-feature>
                <ng-container
                  *ngTemplateOutlet="
                    tooltip.template;
                    context: { $implicit: feature, feature: feature }
                  "
                />
              </ng-template>
            }
            @for (control of controlTemplates(); track control.id()) {
              <ng-template [geoMapControl]="control.id()" let-state let-actions="actions">
                <ng-container
                  *ngTemplateOutlet="
                    control.template;
                    context: { $implicit: state, state: state, actions: actions }
                  "
                />
              </ng-template>
            }
          </geo-map>
        </article>
      }
    }
  `,
})
export class MapGrid {
  /** Grid configuration. */
  readonly config = input.required<MapGridConfig>()
  /** Complete controlled grid state, with `(stateChange)` (`[(state)]`); omit for grid-owned state. */
  readonly state = input<MapGridState | undefined>(undefined)
  /** Optional class applied to every grid cell. */
  readonly cellClassName = input<string | undefined>(undefined)
  /** Icons for every map cell, by role; the rest come from `icons.ts` and `provideMapIcons()`. */
  readonly icons = input<Partial<MapIcons> | undefined>(undefined)

  /** The complete grid state after any change (`[(state)]`). */
  readonly stateChange = output<MapGridState>()
  /**
   * The complete grid state after any change, with the map that changed and its change; after a
   * focus change, `mapId` is `null` and there is no `change`.
   */
  readonly stateChangeDetails = output<MapGridStateChangeEvent>()
  /** A map's renderer completed initialization. */
  readonly ready = output<MapGridEvent<MapViewState>>()
  /** A map's visible view changed. */
  readonly viewChange = output<MapGridEvent<ViewChangeEvent>>()
  /** The feature under the pointer changed in a map. */
  readonly featureHover = output<MapGridEvent<FeatureEvent | null>>()
  /** A selectable feature was selected, or the selection cleared, in a map. */
  readonly featureSelect = output<MapGridEvent<FeatureEvent | null>>()
  /** Visibility, opacity or order of a layer changed in a map. */
  readonly layerStateChange = output<MapGridEvent<LayerStateEvent>>()
  /** A map's selected time changed. */
  readonly timeChange = output<MapGridEvent<TimeChangeEvent>>()
  /** Configuration, source, rendering and export failures of a map (React's `onError`). */
  readonly mapError = output<MapGridEvent<MapError>>()
  /** A map's aggregate layer loading and availability changed. */
  readonly statusChange = output<MapGridEvent<LayerStatus[]>>()
  /** A map's renderer timing measurements. */
  readonly metric = output<MapGridEvent<MapMetric>>()

  /** A static `role` on the element is kept on the grid (the error message is always an alert). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly popupTemplate = contentChild(MapPopupTemplate, { descendants: false })
  protected readonly tooltipTemplate = contentChild(MapTooltipTemplate, { descendants: false })
  protected readonly controlTemplates = contentChildren(MapControlTemplate)

  // A config rebuilt with the same content (written inline in a template) keeps the first
  // object, so the maps keep their state; a changed grid configuration starts them over.
  protected readonly grid = computed(() => this.config(), { equal: sameContent })
  /** Each map starts from its configuration. */
  readonly #initial = computed<MapGridState>(() => {
    const config = this.grid()
    return {
      maps: Object.fromEntries(
        config.maps.map((item) => [
          item.id,
          normalizeMapConfig(cellConfig(config, item, false)).initialState,
        ]),
      ),
      focusedMapId: null,
    }
  })
  readonly #state = controllableSignal({
    value: () => this.state(),
    initial: () => this.#initial(),
    resetKey: () => fingerprint(this.grid()),
  })
  protected readonly current = this.#state.value
  protected readonly focusedMapId = computed(() => this.current().focusedMapId)
  protected readonly messages = computed(() => resolveMapMessages(this.grid().shared.messages))
  protected readonly tooManyMaps = computed(() => this.grid().maps.length > MAX_MAPS)
  protected readonly focusEnabled = computed(() => this.grid().focus?.enabled !== false)
  protected readonly cellClass = computed(() => cn('geo-map-grid-cell', this.cellClassName()))
  protected readonly cells = computed<GridCell[]>(() => {
    const config = this.grid()
    const focusedMapId = this.focusedMapId()
    const messages = this.messages()
    return config.maps
      .filter((item) => focusedMapId === null || focusedMapId === item.id)
      .map((item) => {
        const focused = focusedMapId === item.id
        return {
          item,
          focused,
          config: cellConfig(config, item, focused),
          focusLabel: focused
            ? messages.returnToGrid
            : formatMapMessage(messages.focusMap, { title: item.title }),
        }
      })
  })
  protected readonly hostClasses = computed(() => {
    const error = this.tooManyMaps()
    return {
      'geo-map-grid': !error,
      'geo-map-grid-focused': !error && Boolean(this.focusedMapId()),
      'geo-config-error': error,
    }
  })
  protected readonly hostStyle = partHostStyle(
    () => false,
    (): StyleMap => {
      // The error message is a block, like the React grid's error element.
      if (this.tooManyMaps()) return { display: 'block' }
      const layout = this.grid().layout
      return {
        '--geo-grid-columns': String(layout?.columns ?? 3),
        '--geo-grid-tablet-columns': String(layout?.tabletColumns ?? 2),
        '--geo-grid-mobile-columns': String(layout?.mobileColumns ?? 1),
        '--geo-grid-gap': `${layout?.gapPx ?? 12}px`,
        '--geo-grid-cell-height': `${layout?.cellHeightPx ?? 340}px`,
      }
    },
  )

  /** The state of a map: the grid's, or its starting state while the grid has none (a new map). */
  protected mapState(id: string): MapState {
    return this.current().maps[id] ?? this.#initial().maps[id]!
  }

  /**
   * A map's new state, and the others' with what the grid synchronises. Changes a map made to
   * follow the grid (`origin: 'state'`) are not passed on, so they don't echo back.
   */
  protected update(mapId: string, next: MapState, change: MapStateChange): void {
    const config = this.grid()
    this.#commit(
      {
        ...this.current(),
        maps: Object.fromEntries(
          config.maps.map(({ id }) => [
            id,
            id === mapId
              ? next
              : change.origin === 'state'
                ? this.mapState(id)
                : synced(config, change, next, this.mapState(id)),
          ]),
        ),
      },
      mapId,
      change,
    )
  }

  protected toggleFocus(id: string): void {
    const current = this.current()
    this.#commit({ ...current, focusedMapId: current.focusedMapId === id ? null : id }, null)
  }

  /** Applies `next` to the grid state (owned or controlled) and reports it. */
  #commit(next: MapGridState, mapId: string | null, change?: MapStateChange): void {
    this.#state.set(next)
    this.stateChange.emit(next)
    this.stateChangeDetails.emit(change ? { state: next, mapId, change } : { state: next, mapId })
  }
}
