// Built (not run) against the pasted folder with a fresh app's strict settings. It exercises the
// public API the way a host application would (the React counterpart is
// packages/geospatial-map/test/consumer/consumer.tsx). Keep it identical in consumer-v21 and
// consumer-v22: scripts/paste-test.mjs checks that.
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
  GEOSPATIAL_MAP_VERSION,
  GEO_MAP_PARTS,
  GeospatialMap,
  MapControlButton,
  MapControlGroup,
  MapControls,
  MapGrid,
  MapIconView,
  MapPopup,
  MapPopupTemplate,
  MapRoot,
  MapTooltip,
  MapTooltipTemplate,
  ShapeButton,
  anchoredPosition,
  arcgisBasemap,
  cn,
  defaultMapIcons,
  defineMapConfig,
  fetchGeoJson,
  injectHoveredFeature,
  injectMap,
  injectMapActions,
  injectMapIcons,
  injectMapPixel,
  injectMapRuntime,
  injectMapStatic,
  injectSlotContext,
  mapInputSchema,
  plainBasemap,
  tileBasemap,
  validateMapConfig,
  worldBasemap,
  type FeatureEvent,
  type GeoJsonLoader,
  type MapActionEvent,
  type MapConfig,
  type MapConfigInput,
  type MapError,
  type MapGridEvent,
  type MapGridState,
  type MapIcon,
  type MapLayerConfig,
  type MapOpenLayersHook,
  type MapPanelId,
  type MapState,
  type MapTargetClickEvent,
  type ViewChangeEvent,
} from './geospatial-map'

const layers: MapLayerConfig[] = [
  {
    id: 'areas',
    title: 'Areas',
    kind: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    featureIdField: 'id',
    style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#2563eb' } },
  },
]

const config: MapConfig = defineMapConfig({
  accessibility: { ariaLabel: 'Consumer map' },
  initialState: { view: { center: [0, 0], zoom: 1 } },
  view: { minZoom: 1, interactions: { keyboard: true } },
  data: {
    layers,
    basemaps: [
      {
        id: 'base',
        title: 'Base',
        supportedProjections: ['EPSG:8857', 'EPSG:3857'],
        layers: [],
        backgroundColor: '#dbeafe',
      },
      plainBasemap,
    ],
  },
  ui: { profile: 'compact', layerPanel: { allowReorder: false }, time: { autoplay: false } },
  theme: { primary: '#7c3aed', mutedForeground: '#6b7280', density: 'compact' },
})

/** A custom part: everything at once through injectMap(). */
@Component({
  selector: 'app-selection-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ title() }}</p>`,
})
export class SelectionTitle {
  readonly #map = injectMap()
  protected readonly title = computed(
    () => this.#map().state.selection?.featureId ?? this.#map().messages.selectionCleared,
  )
}

/** A custom control: the rail's button (`geoMapControl`) with an action of its own. */
@Directive({ selector: 'button[appHome]', host: { '(click)': 'home()' } })
export class HomeButton {
  readonly #actions = injectMapActions()

  protected home(): void {
    this.#actions.fit([-180, -90, 180, 90])
  }
}

@Component({
  selector: 'app-preset-map',
  imports: [GeospatialMap, MapPopupTemplate, ShapeButton, SelectionTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button geoShapeButton (click)="exportPng()">Export</button>
    <geo-map
      #map="geoMap"
      [config]="config"
      [(state)]="state"
      [class]="mapClass()"
      (featureSelect)="selected.set($event)"
    >
      <ng-template geoMapPopup let-feature let-close="close">
        <button type="button" (click)="close()">{{ feature.featureId }}</button>
      </ng-template>
      <app-selection-title />
    </geo-map>
  `,
})
export class PresetMap {
  protected readonly config = config
  protected readonly state = signal<MapState>(config.initialState)
  protected readonly selected = signal<FeatureEvent | null>(null)
  protected readonly mapClass = computed(() =>
    cn('h-full', this.state().selection && 'has-selection'),
  )
  private readonly map = viewChild.required(GeospatialMap)

  protected exportPng(): void {
    void this.map().actions.exportImage({ format: 'image/png' })
  }
}

@Component({
  selector: 'app-composed-map',
  imports: [GEO_MAP_PARTS, HomeButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map-root [config]="config" class="brand-map" style="--geo-radius: 6px">
      <geo-map-controls placement="top-left">
        <geo-map-control-group>
          <button geoMapZoomIn (beforeAction)="limitZoom($event)"></button>
          <button geoMapZoomOut [step]="2"></button>
        </geo-map-control-group>
        <geo-map-control-group>
          <button geoMapLayers></button>
          <button geoMapControl appHome label="World">
            <svg viewBox="0 0 24 24" aria-hidden="true"></svg>
          </button>
        </geo-map-control-group>
      </geo-map-controls>
      <geo-map-settings [fields]="['basemap']" />
      <geo-map-layer-panel [allowReorder]="false">
        <h2 geoMapPanelHeader>Data</h2>
        <p geoMapPanelFooter>Updated daily</p>
      </geo-map-layer-panel>
      <geo-map-legend placement="bottom-right" layout="compact" />
      <geo-map-popup>
        <ng-template geoMapPopup let-feature>
          <strong>{{ feature.featureId }}</strong>
        </ng-template>
      </geo-map-popup>
      <geo-map-breadcrumbs (targetClick)="targetClicked($event)" />
      <geo-map-time-controls [speedsMs]="[400, 800]" />
      <geo-map-attribution compact />
    </geo-map-root>
  `,
})
export class ComposedMap {
  protected readonly config = config

  /** A built-in button's action can be cancelled before it runs. */
  protected limitZoom(event: MapActionEvent<'zoomIn'>): void {
    if (event.source.isTrusted === false) event.preventDefault()
  }

  protected targetClicked(event: MapTargetClickEvent): void {
    if (event.target.id === 'world') event.preventDefault()
  }
}

@Component({
  selector: 'app-grid',
  imports: [MapGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map-grid
      [config]="gridConfig"
      cellClassName="cell"
      (stateChange)="gridState.set($event)"
      (viewChange)="viewChanged($event)"
      (mapError)="failed($event)"
    />
  `,
})
export class Grid {
  protected readonly gridConfig = {
    shared: config,
    maps: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', initialState: { view: { zoom: 3 } } },
    ],
    sync: { view: true },
  }
  protected readonly gridState = signal<MapGridState | null>(null)

  protected viewChanged({ mapId, event }: MapGridEvent<ViewChangeEvent>): void {
    void [event.view.zoom, mapId.toUpperCase(), this.gridState()?.focusedMapId]
  }

  protected failed({ mapId, event }: MapGridEvent<MapError>): void {
    void [event.code, mapId]
  }
}

// The short form, with fill and an authenticated loader.
@Component({
  selector: 'app-short-config-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="height: 70vh">
      <geo-map fill [config]="config" [loadGeoJson]="loadGeoJson" />
    </div>
  `,
})
export class ShortConfigMap {
  readonly token = input('')
  protected readonly config: MapConfigInput = {
    accessibility: { ariaLabel: 'Short map' },
    initialState: { view: { center: [25, 42], zoom: 5 } },
    data: {
      layers: [
        {
          id: 'regions',
          title: 'Regions',
          kind: 'geojson',
          data: { url: '/regions.geojson' },
          featureIdField: 'id',
          style: { type: 'constant', symbol: { kind: 'polygon', fillColor: '#60a5fa' } },
        },
      ],
    },
  }
  protected readonly loadGeoJson: GeoJsonLoader = async (url, { signal }) => {
    const response = await fetch(url, {
      ...(signal ? { signal } : {}),
      headers: { Authorization: `Bearer ${this.token()}` },
    })
    return response.json()
  }
}

/** A marker placed with injectMapPixel(), showing the hovered feature. */
@Component({
  selector: 'app-station-marker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.position]': '"absolute"',
    '[style.left.px]': 'pixel()?.[0]',
    '[style.top.px]': 'pixel()?.[1]',
  },
  template: `
    @if (pixel()) {
      <span>{{ label() }}</span>
    }
  `,
})
export class StationMarker {
  readonly lonLat = input.required<[number, number]>()
  protected readonly pixel = injectMapPixel(() => this.lonLat())
  readonly #hovered = injectHoveredFeature()
  protected readonly label = computed(() => {
    const hovered = this.#hovered()
    return hovered ? String(hovered.properties['name'] ?? '') : 'Station'
  })
}

/** A callout placed next to the selected feature with anchoredPosition(). */
@Component({
  selector: 'app-callout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-callout' },
  template: `{{ title() }}`,
})
export class Callout {
  readonly #selected = injectMapRuntime((map) => map.selectedFeature)
  protected readonly title = computed(() => this.#selected()?.featureId ?? '')
  readonly #pixel = injectMapPixel(() => this.#selected()?.coordinate)

  constructor() {
    anchoredPosition(() => (this.#selected() ? this.#pixel() : undefined), 12)
  }
}

@Component({
  selector: 'app-overlay-map',
  imports: [MapRoot, MapPopup, MapTooltip, MapTooltipTemplate, StationMarker, Callout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map-root [config]="config" [onOpenLayersMap]="onOpenLayersMap">
      <geo-map-popup anchor="feature" />
      <geo-map-tooltip [fields]="['name']">
        <ng-template geoMapTooltip let-feature>{{ feature.featureId }}</ng-template>
      </geo-map-tooltip>
      <app-station-marker [lonLat]="[23.3, 42.7]" />
      <app-callout />
    </geo-map-root>
  `,
})
export class OverlayMap {
  protected readonly config: MapConfigInput = {
    accessibility: { ariaLabel: 'Stations' },
    ui: { popup: { anchor: 'feature' }, tooltip: { fields: ['label'] } },
    data: {
      basemaps: [
        worldBasemap,
        tileBasemap({
          url: 'https://tiles.example.com/{z}/{x}/{y}.png',
          attribution: { label: '© Example', url: 'https://example.com' },
        }),
      ],
      layers: [
        {
          id: 'stations',
          title: 'Stations',
          kind: 'geojson',
          data: { url: '/stations.geojson' },
          featureIdField: 'id',
          cluster: { distance: 40 },
          renderer: 'auto',
          style: { type: 'constant', symbol: { kind: 'point', fillColor: '#16a34a' } },
        },
        {
          id: 'countries',
          title: 'Countries',
          kind: 'geojson',
          data: { builtin: 'world' },
          style: { type: 'constant', symbol: { kind: 'polygon', strokeColor: 'var(--brand)' } },
        },
      ],
    },
  }
  protected readonly onOpenLayersMap: MapOpenLayersHook = (map) => {
    const zoom = map.getView().getZoom()
    return () => void zoom
  }
}

// An ArcGIS basemap by URL, indicators from different sources, a disclaimer.
@Component({
  selector: 'app-arcgis-map',
  imports: [GEO_MAP_PARTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map [config]="config" [loadGeoJson]="loadGeoJson">
      <ng-template geoMapTooltip let-feature>
        <em>{{ feature.featureId }}</em>
      </ng-template>
      <geo-map-disclaimer title="Note" placement="bottom-left" defaultOpen>
        Data are provisional.
      </geo-map-disclaimer>
    </geo-map>
  `,
})
export class ArcgisMap {
  readonly token = input.required<string>()
  protected readonly config: MapConfigInput = {
    accessibility: { ariaLabel: 'Indicators' },
    ui: { disclaimer: { text: 'Boundaries are not official.', placement: 'bottom-right' } },
    data: {
      basemaps: [
        arcgisBasemap({
          url: 'https://tiles.arcgis.com/tiles/x/arcgis/rest/services/Basemap/VectorTileServer',
          styleOverrides: [{ layers: 'Boundary line/*', color: '#555', width: 1.5 }],
        }),
      ],
      layers: [
        { id: 'regions', data: { url: '/regions.geojson' } },
        {
          id: 'sites',
          title: 'Sites',
          data: { url: '/sites.csv', longitude: 'lon', latitude: 'lat' },
          style: { type: 'constant', symbol: { kind: 'point', fillColor: '#16a34a' } },
        },
        { id: 'offices', data: { rows: [{ name: 'HQ', lon: 2.35, lat: 48.85 }] } },
      ],
    },
  }
  protected readonly loadGeoJson: GeoJsonLoader = (url, options) =>
    fetchGeoJson(url.startsWith('/private/') ? `${url}?token=${this.token()}` : url, options)
}

// Per-map icons: an icon component and lucide nodes, and a custom part using the map's icons.
@Component({
  selector: 'app-brand-layers-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.class]="class() ?? null" viewBox="0 0 16 16" aria-hidden="true"></svg>`,
})
export class BrandLayersIcon {
  readonly class = input<string>()
}

@Component({
  selector: 'app-themed-layers-button',
  imports: [MapControlButton, MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button geoMapControl label="Layers" (click)="open()">
      <geo-map-icon [icon]="icons().Layers" />
    </button>
  `,
})
export class ThemedLayersButton {
  protected readonly icons = injectMapIcons()
  readonly #slot = injectSlotContext()

  protected open(): void {
    this.#slot().actions.setOpenPanel('layers')
  }
}

@Component({
  selector: 'app-icon-map',
  imports: [MapRoot, MapControls, MapControlGroup, ThemedLayersButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map-root [config]="config" [icons]="icons" class="theme-carbon">
      <geo-map-controls>
        <geo-map-control-group>
          <app-themed-layers-button />
        </geo-map-control-group>
      </geo-map-controls>
    </geo-map-root>
  `,
})
export class IconMap {
  protected readonly config = config
  protected readonly icons: Partial<Record<'Layers' | 'Close', MapIcon>> = {
    Layers: BrandLayersIcon,
    Close: defaultMapIcons.Close,
  }
}

// One set of actions (template ref, inject function, templates), a controlled panel, host
// selection, custom controls and an error template.
@Component({
  selector: 'app-settings-toggle',
  imports: [MapControlButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button geoMapControl [label]="map().messages.mapSettings" (click)="toggle()">
      <svg viewBox="0 0 24 24" aria-hidden="true"></svg>
    </button>
  `,
})
export class SettingsToggle {
  protected readonly map = injectMapStatic()

  protected toggle(): void {
    this.map().actions.setOpenPanel('settings')
  }
}

/** One field of the live map data: updates only when it changes. */
@Component({
  selector: 'app-loading-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <span>Loading</span>
    }
  `,
})
export class LoadingBadge {
  protected readonly loading = injectMapRuntime((map) =>
    map.statuses.some((status) => status.loading),
  )
}

@Component({
  selector: 'app-actions-map',
  imports: [GEO_MAP_PARTS, SettingsToggle, LoadingBadge, HomeButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let result = validation();
    @if (result.success) {
      <button geoShapeButton (click)="root.actions.select({ layerId: 'areas', featureId: '1' })">
        Select
      </button>
      <button geoShapeButton (click)="root.actions.setView({ zoom: 4 })">Zoom</button>
      <geo-map-root
        #root="geoMap"
        [config]="result.config"
        [(openPanel)]="openPanel"
        (stateChangeDetails)="changes.set(changes() + 1)"
        (mapError)="lastError.set($event)"
      >
        <geo-map-controls [groups]="groups">
          <ng-template geoMapControl="custom:settings">
            <app-settings-toggle />
          </ng-template>
        </geo-map-controls>
        <geo-map-settings />
        <geo-map-layer-panel />
        <geo-map-status-chips placement="bottom-left" />
        <geo-map-error-alert [dismissible]="false">
          <ng-template geoMapError let-error let-dismiss="dismiss">
            <span>{{ error.message }}</span>
            <button type="button" (click)="dismiss()">OK</button>
          </ng-template>
        </geo-map-error-alert>
        <app-loading-badge />
      </geo-map-root>
      <geo-map [config]="result.config">
        <ng-template geoMapControl="custom:home" let-state let-actions="actions">
          <button geoMapControl appHome [label]="'Home ' + state.view.zoom"></button>
        </ng-template>
      </geo-map>
    } @else {
      <p>{{ result.issues[0]?.message }}</p>
    }
    <p>{{ layersOpen() ? 'Layers open' : '' }} {{ version }} {{ schemaId }}</p>
  `,
})
export class ActionsMap {
  readonly json = input.required<unknown>()
  protected readonly validation = computed(() => validateMapConfig(this.json()))
  protected readonly openPanel = signal<MapPanelId | null>(null)
  protected readonly layersOpen = computed(() => this.openPanel() === 'layers')
  protected readonly changes = signal(0)
  protected readonly lastError = signal<MapError | null>(null)
  protected readonly groups = [
    { id: 'more', controls: ['zoom-in' as const, 'custom:settings' as const] },
  ]
  protected readonly version = GEOSPATIAL_MAP_VERSION
  protected readonly schemaId = (mapInputSchema as { $id?: string }).$id ?? ''
}

@Component({
  selector: 'app-root',
  imports: [
    PresetMap,
    ComposedMap,
    Grid,
    ShortConfigMap,
    OverlayMap,
    ArcgisMap,
    IconMap,
    ActionsMap,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-preset-map />
    <app-composed-map />
    <app-grid />
    <app-short-config-map token="secret" />
    <app-overlay-map />
    <app-arcgis-map token="secret" />
    <app-icon-map />
    <app-actions-map [json]="json" />
  `,
})
export class App {
  protected readonly json: unknown = { data: { layers } }
}
