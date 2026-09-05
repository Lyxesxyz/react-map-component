# Migrating from legacy 0.1 props

This release intentionally removes the scattered component props.

| Legacy prop                                                          | New location                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| `id`, `ariaLabel`                                                    | `config.id`, `config.accessibility.ariaLabel`         |
| `defaultView`, `defaultBasemapId`, `defaultSelection`, `defaultTime` | `config.initialState`                                 |
| `view`, `activeBasemapId`, `selection`, `time`                       | controlled `state`                                    |
| `layers`, `basemaps`, `zoomTargets`, `hierarchy`                     | `config.data`                                         |
| `projectionBehavior`                                                 | `config.view.projectionBehavior`                      |
| `controls`                                                           | `config.ui` and its profile/panel/control policies    |
| `exportOptions`                                                      | `config.export`                                       |
| `timePlayback`                                                       | `config.time`                                         |
| `renderPopup`                                                        | `slots.popup`                                         |
| `children`                                                           | host composition outside the map or a documented slot |
| `serialize()`, `getView()`                                           | `getState()`                                          |
| `setLayerStyle()`                                                    | `state.layers[layerId].style`                         |

Callbacks retain their names. Add `onStateChange` when the host needs one complete synchronized state contract.
