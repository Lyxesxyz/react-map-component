import js from '@eslint/js'
import angular from 'angular-eslint'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// The Angular folder and the Angular demo. Their inline templates are linted as virtual
// `*.html` files under the same paths (angular.processInlineTemplates).
const angularSources = [
  'packages/geospatial-map-angular/src/**/*.ts',
  'apps/demo-angular/src/**/*.ts',
]
const angularTemplates = [
  'packages/geospatial-map-angular/src/**/*.html',
  'apps/demo-angular/src/app/**/*.html',
]
// Parts on a native <button> that set its type, label and icon from their host bindings, so
// `<button geoMapZoomIn></button>` is a complete, typed, labelled button.
const geoButtonParts = [
  'geoMapZoomIn',
  'geoMapZoomOut',
  'geoMapResetZoom',
  'geoMapLocate',
  'geoMapLayers',
  'geoMapSettings',
  'geoMapFit',
  'geoMapFullscreen',
  'geoMapControl',
  'geoShapeButton',
  'geoShapeIconButton',
]
// Parts on a native <label> that render their own form control inside it, so
// `<label geoShapeSwitch [label]="…"></label>` is an associated label.
const geoLabelParts = [
  'geoShapeSwitch',
  'geoMapBasemapField',
  'geoMapZoomTargetField',
  'geoMapExportField',
]

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.angular/**',
      '**/out-tsc/**',
      '**/.astro/**',
      // The Angular folder as pasted by scripts/paste-test.mjs (a copy of its src/).
      'packages/geospatial-map-angular/test/consumer-*/src/app/geospatial-map/**',
    ],
  },
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
    // Host apps usually run typescript-eslint's recommended rules unmodified. The core holds
    // the shared files synced into the copied folders, so the same rules apply to it.
    files: [
      'packages/geospatial-map/src/**/*.{ts,tsx}',
      'packages/geospatial-map-core/src/**/*.ts',
    ],
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
    // The demos' shared scenarios and fixtures: the apps/demo rules above minus the React ones,
    // and no framework imports. The package's typecheck limits `@/components/geospatial-map`
    // to the exports both folders have.
    files: ['apps/demo-shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*', '@angular/*'],
              message: 'apps/demo-shared is shared by the React and Angular demos.',
            },
            {
              group: ['@/components/geospatial-map/*'],
              message: "Import from '@/components/geospatial-map' (each demo maps it).",
            },
          ],
        },
      ],
    },
  },
  {
    // The Angular folder: typescript-eslint's recommended rules unmodified (as in the React
    // folder), and the angular-eslint rules for its conventions: standalone, OnPush, signal
    // inputs, outputs and queries, `geo` selectors (kebab-case elements, camelCase attributes).
    files: angularSources,
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: ['geo', 'app'], style: 'kebab-case' },
          { type: 'attribute', prefix: ['geo', 'app'], style: 'camelCase' },
        ],
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['geo', 'app'], style: 'camelCase' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/no-output-native': 'error',
      '@angular-eslint/no-output-on-prefix': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
    },
  },
  {
    files: ['packages/geospatial-map-angular/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    files: angularTemplates,
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/button-has-type': [
        'error',
        { ignoreWithDirectives: geoButtonParts },
      ],
      '@angular-eslint/template/elements-content': ['error', { allowList: geoButtonParts }],
      '@angular-eslint/template/label-has-associated-control': [
        'error',
        { labelComponents: [{ selector: 'label', inputs: ['for', 'htmlFor', ...geoLabelParts] }] },
      ],
    },
  },
  {
    files: [
      '**/*.config.{js,mjs,ts}',
      'tests/**/*.ts',
      'scripts/**/*.mjs',
      'apps/site/**/*.mjs',
      'packages/*/test/**/*.{ts,tsx}',
    ],
    languageOptions: { globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly' } },
  },
)
