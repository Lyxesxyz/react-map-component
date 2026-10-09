import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  type ApplicationConfig,
} from '@angular/core'
import { Globe } from 'lucide'
import { provideMapIcons } from './geospatial-map'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Every map of the app: one icon replaced, the rest from icons.ts.
    provideMapIcons({ Fit: Globe }),
  ],
}
