import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core'
import {
  GeospatialMap,
  MapControls,
  MapGrid,
  MapLayerPanel,
  MapPopup,
  MapRoot,
  type MapActions,
  type MapError,
  type MapGridState,
  type MapOpenLayersHook,
  type MapPanelId,
  type MapState,
  type MapStateChangeEvent,
  type MapViewState,
} from '@/components/geospatial-map'
import {
  brazilFeatureId,
  checksConfig,
  createChecksGridConfig,
  createMoreChecksConfig,
  hideCountries,
  moreChecksHeight,
  selectCountry,
} from '@demo-shared/src/fixtures'
import { parseHarnessParams } from '@demo-shared/src/scenarios'

// Behaviour the browser tests check directly: a selection set by the host opens and closes the
// popup, errors reach `(mapError)` with their code, and a synchronised grid reports its state.
// The configurations and state changes are in apps/demo-shared/src/fixtures.ts; the maps'
// actions go on `window.geoChecks` and `window.geoMoreChecks` for the tests. Both hosts have
// `display: contents`, so the toolbars and maps sit in the harness section as in React (where
// the scenario is a fragment).

/** Puts a map's actions on `window` once rendered, and takes them off when the map goes. */
function exposeActions(key: 'geoChecks' | 'geoMoreChecks', actions: () => MapActions): void {
  let exposed: MapActions | undefined
  afterNextRender(() => {
    exposed = actions()
    window[key] = exposed
  })
  inject(DestroyRef).onDestroy(() => {
    if (exposed && window[key] === exposed) window[key] = null
  })
}

/**
 * A second map for 0.9.0 checks: the open panel controlled by the host, the popup element, a
 * host that rejects selections, a timed heatmap, "fit data", and a configuration change that
 * makes the map wait for its world fit for a moment without rebuilding it.
 */
@Component({
  selector: 'app-more-checks',
  imports: [MapControls, MapLayerPanel, MapPopup, MapRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  // The label's text is split into the same text nodes as in React (`{' '}` is `{{ ' ' }}`).
  template: `
    <div class="demo-composed-toolbar" role="group" aria-label="More checks">
      <button type="button" (click)="toggleBasemaps()">Change basemaps</button>
      <label
        ><input
          #lockBox
          type="checkbox"
          [checked]="lockSelection()"
          (change)="lockSelection.set(lockBox.checked)"
        />{{ ' ' }}<ng-container>Lock selection</ng-container></label
      >
      <button type="button" (click)="openPanel.set('layers')">Open layers from the host</button>
      <button type="button" (click)="fitData()">Fit data from the host</button>
      <button type="button" (click)="readPopupRef()">Read popup ref</button>
      <output data-testid="open-panel">{{ openPanel() ?? 'none' }}</output>
      <output data-testid="hook-calls">{{ hookCalls() }}</output>
      <output data-testid="popup-ref">{{ popupTag() }}</output>
      <output data-testid="more-selection">{{ selectedId() }}</output>
    </div>
    <geo-map-root
      [config]="config()"
      [style.--geo-height]="moreChecksHeight"
      [openPanel]="openPanel()"
      (openPanelChange)="openPanel.set($event)"
      [state]="state()"
      (stateChangeDetails)="stateChanged($event)"
      (ready)="ready($event)"
      [onOpenLayersMap]="countHookCall"
    >
      <geo-map-controls />
      <geo-map-layer-panel />
      <geo-map-popup />
    </geo-map-root>
  `,
})
export class MoreChecks {
  protected readonly openPanel = signal<MapPanelId | null>(null)
  protected readonly lockSelection = signal(false)
  protected readonly withPlain = signal(false)
  /** Map-owned until the map is ready, then held by the host. */
  protected readonly state = signal<MapState | undefined>(undefined)
  protected readonly hookCalls = signal(0)
  protected readonly popupTag = signal('')
  protected readonly selectedId = computed(() => this.state()?.selection?.featureId ?? 'none')
  protected readonly config = computed(() => createMoreChecksConfig(this.withPlain()))
  protected readonly moreChecksHeight = moreChecksHeight

  private readonly root = viewChild.required(MapRoot)
  /** The popup's element (React's `ref` on `<MapPopup>`). */
  private readonly popup = viewChild.required<MapPopup, ElementRef<HTMLElement>>(MapPopup, {
    read: ElementRef,
  })

  constructor() {
    exposeActions('geoMoreChecks', () => this.root().actions)
  }

  /** Counts the OpenLayers maps created: a configuration change must not create another. */
  protected readonly countHookCall: MapOpenLayersHook = () => {
    this.hookCalls.update((count) => count + 1)
  }

  protected toggleBasemaps(): void {
    this.withPlain.update((current) => !current)
  }

  protected fitData(): void {
    this.root().actions.fitContent('data')
  }

  /** The popup's `data-slot` while it is open; its hidden host has none (React has no element). */
  protected readPopupRef(): void {
    this.popupTag.set(this.popup().nativeElement.dataset['slot'] ?? 'null')
  }

  protected stateChanged({ state, change }: MapStateChangeEvent): void {
    // A host that keeps the selection it has: the map is set back to it.
    if (this.lockSelection() && change.domain === 'selection') return
    this.state.set(state)
  }

  protected ready(view: MapViewState): void {
    this.state.update((current) => current ?? { ...this.config().initialState, view })
  }
}

@Component({
  selector: 'app-checks',
  imports: [GeospatialMap, MapGrid, MoreChecks],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <div class="demo-composed-toolbar" role="group" aria-label="Checks">
      <button type="button" (click)="select(brazilFeatureId)">Select Brazil</button>
      <button type="button" (click)="select(null)">Clear selection</button>
      <button type="button" (click)="state.update(hideCountries)">Hide countries</button>
      <button type="button" (click)="downloadPng()">Download PNG</button>
      <output data-testid="selection">{{ selectedId() }}</output>
      <output data-testid="errors">{{ errorText() }}</output>
      <output data-testid="grid-focus">{{ gridFocus() }}</output>
      <button type="button" (click)="toggleThirdMap()">{{ gridMapLabel() }}</button>
      <output data-testid="grid-changes">{{ gridChanges() }}</output>
      <output data-testid="grid-maps">{{ gridMaps() }}</output>
    </div>
    <geo-map
      [config]="config"
      [state]="state()"
      (stateChange)="state.set($event)"
      (mapError)="addError($event)"
      [onOpenLayersMap]="hostHook"
    />
    <geo-map-grid [config]="gridConfig()" (stateChange)="gridChanged($event)" />
    <app-more-checks />
  `,
})
export class ChecksScenario {
  protected readonly config = checksConfig
  protected readonly state = signal<MapState>(checksConfig.initialState)
  protected readonly errors = signal<string[]>([])
  protected readonly grid = signal<MapGridState | undefined>(undefined)
  protected readonly gridChanges = signal(0)
  protected readonly thirdMap = signal(false)
  readonly #hookFails = parseHarnessParams(location.search).hookFails

  protected readonly selectedId = computed(() => this.state().selection?.featureId ?? 'none')
  protected readonly errorText = computed(() => this.errors().join(' '))
  protected readonly gridConfig = computed(() => createChecksGridConfig(this.thirdMap()))
  protected readonly gridFocus = computed(() => {
    const grid = this.grid()
    return grid ? (grid.focusedMapId ?? 'grid') : ''
  })
  protected readonly gridMaps = computed(() => {
    const grid = this.grid()
    return grid ? Object.keys(grid.maps).join(' ') : ''
  })
  protected readonly gridMapLabel = computed(() =>
    this.thirdMap() ? 'Remove grid map' : 'Add grid map',
  )

  protected readonly brazilFeatureId = brazilFeatureId
  protected readonly hideCountries = hideCountries

  private readonly map = viewChild.required(GeospatialMap)

  constructor() {
    exposeActions('geoChecks', () => this.map().actions)
  }

  /** `?hook-fails`: the OpenLayers hook throws, which reaches `(mapError)` as `HOOK_FAILED`. */
  protected readonly hostHook: MapOpenLayersHook = () => {
    if (this.#hookFails) throw new Error('the host hook failed')
  }

  protected select(featureId: string | null): void {
    this.state.update((current) => selectCountry(current, featureId))
  }

  protected downloadPng(): void {
    void this.map().actions.downloadImage('image/png')
  }

  protected addError(error: MapError): void {
    this.errors.update((current) => [...current, error.code])
  }

  protected toggleThirdMap(): void {
    this.thirdMap.update((current) => !current)
  }

  protected gridChanged(next: MapGridState): void {
    this.grid.set(next)
    this.gridChanges.update((count) => count + 1)
  }
}
