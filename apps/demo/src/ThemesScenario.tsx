import { useState } from 'react'
import {
  Add,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Close,
  FitToScreen,
  Layers,
  LocationCurrent,
  Maximize,
  PauseFilled,
  PlayFilledAlt,
  Renew,
  Restart,
  SettingsAdjust,
  Subtract,
  ZoomReset,
} from '@carbon/icons-react'
import {
  MdAdd,
  MdArrowDownward,
  MdArrowUpward,
  MdAutorenew,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdExpandMore,
  MdFilterCenterFocus,
  MdFitScreen,
  MdFullscreen,
  MdLayers,
  MdMyLocation,
  MdPause,
  MdPlayArrow,
  MdRemove,
  MdReplay,
  MdTune,
} from 'react-icons/md'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource-variable/source-serif-4'
import { GeospatialMap, cn, type MapIcons } from '@/components/geospatial-map'
import { themesConfig as config } from '@demo-shared/src/fixtures'
import {
  demoThemeLabels as themeLabels,
  demoThemes as themes,
  parseHarnessParams,
  type DemoTheme,
} from '@demo-shared/src/scenarios'
import '@demo-shared/styles/themes/material.css'
import '@demo-shared/styles/themes/carbon.css'
import '@demo-shared/styles/themes/editorial.css'

// Three design systems applied to the same map. Each theme is one stylesheet in
// apps/demo-shared/styles/themes (shared with the Angular demo): `--geo-*` tokens plus a few
// rules on the map's `geo-*` classes, scoped to a wrapper class. Material and Carbon also bring
// their own icon sets through the `icons` prop. Nothing in the component folder is edited, and
// the data colours come from the theme too (`var(--demo-…)`, in the shared `themesConfig`).

const materialIcons: MapIcons = {
  ZoomIn: MdAdd,
  ZoomOut: MdRemove,
  ResetZoom: MdFilterCenterFocus,
  Locate: MdMyLocation,
  Spinner: MdAutorenew,
  Layers: MdLayers,
  Fit: MdFitScreen,
  Settings: MdTune,
  Fullscreen: MdFullscreen,
  Close: MdClose,
  Collapse: MdExpandMore,
  Expand: MdChevronRight,
  MoveUp: MdArrowUpward,
  MoveDown: MdArrowDownward,
  Previous: MdChevronLeft,
  Next: MdChevronRight,
  Play: MdPlayArrow,
  Pause: MdPause,
  Replay: MdReplay,
}

const carbonIcons: MapIcons = {
  ZoomIn: Add,
  ZoomOut: Subtract,
  ResetZoom: ZoomReset,
  Locate: LocationCurrent,
  Spinner: Renew,
  Layers,
  Fit: FitToScreen,
  Settings: SettingsAdjust,
  Fullscreen: Maximize,
  Close,
  Collapse: ChevronDown,
  Expand: ChevronRight,
  MoveUp: ArrowUp,
  MoveDown: ArrowDown,
  Previous: ChevronLeft,
  Next: ChevronRight,
  Play: PlayFilledAlt,
  Pause: PauseFilled,
  Replay: Restart,
}

const themeIcons: Partial<Record<DemoTheme, MapIcons>> = {
  material: materialIcons,
  carbon: carbonIcons,
}

export function ThemesScenario() {
  const [params] = useState(() => parseHarnessParams(window.location.search))
  const [theme, setTheme] = useState<DemoTheme>(params.theme)
  const [dark, setDark] = useState(params.dark)
  const icons = themeIcons[theme]
  return (
    <>
      <div className="demo-composed-toolbar" role="group" aria-label="Theme controls">
        <fieldset className="demo-theme-picker">
          <legend>Theme</legend>
          {themes.map((name) => (
            <label key={name}>
              <input
                type="radio"
                name="demo-theme"
                value={name}
                checked={theme === name}
                onChange={() => setTheme(name)}
              />
              {themeLabels[name]}
            </label>
          ))}
        </fieldset>
        <label>
          <input
            type="checkbox"
            checked={dark}
            onChange={(event) => setDark(event.currentTarget.checked)}
          />{' '}
          Dark
        </label>
      </div>
      <div className={cn('demo-theme', `theme-${theme}`, dark && 'dark')} data-theme-name={theme}>
        <GeospatialMap config={config} {...(icons ? { icons } : {})} />
      </div>
    </>
  )
}
