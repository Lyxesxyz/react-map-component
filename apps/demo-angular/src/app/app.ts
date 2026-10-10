import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core'
import {
  GeospatialMap,
  MapControlButton,
  MapControlTemplate,
  MapGrid,
  MapPopupTemplate,
  type ClassificationMethod,
  type MapActions,
  type MapPlacement,
  type MapState,
  type MapStateChangeEvent,
  type MapUiConfig,
  type MapUiProfileId,
  type MapViewState,
  type PaletteId,
} from '@/components/geospatial-map'
import {
  benchmarkNotice,
  classCountOptions,
  classificationOptions,
  createClassifiedIndicator,
  createHarnessCallbacks,
  createHarnessConfig,
  createHarnessGridConfig,
  defaultPlaygroundSettings,
  defaultSymbology,
  defaultUiOverrideJson,
  generatedPolicyJson,
  harnessLayers,
  indicatorTableRows,
  logEvent,
  paletteOptions,
  parseUiOverride,
  placementOptions,
  profileOptions,
  sourceFixtureNotice,
  stableRenderMark,
  worldBounds,
} from '@demo-shared/src/fixtures'
import {
  counterpartDemoHref,
  defaultDemoUrls,
  harnessView,
  isScenarioId,
  parseHarnessParams,
  scenarioOptions,
  type ScenarioId,
} from '@demo-shared/src/scenarios'
import { DemoPopup } from './demo-popup'
import { ArcgisScenario } from './scenarios/arcgis'
import { ChecksScenario } from './scenarios/checks'
import { ComposedScenario } from './scenarios/composed'
import { FeaturesScenario } from './scenarios/features'
import { QuickStartScenario } from './scenarios/quick-start'
import { ThemesScenario } from './scenarios/themes'

// The harness: a port of the React demo's App.tsx, with the same elements, classes, labels and
// test ids, so the shared browser suite runs against both demos. Its scenarios, fixtures,
// configurations and styles come from apps/demo-shared; this file and the scenario components
// only render them.

/**
 * Where the "React version" link points: `REACT_DEMO_URL` when `define` sets it (angular.json,
 * or `ng build --define REACT_DEMO_URL="'https://…'"`), else the React demo's default address.
 */
declare const REACT_DEMO_URL: string | undefined
const reactDemoUrl =
  typeof REACT_DEMO_URL === 'string' && REACT_DEMO_URL ? REACT_DEMO_URL : defaultDemoUrls.react

@Component({
  selector: 'app-root',
  imports: [
    ArcgisScenario,
    ChecksScenario,
    ComposedScenario,
    DemoPopup,
    FeaturesScenario,
    GeospatialMap,
    MapControlButton,
    MapControlTemplate,
    MapGrid,
    MapPopupTemplate,
    QuickStartScenario,
    ThemesScenario,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ?embed (data-embed): app.css hides the harness chrome and the map fills the window. -->
    <main class="demo-shell" [attr.data-embed]="params.embed ? '' : null">
      <header class="demo-header">
        <div>
          <p class="demo-eyebrow">Component harness</p>
          <h1>Indicator geospatial map</h1>
          <p>
            Vector, raster, projection, time, interaction, legend, grid, and export demonstrations.
          </p>
        </div>
        <div class="demo-header-actions">
          <label class="demo-scenario-control">
            Scenario
            <select #scenarioSelect (change)="chooseScenario(scenarioSelect.value)">
              @for (option of scenarioOptions; track option.id) {
                <option
                  [value]="option.id"
                  [selected]="option.id === scenario()"
                  [textContent]="option.label"
                ></option>
              }
            </select>
          </label>
          <details class="demo-symbology-controls">
            <summary>Style map</summary>
            <fieldset class="demo-symbology-panel">
              <legend>Approved symbology</legend>
              <label>
                Palette
                <select #paletteSelect (change)="choosePalette(paletteSelect.value)">
                  @for (option of paletteOptions; track option.value) {
                    <option
                      [value]="option.value"
                      [selected]="option.value === palette()"
                      [textContent]="option.label"
                    ></option>
                  }
                </select>
              </label>
              <label>
                Classification
                <select #methodSelect (change)="chooseMethod(methodSelect.value)">
                  @for (option of classificationOptions; track option.value) {
                    <option
                      [value]="option.value"
                      [selected]="option.value === method()"
                      [textContent]="option.label"
                    ></option>
                  }
                </select>
              </label>
              <label>
                Classes
                <select #classSelect (change)="chooseClassCount(classSelect.value)">
                  @for (count of classCountOptions; track count) {
                    <option
                      [value]="count"
                      [selected]="count === classCount()"
                      [textContent]="count"
                    ></option>
                  }
                </select>
              </label>
            </fieldset>
          </details>
          <a class="demo-framework-link" [href]="reactHref()">React version</a>
        </div>
      </header>

      @if (params.points > 0) {
        <p class="demo-notice">{{ benchmarkNotice(params.points) }}</p>
      }
      @if (params.sources) {
        <p class="demo-notice">{{ sourceFixtureNotice }}</p>
      }
      @if (params.hidden && !mapVisible()) {
        <button type="button" (click)="mapVisible.set(true)">Reveal map</button>
      }

      @if (scenario() === 'configuration') {
        <section class="demo-configurator" aria-label="Map configuration playground">
          <label>
            Profile
            <select #profileSelect (change)="chooseProfile(profileSelect.value)">
              @for (option of profileOptions; track option.value) {
                <option
                  [value]="option.value"
                  [selected]="option.value === profile()"
                  [textContent]="option.label"
                ></option>
              }
            </select>
          </label>
          <label>
            Control placement
            <select #placementSelect (change)="choosePlacement(placementSelect.value)">
              @for (option of placementOptions; track option.value) {
                <option
                  [value]="option.value"
                  [selected]="option.value === railPlacement()"
                  [textContent]="option.label"
                ></option>
              }
            </select>
          </label>
          <label>
            <input
              #layersBox
              type="checkbox"
              [checked]="showLayers()"
              (change)="showLayers.set(layersBox.checked)"
            />
            Layer panel
          </label>
          <label>
            <input
              #legendBox
              type="checkbox"
              [checked]="showLegend()"
              (change)="showLegend.set(legendBox.checked)"
            />
            Legend
          </label>
          <label>
            <input
              #densityBox
              type="checkbox"
              [checked]="compactTheme()"
              (change)="compactTheme.set(densityBox.checked)"
            />
            Compact density
          </label>
          <label>
            <input
              #translatedBox
              type="checkbox"
              [checked]="translated()"
              (change)="translated.set(translatedBox.checked)"
            />
            Bulgarian labels
          </label>
          <label class="demo-config-json">
            UI override JSON
            <textarea
              #uiJsonField
              [value]="uiJson()"
              (input)="uiJson.set(uiJsonField.value)"
            ></textarea>
          </label>
          <button type="button" (click)="applyUiJson()">Apply JSON</button>
          <output role="status">{{ uiJsonError() || 'Configuration valid' }}</output>
          <details>
            <summary>Generated policy</summary>
            <pre>{{ policyJson() }}</pre>
          </details>
        </section>
      }

      <section [style.display]="mapVisible() ? 'block' : 'none'">
        @switch (view()) {
          @case ('grid') {
            <geo-map-grid
              [config]="gridConfig()"
              (featureSelect)="callbacks.onFeatureSelect($event.event)"
              (viewChange)="callbacks.onViewChange($event.event)"
              (layerStateChange)="callbacks.onLayerStateChange($event.event)"
              (timeChange)="callbacks.onTimeChange($event.event)"
              (metric)="callbacks.onMetric($event.event)"
              (mapError)="callbacks.onError($event.event)"
            >
              <ng-template geoMapPopup let-feature>
                <app-demo-popup [feature]="feature" />
              </ng-template>
              <ng-template geoMapControl="custom:home" let-actions="actions">
                <button geoMapControl label="Fit world" (click)="actions.fit(worldBounds)">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                  </svg>
                </button>
              </ng-template>
            </geo-map-grid>
          }
          @case ('map') {
            <!-- Keyed like the React map: a new scenario mounts a new map. -->
            @for (key of mapKey(); track key) {
              <geo-map
                [config]="config()"
                [state]="
                  params.controlled ? (controlledState() ?? config().initialState) : undefined
                "
                (stateChangeDetails)="stateChanged($event)"
                (ready)="ready($event)"
                (featureSelect)="callbacks.onFeatureSelect($event)"
                (viewChange)="callbacks.onViewChange($event)"
                (layerStateChange)="callbacks.onLayerStateChange($event)"
                (timeChange)="callbacks.onTimeChange($event)"
                (metric)="callbacks.onMetric($event)"
                (mapError)="callbacks.onError($event)"
              >
                <ng-template geoMapPopup let-feature>
                  <app-demo-popup [feature]="feature" />
                </ng-template>
                <ng-template geoMapControl="custom:home" let-actions="actions">
                  <button geoMapControl label="Fit world" (click)="actions.fit(worldBounds)">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                    </svg>
                  </button>
                </ng-template>
              </geo-map>
            }
          }
          @case ('quickstart') {
            <app-quick-start />
          }
          @case ('composed') {
            <app-composed [config]="config()" [callbacks]="callbacks" />
          }
          @case ('features') {
            <app-features />
          }
          @case ('arcgis') {
            <app-arcgis />
          }
          @case ('checks') {
            <app-checks />
          }
          @case ('themes') {
            <app-themes />
          }
        }
      </section>

      <details class="demo-data-table">
        <summary>Accessible indicator data table</summary>
        <table>
          <caption>
            Development index values represented by the global map
          </caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Value</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            @for (row of indicatorTableRows; track row.key) {
              <tr>
                <th scope="row">{{ row.area }}</th>
                <td>{{ row.value }}</td>
                <td>{{ row.category }}</td>
              </tr>
            }
          </tbody>
        </table>
      </details>

      <section class="demo-inspector" aria-label="Integration inspector">
        <header>
          <div>
            <h2>Integration inspector</h2>
            <p>Typed events and the reusable JSON-safe state contract.</p>
          </div>
          <button type="button" (click)="inspectState()">Inspect state</button>
          <button type="button" (click)="fitSelectedFeature()">Fit selected feature</button>
        </header>
        @if (stateJson()) {
          <pre data-testid="serialized-state">{{ stateJson() }}</pre>
        }
        <ol aria-label="Recent map events">
          @for (event of events(); track $index) {
            <li>{{ event }}</li>
          }
        </ol>
      </section>
    </main>
  `,
})
export class App {
  // The URL never changes while the harness runs: the Scenario select switches in place.
  protected readonly params = parseHarnessParams(location.search)
  protected readonly scenario = signal<ScenarioId>(this.params.scenario)
  protected readonly events = signal<string[]>([])
  protected readonly stateJson = signal('')
  protected readonly mapVisible = signal(!this.params.hidden)
  protected readonly palette = signal<PaletteId>(defaultSymbology.palette)
  protected readonly method = signal<ClassificationMethod>(defaultSymbology.method)
  protected readonly classCount = signal(defaultSymbology.classCount)
  protected readonly profile = signal<MapUiProfileId>(defaultPlaygroundSettings.profile)
  protected readonly railPlacement = signal<MapPlacement>(defaultPlaygroundSettings.railPlacement)
  protected readonly showLegend = signal<boolean>(defaultPlaygroundSettings.showLegend)
  protected readonly showLayers = signal<boolean>(defaultPlaygroundSettings.showLayers)
  protected readonly compactTheme = signal<boolean>(defaultPlaygroundSettings.compactTheme)
  protected readonly translated = signal<boolean>(defaultPlaygroundSettings.translated)
  protected readonly uiJson = signal(defaultUiOverrideJson)
  protected readonly uiOverride = signal<MapUiConfig>(defaultPlaygroundSettings.uiOverride)
  protected readonly uiJsonError = signal('')
  protected readonly controlledState = signal<MapState | null>(null)
  /** The main harness map, while it is on screen. */
  private readonly map = viewChild(GeospatialMap)
  /** The composed scenario's map, while it is on screen. */
  private readonly composed = viewChild(ComposedScenario)

  protected readonly classifiedIndicator = computed(() =>
    createClassifiedIndicator({
      palette: this.palette(),
      method: this.method(),
      classCount: this.classCount(),
    }),
  )
  protected readonly layers = computed(() =>
    harnessLayers(
      this.scenario(),
      {
        sources: this.params.sources,
        points: this.params.points,
        renderer: this.params.renderer,
      },
      this.classifiedIndicator(),
    ),
  )
  protected readonly config = computed(() =>
    createHarnessConfig({
      scenario: this.scenario(),
      layers: this.layers(),
      // The projection is a developer setting (users cannot change it on the map): `?projection=`.
      projection: this.params.projection,
      activeBasemap: this.params.activeBasemap,
      profile: this.profile(),
      railPlacement: this.railPlacement(),
      showLegend: this.showLegend(),
      showLayers: this.showLayers(),
      compactTheme: this.compactTheme(),
      translated: this.translated(),
      uiOverride: this.uiOverride(),
    }),
  )
  protected readonly policyJson = computed(() => generatedPolicyJson(this.config()))
  /** The 3 × 2 grid scenario: the harness config in six regional maps. */
  protected readonly gridConfig = computed(() =>
    createHarnessGridConfig(this.config(), this.classifiedIndicator()),
  )
  /** What the harness renders: a scenario's own component, or the main map. */
  protected readonly view = computed(() => harnessView(this.scenario(), this.params))
  /** The main map's key (React's `key`): one item, so a new key replaces the map. */
  protected readonly mapKey = computed(() => [
    `${this.scenario()}-${this.params.sources}-${this.params.points}`,
  ])
  /** The same route on the React demo, with the scenario on screen. */
  protected readonly reactHref = computed(() =>
    counterpartDemoHref(
      reactDemoUrl,
      location,
      new URL(document.baseURI).pathname,
      this.scenario(),
    ),
  )

  protected readonly callbacks = createHarnessCallbacks((name, detail) => this.record(name, detail))

  protected readonly scenarioOptions = scenarioOptions
  protected readonly paletteOptions = paletteOptions
  protected readonly classificationOptions = classificationOptions
  protected readonly classCountOptions = classCountOptions
  protected readonly profileOptions = profileOptions
  protected readonly placementOptions = placementOptions
  protected readonly indicatorTableRows = indicatorTableRows
  protected readonly sourceFixtureNotice = sourceFixtureNotice
  protected readonly worldBounds = worldBounds
  protected readonly benchmarkNotice = benchmarkNotice

  protected record(name: string, detail: unknown): void {
    this.events.update((current) => logEvent(current, name, detail))
  }

  protected chooseScenario(value: string): void {
    if (isScenarioId(value)) this.scenario.set(value)
  }

  protected choosePalette(value: string): void {
    this.palette.set(value as PaletteId)
    this.record('symbologyControl', { palette: value })
  }

  protected chooseMethod(value: string): void {
    this.method.set(value as ClassificationMethod)
    this.record('symbologyControl', { method: value })
  }

  protected chooseClassCount(value: string): void {
    this.classCount.set(Number(value))
  }

  protected chooseProfile(value: string): void {
    this.profile.set(value as MapUiProfileId)
  }

  protected choosePlacement(value: string): void {
    this.railPlacement.set(value as MapPlacement)
  }

  protected applyUiJson(): void {
    const result = parseUiOverride(this.uiJson())
    if ('ui' in result) {
      this.uiOverride.set(result.ui)
      this.uiJsonError.set('')
    } else {
      this.uiJsonError.set(result.error)
    }
  }

  /** `?controlled`: the host keeps the map's complete state. */
  protected stateChanged({ state, change }: MapStateChangeEvent): void {
    if (!this.params.controlled) return
    this.controlledState.set(state)
    this.record('stateChange', change.domain)
  }

  protected ready(view: MapViewState): void {
    performance.mark(stableRenderMark)
    this.record('ready', view.projection)
  }

  /** The actions of the map on screen (the scenarios with a map of their own add theirs here). */
  protected mapActions(): MapActions | undefined {
    return this.map()?.actions ?? this.composed()?.actions
  }

  protected inspectState(): void {
    this.stateJson.set(JSON.stringify(this.mapActions()?.getState() ?? {}, null, 2))
  }

  protected fitSelectedFeature(): void {
    this.mapActions()?.fitSelection({ maxZoom: 6 })
  }
}
