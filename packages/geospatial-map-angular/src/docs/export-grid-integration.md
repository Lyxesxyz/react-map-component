# Export, grids, Angular CLI, and server rendering

## Report exports

Users export from the settings panel's `export` field (on by default; `export: { enabled: false }` hides it). From code, use the actions (`#map="geoMap"` and `map.actions`, `injectMapActions()`, or a template's `actions`):

- `exportImage(options)` returns the report as a `Promise<Blob>`. If it fails, it rejects with an `Error` whose `mapError` property is the `MapError`: `EXPORT_CORS_BLOCKED`, `EXPORT_TIMEOUT`, `EXPORT_FAILED`, or a layer's `SOURCE_LOAD_FAILED`.
- `downloadImage(format)` exports with the configured `config.export` options and downloads the file. A failure shows in the error alert and reaches `(mapError)`.

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { GeospatialMap, type MapActions, type MapError } from './geospatial-map'

@Component({
  selector: 'app-report-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map #map="geoMap" [config]="config" />
    <button type="button" (click)="attach(map.actions)">Attach the map to the report</button>
    <button type="button" (click)="map.actions.downloadImage('image/svg+xml')">Download SVG</button>
    @if (failure()) {
      <p role="alert">{{ failure() }}</p>
    }
  `,
})
export class ReportMap {
  protected readonly config = config
  protected readonly failure = signal<string | null>(null)

  protected async attach(actions: MapActions): Promise<void> {
    try {
      const blob = await actions.exportImage({ format: 'image/png', selectedAreaLabel: 'Kenya' })
      await uploadReportImage(blob)
    } catch (error) {
      const mapError = (error as { mapError?: MapError }).mapError
      this.failure.set(mapError?.message ?? 'The export failed.')
    }
  }
}
```

PNG, JPEG, and SVG reports have the same layout: header, map, legend, disclaimer, and attribution. The legend is the one on screen, including hand-written `legend.entries`.

What an export does when you leave the options out:

- **Size.** The report is 1200 × 720 report pixels, the legend and text included. `width`, `height`, and `pixelRatio` (1 to 3) change it. The map is drawn at the export size and is back at its screen size afterwards, even after a failed export.
- **Options.** `exportImage` and `downloadImage` both use `config.export` for the report options you don't pass. The title defaults to `accessibility.ariaLabel`, and the disclaimer to the configured one.
- **Report text.** The header lines come from the messages `exportTime` ("Time: {time}", when a frame is shown), `exportSelectedArea` ("Selected area: {area}", when you pass `selectedAreaLabel`), and `exportScale` ("Scale: zoom {zoom} · {projection}"). Translate them in `config.messages`.
- **Order.** Exports run one after another, in the order they were asked for. A second export waits for the first.
- **Loading.** An export waits for every visible layer to load, up to `timeoutMs` (10 seconds), then for fonts and a drawn frame. An optional layer that failed is exported without its data. A `required` layer that failed fails the export.

PNG and JPEG require every visible tile/image source to permit anonymous CORS canvas access. SVG is vector-native when every visible layer is GeoJSON; otherwise the map inside the SVG report is a raster image, with the same CORS requirement. Vector SVG draws what the canvas draws: symbol sizes from `radiusStops` and `widthStops` at the current zoom, layer opacity, drawing order, and the selection.

## Embed pages

There are no embed helpers. An embed page is an ordinary page (a route of your app) that renders `<geo-map>` from a config your server approved. Check that config with `validateMapConfig` before you render it. Storing configs, authorization, CSP, and public-data policy stay with the host.

## MapGrid

`<geo-map-grid>` (`MapGrid`) takes one `MapGridConfig`:

- `shared` is the map config every cell uses, in the short form (`MapConfigInput`).
- `maps` lists one to six cells: `{ id, title, initialState?, layers? }`. A cell's `initialState` is partial and is merged over the shared one. Its `layers` replace the shared layers. The grid follows the list: add or remove a cell and the map appears or goes.
- `layout` sets `columns`, `tabletColumns` (below 980 px), `mobileColumns` (below 680 px), `gapPx`, and `cellHeightPx`.
- `sync` turns synchronization on for `view`, `layers`, `time`, and `selection`, each independently. Only changes a user or an action made (origin `'user'` or `'api'`) are passed to the other maps. The changes a map makes to follow the grid are not passed on, so they don't echo back.
- `focus.enabled` (default `true`) adds a button to each cell that shows that map alone, with its full UI.

Unfocused cells use your `shared.ui` with `profile: 'grid'`, so your other `ui` settings still apply. A focused cell uses `shared.ui` as written.

A changed grid config starts each map's state over from its config. A config you rebuild with new layers or a new starting zoom therefore shows them. A config rebuilt with the same content (in a `computed`, for example) keeps the maps' state.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core'
import {
  MapGrid,
  type MapError,
  type MapGridConfig,
  type MapGridEvent,
  type MapGridStateChangeEvent,
} from './geospatial-map'

@Component({
  selector: 'app-unemployment-grid',
  imports: [MapGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <geo-map-grid [config]="grid" (stateChangeDetails)="save($event)" (mapError)="failed($event)" />
  `,
})
export class UnemploymentGrid {
  protected readonly grid: MapGridConfig = {
    shared: { accessibility: { ariaLabel: 'Unemployment' }, data: { layers } },
    maps: [
      { id: 'y2020', title: '2020', initialState: { time: '2020' } },
      { id: 'y2024', title: '2024', initialState: { time: '2024' } },
    ],
    layout: { columns: 2 },
    sync: { view: true, layers: true },
  }

  protected save({ state, mapId, change }: MapGridStateChangeEvent): void {
    if (mapId === null) saveFocus(state.focusedMapId)
    else saveView(mapId, state.maps[mapId]!.view, change?.origin)
  }

  protected failed({ mapId, event }: MapGridEvent<MapError>): void {
    report(mapId, event.code)
  }
}
```

The grid state (`MapGridState`) holds each map's complete state and the focused map: `{ maps, focusedMapId }`. Bind `[(state)]` to control the grid: `(stateChange)` emits the complete grid state after every change. `(stateChangeDetails)` emits the same state with where it came from (`MapGridStateChangeEvent`):

- After a change in one map, `mapId` is that map's ID and `change` is its `MapStateChange`.
- After a focus change, `mapId` is `null` and `change` is undefined.

Several updates in the same tick, such as two synchronised maps reporting at once, all apply. [`examples/controlled-state-and-grid.ts`](../examples/controlled-state-and-grid.ts) has a grid of six synchronised maps. The `geoMapPopup`, `geoMapTooltip` and `geoMapControl` templates you put inside the grid, and `[icons]`, go to every cell. `cellClassName` adds a class to every cell.

The per-map outputs (`(ready)`, `(viewChange)`, `(featureHover)`, `(featureSelect)`, `(layerStateChange)`, `(timeChange)`, `(mapError)`, `(statusChange)` and `(metric)`) come from every cell. An output has one payload, so each one emits a `MapGridEvent`: `{ mapId, event }`.

With more than six maps, the grid shows the `tooManyGridMaps` message as an alert instead.

## Angular CLI

Copy the folder to `src/app/geospatial-map` and add its stylesheet to `styles` in `angular.json`, before your own styles:

```json
"styles": ["src/app/geospatial-map/geospatial-map.css", "src/styles.css"]
```

Or import it at the top of `src/styles.css`:

```css
@import './app/geospatial-map/geospatial-map.css';
```

Import the parts and helpers from the folder's `index.ts`. No path alias is needed; a `paths` alias in `tsconfig.json` works too if you prefer one.

```ts
import { GeospatialMap, defineMapConfig, type MapConfig } from './geospatial-map'
```

The folder compiles with the settings `ng new` writes (`strict`, `strictTemplates`, `noPropertyAccessFromIndexSignature`): the source repository builds it in fresh Angular 21 and 22 apps. Every component is standalone and `OnPush`. It needs no NgModule, no RxJS, no `@angular/forms` and no CDK.

**Bundle budgets.** A fresh app that shows the map on its first page has an initial bundle of about 1.3 MB (about 320 kB compressed), mostly OpenLayers. That is above the 1 MB error budget `ng new` writes, so `ng build` fails. Load the map with `@defer` or a lazy route ([below](#deferred-loading)), which keeps the first page at about 190 kB, or raise the budget:

```json
"budgets": [
  { "type": "initial", "maximumWarning": "1.6MB", "maximumError": "2MB" },
  { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
]
```

## Zoneless and zone.js

New Angular 21 apps are zoneless, and so is the map: map events reach the UI by writing signals, and nothing in the folder needs zone.js.

In an app that still loads zone.js (`provideZoneChangeDetection()`), the map works the same. OpenLayers runs outside the Angular zone, so dragging the map doesn't run change detection on every frame. The outputs that follow map events are emitted outside the zone too: keep what you take from them in signals, which update the view either way. `exportImage()` and `downloadImage()` resolve in the zone you called them from.

## Server rendering and hydration

Add server rendering with `ng add @angular/ssr` (or `ng new --ssr`). The map needs nothing more:

- The server renders an accessible shell: the map element with `data-status="loading"`, its controls and the parts the config alone fills. OpenLayers, `ResizeObserver`, `matchMedia`, geolocation and fullscreen are used only in the browser, after render, so you need no `isPlatformBrowser` checks around the map.
- With hydration (`provideClientHydration()`), the map hydrates like the rest of the page. OpenLayers adds its own elements after hydration, so the map needs no `ngSkipHydration`.
- `defineMapConfig`, `validateMapConfig`, the basemap helpers (`arcgisBasemap`, `worldBasemap`, …) and the types run on the server too, so the server can build or check a config before it renders.
- Data URLs are fetched by the map in the browser. Relative URLs (`/data/regions.geojson`) resolve against the page.
- Actions do nothing on the server. Call them from event handlers or after `(ready)`.

To render the map on the server but load and hydrate its code only when it scrolls into view, use incremental hydration: `@defer (hydrate on viewport)` around the map, and `withIncrementalHydration()` in your app config.

```ts
// src/app/app.config.ts (keep the providers you have)
import type { ApplicationConfig } from '@angular/core'
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser'

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
}
```

## Deferred loading

The map's code is about 1.1 MB (about 270 kB compressed), mostly OpenLayers. Load it when the page needs it: put the map in a component of its own, and render that component in a `@defer` block.

```ts
// regions-page.ts
import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RegionsMap } from './regions-map'

@Component({
  selector: 'app-regions-page',
  imports: [RegionsMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Regions</h1>
    @defer (on viewport) {
      <app-regions-map />
    } @placeholder {
      <div class="map-placeholder">Loading map…</div>
    }
  `,
})
export class RegionsPage {}
```

```css
.map-placeholder {
  height: var(--geo-height); /* the map's height, so the page doesn't jump */
}
```

- **Only the deferred component imports the folder.** `RegionsMap`, in a file of its own, builds its config and imports `GeospatialMap`. Angular splits it off only when the page refers to it nowhere but inside `@defer`. Any import from the folder in eagerly loaded code (`defineMapConfig` in the page, `provideMapIcons()` in `app.config.ts`) brings the whole map back into the first bundle.
- **App-wide icons.** Put `provideMapIcons()` in the `providers` of the deferred component, or of its lazy route, instead of `app.config.ts`.
- **Triggers.** `on viewport` loads the map when its placeholder scrolls into view; `on idle`, `on interaction` and `prefetch on idle` work too. With server rendering, use `@defer (hydrate on viewport)` (see above).
- **Lazy routes.** A route with `loadComponent: () => import('./regions-page').then((m) => m.RegionsPage)` splits the same way.
