import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import { GeospatialMap, type MapIcons } from '@/components/geospatial-map'
import { themesConfig } from '@demo-shared/src/fixtures'
import {
  demoThemeLabels,
  demoThemes,
  parseHarnessParams,
  type DemoTheme,
} from '@demo-shared/src/scenarios'
import { carbonIcons, materialIcons } from './theme-icons'

// Three design systems applied to the same map. Each theme is one stylesheet in
// apps/demo-shared/styles/themes (shared with the React demo, and loaded with their fonts in
// angular.json): `--geo-*` tokens plus a few rules on the map's `geo-*` classes, scoped to a
// wrapper class. Material and Carbon also bring their own icon sets through the `[icons]` input:
// Carbon's are SVG node lists, Material's are icon components (theme-icons.ts). Nothing in the
// component folder is edited, and the data colours come from the theme too (`var(--demo-…)`, in
// the shared `themesConfig`). The host element has `display: contents`, so the toolbar and the
// map sit in the harness section as in React.

const themeIcons: Partial<Record<DemoTheme, MapIcons>> = {
  material: materialIcons,
  carbon: carbonIcons,
}

@Component({
  selector: 'app-themes',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  // The Dark label's text is split into the same text nodes as in React (React's `{' '}` is
  // `{{ ' ' }}` here, next to an <ng-container>), so it renders to the same pixels.
  template: `
    <div class="demo-composed-toolbar" role="group" aria-label="Theme controls">
      <fieldset class="demo-theme-picker">
        <legend>Theme</legend>
        @for (name of themes; track name) {
          <label
            ><input
              type="radio"
              name="demo-theme"
              [value]="name"
              [checked]="theme() === name"
              (change)="theme.set(name)"
            />{{ themeLabels[name] }}</label
          >
        }
      </fieldset>
      <label
        ><input
          #darkBox
          type="checkbox"
          [checked]="dark()"
          (change)="dark.set(darkBox.checked)"
        />{{ ' ' }}<ng-container>Dark</ng-container></label
      >
    </div>
    <div [class]="themeClass()" [attr.data-theme-name]="theme()">
      <geo-map [config]="config" [icons]="icons()" />
    </div>
  `,
})
export class ThemesScenario {
  readonly #params = parseHarnessParams(location.search)
  protected readonly theme = signal<DemoTheme>(this.#params.theme)
  protected readonly dark = signal(this.#params.dark)
  protected readonly icons = computed(() => themeIcons[this.theme()])
  protected readonly themeClass = computed(
    () => `demo-theme theme-${this.theme()}${this.dark() ? ' dark' : ''}`,
  )

  protected readonly config = themesConfig
  protected readonly themes = demoThemes
  protected readonly themeLabels = demoThemeLabels
}
