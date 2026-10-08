import { InjectionToken, inject } from '@angular/core'
import type { Provider } from '@angular/core'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Focus,
  Layers3,
  LoaderCircle,
  LocateFixed,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scan,
  Settings2,
  X,
} from 'lucide'
import type { MapIcons } from './component-types'

// Every icon the map renders comes from this set. To use another icon set in every map of your
// app, replace the icons here: an SVG node list in lucide's shape, or any icon component. To
// change icons for an app or a route, use provideMapIcons(); for one map (or one theme), pass
// [icons] to <geo-map-root>, <geo-map> or <geo-map-grid>. Import each icon by name: the
// `icons` namespace of lucide holds every icon and defeats tree-shaking.
export const defaultMapIcons: MapIcons = {
  ZoomIn: Plus,
  ZoomOut: Minus,
  ResetZoom: Scan,
  Locate: LocateFixed,
  Spinner: LoaderCircle,
  Layers: Layers3,
  Fit: Focus,
  Settings: Settings2,
  Fullscreen: Maximize2,
  Close: X,
  Collapse: ChevronDown,
  Expand: ChevronRight,
  MoveUp: ChevronUp,
  MoveDown: ChevronDown,
  Previous: ChevronLeft,
  Next: ChevronRight,
  Play,
  Pause,
  Replay: RotateCcw,
}

/** The icons of every map in the injector: `icons.ts`, plus any `provideMapIcons()`. */
export const MAP_ICONS = new InjectionToken<MapIcons>('MAP_ICONS', {
  providedIn: 'root',
  factory: () => defaultMapIcons,
})

/**
 * Replaces some icons for every map of an app or route; the rest keep their current icons.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideMapIcons({ ZoomIn: Plus, Close: XCircle })] })
 * ```
 */
export function provideMapIcons(icons: Partial<MapIcons>): Provider {
  return {
    provide: MAP_ICONS,
    useFactory: (): MapIcons => ({
      ...(inject(MAP_ICONS, { skipSelf: true, optional: true }) ?? defaultMapIcons),
      ...icons,
    }),
  }
}
