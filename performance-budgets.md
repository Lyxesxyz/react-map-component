# Geospatial map performance budgets

These are release gates, not feature-count guarantees. Measurements use production builds, warm static-asset cache after one priming visit, the bundled deterministic fixtures, and a 1,440 × 900 viewport.

## Named reference environments

| Environment       | Browser                                                                  | Network/CPU profile                    |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| Desktop reference | Current stable Chromium on an Apple-silicon Mac with 16 GB RAM           | Native CPU, local deterministic assets |
| Mid-tier laptop   | Current stable Chromium on a four-core x64 laptop with 8 GB RAM          | Fast 4G, 4× CPU throttle               |
| Mobile reference  | Current stable mobile Safari on a supported iPhone with 4 GB or more RAM | Fast 4G                                |

## Budgets

| Measure                              |  Desktop | Mid-tier laptop |                                            Mobile |
| ------------------------------------ | -------: | --------------: | ------------------------------------------------: |
| Stable global map render             | 2,500 ms |        5,000 ms |                                          6,000 ms |
| Stable 50,000-point fixture render   | 4,000 ms |        7,000 ms | Not an accepted mobile view; use tiles/clustering |
| View/layer control response          |   100 ms |          200 ms |                                            250 ms |
| Time animation                       |   50 FPS |          30 FPS |                                            30 FPS |
| JavaScript heap after global fixture |   200 MB |          250 MB |                                            300 MB |
| 1,200 × 720, 1× PNG export           | 3,000 ms |        5,000 ms |                                          7,000 ms |

`tests/browser/performance.spec.ts` enforces the desktop reference budgets that browser automation can measure reliably. Mid-tier and mobile reports remain explicit pre-release runs because CI emulation does not replace physical-device memory and gesture testing.

## Both demos

The browser budgets above apply to the React and the Angular version alike. `tests/browser/performance.spec.ts` runs with the same limits in the `chromium` project (the React demo) and in the `chromium-angular` project (the Angular demo), and the named reference-environment runs cover both demos. Both versions drive the same engine files, so a budget that fails in one demo and passes in the other points at the framework layer.

## Angular bundle budgets

`pnpm build:angular` builds the Angular demo for production and fails when it exceeds the budgets in `apps/demo-angular/angular.json`. The paste-test apps (`pnpm test:paste`) use the same budgets.

| Budget                          | Warning | Error | Measured for 0.10.0                      |
| ------------------------------- | ------: | ----: | ---------------------------------------- |
| Initial bundle (raw size)       |  1.6 MB |  2 MB | 1.52 MB, about 383 kB estimated transfer |
| The styles of any one component |    4 kB |  8 kB | none; the parts declare no `styles`      |

The initial bundle holds the harness, every scenario and OpenLayers: the demo loads no scenario lazily. Three chunks load on demand and have no budget of their own:

| Lazy chunk                  | Raw size | Estimated transfer | Loaded                                             |
| --------------------------- | -------: | -----------------: | -------------------------------------------------- |
| `ol-mapbox-style` (`index`) |   173 kB |              43 kB | by the first vector tile layer with a Mapbox style |
| `world-data`                |    76 kB |              26 kB | by the built-in world basemap                      |
| `zone`                      |    36 kB |              12 kB | with `?zone` only                                  |

In an app, the map adds roughly 290 KB gzipped to the bundle that imports it, mostly OpenLayers. The Angular folder's README shows how `@defer` keeps it out of the initial bundle. Review a change in these numbers like a change in the browser budgets.
