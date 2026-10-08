import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: { reporter: ['text', 'html'] },
    projects: [
      // The core and React tests (node environment), as before.
      {
        test: {
          name: 'core',
          include: ['packages/**/test/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', 'packages/geospatial-map-angular/**'],
        },
      },
      // The Angular folder brings its own project (Analog plugin, jsdom, zoneless TestBed).
      'packages/geospatial-map-angular/vitest.config.ts',
    ],
  },
})
