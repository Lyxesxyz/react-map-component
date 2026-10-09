import { bootstrapApplication } from '@angular/platform-browser'
import { App } from './app/app'
import { appConfig } from './app/app.config'

/**
 * `true` in the `zone` configuration (`ng serve --configuration zone`, angular.json `define`),
 * which the `chromium-angular-zone` Playwright project serves: every route then runs with zone.js.
 */
declare const GEO_DEMO_FORCE_ZONE: boolean | undefined

// `?zone` checks zone-based host apps: load zone.js first, then bootstrap with zone change
// detection. Without it the demo is zoneless, like a new Angular app.
const zone =
  (typeof GEO_DEMO_FORCE_ZONE === 'boolean' && GEO_DEMO_FORCE_ZONE) ||
  new URLSearchParams(location.search).has('zone')
if (zone) await import('zone.js')

bootstrapApplication(App, appConfig(zone)).catch((error: unknown) => console.error(error))
