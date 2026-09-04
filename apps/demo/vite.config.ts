import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const directory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@org/geospatial-map/styles.css',
        replacement: path.resolve(directory, '../../packages/geospatial-map/src/styles.css'),
      },
      {
        find: '@org/geospatial-map',
        replacement: path.resolve(directory, '../../packages/geospatial-map/src/index.ts'),
      },
    ],
  },
})
