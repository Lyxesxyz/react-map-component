import type { TemplateRef, Type } from '@angular/core'
import type { IconNode } from 'lucide'
import type {
  ConfigIssue,
  FeatureEvent,
  MapActions,
  MapConfig,
  MapError,
  MapHostInputs,
  MapIconName,
  MapMessages,
  MapRuntime,
  MapSlotContext,
  MapState,
  MapStateChange,
  PopupContext,
  ResolvedMapUiConfig,
} from './types'

// The Angular types: icons, template contexts, the context values of the parts and the output
// payloads. The configuration, state, event and action types are in `types.ts`.

/**
 * An icon as an SVG node list, in the shape of lucide's `IconNode` (`[tag, attributes][]`), so
 * `import { Globe } from 'lucide'` works. It is drawn inside an `<svg>` with lucide's default
 * attributes (24×24 view box, `stroke="currentColor"`, no fill).
 */
export type MapSvgIcon = IconNode

/**
 * An icon: an SVG node list (lucide, or an adapter for another set), or an icon component
 * (Material, Carbon, your own). A component may declare a `class` and an `ariaHidden` input;
 * the map sets the ones it declares. Size and stroke come from CSS (`--geo-icon-size`,
 * `--geo-icon-stroke`).
 */
export type MapIcon = MapSvgIcon | Type<unknown>

/** A complete icon set. Pass a partial one to `[icons]` or `provideMapIcons()`. */
export type MapIcons = Record<MapIconName, MapIcon>

/** What doesn't change while the map is used: configuration, UI policy, text, actions, icons. */
export type MapStaticValue = {
  /** Stable DOM-safe map identifier. */
  mapId: string
  /**
   * Validated configuration. While the configuration is invalid (the map shows the error
   * panel), a configuration built from the defaults, so parts never see `null`.
   */
  config: MapConfig
  /** Configuration UI resolved against its profile. */
  ui: ResolvedMapUiConfig
  /** Messages resolved against the English defaults. */
  messages: MapMessages
  /** Every map action, with a stable identity. */
  actions: MapActions
  /** `icons.ts` merged with `provideMapIcons()` and the `icons` input. */
  icons: MapIcons
}

/** Value of `injectMap()`: the static value and the live map data. */
export type MapContextValue = MapStaticValue & MapRuntime

/** The `(stateChangeDetails)` payload: the proposed state and why it changed. */
export type MapStateChangeEvent = {
  state: MapState
  change: MapStateChange
}

/** A per-map output of `<geo-map-grid>`: which map it came from, and its event. */
export type MapGridEvent<T> = {
  mapId: string
  event: T
}

/** Extra semantic checks for `<geo-map-root [validate]>`; any issue shows the error panel. */
export type MapConfigValidator = (config: MapConfig, ui: ResolvedMapUiConfig) => ConfigIssue[]

/** The `[onOpenLayersMap]` hook: receives the OpenLayers map; may return a cleanup. */
export type MapOpenLayersHook = NonNullable<MapHostInputs['onOpenLayersMap']>

/** `<ng-template geoMapPopup let-feature let-close="close" let-state="state" let-actions="actions">` */
export type MapPopupContext = PopupContext & {
  /** The selected feature (`let-feature`). */
  $implicit: FeatureEvent
}

/** `<ng-template geoMapTooltip let-feature>` */
export type MapTooltipContext = {
  /** The hovered feature (`let-feature`). */
  $implicit: FeatureEvent
  feature: FeatureEvent
}

/** `<ng-template geoMapControl="custom:share" let-state let-actions="actions">` */
export type MapControlContext = MapSlotContext & {
  /** The current map state (`let-state`). */
  $implicit: MapState
}

/** `<ng-template geoMapError let-error let-dismiss="dismiss">` inside `<geo-map-error-alert>` */
export type MapErrorContext = {
  /** The error shown (`let-error`). */
  $implicit: MapError
  error: MapError
  /** Hides the alert. */
  dismiss: () => void
}

/** `<ng-template geoMapConfigError let-error let-state="state" let-actions="actions">` */
export type MapConfigErrorContext = MapSlotContext & {
  /** Why the configuration was rejected (`let-error`); `error.cause` lists the issues. */
  $implicit: MapError
  error: MapError
}

/** Templates keyed by `custom:*` control id, for `<geo-map-controls [customControls]>`. */
export type CustomControls = Partial<Record<`custom:${string}`, TemplateRef<MapControlContext>>>
