# Theming and localization

Inter Variable is the package default. Supply a partial `theme` object to change `fontFamily`, text/muted/border/surface/glass colors, accent/hover/danger/focus colors, radius, shadow, control size, or density.

```ts
theme: {
  accentColor: '#6d28d9',
  accentHoverColor: '#5b21b6',
  density: 'compact',
}
```

Theme values are applied as stable `--geo-*` CSS variables at the map root. Prefer tokens over targeting internal class names. The documented variables mirror `MapThemeTokens`.

| Token              | Default                                                                | CSS variable         |
| ------------------ | ---------------------------------------------------------------------- | -------------------- |
| `fontFamily`       | `'Inter Variable', Inter, sans-serif`                                  | `--geo-font-family`  |
| `textColor`        | `#18181b`                                                              | `--geo-ink`          |
| `mutedColor`       | `#71717a`                                                              | `--geo-muted`        |
| `borderColor`      | `rgba(24, 24, 27, 0.14)`                                               | `--geo-border`       |
| `surfaceColor`     | `#ffffff`                                                              | `--geo-surface`      |
| `softSurfaceColor` | `#f4f4f5`                                                              | `--geo-surface-soft` |
| `glassColor`       | `rgba(255, 255, 255, 0.94)`                                            | `--geo-glass`        |
| `accentColor`      | `#0f766e`                                                              | `--geo-accent`       |
| `accentHoverColor` | `#115e59`                                                              | `--geo-accent-hover` |
| `dangerColor`      | `#a61b1b`                                                              | `--geo-danger`       |
| `focusColor`       | `rgba(20, 108, 117, 0.35)`                                             | `--geo-focus`        |
| `radius`           | `12px`                                                                 | `--geo-radius`       |
| `shadow`           | `0 12px 32px rgba(24, 24, 27, 0.12), 0 2px 5px rgba(24, 24, 27, 0.08)` | `--geo-shadow`       |
| `controlSize`      | `42px`                                                                 | `--geo-control-size` |
| `density`          | `comfortable`                                                          | root density class   |

`messages` is a partial `MapMessages` dictionary. Missing keys use English defaults. Templates use named placeholders such as `{projection}`, `{feature}`, `{time}`, `{value}`, `{layer}`, `{units}`, and `{title}`.

```ts
messages: {
  layers: 'Слоеве',
  legend: 'Легенда',
  selectedFeature: 'Избрано: {feature}',
}
```

The package does not add an i18n runtime. The host owns locale selection and supplies a dictionary, keeping JSON configuration portable.
