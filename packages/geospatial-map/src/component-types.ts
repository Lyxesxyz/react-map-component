import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react'
import type {
  ConfigIssue,
  FeatureEvent,
  MapActions,
  MapConfig,
  MapConfigInput,
  MapError,
  MapGridCallbacks,
  MapGridConfig,
  MapGridState,
  MapHostInputs,
  MapIconName,
  MapMessages,
  MapRuntime,
  MapSlotContext,
  MapStateChange,
  PopupContext,
  ResolvedMapUiConfig,
} from './types'

// The React types: props, slots, icons and the context values of the parts. The configuration,
// state, event and action types are in `types.ts`.

/** What the component `ref` gives you: the same actions as `useMapActions()`. */
export type GeospatialMapHandle = MapActions

/**
 * Content for the `<GeospatialMap>` layout's popup, tooltip and custom controls. For anything
 * else (panel headers, loading and error content), compose the parts with `<MapRoot>`.
 */
export type MapSlots = {
  /** Selected-feature content inside the popup. */
  popup?: (context: PopupContext) => ReactNode
  /** The hover tooltip for a feature; return `null` to show none. */
  tooltip?: (feature: FeatureEvent) => ReactNode
  /** Renderers for `custom:*` control ids in `ui.controls.groups`. */
  controls?: CustomControls
}

/** Renderers keyed by `custom:*` control id. */
export type CustomControls = Partial<
  Record<`custom:${string}`, (context: MapSlotContext) => ReactNode>
>

/**
 * An icon component: anything that renders an SVG and accepts `className` and `aria-hidden`
 * (lucide-react, @carbon/icons-react, react-icons, your own). Size and stroke come from CSS
 * (`--geo-icon-size`, `--geo-icon-stroke`).
 */
export type MapIcon = ComponentType<{
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

/** A complete icon set. Pass a partial one to the `icons` prop to replace some of them. */
export type MapIcons = Record<MapIconName, MapIcon>

/** Props shared by `<MapRoot>` (composable) and the `<GeospatialMap>` preset. */
export type MapRootProps = MapHostInputs &
  Omit<ComponentPropsWithoutRef<'section'>, keyof MapHostInputs | 'children'> & {
    /** Map configuration: the short `MapConfigInput` form or a complete `MapConfig`. */
    config: MapConfigInput
    /** Map parts (`<MapControls>`, `<MapLegend>`, …) rendered on top of the map viewport. */
    children?: ReactNode
    /** Fill the parent element's height instead of using `--geo-height`. */
    fill?: boolean
    /**
     * Icons for this map, by role (`{ ZoomIn, Layers, Close, … }`); the rest come from
     * `icons.ts`. To change the icons of every map in your app, edit `icons.ts` instead.
     */
    icons?: Partial<MapIcons>
    /** Extra semantic checks; any issue renders the configuration-error shell. */
    validate?: (config: MapConfig, ui: ResolvedMapUiConfig) => ConfigIssue[]
    /** Replaces the configuration-error message content. */
    renderConfigError?: (error: MapError, context: MapSlotContext) => ReactNode
  }

/** Public React props for the ready-made `<GeospatialMap>` layout. */
export type GeospatialMapProps = Omit<MapRootProps, 'validate' | 'renderConfigError'> & {
  /** Popup, tooltip and custom-control content. */
  slots?: MapSlots
}

/** What doesn't change while the map is used: configuration, UI policy, text, actions, icons. */
export type MapStaticValue = {
  /** Stable DOM-safe map identifier. */
  mapId: string
  /** Validated configuration. */
  config: MapConfig
  /** Configuration UI resolved against its profile. */
  ui: ResolvedMapUiConfig
  /** Messages resolved against the English defaults. */
  messages: MapMessages
  /** Every map action, with a stable identity. */
  actions: MapActions
  /** `icons.ts` merged with the `icons` prop. */
  icons: MapIcons
}

/** Value returned by `useMap()`: the static value and the live map data. */
export type MapContextValue = MapStaticValue & MapRuntime

/** Public React props for a map comparison grid. */
export type MapGridProps = MapGridCallbacks & {
  /** Grid configuration. */
  config: MapGridConfig
  /** Complete controlled grid state; omit for grid-owned state. */
  state?: MapGridState
  /** Optional class applied to the grid root. */
  className?: string
  /** Optional class applied to every grid cell. */
  cellClassName?: string
  /** Slots forwarded to each map cell. */
  slots?: MapSlots
  /** Icons for every map cell. */
  icons?: Partial<MapIcons>
  /**
   * Receives the complete grid state after any change: a map's state (with its id and the
   * change) or the focused map (with `change` undefined).
   */
  onStateChange?: (state: MapGridState, mapId: string | null, change?: MapStateChange) => void
}
