// Example: controlled state (the host owns the complete map state) and a synchronised grid of
// six maps. See docs/state-events-templates.md and docs/export-grid-integration.md.

import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import {
  GeospatialMap,
  MapGrid,
  MapPopupTemplate,
  defineMapConfig,
  type MapGridConfig,
  type MapLayerInput,
  type MapState,
} from '../index'

const layers: MapLayerInput[] = [
  {
    id: 'places',
    title: 'Places',
    data: { type: 'FeatureCollection', features: [] },
    style: { type: 'constant', symbol: { kind: 'point', fillColor: '#0f766e' } },
  },
]

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Places map' },
  initialState: { view: { center: [0, 15], zoom: 1.2 } },
  data: {
    layers,
    basemaps: [
      {
        id: 'equal-earth',
        title: 'Equal Earth',
        supportedProjections: ['EPSG:8857'],
        layers: [],
        backgroundColor: '#eef4f2',
      },
    ],
  },
  ui: { profile: 'compact' },
})

/** The host keeps the map state in a signal (for URLs, undo, or syncing other UI). */
@Component({
  selector: 'app-controlled-map-example',
  imports: [GeospatialMap, MapPopupTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map [config]="config" [(state)]="state">
      <ng-template geoMapPopup let-feature>
        <strong>{{ feature.featureId }}</strong>
      </ng-template>
    </geo-map>
  `,
})
export class ControlledMapExample {
  protected readonly config = config
  protected readonly state = signal<MapState>(config.initialState)
}

const grid: MapGridConfig = {
  shared: config,
  maps: Array.from({ length: 6 }, (_, index) => ({
    id: `map-${index + 1}`,
    title: `Region ${index + 1}`,
  })),
  layout: { columns: 3, tabletColumns: 2, mobileColumns: 1 },
  sync: { layers: true, time: true },
  focus: { enabled: true },
}

/** Six maps in a grid, with layers and time kept in sync. */
@Component({
  selector: 'app-grid-example',
  imports: [MapGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map-grid [config]="grid" />`,
})
export class GridExample {
  protected readonly grid = grid
}
