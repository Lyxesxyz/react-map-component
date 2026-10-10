// The examples the site shows: each one is a scenario of the demos (apps/demo-shared/src/scenarios.ts),
// embedded with `?scenario=<id>&embed`, plus the example files and guides that show how to build it.
// Plain JavaScript, because astro.config.mjs reads it (through src/sidebar.mjs) before Vite runs.

/**
 * @typedef {object} Example
 * @property {string} id The demo scenario (`?scenario=<id>`).
 * @property {string} title The scenario's label in the demos' Scenario select.
 * @property {string} summary One or two sentences: what the map shows.
 * @property {string} [query] Extra query parameters for the embedded demo, starting with `&`.
 * @property {{ label: string, query: string }[]} [variants] Views of the scenario the example page
 *   switches between. The first is the one shown first, so its query is `query` ('' for none).
 * @property {boolean} [embed] False when the scenario only makes sense with the demo's own form.
 * @property {Shown[]} shows What the map shows, drawn as a small legend on the gallery card.
 * @property {number} [height] The embedded demo's height in CSS pixels (560 by default).
 * @property {string[]} react Example files in packages/geospatial-map/src/examples.
 * @property {string[]} angular Example files in packages/geospatial-map-angular/src/examples.
 * @property {{ label: string, react: string, angular: string }[]} [guides] Guide pages, as site
 *   paths below the framework (`guides/<name>/#anchor`).
 * @property {string} network What the scenario loads from the network.
 */

/**
 * What a map shows, as a legend entry on the gallery card (src/components/examples/MiniLegend.astro).
 *
 * @typedef {'polygons' | 'classes' | 'ramp' | 'lines' | 'points' | 'bubbles' | 'categories'
 *   | 'heatmap' | 'raster' | 'time' | 'grid' | 'clusters' | 'basemap' | 'themes' | 'error'
 *   | 'form' | 'parts'} Shown
 */

/** @type {Example[]} */
export const examples = [
  {
    id: 'global',
    title: 'Global choropleth',
    summary:
      'A development index in five equal-interval classes over the Esri World Basemap in Equal Earth, with breadcrumbs, a legend, settings and a popup.',
    shows: ['classes'],
    variants: [
      { label: 'Esri World Basemap', query: '' },
      { label: 'ArcGIS Equal Earth basemap', query: '&basemap=arcgis-equal-earth' },
      { label: 'Web Mercator', query: '&projection=EPSG:3857' },
      { label: 'Bundled basemap (offline)', query: '&basemap=reference-equal-earth' },
    ],
    react: ['quick-start.tsx', 'admin-choropleth.tsx'],
    angular: ['quick-start.ts', 'admin-choropleth.ts'],
    guides: [
      {
        label: 'Colouring admin areas',
        react: 'guides/layers-and-legends/#colouring-admin-areas',
        angular: 'guides/layers-and-legends/#colouring-admin-areas',
      },
    ],
    network: 'Esri World Basemap (falls back to the bundled basemap)',
  },
  {
    id: 'geometry',
    title: 'Geometry types',
    summary:
      'Polygons in classes, dashed route lines whose width follows the zoom, and labelled city points on one map.',
    shows: ['classes', 'lines', 'points'],
    react: ['symbology-layers.ts'],
    angular: ['symbology-layers.ts'],
    guides: [
      {
        label: 'Symbology',
        react: 'guides/layers-and-legends/#symbology',
        angular: 'guides/layers-and-legends/#symbology',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'points',
    title: 'Point & density layers',
    summary:
      'Graduated bubbles, categorical point symbols and a weighted heatmap in an exclusive group, with the layer panel open.',
    shows: ['bubbles', 'categories', 'heatmap'],
    react: ['symbology-layers.ts'],
    angular: ['symbology-layers.ts'],
    guides: [
      {
        label: 'Symbology',
        react: 'guides/layers-and-legends/#symbology',
        angular: 'guides/layers-and-legends/#symbology',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'layers',
    title: 'Layer controls',
    summary:
      'A grouped layer panel with visibility, opacity, reordering and metadata over five vector and raster layers.',
    shows: ['classes', 'raster', 'lines', 'points'],
    react: ['custom-layout.tsx'],
    angular: ['custom-layout.ts'],
    guides: [
      {
        label: 'Settings and panels',
        react: 'guides/configuration/#settings-and-panels',
        angular: 'guides/configuration/#settings-and-panels',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'time',
    title: 'Time series',
    summary:
      'A vector choropleth and a raster stepped through 2021–2024, with play, step and speed controls and a legend per frame.',
    shows: ['ramp', 'raster', 'time'],
    react: [],
    angular: [],
    guides: [
      {
        label: 'Time frames',
        react: 'guides/layers-and-legends/#time-frames',
        angular: 'guides/layers-and-legends/#time-frames',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'raster',
    title: 'Raster',
    summary:
      'Two XYZ raster overlays above the classified index, each with its own opacity and a gradient legend.',
    shows: ['classes', 'raster'],
    react: [],
    angular: [],
    guides: [
      {
        label: 'Layer sources',
        react: 'guides/layers-and-legends/#layer-sources',
        angular: 'guides/layers-and-legends/#layer-sources',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'grid',
    title: '3 × 2 grid',
    summary:
      'Six regional maps with synchronised layers and time, each one focusable, for report pages.',
    shows: ['grid', 'classes'],
    query: '&basemap=reference-equal-earth',
    height: 1160,
    react: ['controlled-state-and-grid.tsx'],
    angular: ['controlled-state-and-grid.ts'],
    guides: [
      {
        label: 'MapGrid',
        react: 'guides/export-grid-integration/#mapgrid',
        angular: 'guides/export-grid-integration/#mapgrid',
      },
    ],
    network: 'None (bundled basemap)',
  },
  {
    id: 'configuration',
    title: 'Configuration playground',
    summary:
      'A form that switches the UI profile, control placement, panels, density, Bulgarian labels and JSON UI overrides on a live map.',
    shows: ['form', 'classes'],
    embed: false,
    react: [],
    angular: [],
    guides: [
      {
        label: 'Profiles',
        react: 'guides/configuration/#profiles',
        angular: 'guides/configuration/#profiles',
      },
      {
        label: 'Localization',
        react: 'guides/theming-localization/#localization',
        angular: 'guides/theming-localization/#localization',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'composed',
    title: 'Composed parts & styling',
    summary:
      'A hand-composed map: controls top-left with a custom button, a restyled legend card, a popup, a badge that reads map state, and brand tokens.',
    shows: ['parts', 'classes', 'lines'],
    react: ['custom-layout.tsx', 'brand-theme.tsx', 'brand-theme.css'],
    angular: ['custom-layout.ts', 'brand-theme.ts', 'brand-theme.css'],
    guides: [
      {
        label: 'Composition',
        react: 'guides/state-events-slots/#composition',
        angular: 'guides/state-events-templates/#composition',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'quickstart',
    title: 'Quick start (short config)',
    summary:
      'The shortest configuration: the map fills its frame and its GeoJSON comes through a custom loader.',
    shows: ['polygons'],
    react: ['quick-start.tsx', 'authenticated-data.tsx'],
    angular: ['quick-start.ts', 'authenticated-data.ts'],
    guides: [
      {
        label: 'Short form',
        react: 'guides/getting-started/#short-form',
        angular: 'guides/getting-started/#short-form',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'features',
    title: 'Basemap, clusters & overlays',
    summary:
      'Clustered monitoring stations on the built-in world basemap, with an anchored popup, a hover tooltip and an OpenLayers overlay.',
    shows: ['clusters', 'points'],
    react: ['custom-layout.tsx', 'arcgis-indicators.tsx'],
    angular: ['custom-layout.ts', 'arcgis-indicators.ts'],
    network: 'None (bundled basemap)',
  },
  {
    id: 'arcgis',
    title: 'ArcGIS basemap + indicators',
    summary:
      'An Equal Earth vector basemap from ArcGIS Online set by URL alone, with an index overlay, labels above the data and a disclaimer.',
    shows: ['basemap', 'ramp'],
    react: ['arcgis-indicators.tsx'],
    angular: ['arcgis-indicators.ts'],
    network: 'ArcGIS Online (tiles.arcgis.com)',
  },
  {
    id: 'themes',
    title: 'Design-system themes',
    summary:
      'The same timed map restyled as Material 3, IBM Carbon or an editorial print theme, light or dark, with each theme’s icon set.',
    shows: ['themes', 'ramp', 'time'],
    query: '&theme=material',
    variants: [
      { label: 'Material 3', query: '&theme=material' },
      { label: 'IBM Carbon', query: '&theme=carbon' },
      { label: 'Editorial', query: '&theme=editorial' },
      { label: 'Default', query: '&theme=default' },
      { label: 'Carbon, dark', query: '&theme=carbon&dark' },
    ],
    react: ['brand-theme.tsx', 'brand-theme.css'],
    angular: ['brand-theme.ts', 'brand-theme.css'],
    guides: [
      {
        label: 'Theme recipes',
        react: 'guides/theming-localization/#theme-recipes',
        angular: 'guides/theming-localization/#theme-recipes',
      },
    ],
    network: 'Esri World Basemap',
  },
  {
    id: 'errors',
    title: 'Error handling',
    summary:
      'An optional layer whose URL returns 404: the error alert and the layer’s error state show while the rest of the map keeps working.',
    shows: ['classes', 'error'],
    react: ['map-ready-check.ts'],
    angular: ['map-ready-check.ts'],
    guides: [
      {
        label: 'Error codes',
        react: 'guides/troubleshooting/#error-codes',
        angular: 'guides/troubleshooting/#error-codes',
      },
    ],
    network: 'Esri World Basemap',
  },
]
