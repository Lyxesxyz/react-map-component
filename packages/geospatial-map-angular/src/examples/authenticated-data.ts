// Example: data behind authentication. Wrap the built-in loader (`fetchGeoJson`) so GeoJSON,
// CSV and ArcGIS sources keep working; only the request changes.
// Task: "our indicator API needs a token". See README.md → Data that needs authentication.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { GeospatialMap, fetchGeoJson, type GeoJsonLoader, type MapConfigInput } from '../index'

/** Sends a bearer token to your own API, and nothing extra to public URLs. */
function withToken(token: string): GeoJsonLoader {
  return (url, options) =>
    url.startsWith('/api/')
      ? fetchGeoJson(url, { ...options, init: { headers: { Authorization: `Bearer ${token}` } } })
      : fetchGeoJson(url, options)
}

// With a session cookie instead of a token:
//   loadGeoJson: GeoJsonLoader = (url, options) =>
//     fetchGeoJson(url, { ...options, init: { credentials: 'include' } })

const config: MapConfigInput = {
  accessibility: { ariaLabel: 'Programme sites' },
  data: {
    layers: [
      {
        id: 'sites',
        title: 'Programme sites',
        data: { url: '/api/sites', format: 'json', longitude: 'lon', latitude: 'lat' },
        featureIdField: 'site_id',
        style: { type: 'constant', symbol: { kind: 'point', fillColor: '#7c3aed' } },
      },
    ],
  },
}

@Component({
  selector: 'app-private-indicator-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" [loadGeoJson]="loadGeoJson()" />`,
})
export class PrivateIndicatorMap {
  readonly token = input.required<string>()

  protected readonly config = config
  /** Each load uses the loader of that moment, so a new token applies to the next request. */
  protected readonly loadGeoJson = computed(() => withToken(this.token()))
}
