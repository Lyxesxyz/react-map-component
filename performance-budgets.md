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
