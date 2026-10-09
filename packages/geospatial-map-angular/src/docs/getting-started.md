# Getting started

## Contract

`config` is policy and initial data. `state` is optional changing state. Outputs report events. Templates (`<ng-template geoMapPopup>`, `geoMapTooltip`, `geoMapControl`) are the few Angular-only content extensions. Configurations contain no functions and can be stored in a CMS or returned by an API.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core'
import { GeospatialMap, defineMapConfig } from './geospatial-map'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Indicator map' },
  initialState: {
    view: { center: [20, 5], zoom: 3, projection: 'EPSG:8857' },
    activeBasemapId: 'reference-equal-earth',
  },
  view: {
    interactions: { dragPan: true, wheelZoom: true, keyboard: true, select: true },
  },
  data: { layers, basemaps, zoomTargets },
  ui: { profile: 'compact', breadcrumbs: { targets: ['world', 'africa', 'kenya'] } },
  export: { enabled: true, formats: ['image/png', 'image/svg+xml'] },
})

@Component({
  selector: 'app-indicator-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map [config]="config" />`,
})
export class IndicatorMap {
  protected readonly config = config
}
```

Copy `packages/geospatial-map-angular/src` into the host application (for example to `src/app/geospatial-map`), install the packages listed in its README, and add `geospatial-map.css` to `styles` in `angular.json` once. The samples in these guides import from `'./geospatial-map'`, as a component in `src/app/` does; adjust the path to where you put the folder. The component fills its parent width and is `--geo-height` (680px by default) tall. Set the token from your own CSS, or from a `class` or `style` on the element, to change it.

Use `<geo-map>` for most maps: it lays the map out from `config.ui`. For a custom layout, where you choose and arrange the parts yourself, use `<geo-map-root>` with the parts inside it. See [composition](./state-events-templates.md#composition) and [`examples/custom-layout.ts`](../examples/custom-layout.ts); the smallest complete map is [`examples/quick-start.ts`](../examples/quick-start.ts).

Every part is a standalone component or directive. Import the ones a template uses, or `GEO_MAP_PARTS` for all of them. The map works in zoneless apps (the default for new Angular 21 apps) and in apps that still load zone.js.

The projection is part of the config (`initialState.view.projection`, or an ArcGIS basemap's own). Each map has one; users can't switch it.

## Short form

Only `accessibility` and `data.layers` are required. `defineMapConfig` and `validateMapConfig` fill in the rest:

- `version: 1`
- `view: {}` and `ui: {}` (the `full` profile)
- `data.basemaps`: `esriWorldBasemap` (Esri's World Basemap, loaded from `basemaps.arcgis.com`), with `worldBasemap` (bundled country outlines) as its fallback when it can't be loaded
- a whole-world starting view, fitted to the map's size when the map starts (`view.fitWorld` is on by default when the config sets no starting zoom), with state for every layer in list order
- the first time frame as the starting time, when layers have time frames and `initialState.time` is not set
- for layers without a `kind` or with `kind: 'geojson'`: the `id` as `title`, and a default style
- `selectable: true` on GeoJSON layers and on vector tile (`mvt`) layers with a `featureIdField` (heatmaps are never selectable)

The smallest useful configuration:

```ts
const config = defineMapConfig({
  accessibility: { ariaLabel: 'Literacy rate by country' },
  data: {
    layers: [{ id: 'literacy', data: { url: '/data/literacy.geojson' }, featureIdField: 'iso3' }],
  },
})
```

The full form remains valid; see [the full form example](./configuration.md#full-form). `defineMapConfig` returns the full form, so its result shows exactly what gets filled in. Two JSON Schemas describe the config: `mapConfigSchema` the full, normalized form, and `mapInputSchema` the short form people write. To validate a short config stored in a CMS, use `validateMapConfig`, which normalizes it first.

Writing the config as a class field, or building it in a `computed`, is fine: the map compares configs by content, so a config rebuilt with the same content doesn't reset the view. It resets only when `initialState` changes. Large inline data (`data: { type: 'FeatureCollection', features }` or `data: { rows }`) is the exception: keep the same array (a constant or a class field), so the map isn't handed a new dataset each time the config is rebuilt.

## Loading external JSON

Validate JSON from a CMS or an API before you render it. `validateMapConfig` returns either the full config or a list of issues:

```ts
import { ChangeDetectionStrategy, Component, computed, effect, input } from '@angular/core'
import { GeospatialMap, validateMapConfig, type MapError } from './geospatial-map'

@Component({
  selector: 'app-cms-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let checked = result();
    @if (checked.success) {
      <geo-map [config]="checked.config" (mapError)="reportMapError($event)" />
    } @else {
      <ul class="config-issues">
        @for (issue of checked.issues; track $index) {
          <li>{{ issue.path }}: {{ issue.message }}</li>
        }
      </ul>
    }
  `,
})
export class CmsMap {
  /** The map configuration, as your API returned it. */
  readonly json = input.required<unknown>()
  protected readonly result = computed(() => validateMapConfig(this.json()))

  constructor() {
    effect(() => {
      const result = this.result()
      if (!result.success) reportConfigurationIssues(result.issues)
    })
  }

  protected reportMapError(error: MapError): void {
    console.error(error.code, error.message)
  }
}
```

The component validates again at its boundary. Unknown keys, unknown schema versions, invalid layer state, and projection-incompatible basemaps fail visibly: the map shows an accessible error panel and emits `CONFIG_INVALID` through `(mapError)`. A configuration stored before 0.9.0 fails with a message for each renamed or removed field, for example `ui.legend.defaultOpen was renamed to ui.legend.expanded in 0.9.0` or ``data.layers.0.role was removed in 0.9.0: list layers under a heading with `group` ``. Rename the field where the config is stored, using the 0.9 names.

For the CMS side, `mapInputSchema` is the JSON Schema of the short form (`MapConfigInput`): give it to a JSON editor or a CMS field so authors see mistakes as they type. In the source repository, `pnpm schema` writes it to `map-config-input.schema.json`, next to `map-config.schema.json` (the full form). The schema checks the shape; `validateMapConfig` also checks the rules between fields (ids that must exist, basemaps that must support the projection), so still run it before rendering.

An embed page is an ordinary page: it renders `<geo-map>` from a config your server approved, checked with `validateMapConfig` as above.

## Configuration precedence

Defaults resolve in this order:

1. Package defaults.
2. The selected UI profile.
3. Fields supplied in `config`.
4. Controlled `state` for runtime values.

Nested objects merge. Arrays replace the profile array completely, which makes control ordering deterministic.

In a custom layout, an input on a part overrides the config for that part only: `<geo-map-legend placement="bottom-right">` changes the legend's corner and nothing else.
