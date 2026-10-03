'use client'

// Example: data behind authentication. Wrap the built-in loader (`fetchGeoJson`) so GeoJSON,
// CSV and ArcGIS sources keep working; only the request changes.
// Task: "our indicator API needs a token". See README.md → Data that needs authentication.

import { GeospatialMap, fetchGeoJson, type GeoJsonLoader } from '..'

/** Sends a bearer token to your own API, and nothing extra to public URLs. */
function withToken(token: string): GeoJsonLoader {
  return (url, options) =>
    url.startsWith('/api/')
      ? fetchGeoJson(url, { ...options, init: { headers: { Authorization: `Bearer ${token}` } } })
      : fetchGeoJson(url, options)
}

// With a session cookie instead of a token:
//   loadGeoJson={(url, options) => fetchGeoJson(url, { ...options, init: { credentials: 'include' } })}

export function PrivateIndicatorMap({ token }: { token: string }) {
  return (
    <GeospatialMap
      config={{
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
      }}
      loadGeoJson={withToken(token)}
    />
  )
}
