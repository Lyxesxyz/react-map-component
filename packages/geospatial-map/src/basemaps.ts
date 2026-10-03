import type { AttributionSpec, BasemapConfig, ProjectionId } from './types'

// Ready-made basemaps. Plain configuration objects: safe to import on the server and to store.

const naturalEarth: AttributionSpec = {
  label: 'Natural Earth',
  url: 'https://www.naturalearthdata.com/',
  license: 'Public domain',
}

/**
 * Country outlines on a water background, coloured by the `--geo-basemap-water`,
 * `--geo-basemap-land` and `--geo-basemap-border` tokens (so it follows dark mode). The data
 * (Natural Earth 1:110m, about 68 KB) ships with the component and loads on first use, so it
 * needs no network access or API key. Works in Equal Earth and Web Mercator. The default when a
 * configuration lists no basemaps.
 */
export const worldBasemap: BasemapConfig = {
  id: 'world',
  title: 'World',
  supportedProjections: ['EPSG:8857', 'EPSG:3857'],
  layers: [
    {
      id: 'world-outlines',
      title: 'Countries',
      role: 'basemap',
      kind: 'geojson',
      data: { builtin: 'world' },
      style: {
        type: 'constant',
        symbol: {
          kind: 'polygon',
          fillColor: 'var(--geo-basemap-land)',
          strokeColor: 'var(--geo-basemap-border)',
          strokeWidth: 0.6,
        },
      },
      showInLayerControl: false,
      attribution: [naturalEarth],
      exportable: true,
    },
  ],
  backgroundColor: 'var(--geo-basemap-water)',
  attribution: [naturalEarth],
  exportable: true,
}

/** No geography: only the `--geo-stage` background behind your layers. */
export const plainBasemap: BasemapConfig = {
  id: 'plain',
  title: 'Plain',
  supportedProjections: ['EPSG:8857', 'EPSG:3857'],
  layers: [],
  backgroundColor: 'transparent',
  attribution: [],
  exportable: true,
}

export type TileBasemapOptions = {
  /** Tile URL template with `{z}`, `{x}` and `{y}`, for example from your tile provider. */
  url: string
  /** Credit the provider requires. Shown in the attribution bar and exports. */
  attribution: AttributionSpec | string
  /** Basemap id; defaults to `'tiles'`. Give each basemap in a config its own id. */
  id?: string
  /** Name shown in the basemap picker; defaults to the attribution label. */
  title?: string
  /** Projections to show it in. Defaults to Web Mercator, the projection of almost all tile services. */
  projections?: ProjectionId[]
  /** Projection of the tiles themselves; defaults to `'EPSG:3857'`. */
  tileProjection?: string
  /** Highest zoom level the service provides. */
  maxZoom?: number
  /** Color shown while tiles load. Defaults to the `--geo-basemap-water` token. */
  backgroundColor?: string
  /**
   * Whether exports may include the tiles. Defaults to `false`: check the provider's terms first.
   * Export also needs the provider to send CORS headers.
   */
  exportable?: boolean
  /** Browser CORS mode for tile images; defaults to `'anonymous'`. */
  crossOrigin?: 'anonymous' | 'use-credentials'
}

/**
 * A basemap from any raster tile service (OpenStreetMap-style `{z}/{x}/{y}` URLs).
 *
 * ```ts
 * tileBasemap({
 *   url: 'https://tiles.example.com/{z}/{x}/{y}.png',
 *   attribution: { label: '© Example Maps', url: 'https://example.com/copyright' },
 * })
 * ```
 */
export function tileBasemap(options: TileBasemapOptions): BasemapConfig {
  const attribution =
    typeof options.attribution === 'string' ? { label: options.attribution } : options.attribution
  const id = options.id ?? 'tiles'
  const exportable = options.exportable ?? false
  return {
    id,
    title: options.title ?? attribution.label,
    supportedProjections: options.projections ?? ['EPSG:3857'],
    layers: [
      {
        id: `${id}-tiles`,
        title: options.title ?? attribution.label,
        role: 'basemap',
        kind: 'xyz',
        urlTemplate: options.url,
        sourceProjection: options.tileProjection ?? 'EPSG:3857',
        ...(options.maxZoom === undefined ? {} : { maxSourceZoom: options.maxZoom }),
        ...(options.crossOrigin ? { crossOrigin: options.crossOrigin } : {}),
        showInLayerControl: false,
        attribution: [attribution],
        exportable,
      },
    ],
    backgroundColor: options.backgroundColor ?? 'var(--geo-basemap-water)',
    attribution: [attribution],
    exportable,
    network: true,
  }
}
