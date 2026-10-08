import '@angular/compiler'
import '@analogjs/vitest-angular/setup-snapshots'
import '@analogjs/vitest-angular/setup-serializers'
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed'

// A zoneless TestBed for the jsdom tests. Server-rendering tests (`// @vitest-environment node`)
// bootstrap platform-server themselves and skip it: the browser testing platform would install
// the browser DOM adapter.
if (typeof document !== 'undefined') {
  setupTestBed({ zoneless: true, errorOnUnknownElements: true, errorOnUnknownProperties: true })
}
