import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core'
import { injectMapActions, injectMapRuntime, injectMapStatic } from './map-context'
import { MapIconView } from './map-icon'
import { ShapeCard, ShapeIconButton, ShapeLabel, ShapeSelect } from './shapes'
import type { ShapeSelectOption } from './shapes'
import { injectHostAttribute, partHostStyle } from './signals'
import type { ExportFormat, MapPlacement, SettingsFieldId } from './types'

// The fields, then the panel that lays them out (`MapSettings`, at the end: a component's
// `imports` must be declared before it). Each field's host is React's root `<label>`.

/**
 * `<label geoMapBasemapField>`: picks the basemap, among those in the map's projection. Hidden
 * (with no classes) with fewer than two.
 */
@Component({
  selector: 'label[geoMapBasemapField]',
  imports: [ShapeSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeLabel],
  host: { '[class.geo-settings-field]': '!hidden()', '[style]': 'hostStyle()' },
  template: `
    @if (!hidden()) {
      <span class="geo-settings-field-label">{{ map().messages.basemap }}</span>
      <geo-shape-select
        [ariaLabel]="map().messages.basemap"
        [value]="activeBasemapId() ?? ''"
        [options]="options()"
        (valueChange)="actions.setBasemap($event)"
      />
    }
  `,
})
export class MapBasemapField {
  protected readonly map = injectMapStatic()
  protected readonly actions = injectMapActions()
  protected readonly activeBasemapId = injectMapRuntime((map) => map.state.activeBasemapId)
  protected readonly options = computed<ShapeSelectOption[]>(() => {
    const { config } = this.map()
    const projection = config.initialState.view.projection
    return config.data.basemaps
      .filter((item) => item.supportedProjections.includes(projection))
      .map((item) => ({ value: item.id, label: item.title }))
  })
  protected readonly hidden = computed(() => this.options().length < 2)
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeLabel, { self: true }).hideWhen(() => this.hidden())
  }
}

/**
 * `<label geoMapZoomTargetField>`: zooms to one of `config.data.zoomTargets`. Hidden (with no
 * classes) without targets. `(targetSelect)` gets the target's id after the map starts zooming
 * (React's `onSelect`; `select` is a DOM event name). The settings panel closes itself with it.
 */
@Component({
  selector: 'label[geoMapZoomTargetField]',
  imports: [ShapeSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeLabel],
  host: { '[class.geo-settings-field]': '!hidden()', '[style]': 'hostStyle()' },
  template: `
    @if (!hidden()) {
      <span class="geo-settings-field-label">{{ map().messages.goToArea }}</span>
      <geo-shape-select
        [ariaLabel]="map().messages.zoomToArea"
        [options]="options()"
        (valueChange)="choose($event)"
      />
    }
  `,
})
export class MapZoomTargetField {
  /** The id of the chosen target, after `actions.fitZoomTarget(id)`. */
  readonly targetSelect = output<string>()

  protected readonly map = injectMapStatic()
  readonly #actions = injectMapActions()
  readonly #targets = computed(() => this.map().config.data.zoomTargets ?? [])
  // Uncontrolled, as React's `defaultValue=""`: it starts on the disabled placeholder and then
  // shows the chosen area.
  protected readonly options = computed<ShapeSelectOption[]>(() => [
    { value: '', label: this.map().messages.chooseArea, disabled: true },
    ...this.#targets().map((target) => ({ value: target.id, label: target.label })),
  ])
  protected readonly hidden = computed(() => !this.#targets().length)
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeLabel, { self: true }).hideWhen(() => this.hidden())
  }

  protected choose(id: string): void {
    this.#actions.fitZoomTarget(id)
    this.targetSelect.emit(id)
  }
}

const allFormats: ExportFormat[] = ['image/png', 'image/jpeg', 'image/svg+xml']
const formatLabels: Record<ExportFormat, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/svg+xml': 'SVG',
}

/**
 * `<label geoMapExportField>`: downloads the map as a report image, in the formats
 * `config.export` allows. Hidden (with no classes) when `config.export.enabled` is `false`.
 */
@Component({
  selector: 'label[geoMapExportField]',
  imports: [ShapeSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeLabel],
  host: { '[class.geo-settings-field]': '!hidden()', '[style]': 'hostStyle()' },
  // Controlled on the placeholder (`[value]="''"`): after each download the select shows it
  // again, as React's `event.currentTarget.value = ''`. A binding, not `value=""`, which would
  // also leave a `value` attribute on <geo-shape-select>.
  template: `
    @if (!hidden()) {
      <span class="geo-settings-field-label">{{ map().messages.download }}</span>
      <geo-shape-select
        [value]="''"
        [ariaLabel]="map().messages.exportMap"
        [options]="options()"
        (valueChange)="download($event)"
      />
    }
  `,
})
export class MapExportField {
  /** The formats offered; defaults to `config.export.formats`, or all three. */
  readonly formats = input<ExportFormat[]>()
  /** The format listed first; defaults to `config.export.defaultFormat`. */
  readonly defaultFormat = input<ExportFormat>()

  protected readonly map = injectMapStatic()
  readonly #actions = injectMapActions()
  protected readonly hidden = computed(() => this.map().config.export?.enabled === false)
  protected readonly options = computed<ShapeSelectOption[]>(() => {
    const exportConfig = this.map().config.export ?? {}
    const configured = this.formats() ?? exportConfig.formats ?? allFormats
    const preferred = this.defaultFormat() ?? exportConfig.defaultFormat
    const ordered = preferred
      ? [preferred, ...configured.filter((format) => format !== preferred)]
      : configured
    return [
      { value: '', label: this.map().messages.exportReportImage, disabled: true },
      ...ordered.map((format) => ({ value: format, label: formatLabels[format] })),
    ]
  })
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeLabel, { self: true }).hideWhen(() => this.hidden())
  }

  protected download(format: string): void {
    if (format) void this.#actions.downloadImage(format as ExportFormat)
  }
}

/**
 * Basemap, area, and export settings, shown while the map's open panel is `'settings'` (the
 * settings button, `actions.setOpenPanel`, or `[(openPanel)]` on the root). Hidden (with no
 * classes or ARIA) while another panel or none is open. Without content it renders `fields`;
 * project your own fields (`<label geoMapBasemapField>`, …) to replace them. Project
 * `[geoMapPanelHeader]` to replace the default header (title and close button), and
 * `[geoMapPanelFooter]` to add content after the fields.
 */
@Component({
  selector: 'geo-map-settings',
  imports: [MapBasemapField, MapExportField, MapIconView, MapZoomTargetField, ShapeIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeCard],
  host: {
    '[class.geo-map-settings]': '!hidden()',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "region")',
    '[attr.data-slot]': 'hidden() ? null : "map-settings"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.settings.placement)',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? map().messages.mapSettings)',
    '[style]': 'hostStyle()',
  },
  template: `
    @if (!hidden()) {
      @let messages = map().messages;
      <ng-content select="[geoMapPanelHeader]">
        <header class="geo-panel-header">
          <div class="geo-panel-heading">
            <span class="geo-panel-kicker">{{ messages.mapOptions }}</span>
            <h2 class="geo-panel-title">{{ messages.viewAndOutput }}</h2>
          </div>
          <button geoShapeIconButton [label]="messages.closeSettings" (click)="close()">
            <geo-map-icon [icon]="map().icons.Close" />
          </button>
        </header>
      </ng-content>
      <div class="geo-settings-fields">
        <ng-content>
          @for (field of resolvedFields(); track field) {
            @switch (field) {
              @case ('basemap') {
                <label geoMapBasemapField></label>
              }
              @case ('zoom-target') {
                <label geoMapZoomTargetField (targetSelect)="close()"></label>
              }
              @case ('export') {
                <label geoMapExportField></label>
              }
            }
          }
        </ng-content>
      </div>
      <ng-content select="[geoMapPanelFooter]" />
    }
  `,
})
export class MapSettings {
  /** Corner of the map; defaults to `ui.settings.placement`. */
  readonly placement = input<MapPlacement>()
  /** Fields rendered when there is no projected content; defaults to `ui.settings.fields`. */
  readonly fields = input<SettingsFieldId[]>()

  protected readonly map = injectMapStatic()
  readonly #actions = injectMapActions()
  /** A static `role` or `aria-label` on the element replaces the default (while shown). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #open = injectMapRuntime((map) => map.openPanel === 'settings')
  protected readonly hidden = computed(() => !this.#open())
  protected readonly resolvedFields = computed(() => this.fields() ?? this.map().ui.settings.fields)
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    inject(ShapeCard, { self: true }).hideWhen(() => this.hidden())
  }

  protected close(): void {
    this.#actions.setOpenPanel(null)
  }
}
