import { fileURLToPath } from 'node:url'
import angular from '@analogjs/vite-plugin-angular'
import { defineProject } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

// The Angular folder's tests, a project of the root vitest.config.ts: the Analog plugin compiles
// the components ahead of time (its tsconfig must emit), jsdom and a zoneless TestBed run them.
// Server-rendering tests opt into `// @vitest-environment node`.
export default defineProject({
  root,
  plugins: [angular({ tsconfig: fileURLToPath(new URL('./tsconfig.spec.json', import.meta.url)) })],
  test: {
    name: 'angular',
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
})
