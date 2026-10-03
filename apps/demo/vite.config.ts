import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const directory = path.dirname(fileURLToPath(import.meta.url))

// The demo consumes the copy-paste folder exactly like a host app would:
// `@/components/geospatial-map` points at the folder the team copies into their project.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@/components/geospatial-map',
        replacement: path.resolve(directory, '../../packages/geospatial-map/src'),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
})
