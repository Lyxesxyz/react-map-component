import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mapConfigSchema } from './src/config.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-map-config-schema',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'map-config.schema.json',
          source: JSON.stringify(mapConfigSchema, null, 2),
        })
      },
    },
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'geospatial-map',
      cssFileName: 'geospatial-map',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
})
