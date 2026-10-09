// Example: the team's own ArcGIS basemap (configured by URL only) with indicators from three
// kinds of source, border overrides, and a disclaimer.
// Task: "use our ArcGIS basemap and add indicators". See docs/layers-and-legends.md.

import { ChangeDetectionStrategy, Component } from '@angular/core'
import { GeospatialMap, arcgisBasemap, defineMapConfig } from '../index'

// Replace with your public ArcGIS vector tile service (or its ArcGIS Online item page). The
// projection, tiles, style and attribution are read from the service.
const BASEMAP_URL =
  'https://tiles.arcgis.com/tiles/YOUR_ORG/arcgis/rest/services/YOUR_BASEMAP/VectorTileServer'

const config = defineMapConfig({
  id: 'indicators',
  accessibility: { ariaLabel: 'Development indicators' },
  ui: {
    disclaimer: {
      text: 'The boundaries and names shown do not imply official endorsement or acceptance.',
    },
  },
  data: {
    basemaps: [
      arcgisBasemap({
        url: BASEMAP_URL,
        // Style layer ids come from the service's style; a pattern that matches nothing logs
        // the ids it has.
        styleOverrides: [
          { layers: 'Boundary line/Admin0*', color: '#4b5563', width: 1.2 },
          { layers: 'Boundary line/Admin2*', visible: false },
        ],
      }),
    ],
    layers: [
      // GeoJSON polygons, coloured by class.
      {
        id: 'poverty',
        title: 'Poverty headcount',
        data: { url: '/data/admin1-poverty.geojson' },
        featureIdField: 'adm1_code',
        style: {
          type: 'graduated',
          field: 'poverty',
          classes: [
            { label: '< 10%', max: 10, symbol: { kind: 'polygon', fillColor: '#fef3c7' } },
            {
              label: '10–30%',
              min: 10,
              max: 30,
              symbol: { kind: 'polygon', fillColor: '#f59e0b' },
            },
            { label: '≥ 30%', min: 30, symbol: { kind: 'polygon', fillColor: '#b45309' } },
          ],
        },
      },
      // An ArcGIS feature layer: read page by page, in longitude/latitude.
      {
        id: 'schools',
        title: 'Schools',
        data: {
          url: 'https://services.arcgis.com/YOUR_ORG/arcgis/rest/services/Schools/FeatureServer/0',
        },
        featureIdField: 'OBJECTID',
        style: { type: 'constant', symbol: { kind: 'point', radius: 4, fillColor: '#2563eb' } },
      },
      // CSV points with longitude and latitude columns (found by name).
      {
        id: 'clinics',
        title: 'Clinics',
        data: { url: '/data/clinics.csv' },
        cluster: { distance: 36 },
        style: { type: 'constant', symbol: { kind: 'point', radius: 5, fillColor: '#16a34a' } },
      },
    ],
  },
})

@Component({
  selector: 'app-indicators-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" />`,
})
export class IndicatorsMap {
  protected readonly config = config
}
