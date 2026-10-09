// Example: the smallest useful map. One indicator layer from a GeoJSON URL, coloured by a
// numeric property; everything else (basemap, starting view, UI) uses the defaults.
// Task: "add a map with our indicator". See README.md → Quick start.

import { ChangeDetectionStrategy, Component, output } from '@angular/core'
import { GeospatialMap, defineMapConfig, type FeatureEvent } from '../index'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Literacy rate by country' },
  data: {
    layers: [
      {
        id: 'literacy',
        title: 'Literacy rate',
        data: { url: '/data/literacy.geojson' },
        featureIdField: 'iso3', // stable id: selection, events and the popup use it
        style: {
          type: 'continuous',
          field: 'rate',
          domain: [40, 100],
          stops: [
            { value: 40, color: '#fef3c7' },
            { value: 100, color: '#065f46' },
          ],
        },
        legend: { units: '%, adults 15+', sourceNote: 'Source: national surveys' },
      },
    ],
  },
})

@Component({
  selector: 'app-literacy-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" (featureSelect)="select($event)" />`,
})
export class LiteracyMap {
  /** The selected country's ISO3 code, or `null` when the selection is cleared. */
  readonly country = output<string | null>()

  protected readonly config = config

  protected select(event: FeatureEvent | null): void {
    this.country.emit(event ? event.featureId : null)
  }
}
