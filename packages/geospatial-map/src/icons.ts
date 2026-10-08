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
} from 'lucide-react'
import type { MapIcons } from './component-types'

// Every icon the map renders comes from this set. To use another icon set in every map of your
// app, replace the components here; any component that renders an SVG and accepts `className`
// and `aria-hidden` works. To change icons for one map (or one theme), pass `icons` to
// <MapRoot>, <GeospatialMap> or <MapGrid> instead.
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
