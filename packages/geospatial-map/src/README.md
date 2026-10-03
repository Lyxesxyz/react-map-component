# Geospatial map

An interactive React map for indicator pages, delivered the way shadcn/ui delivers its components: **you copy this folder into your app and own the code**. It renders with OpenLayers (Equal Earth and Web Mercator), and it has a layer panel, legends, popups, time playback, a six-map grid, and PNG/JPEG/SVG export.

- **Drop-in.** Run one install command, copy the folder, and add one CSS import. There's no build step and no path aliases, and nothing outside this folder is imported.
- **Composable.** Use the ready-made `<GeospatialMap>` layout, or build your own from `<MapRoot>` plus the parts you want.
- **Easy to restyle.** Override `--geo-*` CSS variables, pass `className` to any part, or edit the source.

## 1. Install

```sh
npm install ol ol-mapbox-style proj4 typebox lucide-react
npm install -D @types/geojson
```

(Or `pnpm add …` / `yarn add …`.)

- **React:** 18.3+ or 19.
- **TypeScript:** `"moduleResolution": "bundler"`, which is the default in Vite and Next.js.
- **lucide-react:** 0.360 or newer. For older versions, see [Icons](#icons).
- **`typebox`:** the unscoped 1.x package, not `@sinclair/typebox`.

## 2. Copy this folder

Copy it into your app, for example to `src/components/geospatial-map/`. The path is up to you; the examples below assume the `@/components/geospatial-map` alias that Vite and Next.js templates set up.

## 3. Import the styles once

Import the stylesheet in your app entry, **before your own CSS**:

```ts
// Vite: src/main.tsx · Next.js App Router: app/layout.tsx · Pages Router: pages/_app.tsx
import '@/components/geospatial-map/geospatial-map.css'
```

The map inherits your app's font. Set `--geo-font-family` if you want a different one.

## Quick start

```tsx
import {
  GeospatialMap,
  defineMapConfig,
  initialMapState,
  type MapLayerConfig,
} from '@/components/geospatial-map'

const layers: MapLayerConfig[] = [
  {
    id: 'regions',
    title: 'Regions',
    role: 'indicator',
    kind: 'geojson',
    data: { url: '/data/regions.geojson' }, // or an inline FeatureCollection
    featureIdField: 'id',
    style: {
      type: 'constant',
      symbol: { kind: 'polygon', fillColor: '#60a5fa', strokeColor: '#fff' },
    },
  },
]

const config = defineMapConfig({
  version: 1,
  accessibility: { ariaLabel: 'Regions map' },
  initialState: initialMapState(
    { center: [0, 20], zoom: 1.2, projection: 'EPSG:8857' },
    layers,
    'plain',
  ),
  view: {},
  data: {
    layers,
    basemaps: [
      {
        id: 'plain',
        title: 'Plain',
        supportedProjections: ['EPSG:8857', 'EPSG:3857'],
        layers: [],
        backgroundColor: '#dbeafe',
        attribution: [],
        exportable: true,
      },
    ],
  },
  ui: { profile: 'full' },
})

export function RegionsMap() {
  return (
    <GeospatialMap config={config} onFeatureSelect={(event) => console.log(event?.featureId)} />
  )
}
```

How the config works:

- `config` is plain JSON, so it can come from a CMS or an API. Validate untrusted JSON with `validateMapConfig()` first.
- `config.ui` chooses a profile (`full`, `compact`, `embedded`, `grid`) and switches panels on or off. It also places each panel in a corner.
- `config.theme` and `config.messages` adjust colours and text per map.

## Build your own layout

`<GeospatialMap>` is `<MapRoot>` plus every part, arranged from `config.ui`. To decide yourself what appears and where, compose the parts directly:

```tsx
import {
  MapAttribution,
  MapControlGroup,
  MapControls,
  MapLayerPanel,
  MapLayersButton,
  MapLegend,
  MapPopup,
  MapRoot,
  MapZoomInButton,
  MapZoomOutButton,
} from '@/components/geospatial-map'

export function RegionsMap() {
  return (
    <MapRoot config={config} className="regions-map">
      <MapControls placement="top-left">
        <MapControlGroup>
          <MapZoomInButton />
          <MapZoomOutButton />
        </MapControlGroup>
        <MapControlGroup>
          <MapLayersButton />
        </MapControlGroup>
      </MapControls>
      <MapLayerPanel placement="top-left" allowReorder={false} />
      <MapLegend placement="bottom-right" className="regions-legend" />
      <MapPopup>{({ selection }) => <RegionStats id={selection.featureId} />}</MapPopup>
      <MapAttribution compact />
    </MapRoot>
  )
}
```

Every part follows the same rules:

- It accepts `className`, `style`, and the HTML attributes of its root element.
- `placement` (`top-left`, `top-right`, `bottom-left`, `bottom-right`) and behaviour props (`allowOpacity`, `layout`, `compact`…) default to the matching `config.ui` value, so passing a prop only overrides that one setting.
- A part renders when you include it. Panels open from their buttons.

| Part                                                                                                                                                          | What it renders                                                                                                                                            | Notable props                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `MapRoot`                                                                                                                                                     | Map frame, OpenLayers viewport, state, and context. Takes `ref` for `fit`, `fitSelection`, `exportImage`, `getState`.                                      | `config`, `state`, `onStateChange`, all `on*` callbacks                                                |
| `MapControls`                                                                                                                                                 | Control rail. Without children, it renders `config.ui.controlRail.groups`.                                                                                 | `placement`, `groups`                                                                                  |
| `MapControlGroup`                                                                                                                                             | Joins buttons visually.                                                                                                                                    | —                                                                                                      |
| `MapZoomInButton`, `MapZoomOutButton`, `MapResetZoomButton`, `MapLocateButton`, `MapLayersButton`, `MapSettingsButton`, `MapFitButton`, `MapFullscreenButton` | Built-in rail buttons.                                                                                                                                     | `label`, `children` (icon); an `onClick` that calls `event.preventDefault()` skips the built-in action |
| `MapControlButton`                                                                                                                                            | A rail-styled icon button for your own controls.                                                                                                           | `label`, `active`                                                                                      |
| `MapLayerPanel`                                                                                                                                               | Layer visibility, opacity, order, and status.                                                                                                              | `allowVisibility`, `allowOpacity`, `allowReorder`, `groupBy`, `header`, `footer`, `open`               |
| `MapSettings`                                                                                                                                                 | Projection, basemap, area, and export fields. Also exported separately as `MapProjectionField`, `MapBasemapField`, `MapZoomTargetField`, `MapExportField`. | `fields`, `header`, `footer`, `open`                                                                   |
| `MapLegend`                                                                                                                                                   | Legends for visible layers. `MapLegendSymbol` draws one swatch.                                                                                            | `layout`, `defaultOpen`, `header`, `footer`                                                            |
| `MapPopup`                                                                                                                                                    | Dialog for the selected feature.                                                                                                                           | `children`: a node, or `({ selection, close, state, actions }) => node`                                |
| `MapTimeControls`                                                                                                                                             | Time slider and playback (renders only for time-aware layers).                                                                                             | `speedsMs`, `loop`, `autoplay`                                                                         |
| `MapBreadcrumbs`                                                                                                                                              | Geographic hierarchy that zooms on click.                                                                                                                  | `items`, `onItemClick`                                                                                 |
| `MapStatus`, `MapErrorAlert`                                                                                                                                  | Loading and no-data chips; recoverable error alert.                                                                                                        | `loading`, `empty`, `dismissible`                                                                      |
| `MapAttribution`                                                                                                                                              | Source attribution (keep it visible when sources require it).                                                                                              | `compact`                                                                                              |
| `MapGrid`                                                                                                                                                     | Up to six synchronized `GeospatialMap`s.                                                                                                                   | `config`, `cellClassName`                                                                              |

### Custom parts

Any component rendered inside `<MapRoot>` can use the map:

```tsx
import { useMap, useMapActions } from '@/components/geospatial-map'

function SelectedArea() {
  const { selectedFeature, messages } = useMap() // state, legends, statuses, ui, config…
  return <p className="selected-area">{selectedFeature?.featureId ?? messages.selectionCleared}</p>
}

function HomeButton() {
  const { fit } = useMapActions() // stable; does not re-render when the map moves
  return <button onClick={() => fit([-180, -90, 180, 90])}>World</button>
}
```

Give custom parts `position: absolute` and use the `--geo-inset` token so they line up with the built-in ones. OpenLayers objects are deliberately not exposed: parts talk to the map through `useMap()` and the actions.

## Styling

### Tokens

All colours and sizes are CSS variables. Override them on `:root` for the whole app, or on any wrapper or the map's `className` for one map:

```css
.regions-map {
  --geo-primary: #7c3aed;
  --geo-radius: 6px;
  --geo-height: 520px;
}
```

| Token                                                  | Default (light)          | Used for                                                                                                                      |
| ------------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `--geo-background` / `--geo-foreground`                | `#ffffff` / `#18181b`    | Panel surface and text                                                                                                        |
| `--geo-muted` / `--geo-muted-foreground`               | `#f4f4f5` / `#71717a`    | Secondary surfaces and text                                                                                                   |
| `--geo-primary` / `--geo-primary-foreground`           | `#0f766e` / `#ffffff`    | Switches, sliders, links, hover borders                                                                                       |
| `--geo-primary-hover`                                  | `#115e59`                | Links and pressed states                                                                                                      |
| `--geo-accent`                                         | tint of primary          | Button hover surface (optional)                                                                                               |
| `--geo-destructive`                                    | `#a61b1b`                | Errors                                                                                                                        |
| `--geo-border` / `--geo-input` / `--geo-ring`          | translucent              | Borders, control borders, focus ring                                                                                          |
| `--geo-overlay`                                        | `rgba(255,255,255,0.94)` | Floating panels (glass)                                                                                                       |
| `--geo-stage`                                          | `#cfe4f2`                | Backdrop before the basemap paints                                                                                            |
| `--geo-radius`, `--geo-shadow`, `--geo-shadow-sm`      | `12px`, soft shadows     | Shape                                                                                                                         |
| `--geo-control-size`, `--geo-inset`, `--geo-font-size` | `42px`, `14px`, `14px`   | Density and spacing                                                                                                           |
| `--geo-height`                                         | `680px`                  | Map height. Narrow maps (<680px wide) use `--geo-height-narrow` (`700px`), `--geo-inset-narrow`, `--geo-control-size-narrow`. |
| `--geo-font-family`                                    | your app's font          | All map text, canvas labels, exports                                                                                          |
| `--geo-selection-fill` / `-stroke` / `-line`           | amber / near-black       | Selected feature on the map and in exports                                                                                    |
| `--geo-label-color` / `--geo-label-halo`               | `#172033` / `#ffffff`    | Map labels                                                                                                                    |
| `--geo-export-background` / `-foreground` / `-muted`   | white / dark             | Exported report images                                                                                                        |

The canvas and export tokens are read with `getComputedStyle`, so they follow your CSS too.

### Dark mode

Add `.dark` (or `data-theme="dark"`) to `<html>`, a wrapper, or the map, and the tokens switch. Use `.light` / `data-theme="light"` to switch back inside a dark area. If you override tokens for a brand, override the dark values as well:

```css
.dark .regions-map {
  --geo-primary: #a78bfa;
}
```

The basemap and layer colours come from your config (data), not from the theme.

### Classes and states

- **Stable class names.** Every element has a stable `geo-*` class: `geo-map-root`, `geo-map-stage`, `geo-map-controls`, `geo-layer-panel`, `geo-layer-item`, `geo-legend`, `geo-legend-entry`, `geo-popup`, `geo-time-controls`, `geo-attribution`, and so on.
- **Part markers.** Each part also carries `data-slot="map-legend"` (shadcn convention).
- **State attributes:** `data-placement`, `data-state` (time playback), `data-visible` (layers), `data-active` (control buttons), `data-density`.
- **Specificity.** Every rule in `geospatial-map.css` has the specificity of a **single class**. Qualifiers sit in `:where()`. As a result:
  - one class of yours, loaded after the stylesheet, always wins;
  - your global element resets (`button { font: inherit }`, `* { margin: 0 }`) can't break the map.

```css
.regions-legend {
  width: 320px;
  border-left: 4px solid var(--geo-primary);
}
.geo-layer-item[data-visible='false'] {
  opacity: 0.6;
}
```

### Theme from JSON

`config.theme` sets a few tokens per map from data. This is useful when the theme comes from a CMS.

- Keys map onto variables: `accentColor` → `--geo-primary`, `textColor` → `--geo-foreground`, `surfaceColor` → `--geo-background`, and so on (see `theme.ts`).
- `density: 'compact'` sets `data-density="compact"`.
- Only the keys you set are written, as inline styles on the map root.

### Using shadcn/ui tokens

If your app has shadcn/ui variables, paste this to make the map match (dark mode follows automatically):

```css
:root {
  --geo-background: var(--card);
  --geo-foreground: var(--card-foreground);
  --geo-muted: var(--muted);
  --geo-muted-foreground: var(--muted-foreground);
  --geo-primary: var(--primary);
  --geo-primary-foreground: var(--primary-foreground);
  --geo-primary-hover: var(--primary);
  --geo-accent: var(--accent);
  --geo-accent-foreground: var(--accent-foreground);
  --geo-destructive: var(--destructive);
  --geo-border: var(--border);
  --geo-input: var(--input);
  --geo-ring: var(--ring);
  --geo-overlay: var(--popover);
  --geo-radius: var(--radius);
}
```

### Using Tailwind

Import the stylesheet into the components layer, so utility classes passed through `className` override it:

```css
@import './components/geospatial-map/geospatial-map.css' layer(components);
```

If you want conflicting utilities merged, swap the tiny `cn()` in `utils.ts` for `clsx` + `tailwind-merge`.

### Your design system's components

Every button, select, slider, switch, card, badge, alert, and label comes from **`shapes.tsx`**. Keep the exported names and props and replace the bodies to use your own components. For example, with shadcn/ui:

```tsx
// shapes.tsx
import { Button } from '@/components/ui/button'

export const ShapeButton = forwardRef<HTMLButtonElement, ShapeButtonProps>(function ShapeButton(
  { className, ...props },
  ref,
) {
  return (
    <Button ref={ref} variant="outline" className={cn('geo-shape-button', className)} {...props} />
  )
})
```

### Icons

Every icon comes from **`icons.ts`**, under semantic names (`ZoomInIcon`, `LayersIcon`, `CloseIcon`…). Re-export any component that accepts SVG props to use a different icon set. On lucide-react older than 0.360, change `LoaderCircle` to `Loader2`.

## Framework notes

- **Next.js App Router.**
  - Every module that uses React state starts with `'use client'`, so the parts work as client components.
  - Render the map from your own client component when you pass callbacks or slots, because functions can't cross the server/client boundary.
  - `defineMapConfig`, `validateMapConfig`, and the types are server-safe, so a server component can build or validate the config and pass it down.
  - To keep the map out of the initial bundle, wrap it in `next/dynamic` with `ssr: false`.
- **Server rendering.** The map renders an accessible shell on the server. OpenLayers starts after mount.
- **Size.** The map fills its container's width and is `--geo-height` tall. It resizes itself, including when revealed from a hidden container.

## What's in this folder

| File                                                  | What it is                       | Edit it?                |
| ----------------------------------------------------- | -------------------------------- | ----------------------- |
| `geospatial-map.css`                                  | Tokens and all styles            | Yes, freely             |
| `geospatial-map.tsx`, `map-grid.tsx`                  | Ready-made layouts               | Yes                     |
| `map-*.tsx`                                           | The parts                        | Yes                     |
| `shapes.tsx`, `icons.ts`, `utils.ts`                  | UI primitives, icons, `cn()`     | Yes (swap points)       |
| `messages.ts`, `theme.ts`                             | English copy, JSON theme mapping | Yes                     |
| `map-root.tsx`, `map-context.ts`, `use-map-engine.ts` | Map lifecycle and context        | Rarely                  |
| `config.ts`, `types.ts`, `map-state.ts`               | Config schema, validation, types | Rarely                  |
| `core/`                                               | OpenLayers engine (no React)     | Only for engine changes |

The JSON Schema for the config is exported as `mapConfigSchema`; the source repository's `pnpm schema` command writes it to a file. Detailed guides for layers, symbology, time, export, embedding, and the grid live in the source repository's `packages/geospatial-map/docs/`.

## Updating

Because you own the copy, updates are a diff rather than an `npm update`. Keep your changes in the parts, `shapes.tsx`, `icons.ts`, and the CSS. Then a newer upstream `core/`, `config.ts`, `types.ts`, and engine files can be copied over with few conflicts.
