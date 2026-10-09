import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core'
import type { FeatureEvent } from '@/components/geospatial-map'
import { harnessPopupContent, popupLoadingMs } from '@demo-shared/src/fixtures'

/**
 * The main map's popup content: "Loading indicator statistics…" for `popupLoadingMs`, as if the
 * statistics came from a server, then the feature's statistic. The host element has
 * `display: contents`, so the popup card holds the same elements as in the React demo.
 */
@Component({
  selector: 'app-demo-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (loading()) {
      <p role="status">Loading indicator statistics…</p>
    } @else {
      <div class="demo-popup">
        <h2>{{ content().title }}</h2>
        <p class="demo-statistic">{{ content().statistic }}</p>
        <p>{{ content().note }}</p>
      </div>
    }
  `,
})
export class DemoPopup {
  readonly feature = input.required<FeatureEvent>()
  protected readonly loading = signal(true)
  protected readonly content = computed(() => harnessPopupContent(this.feature()))
  readonly #featureId = computed(() => this.feature().featureId)

  constructor() {
    // Keyed on the feature id, like the React demo's effect.
    effect((onCleanup) => {
      this.#featureId()
      const timer = setTimeout(() => this.loading.set(false), popupLoadingMs)
      onCleanup(() => clearTimeout(timer))
    })
  }
}
