// The outline of the world in Equal Earth (EPSG:8857), the map's default projection, on a 320 × 160
// grid, from the projection's formulas (Šavrič, Patterson and Jenny, 2018). A demo frame draws it
// while it loads. The example cards' plates (src/assets/plate-*.svg) are on the same grid: this
// outline, a 30° graticule, and the land of the folders' world-data.ts (Natural Earth 1:110m),
// projected and simplified.

export const plateViewBox = '0 0 320 160'

export const plateOutline =
  'M252.4 155.9L253.4 155.5L256.3 154.2L260.6 152.2L265.9 149.6L271.6 146.4L277.5 142.7L283.3 138.7L288.7 134.3L293.7 129.6L298.3 124.6L302.3 119.5L305.9 114.2L309 108.7L311.5 103.1L313.5 97.4L314.9 91.6L315.7 85.8L316 80L315.7 74.2L314.9 68.4L313.5 62.6L311.5 56.9L309 51.3L305.9 45.8L302.3 40.5L298.3 35.4L293.7 30.4L288.7 25.7L283.3 21.3L277.5 17.3L271.6 13.6L265.9 10.4L260.6 7.8L256.3 5.8L253.4 4.5L252.4 4.1L67.6 4.1L66.6 4.5L63.7 5.8L59.4 7.8L54.1 10.4L48.4 13.6L42.5 17.3L36.7 21.3L31.3 25.7L26.3 30.4L21.7 35.4L17.7 40.5L14.1 45.8L11 51.3L8.5 56.9L6.5 62.6L5.1 68.4L4.3 74.2L4 80L4.3 85.8L5.1 91.6L6.5 97.4L8.5 103.1L11 108.7L14.1 114.2L17.7 119.5L21.7 124.6L26.3 129.6L31.3 134.3L36.7 138.7L42.5 142.7L48.4 146.4L54.1 149.6L59.4 152.2L63.7 154.2L66.6 155.5L67.6 155.9Z'
