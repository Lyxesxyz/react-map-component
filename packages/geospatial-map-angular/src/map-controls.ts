import { NgTemplateOutlet } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  booleanAttribute,
  computed,
  contentChildren,
  input,
  output,
  signal,
} from '@angular/core'
import type { Signal, TemplateRef } from '@angular/core'
import { mapError } from './core/errors'
import { MapActionEvent } from './map-action-event'
import type { MapButtonAction } from './map-action-event'
import { injectMapActions, injectMapRuntime, injectMapStatic } from './map-context'
import { MapIconView } from './map-icon'
import { MapControlTemplate } from './map-templates'
import { injectHostAttribute, optionalBooleanAttribute, partHostStyle } from './signals'
import type { CustomControls, MapControlContext, MapIcon } from './component-types'
import type {
  BuiltInControlId,
  ControlGroupConfig,
  FitTargetPolicy,
  MapControlId,
  MapPanelId,
  MapPlacement,
  ResolvedMapUiConfig,
} from './types'
import { warnOnce } from './utils'

const isCustom = (id: MapControlId): id is `custom:${string}` => id.startsWith('custom:')

/** Whether "fit" has something to fit: with `fitTarget: 'selection'`, only a selection. */
function isFitAvailable(policy: FitTargetPolicy, hasSelection: boolean): boolean {
  return policy !== 'selection' || hasSelection
}

/** Whether a built-in control has something to do with the current configuration and state. */
function isControlAvailable(
  id: BuiltInControlId,
  ui: ResolvedMapUiConfig,
  hasSelection: boolean,
): boolean {
  if (id === 'layers') return ui.layerPanel.enabled
  if (id === 'settings') return ui.settings.enabled && ui.settings.fields.length > 0
  if (id === 'fit') return isFitAvailable(ui.controls.fitTarget, hasSelection)
  return true
}

/** Visually joins related control buttons. */
@Component({
  selector: 'geo-map-control-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'geo-control-group',
    'data-slot': 'map-control-group',
    '[attr.data-control-group]': 'id() ?? null',
    // `id` is the group's name, not a DOM id (as in React): the same layout in two maps
    // must not repeat an element id.
    '[attr.id]': 'null',
  },
  template: '<ng-content />',
})
export class MapControlGroup {
  /** Exposed as `data-control-group` for styling (not as the element's DOM id). */
  readonly id = input<string>()
}

/**
 * `<button geoMapControl [label]="…">`: an icon button styled for the control rail. Use it for
 * your own controls; the icon is its content.
 */
@Component({
  selector: 'button[geoMapControl]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    class: 'geo-shape-button geo-shape-icon-button',
    'data-slot': 'map-control-button',
    '[class.geo-control-active]': 'active()',
    '[attr.data-active]': 'active() ? "" : null',
    '[attr.aria-label]': 'consumerLabel ?? label()',
    '[attr.title]': 'label()',
  },
  template: '<ng-content />',
})
export class MapControlButton {
  /** Accessible name and tooltip. */
  readonly label = input.required<string>()
  /** Shows the pressed/open styling. */
  readonly active = input(false, { transform: booleanAttribute })
  /** A static `aria-label` on the element replaces `label` as the accessible name. */
  protected readonly consumerLabel = injectHostAttribute('aria-label')
}

/**
 * What every built-in button is: a default label and icon, and the action that runs on click.
 * `label` replaces the label, content replaces the icon, and `(beforeAction)` can cancel the
 * action with `event.preventDefault()`.
 */
@Directive({
  host: {
    type: 'button',
    '[class.geo-shape-button]': '!hidden()',
    '[class.geo-shape-icon-button]': '!hidden()',
    '[class.geo-control-active]': '!hidden() && active()',
    '[attr.data-slot]': 'hidden() ? null : "map-control-button"',
    '[attr.data-active]': '!hidden() && active() ? "" : null',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? resolvedLabel())',
    '[attr.title]': 'hidden() ? null : resolvedLabel()',
    '[attr.aria-expanded]': 'hidden() ? null : expanded()',
    '[attr.aria-busy]': 'busy() ? "true" : null',
    '[attr.disabled]': 'resolvedDisabled() ? "" : null',
    '[style]': 'hostStyle()',
    '(click)': 'handleClick($event)',
  },
})
export abstract class MapBuiltInButton<A extends MapButtonAction> {
  /** Replaces the default accessible name and tooltip. */
  readonly label = input<string>()
  /** Replaces the built-in disabled state. */
  readonly disabled = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Emitted before the action runs; `preventDefault()` skips it. */
  readonly beforeAction = output<MapActionEvent<A>>()

  protected readonly map = injectMapStatic()
  protected readonly mapActions = injectMapActions()
  protected abstract readonly action: A
  protected abstract readonly defaultLabel: Signal<string>
  protected abstract readonly icon: Signal<MapIcon>
  protected readonly iconClass: Signal<string | undefined> = signal(undefined)
  protected readonly active: Signal<boolean> = signal(false)
  protected readonly expanded: Signal<'true' | 'false' | null> = signal(null)
  protected readonly busy: Signal<boolean> = signal(false)
  protected readonly builtInDisabled: Signal<boolean> = signal(false)
  /** Where React renders nothing (an unavailable fit button): hidden, without classes or ARIA. */
  protected readonly hidden: Signal<boolean> = signal(false)

  /** A static `aria-label` on the element replaces the accessible name (not the tooltip). */
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  protected readonly resolvedLabel = computed(() => this.label() ?? this.defaultLabel())
  protected readonly resolvedDisabled = computed(() => this.disabled() ?? this.builtInDisabled())
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  protected handleClick(event: MouseEvent): void {
    const before = new MapActionEvent(this.action, event)
    this.beforeAction.emit(before)
    if (before.defaultPrevented || event.defaultPrevented) return
    this.run()
  }

  /** The built-in action. */
  protected abstract run(): void
}

const buttonTemplate = `<ng-content><geo-map-icon [icon]="icon()" [iconClass]="iconClass()" /></ng-content>`

/** `<button geoMapZoomIn>`: zooms in by `step` (default `ui.controls.zoomStep`). */
@Component({
  selector: 'button[geoMapZoomIn]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapZoomInButton extends MapBuiltInButton<'zoomIn'> {
  readonly step = input<number>()
  protected readonly action = 'zoomIn'
  protected readonly defaultLabel = computed(() => this.map().messages.zoomIn)
  protected readonly icon = computed(() => this.map().icons.ZoomIn)
  protected run(): void {
    this.mapActions.zoom(this.step() ?? this.map().ui.controls.zoomStep)
  }
}

/** `<button geoMapZoomOut>`: zooms out by `step` (default `ui.controls.zoomStep`). */
@Component({
  selector: 'button[geoMapZoomOut]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapZoomOutButton extends MapBuiltInButton<'zoomOut'> {
  readonly step = input<number>()
  protected readonly action = 'zoomOut'
  protected readonly defaultLabel = computed(() => this.map().messages.zoomOut)
  protected readonly icon = computed(() => this.map().icons.ZoomOut)
  protected run(): void {
    this.mapActions.zoom(-(this.step() ?? this.map().ui.controls.zoomStep))
  }
}

/** `<button geoMapResetZoom>`: returns to the starting zoom; disabled while there. */
@Component({
  selector: 'button[geoMapResetZoom]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapResetZoomButton extends MapBuiltInButton<'resetZoom'> {
  protected readonly action = 'resetZoom'
  protected readonly defaultLabel = computed(() => this.map().messages.resetZoom)
  protected readonly icon = computed(() => this.map().icons.ResetZoom)
  readonly #zoom = injectMapRuntime((map) => map.state.view.zoom)
  protected override readonly builtInDisabled = computed(
    () => Math.abs(this.#zoom() - this.map().config.initialState.view.zoom) < 1e-6,
  )
  protected run(): void {
    this.mapActions.resetZoom()
  }
}

/** `<button geoMapLocate>`: centres the map on the user's location (`ui.controls.locate`). */
@Component({
  selector: 'button[geoMapLocate]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapLocateButton extends MapBuiltInButton<'locate'> {
  /** Zoom to go to; defaults to `ui.controls.locate.zoom`. */
  readonly zoom = input<number>()
  protected readonly action = 'locate'
  readonly #locating = signal(false)
  protected readonly defaultLabel = computed(() => this.map().messages.findLocation)
  protected readonly icon = computed(() =>
    this.#locating() ? this.map().icons.Spinner : this.map().icons.Locate,
  )
  protected override readonly iconClass = computed(() =>
    this.#locating() ? 'geo-spin' : undefined,
  )
  protected override readonly builtInDisabled = this.#locating.asReadonly()
  protected override readonly busy = this.#locating.asReadonly()

  protected run(): void {
    const { ui, messages } = this.map()
    const actions = this.mapActions
    const options = ui.controls.locate
    const failed = (message: string, cause?: unknown) =>
      actions.reportError(mapError('LOCATION_UNAVAILABLE', message, true, undefined, cause))
    if (!navigator.geolocation) return failed(messages.locationUnavailable)
    this.#locating.set(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        actions.setView({
          center: [coords.longitude, coords.latitude],
          zoom: this.zoom() ?? options.zoom,
        })
        this.#locating.set(false)
      },
      (cause) => {
        failed(messages.locationDenied, cause)
        this.#locating.set(false)
      },
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeoutMs,
        maximumAge: options.maximumAgeMs,
      },
    )
  }
}

/** A button that opens and closes one of the map's panels. */
@Directive()
abstract class MapPanelButton<A extends 'layers' | 'settings'> extends MapBuiltInButton<A> {
  protected abstract readonly panel: MapPanelId
  readonly #openPanel = injectMapRuntime((map) => map.openPanel)
  protected readonly open = computed(() => this.#openPanel() === this.panel)
  protected override readonly active = this.open
  protected override readonly expanded = computed(() => (this.open() ? 'true' : 'false'))
  protected run(): void {
    this.mapActions.setOpenPanel(this.open() ? null : this.panel)
  }
}

/** `<button geoMapLayers>`: opens and closes the layer panel. */
@Component({
  selector: 'button[geoMapLayers]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapLayersButton extends MapPanelButton<'layers'> {
  protected readonly action = 'layers'
  protected readonly panel = 'layers'
  protected readonly defaultLabel = computed(() => this.map().messages.layers)
  protected readonly icon = computed(() => this.map().icons.Layers)
}

/** `<button geoMapSettings>`: opens and closes the settings panel. */
@Component({
  selector: 'button[geoMapSettings]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapSettingsButton extends MapPanelButton<'settings'> {
  protected readonly action = 'settings'
  protected readonly panel = 'settings'
  protected readonly defaultLabel = computed(() => this.map().messages.mapSettings)
  protected readonly icon = computed(() => this.map().icons.Settings)
}

/**
 * `<button geoMapFit>`: fits the selection, the data, or the selection when there is one
 * (`fitTarget`, default `ui.controls.fitTarget`). Hidden while there is nothing to fit.
 */
@Component({
  selector: 'button[geoMapFit]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapFitButton extends MapBuiltInButton<'fit'> {
  readonly fitTarget = input<FitTargetPolicy>()
  protected readonly action = 'fit'
  readonly #hasSelection = injectMapRuntime((map) => map.state.selection !== null)
  readonly #policy = computed(() => this.fitTarget() ?? this.map().ui.controls.fitTarget)
  protected override readonly hidden = computed(
    () => !isFitAvailable(this.#policy(), this.#hasSelection()),
  )
  protected readonly defaultLabel = computed(() => {
    const { messages } = this.map()
    return this.#hasSelection() && this.#policy() !== 'data'
      ? messages.fitSelection
      : messages.fitData
  })
  protected readonly icon = computed(() => this.map().icons.Fit)
  protected run(): void {
    this.mapActions.fitContent(this.#policy())
  }
}

/** `<button geoMapFullscreen>`: toggles fullscreen for the map (or its container). */
@Component({
  selector: 'button[geoMapFullscreen]',
  imports: [MapIconView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: buttonTemplate,
})
export class MapFullscreenButton extends MapBuiltInButton<'fullscreen'> {
  /** What goes fullscreen; defaults to `ui.controls.fullscreenTarget`. */
  readonly target = input<'map' | 'container'>()
  protected readonly action = 'fullscreen'
  protected readonly defaultLabel = computed(() => this.map().messages.fullscreen)
  protected readonly icon = computed(() => this.map().icons.Fullscreen)
  protected run(): void {
    this.mapActions.toggleFullscreen(this.target())
  }
}

type RenderedControl = {
  id: MapControlId
  /** The template of a `custom:*` control. */
  template: TemplateRef<MapControlContext> | null
}

/**
 * The floating control rail. Project `<geo-map-control-group>` children, or let it render the
 * configured groups. A `custom:*` id is rendered from a `<ng-template geoMapControl="custom:…">`
 * inside it (or `customControls`); one without a template is skipped (with a console hint).
 */
@Component({
  selector: 'geo-map-controls',
  imports: [
    NgTemplateOutlet,
    MapControlGroup,
    MapZoomInButton,
    MapZoomOutButton,
    MapResetZoomButton,
    MapLocateButton,
    MapLayersButton,
    MapSettingsButton,
    MapFitButton,
    MapFullscreenButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'geo-map-controls',
    role: 'group',
    'data-slot': 'map-controls',
    '[attr.data-placement]': 'placement() ?? map().ui.controls.placement',
    '[attr.aria-label]': 'consumerLabel ?? map().messages.mapControls',
  },
  template: `
    <ng-content select="ng-template" />
    <ng-content>
      @for (group of renderedGroups(); track group.id) {
        <geo-map-control-group [id]="group.id">
          @for (control of group.controls; track control.id) {
            @switch (control.id) {
              @case ('zoom-in') {
                <button geoMapZoomIn></button>
              }
              @case ('zoom-out') {
                <button geoMapZoomOut></button>
              }
              @case ('reset-zoom') {
                <button geoMapResetZoom></button>
              }
              @case ('locate') {
                <button geoMapLocate></button>
              }
              @case ('layers') {
                <button geoMapLayers></button>
              }
              @case ('fit') {
                <button geoMapFit></button>
              }
              @case ('settings') {
                <button geoMapSettings></button>
              }
              @case ('fullscreen') {
                <button geoMapFullscreen></button>
              }
              @default {
                @if (control.template; as template) {
                  <div class="geo-custom-control" data-slot="map-custom-control">
                    <ng-container *ngTemplateOutlet="template; context: controlContext()" />
                  </div>
                }
              }
            }
          }
        </geo-map-control-group>
      }
    </ng-content>
  `,
})
export class MapControls {
  /** Corner of the map; defaults to `ui.controls.placement`. */
  readonly placement = input<MapPlacement>()
  /** Groups rendered when there is no projected content; defaults to `ui.controls.groups`. */
  readonly groups = input<ControlGroupConfig[]>()
  /** Templates for the `custom:*` ids in `groups` (`<geo-map>` passes its own here). */
  readonly customControls = input<CustomControls>()

  protected readonly map = injectMapStatic()
  /** A static `aria-label` on the element replaces the default name. */
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #actions = injectMapActions()
  readonly #state = injectMapRuntime((map) => map.state)
  readonly #hasSelection = injectMapRuntime((map) => map.state.selection !== null)
  private readonly templates = contentChildren(MapControlTemplate)

  protected readonly controlContext = computed<MapControlContext>(() => {
    const state = this.#state()
    return { $implicit: state, state, actions: this.#actions }
  })
  readonly #customTemplates = computed(() => {
    const templates: CustomControls = { ...this.customControls() }
    for (const item of this.templates()) templates[item.id()] = item.template
    return templates
  })
  protected readonly renderedGroups = computed(() => {
    const { ui } = this.map()
    const hasSelection = this.#hasSelection()
    const templates = this.#customTemplates()
    return (this.groups() ?? ui.controls.groups).flatMap((group) => {
      const controls = group.controls.flatMap((id): RenderedControl[] => {
        if (!isCustom(id))
          return isControlAvailable(id, ui, hasSelection) ? [{ id, template: null }] : []
        const template = templates[id]
        if (template) return [{ id, template }]
        warnOnce(
          `custom-control:${id}`,
          `Control ${id} is in ui.controls.groups but has no template: add <ng-template geoMapControl="${id}"> inside <geo-map> or <geo-map-controls> (or pass customControls).`,
        )
        return []
      })
      return controls.length ? [{ id: group.id, controls }] : []
    })
  })
}
