import {
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  provideZonelessChangeDetection,
} from '@angular/core'
import type { ApplicationConfig } from '@angular/core'

/** Zoneless (explicitly), or zone.js change detection for the `?zone` check. */
export function appConfig(zone: boolean): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      zone ? provideZoneChangeDetection() : provideZonelessChangeDetection(),
    ],
  }
}
