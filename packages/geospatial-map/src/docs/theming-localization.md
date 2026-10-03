# Theming and localization

The stylesheet `geospatial-map.css` is the source of truth for how the map looks. You restyle it in three ways, from lightest touch to heaviest:

1. **Override tokens.** All colours and sizes are `--geo-*` CSS variables.
2. **Target classes.** Every element has a stable `geo-*` class, and every part takes `className`.
3. **Edit the source.** The folder is yours: the parts, `shapes.tsx` (primitives), and `icons.ts` (icons).

The complete token table, the shadcn/ui bridge, Tailwind notes, and examples of swapping primitives are in [`README.md`](../README.md#styling). This guide covers the rules behind them.

## Tokens

- **Where defaults live.** Defaults are declared on `:root`, `.light`, and `[data-theme='light']`. Dark values are declared on `.dark` and `[data-theme='dark']`.
- **No re-declaration on the map.** The map root doesn't re-declare tokens, so an override on `:root`, on any wrapper, or on the map element itself is inherited by every part.

```css
:root {
  --geo-primary: #1d4ed8; /* every map in the app */
}

.report-page .geo-map-root {
  --geo-height: 420px; /* maps on one page */
}

.brand-map {
  --geo-radius: 4px; /* one map, via className */
}
```

**Derived tokens.** These are computed where they are used, so overriding the base token is enough:

| Token                          | Derived from                           |
| ------------------------------ | -------------------------------------- |
| `--geo-accent` (hover surface) | `--geo-primary` and `--geo-background` |
| `--geo-accent-foreground`      | `--geo-foreground`                     |
| `--geo-input`                  | `--geo-border`                         |
| `--geo-rail-offset`            | `--geo-inset` and `--geo-control-size` |
| `--geo-font-family`            | your app's font                        |

Set any of them to override the derived value.

**Narrow maps.** When the map is narrower than 680px (a container query, not a viewport media query), it uses `--geo-height-narrow`, `--geo-inset-narrow`, and `--geo-control-size-narrow`. If you change the regular values, change the narrow ones too.

**Canvas and export tokens.** These style what CSS can't reach:

- `--geo-selection-fill`, `--geo-selection-stroke`, and `--geo-selection-line` for the selected feature.
- `--geo-label-color` and `--geo-label-halo` for map labels.
- `--geo-export-background`, `--geo-export-foreground`, and `--geo-export-muted` for report images.

The renderer resolves them with `getComputedStyle` when the map mounts, on each update, and at export time. `var()`, `oklch()`, and `color-mix()` values all work.

## Dark mode

Put `.dark` or `data-theme="dark"` on `<html>`, on a wrapper, or on the map. Inside a dark area, `.light` or `data-theme="light"` switches back.

A brand override written for light mode replaces the dark default as well, so give it a dark value too:

```css
.brand-map {
  --geo-primary: #7c3aed;
}

.dark .brand-map {
  --geo-primary: #a78bfa;
}
```

Basemap and layer colours are data in the map config. They can still follow a theme: write them as `var(--your-token)` and define the token in the theme (the demo themes do this for the choropleth palette).

## Theme recipes

The source repository's demo (`/?scenario=themes`) restyles one map as three design systems. Each is one stylesheet in its `apps/demo/src/themes/`, scoped to a class on a wrapper, plus an icon set for Material and Carbon. What each one changes, and how:

| Change   | Material 3-style                                        | Carbon-style                                                | Editorial print                                                  |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Type     | Roboto, 500 for titles and labels, no uppercase         | IBM Plex Sans, 600 titles, 12px labels with 0.32px tracking | Source Serif, italic titles, small caps (`--geo-label-caps`)     |
| Shape    | `--geo-radius-panel: 16px`, pill buttons, 4px fields    | every radius `0px`, pill toggles and tags                   | every radius `0px`, including toggles (`--geo-radius-pill: 0px`) |
| Surfaces | elevation shadows, no blur, tonal rail (one class rule) | flat layers, one popover shadow, no blur                    | no shadow or blur, 3px top rule on cards (one class rule)        |
| Focus    | 3px ring                                                | 2px inset ring (`--geo-focus-offset: -2px`)                 | 2px ring in the accent                                           |
| Rail     | 48px tonal FABs, primary when pressed                   | 48px column, no gaps (two class rules)                      | 40px, ink when pressed (`--geo-control-active`)                  |
| Switch   | 52×32, thumb grows from 16 to 24px                      | 48×24 green toggle                                          | 34×18 square, ink                                                |
| Slider   | 16px track, bar thumb                                   | 2px track, 14px thumb                                       | 1px rule, accent tick                                            |
| Fields   | outlined, 48px (class rule)                             | filled with a bottom rule (class rule)                      | bottom rule (class rule)                                         |
| Icons    | `react-icons/md` through `icons`                        | `@carbon/icons-react` through `icons`                       | lucide with `--geo-icon-stroke: 1.25`                            |
| Map      | violet tonal palette, Roboto labels                     | Carbon blue palette                                         | warm palette, 13px/600 serif labels                              |

Every theme also has a dark variant (`.theme-x.dark`). A test checks that the theme files use no `!important` and no selector stronger than "theme class + one part class".

### Notes on the controls

- **Slider.** The range input is drawn from tokens with `appearance: none`. The filled part of the track comes from `--geo-slider-fill`, which `ShapeSlider` sets from its value; Firefox uses its native progress element instead.
- **Select.** The native select has no browser arrow; its wrapper (`.geo-shape-select-wrap`) draws the chevron with `::after` in `currentColor`. Restyle, move or replace it there. The option list itself is drawn by the browser and can't be styled; swap `ShapeSelect` in `shapes.tsx` for your design system's select if you need that.
- **Switch.** The thumb is centred and travels from one end to the other, so any `--geo-switch-width/-height/-thumb` combination works.

## Classes, data attributes, and specificity

Every rule in `geospatial-map.css` has the specificity of a single class. Qualifiers such as placement, state, and pseudo-classes are wrapped in `:where()`. In practice this means:

- One class of yours, loaded after `geospatial-map.css`, overrides any map rule.
- Global element resets in your app, such as `button { font: inherit }` or `* { margin: 0 }`, can't override the map's class rules.
- A unit test (`test/theme-tokens.test.ts`) enforces this for every rule.

The hooks you can target:

- **Class names.** Every element has a stable class:
  - `geo-map-root`, `geo-map-stage`, `geo-map-viewport`
  - `geo-map-controls`, `geo-control-group`
  - `geo-layer-panel`, `geo-layer-item`, `geo-layer-title`
  - `geo-legend`, `geo-legend-entry`, `geo-legend-symbol`
  - `geo-popup`, `geo-popup-title`
  - `geo-time-controls`, `geo-attribution`
  - and more; see the `map-*.tsx` files.
- **Part markers.** Each part also carries `data-slot`, for example `data-slot="map-legend"`.
- **State attributes:**
  - `data-placement` on floating parts.
  - `data-visible` on layer rows.
  - `data-active` on pressed control buttons.
  - `data-state` on time controls.
  - `data-density` on the root.

Slot and children content isn't styled by the map. Unlike the 0.1 package, a heading you render inside the popup doesn't pick up the map's heading styles.

If you use Tailwind, import the stylesheet into the components layer so utilities win:

```css
@import './components/geospatial-map/geospatial-map.css' layer(components);
```

## Theme from JSON (`config.theme`)

`config.theme` is the JSON-safe way to set tokens per map, for example from a CMS. Only the keys you provide are written, as inline custom properties on the map root.

| Key                | CSS variable                                          |
| ------------------ | ----------------------------------------------------- |
| `fontFamily`       | `--geo-font-family`                                   |
| `textColor`        | `--geo-foreground`                                    |
| `mutedColor`       | `--geo-muted-foreground`                              |
| `borderColor`      | `--geo-border`                                        |
| `surfaceColor`     | `--geo-background`                                    |
| `softSurfaceColor` | `--geo-muted`                                         |
| `glassColor`       | `--geo-overlay`                                       |
| `accentColor`      | `--geo-primary`                                       |
| `accentHoverColor` | `--geo-primary-hover`                                 |
| `dangerColor`      | `--geo-destructive`                                   |
| `focusColor`       | `--geo-ring`                                          |
| `radius`           | `--geo-radius`                                        |
| `shadow`           | `--geo-shadow`                                        |
| `controlSize`      | `--geo-control-size`                                  |
| `density`          | `data-density` attribute (`comfortable` or `compact`) |

```ts
theme: {
  accentColor: '#6d28d9',
  accentHoverColor: '#5b21b6',
  density: 'compact',
}
```

Inline values take precedence over stylesheet rules. Use `config.theme` for data-driven branding, and CSS for everything else.

## Localization

`messages` is a partial `MapMessages` dictionary. Missing keys fall back to the English defaults in `messages.ts`. Templates use named placeholders such as `{projection}`, `{feature}`, `{time}`, `{value}`, `{layer}`, `{units}`, `{title}`, and `{date}`.

```ts
messages: {
  layers: 'Слоеве',
  legend: 'Легенда',
  selectedFeature: 'Избрано: {feature}',
}
```

The component doesn't include an i18n runtime. The host owns locale selection and supplies the dictionary, which keeps the JSON configuration portable. Built-in part props such as `label` on control buttons also accept already-translated strings.
