import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The copy-paste folder must lint cleanly under the React rules new Vite and Next.js
    // projects enable by default.
    files: ['packages/geospatial-map/src/**/*.{ts,tsx}', 'apps/demo/src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    // Host apps usually run typescript-eslint's recommended rules unmodified.
    files: ['packages/geospatial-map/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    // Fast Refresh: component files export only components (Vite templates warn otherwise).
    files: ['packages/geospatial-map/src/**/*.tsx', 'apps/demo/src/**/*.tsx'],
    ignores: ['apps/demo/src/main.tsx'],
    plugins: { 'react-refresh': reactRefresh },
    rules: { 'react-refresh/only-export-components': ['error', { allowConstantExport: true }] },
  },
  {
    files: [
      '**/*.config.{js,ts}',
      'tests/**/*.ts',
      'scripts/**/*.mjs',
      'packages/*/test/**/*.{ts,tsx}',
    ],
    languageOptions: { globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly' } },
  },
)
