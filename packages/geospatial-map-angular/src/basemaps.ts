import type {
  ArcGISVectorTileLayerConfig,
  AttributionSpec,
  BasemapConfig,
  BasemapLayerConfig,
  ProjectionDefinition,
  ProjectionId,
  StyleOverride,
} from './types'

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
        kind: 'xyz',
        url: options.url,
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
  }
}

export type ArcGISBasemapOptions = {
  /**
   * The basemap: a `…/VectorTileServer` URL, an ArcGIS Online item page
   * (`https://www.arcgis.com/home/item.html?id=…`) of a vector tile service or style, or the id.
   */
  url: string
  /** Basemap id; defaults to `'arcgis'`. */
  id?: string
  /** Name shown in the basemap picker; defaults to `'Basemap'`. */
  title?: string
  /**
   * Changes to the basemap style: border colours and widths, hidden layers. Patterns match style
   * layer ids; the console lists the ids when a pattern matches nothing.
   *
   * ```ts
   * styleOverrides: [{ layers: 'Boundary line/Admin1*', color: '#555', width: 1.2 }]
   * ```
   */
  styleOverrides?: StyleOverride[]
  /** Draw the basemap's labels and borders above your data layers. Default `true`. */
  labelsAboveData?: boolean
  /** Style JSON to use instead of the service's default style. */
  styleUrl?: string
  /** Credit to show; defaults to the service's copyright text. */
  attribution?: AttributionSpec[]
  /** Whether exports may include the basemap. Default `true`. */
  exportable?: boolean
  /** Only for services in a spatial reference the map does not recognise. */
  sourceProjectionDefinition?: ProjectionDefinition
}

/**
 * A basemap from an ArcGIS vector tile service, configured with just its URL. The map reads the
 * service when it loads and uses its projection, tile grid, style and copyright, so an Equal Earth
 * basemap makes the map Equal Earth. Labels and borders are drawn above your data by default.
 *
 * ```ts
 * basemaps: [arcgisBasemap({ url: 'https://…/VectorTileServer' })]
 * ```
 */
export function arcgisBasemap(options: ArcGISBasemapOptions): BasemapConfig {
  const id = options.id ?? 'arcgis'
  const title = options.title ?? 'Basemap'
  const shared: Omit<ArcGISVectorTileLayerConfig, 'id' | 'title'> = {
    kind: 'arcgis-vector-tiles',
    url: options.url,
    showInLayerControl: false,
    exportable: options.exportable ?? true,
    ...(options.sourceProjectionDefinition
      ? { sourceProjectionDefinition: options.sourceProjectionDefinition }
      : {}),
    ...(options.attribution ? { attribution: options.attribution } : {}),
  }
  const style = (layers?: 'base' | 'reference') => ({
    mapboxStyle: {
      ...(options.styleUrl ? { url: options.styleUrl } : {}),
      ...(layers ? { layers } : {}),
      ...(options.styleOverrides ? { overrides: options.styleOverrides } : {}),
    },
  })
  const layers: BasemapLayerConfig[] =
    options.labelsAboveData === false
      ? [{ ...shared, ...style(), id: `${id}-tiles`, title }]
      : [
          { ...shared, ...style('base'), id: `${id}-base`, title },
          {
            ...shared,
            ...style('reference'),
            id: `${id}-labels`,
            title: `${title} labels`,
            aboveOverlays: true,
          },
        ]
  return {
    id,
    title,
    supportedProjections: [],
    layers,
    backgroundColor: 'var(--geo-basemap-water)',
    attribution: options.attribution ?? [],
    exportable: options.exportable ?? true,
  }
}
