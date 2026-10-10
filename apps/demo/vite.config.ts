import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const directory = path.dirname(fileURLToPath(import.meta.url))

// The demo consumes the copy-paste folder exactly like a host app would:
// `@/components/geospatial-map` points at the folder the team copies into their project.
// The scenarios, fixtures, harness styles, themes and data are shared with the Angular demo:
// `@demo-shared/*` is apps/demo-shared, and its public/ (the data/… files) is served next to the
// page. The scenarios load data/… by relative URL, so a build with `--base` works below a path.
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(directory, '../demo-shared/public'),
  resolve: {
    alias: [
      {
        find: '@/components/geospatial-map',
        replacement: path.resolve(directory, '../../packages/geospatial-map/src'),
      },
      { find: /^@demo-shared\//, replacement: `${path.resolve(directory, '../demo-shared')}/` },
    ],
    dedupe: ['react', 'react-dom'],
  },
})
