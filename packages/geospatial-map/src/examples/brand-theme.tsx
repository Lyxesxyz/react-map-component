'use client'

// Example: restyle the map to a design system with CSS (see brand-theme.css next to this file)
// and swap some icons for this map only. Task: "make the map match our design system".
// See README.md → Matching a design system, and docs/theming-localization.md.

import { Building2, Eye } from 'lucide-react'
import { GeospatialMap, defineMapConfig } from '..'

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

export function BrandMap({ dark = false }: { dark?: boolean }) {
  return (
    <GeospatialMap
      config={config}
      className={dark ? 'brand-map dark' : 'brand-map'}
      icons={{ Layers: Eye, Fit: Building2 }}
    />
  )
}
