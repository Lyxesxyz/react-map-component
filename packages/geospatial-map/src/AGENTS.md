# Geospatial map: instructions for coding agents

This folder is a map component copied into this app (shadcn/ui style). The app owns the copy. `version.ts` says which release it is; newer releases are merged in with a script (see [Updating](#updating)). Humans start at `README.md`; this file is the short version for agents.

## Choose where a change belongs

Most requests need no edit inside this folder. Use the first place in this table that fits:

| The request                                       | Change                                                                                        | Example and guide                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Show data, add or restyle a layer, a legend       | The map config (`defineMapConfig({ … })`) in the app                                          | `examples/quick-start.tsx`, `docs/layers-and-legends.md`            |
| Use the team's ArcGIS basemap, change its borders | `arcgisBasemap({ url, styleOverrides })` in the config                                        | `examples/arcgis-indicators.tsx`                                    |
| Colour admin areas by a value table               | Boundary GeoJSON layer + join in `loadGeoJson`                                                | `examples/admin-choropleth.tsx`                                     |
| Data needs a token, header or cookie              | `loadGeoJson` wrapping `fetchGeoJson(url, { ...options, init })`                              | `examples/authenticated-data.tsx`                                   |
| Colours, fonts, sizes, radius, dark mode          | `--geo-*` tokens and `.your-class .geo-*` rules in the app's CSS                              | `examples/brand-theme.tsx` + `.css`, `docs/theming-localization.md` |
| Different icons                                   | `icons` prop (one map) or `icons.ts` (every map)                                              | `examples/brand-theme.tsx`                                          |
| Move, remove or add controls and panels           | `config.ui` (`controls`, `layerPanel`, `settings`, …), or `<MapRoot>` with the parts you want | `examples/custom-layout.tsx`, `docs/configuration.md`               |
| Custom popup, tooltip or control                  | `slots` (`popup`, `tooltip`, `controls`) on `<GeospatialMap>`                                 | `examples/custom-layout.tsx`, `docs/state-events-slots.md`          |
| Panel header/footer, loading or error content     | `<MapRoot>` with the parts: `header`/`footer` props, children of `<MapErrorAlert>`            | `examples/custom-layout.tsx`, `docs/state-events-slots.md`          |
| React to clicks, keep state in the app            | `onFeatureSelect`, `onStateChange` + `state` (the popup follows `state.selection`)            | `examples/controlled-state-and-grid.tsx`                            |
| Select a feature, open a panel, export from code  | The `ref` or `useMapActions()`: `select`, `setOpenPanel`, `downloadImage`, …                  | `docs/state-events-slots.md`                                        |
| Use the app's own Button/Select/Switch            | Replace bodies in `shapes.tsx`, keeping names and props                                       | `README.md` → Your design system's components                       |
| Drawing, measuring, an OpenLayers feature         | `onOpenLayersMap={(map) => …}` (return a cleanup)                                             | `README.md` → OpenLayers access                                     |
| Several synchronised maps                         | `<MapGrid>`                                                                                   | `examples/controlled-state-and-grid.tsx`                            |
| Config comes from a CMS or API as JSON            | `validateMapConfig(json)` before rendering                                                    | `docs/getting-started.md`                                           |

Every config field is typed and documented in `types.ts` (start at `MapConfigInput` and `MapLayerInput`). Every public export is listed in `index.ts`.

## Rules

- **Don't edit the engine files** to customise behaviour: `core/`, `config/`, `use-*.ts`, `map-bridges.ts`, `map-state.ts`, `map-context.ts`, `hooks.ts`. Their header says so. Edits there are the most likely to conflict when the folder is updated. If something can't be done through the table above, report it rather than patching the engine.
- **Don't edit** `version.ts`, `CHANGELOG.md` or `world-data.ts` (generated).
- **Don't edit `geospatial-map.css` to restyle.** Override tokens and classes in the app's stylesheet, loaded after it. Scope rules to one class (`.brand-map .geo-legend { … }`). Never use `!important` or deeper selectors: every component rule has single-class specificity, so one scoped class always wins.
- **Keep layer `id`s unique and stable**, and give selectable layers a `featureIdField` whose values are unique.
- **Use the 0.8 field names.** A config written for 0.7 fails validation with a message naming the new field (`ui.controlRail was renamed to ui.controls in 0.8.0`). Rename the field where the config is written.
- **The projection is the developer's choice** (`initialState.view.projection`, or the ArcGIS basemap's own). Don't add a projection picker for users.
- **Large inline data** (`data: { type: 'FeatureCollection', … }` or `data: { rows }`) must keep its identity between renders: define it outside the component or memoise it.
- **Colours in the config may be CSS variables** (`fillColor: 'var(--brand-500)'`); prefer that to hard-coding a theme's colours in data.
- **Import from the folder's `index.ts`**, not from internal files, except `testing.ts` in tests.

## Verify your change

1. **Typecheck** the app. The config is fully typed; a type error usually names the wrong field.
2. **Load a page with the map** and wait until the map element (`[data-slot="map"]`) has `data-status="ready"`; in Playwright, `waitForMapReady(page)` from `testing.ts` does this (see `examples/map-ready-check.ts`). `data-status="error"` means the config is invalid; the map shows the reason.
3. **No `[geospatial-map]` console messages.** The map logs one-time hints for setup and data mistakes: missing CSS import, a style field the data doesn't have, coordinates that aren't longitude/latitude, values matching no category, duplicate ids. Treat them as failures.
4. **No `data-layer-errors` attribute** on the map element. It counts layers that failed to load; the layer panel marks which ones, and the error alert on the map shows the reason (also passed to `onError`).
5. **Look at it**: take a screenshot, including dark mode and a narrow (phone) width if you changed styles.

## Updating

Never re-copy the folder over the app's copy; that drops the app's edits. From a clone of the source repository:

```sh
node scripts/update-geospatial-map.mjs path/to/this/folder           # report
node scripts/update-geospatial-map.mjs path/to/this/folder --apply   # three-way merge
```

Then read the `CHANGELOG.md` entries newer than the old version, especially "Changed (check these when updating)", and run the checks above.

## Where to look

| Question                                   | File                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| What can the config contain?               | `types.ts`, `docs/configuration.md`                               |
| Layer kinds, data sources, styles, legends | `docs/layers-and-legends.md`                                      |
| Callbacks, state, actions, slots, hooks    | `docs/state-events-slots.md`                                      |
| Tokens, classes, dark mode, themes         | `README.md` → Styling, `docs/theming-localization.md`             |
| Export, embeds, grids, Vite and Next.js    | `docs/export-grid-integration.md`                                 |
| Something looks wrong                      | `docs/troubleshooting.md`, `README.md` → If something looks wrong |
| What changed between versions              | `CHANGELOG.md`, `docs/migration.md`                               |
