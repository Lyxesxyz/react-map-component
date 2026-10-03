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
import {
  GeospatialMap,
  cn,
  defineMapConfig,
  type GeoJsonLayerConfig,
  type MapIcons,
  type MapLayerInput,
} from '@/components/geospatial-map'
import './themes/material.css'
import './themes/carbon.css'
import './themes/editorial.css'
import { categoricalPointLayer, cityLayer, timedLayer } from './demo-config'

// Three design systems applied to the same map. Each theme is one stylesheet in ./themes:
// `--geo-*` tokens plus a few rules on the map's `geo-*` classes, scoped to a wrapper class.
// Material and Carbon also bring their own icon sets through the `icons` prop. Nothing in the
// component folder is edited, and the data colours come from the theme too (`var(--demo-…)`).

const themes = ['default', 'material', 'carbon', 'editorial'] as const
type DemoTheme = (typeof themes)[number]

const themeLabels: Record<DemoTheme, string> = {
  default: 'Default',
  material: 'Material',
  carbon: 'Carbon',
  editorial: 'Editorial',
}

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

// The same layers as the time scenario, with colours taken from the theme.
const layers: MapLayerInput[] = [
  {
    ...(timedLayer as GeoJsonLayerConfig),
    opacity: 1,
    style: {
      type: 'continuous',
      field: 'value',
      domain: [0, 100],
      stops: [
        { value: 0, color: 'var(--demo-seq-1)' },
        { value: 50, color: 'var(--demo-seq-3)' },
        { value: 100, color: 'var(--demo-seq-5)' },
      ],
      symbol: { kind: 'polygon', strokeColor: 'var(--demo-area-stroke)', strokeWidth: 0.6 },
      missing: { label: 'No data', symbol: { kind: 'polygon', fillColor: 'var(--demo-missing)' } },
    },
  },
  {
    ...(cityLayer as GeoJsonLayerConfig),
    style: {
      type: 'constant',
      symbol: {
        kind: 'point',
        shape: 'circle',
        radius: 5,
        fillColor: 'var(--demo-point)',
        strokeColor: 'var(--demo-point-stroke)',
        strokeWidth: 2,
        labelField: 'name',
      },
    },
    legend: {
      entries: [
        {
          id: 'city',
          label: 'Selected cities',
          symbol: {
            kind: 'point',
            fillColor: 'var(--demo-point)',
            strokeColor: 'var(--demo-point-stroke)',
          },
        },
      ],
    },
  },
  categoricalPointLayer,
]

const config = defineMapConfig({
  accessibility: { ariaLabel: 'Design-system themes' },
  initialState: { time: '2021' },
  ui: {
    popup: { anchor: 'feature' },
    disclaimer: {
      text:
        'Boundaries and names shown do not imply official endorsement or acceptance. ' +
        'Values are synthetic and for demonstration only.',
    },
  },
  data: { layers },
})

function initialTheme(): DemoTheme {
  const requested = new URLSearchParams(window.location.search).get('theme')
  return themes.find((theme) => theme === requested) ?? 'material'
}

export function ThemesScenario() {
  const [theme, setTheme] = useState<DemoTheme>(initialTheme)
  const [dark, setDark] = useState(() => new URLSearchParams(window.location.search).has('dark'))
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
