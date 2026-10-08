import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import {
  GeospatialMap,
  defineMapConfig,
  type FeatureEvent,
  type GeoJsonLoader,
} from '@/components/geospatial-map'
import { worldCountries } from '../world'

// The shortest useful integration, written the way a team would first write it: the config is
// built again on every render of the parent ("Re-render parent" makes a new object with the
// same content), the map fills its container, and GeoJSON comes through a custom loader (where
// an app would add auth headers).
@Component({
  selector: 'app-quick-start',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-composed-toolbar" role="group" aria-label="Quick start controls">
      <button type="button" (click)="rerender()">Re-render parent ({{ renders() }})</button>
      <output aria-label="Custom loader calls">Custom loader calls: {{ loads() }}</output>
      <output aria-label="Selected area">Selected: {{ selected() ?? 'none' }}</output>
    </div>
    <div class="demo-fill-frame">
      <geo-map
        fill
        [config]="config()"
        [loadGeoJson]="loadGeoJson"
        (featureSelect)="select($event)"
      />
    </div>
  `,
})
export class QuickStartScenario {
  protected readonly renders = signal(0)
  protected readonly loads = signal(0)
  protected readonly selected = signal<string | null>(null)

  /** A new config object on every render, as if it were written inline. */
  protected readonly config = computed(() => {
    this.renders()
    return defineMapConfig({
      accessibility: { ariaLabel: 'Quick start map' },
      data: {
        layers: [
          {
            id: 'countries',
            title: 'Countries',
            kind: 'geojson',
            data: { url: '/api/countries.geojson' },
            featureIdField: 'geoId',
            style: {
              type: 'constant',
              symbol: {
                kind: 'polygon',
                fillColor: '#5b8fd6',
                strokeColor: '#ffffff',
                strokeWidth: 0.5,
              },
            },
          },
        ],
      },
    })
  })

  protected readonly loadGeoJson: GeoJsonLoader = async () => {
    this.loads.update((count) => count + 1)
    return worldCountries
  }

  protected rerender(): void {
    this.renders.update((count) => count + 1)
  }

  protected select(event: FeatureEvent | null): void {
    this.selected.set(event ? String(event.properties['name'] ?? event.featureId) : null)
  }
}
