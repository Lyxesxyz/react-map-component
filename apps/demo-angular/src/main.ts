import { bootstrapApplication } from '@angular/platform-browser'
import { App } from './app/app'
import { appConfig } from './app/app.config'

// `?zone` checks zone-based host apps: load zone.js first, then bootstrap with zone change
// detection. Without it the demo is zoneless, like a new Angular app.
const zone = new URLSearchParams(location.search).has('zone')
if (zone) await import('zone.js')

bootstrapApplication(App, appConfig(zone)).catch((error: unknown) => console.error(error))
