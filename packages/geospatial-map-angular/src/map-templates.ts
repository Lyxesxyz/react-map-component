import { Directive, TemplateRef, inject, input } from '@angular/core'
import type {
  MapConfigErrorContext,
  MapControlContext,
  MapErrorContext,
  MapPopupContext,
  MapTooltipContext,
} from './component-types'

// Content for the parts, as templates with typed contexts: under strictTemplates, `let-feature`
// is a `FeatureEvent`. Declare them inside the part, or inside <geo-map> for its layout.

/**
 * Popup content for the selected feature, inside `<geo-map>` or `<geo-map-popup>`:
 * `<ng-template geoMapPopup let-feature let-close="close" let-state="state" let-actions="actions">`.
 */
@Directive({ selector: 'ng-template[geoMapPopup]' })
export class MapPopupTemplate {
  readonly template = inject<TemplateRef<MapPopupContext>>(TemplateRef)

  static ngTemplateContextGuard(_dir: MapPopupTemplate, ctx: unknown): ctx is MapPopupContext {
    return typeof ctx === 'object'
  }
}

/** The hover tooltip for a feature, inside `<geo-map>` or `<geo-map-tooltip>`: `let-feature`. */
@Directive({ selector: 'ng-template[geoMapTooltip]' })
export class MapTooltipTemplate {
  readonly template = inject<TemplateRef<MapTooltipContext>>(TemplateRef)

  static ngTemplateContextGuard(_dir: MapTooltipTemplate, ctx: unknown): ctx is MapTooltipContext {
    return typeof ctx === 'object'
  }
}

/**
 * A `custom:*` control of `ui.controls.groups`, inside `<geo-map>` or `<geo-map-controls>`:
 * `<ng-template geoMapControl="custom:share" let-state let-actions="actions">`.
 */
@Directive({ selector: 'ng-template[geoMapControl]' })
export class MapControlTemplate {
  /** The control id, as in `ui.controls.groups`. */
  readonly id = input.required<`custom:${string}`>({ alias: 'geoMapControl' })
  readonly template = inject<TemplateRef<MapControlContext>>(TemplateRef)

  static ngTemplateContextGuard(_dir: MapControlTemplate, ctx: unknown): ctx is MapControlContext {
    return typeof ctx === 'object'
  }
}

/** Replaces the error message of `<geo-map-error-alert>`: `let-error let-dismiss="dismiss"`. */
@Directive({ selector: 'ng-template[geoMapError]' })
export class MapErrorTemplate {
  readonly template = inject<TemplateRef<MapErrorContext>>(TemplateRef)

  static ngTemplateContextGuard(_dir: MapErrorTemplate, ctx: unknown): ctx is MapErrorContext {
    return typeof ctx === 'object'
  }
}

/**
 * Replaces the configuration-error message, inside `<geo-map-root>`:
 * `<ng-template geoMapConfigError let-error let-state="state" let-actions="actions">`.
 */
@Directive({ selector: 'ng-template[geoMapConfigError]' })
export class MapConfigErrorTemplate {
  readonly template = inject<TemplateRef<MapConfigErrorContext>>(TemplateRef)

  static ngTemplateContextGuard(
    _dir: MapConfigErrorTemplate,
    ctx: unknown,
  ): ctx is MapConfigErrorContext {
    return typeof ctx === 'object'
  }
}
