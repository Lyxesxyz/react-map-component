// Example: restyle the map to a design system with CSS (see brand-theme.css next to this file)
// and swap some icons for this map only. Task: "make the map match our design system".
// See README.md → Matching a design system, and docs/theming-localization.md.

import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core'
import { Building2, Eye } from 'lucide'
import { GeospatialMap, defineMapConfig, type MapIcons } from '../index'

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Offices' },
  data: {
    layers: [
      {
        id: 'regions',
        title: 'Regions',
        data: { url: '/data/regions.geojson' },
        style: {
          type: 'continuous',
          field: 'value',
          domain: [0, 100],
          // Colours from the theme stylesheet, so light and dark mode can differ.
          stops: [
            { value: 0, color: 'var(--brand-low)' },
            { value: 100, color: 'var(--brand-high)' },
          ],
        },
      },
    ],
  },
})

// Any lucide icon works as it is; other sets work as node lists or icon components (README.md →
// Icons). The other roles keep the icons of icons.ts.
const icons: Partial<MapIcons> = { Layers: Eye, Fit: Building2 }

@Component({
  selector: 'app-brand-map',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<geo-map class="brand-map" [class.dark]="dark()" [config]="config" [icons]="icons" />`,
})
export class BrandMap {
  /**
   * Dark mode for this map only. brand-theme.css declares its dark values under `.brand-map.dark`;
   * to follow `.dark` on `<html>` instead, add `.dark .brand-map` to that rule's selector.
   */
  readonly dark = input(false, { transform: booleanAttribute })

  protected readonly config = config
  protected readonly icons = icons
}
