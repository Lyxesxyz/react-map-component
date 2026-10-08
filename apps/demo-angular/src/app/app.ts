import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import { QuickStartScenario } from './scenarios/quick-start'

/** The React demo's origin, set by `define` in angular.json. */
declare const REACT_DEMO_URL: string

/** The scenarios of the React harness, by `?scenario=` id (the same routes in both demos). */
const scenarios = [
  { id: 'global', label: 'Global choropleth' },
  { id: 'geometry', label: 'Geometry types' },
  { id: 'points', label: 'Point & density layers' },
  { id: 'layers', label: 'Layer controls' },
  { id: 'time', label: 'Time series' },
  { id: 'raster', label: 'Raster' },
  { id: 'grid', label: '3 × 2 grid' },
  { id: 'configuration', label: 'Configuration playground' },
  { id: 'composed', label: 'Composed parts & styling' },
  { id: 'quickstart', label: 'Quick start (short config)' },
  { id: 'features', label: 'Basemap, clusters & overlays' },
  { id: 'arcgis', label: 'ArcGIS basemap + indicators' },
  { id: 'themes', label: 'Design-system themes' },
  { id: 'errors', label: 'Error handling' },
  { id: 'checks', label: 'Engine checks' },
] as const

type ScenarioId = (typeof scenarios)[number]['id']

const isScenario = (value: string | null): value is ScenarioId =>
  scenarios.some((scenario) => scenario.id === value)

/** The harness: the same header, scenario picker and routes as the React demo. */
@Component({
  selector: 'app-root',
  imports: [QuickStartScenario],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="demo-shell">
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
            <select (change)="choose(picker.value)" #picker>
              @for (option of scenarios; track option.id) {
                <option
                  [value]="option.id"
                  [selected]="option.id === scenario()"
                  [textContent]="option.label"
                ></option>
              }
            </select>
          </label>
          <a class="demo-framework-link" [href]="reactHref()">React version</a>
        </div>
      </header>

      <section>
        @switch (scenario()) {
          @case ('quickstart') {
            <app-quick-start />
          }
          @default {
            <p class="demo-notice" role="status">
              Not ported yet: “{{ scenarioLabel() }}” runs in the React version for now.
            </p>
          }
        }
      </section>
    </main>
  `,
})
export class App {
  protected readonly scenarios = scenarios
  readonly #params = new URLSearchParams(location.search)
  readonly #requested = this.#params.get('scenario')
  protected readonly scenario = signal<ScenarioId>(
    isScenario(this.#requested) ? this.#requested : 'global',
  )
  protected readonly scenarioLabel = computed(
    () => scenarios.find((scenario) => scenario.id === this.scenario())?.label ?? '',
  )
  /** The same path and query string on the React demo, with the scenario on screen. */
  protected readonly reactHref = computed(() => {
    const url = new URL(location.pathname, REACT_DEMO_URL)
    const params = new URLSearchParams(location.search)
    if (this.scenario() !== (this.#requested ?? 'global')) params.set('scenario', this.scenario())
    url.search = params.toString()
    url.hash = location.hash
    return url.href
  })

  protected choose(value: string): void {
    if (isScenario(value)) this.scenario.set(value)
  }
}
