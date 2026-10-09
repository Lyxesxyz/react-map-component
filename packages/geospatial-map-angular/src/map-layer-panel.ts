import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core'
import { canReorder } from './core/layer-order'
import { injectMapActions, injectMapRuntime, injectMapStatic } from './map-context'
import { MapIconView } from './map-icon'
import { MapLegendSymbol } from './map-legend'
import { formatMapMessage, layerStatusLabel } from './messages'
import { ShapeBadge, ShapeCard, ShapeIconButton, ShapeSlider, ShapeSwitch } from './shapes'
import {
  injectHostAttribute,
  injectUniqueId,
  optionalBooleanAttribute,
  partHostStyle,
} from './signals'
import type {
  LayerPanelConfig,
  LayerStatus,
  MapLayerConfig,
  MapPlacement,
  NormalizedLegend,
} from './types'
import { safeId } from './utils'

type LayerPanelOptions = Required<
  Pick<
    LayerPanelConfig,
    | 'allowVisibility'
    | 'allowOpacity'
    | 'allowReorder'
    | 'showMetadata'
    | 'groupBy'
    | 'itemDetails'
    | 'defaultExpandedLayerIds'
    | 'showSymbolPreview'
  >
>

type LayerItem = {
  layer: MapLayerConfig
  /** Position in drawing order (0 at the bottom). */
  order: number
  status: LayerStatus | undefined
  legend: NormalizedLegend | undefined
}

type LayerGroup = {
  id: string
  label?: string
  /** Whether a layer of the group is in an exclusive group ("Show one layer at a time"). */
  exclusive: boolean
  items: LayerItem[]
}

/**
 * Layer visibility, opacity, order, and status, shown while the map's open panel is `'layers'`
 * (the layers button, `actions.setOpenPanel`, or `[(openPanel)]` on the root). Behaviour
 * defaults come from `ui.layerPanel`. Hidden (with no classes or ARIA) while another panel or
 * none is open. Project `[geoMapPanelHeader]` to replace the default header (title, count, and
 * close button), and `[geoMapPanelFooter]` to add content after the layer list.
 */
@Component({
  selector: 'geo-map-layer-panel',
  imports: [MapIconView, MapLegendSymbol, ShapeBadge, ShapeIconButton, ShapeSlider, ShapeSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [ShapeCard],
  host: {
    '[class.geo-layer-panel]': '!hidden()',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "region")',
    '[attr.data-slot]': 'hidden() ? null : "map-layer-panel"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.layerPanel.placement)',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? map().messages.mapLayers)',
    '[style]': 'hostStyle()',
  },
  template: `
    @if (!hidden()) {
      @let messages = map().messages;
      @let icons = map().icons;
      <ng-content select="[geoMapPanelHeader]">
        <header class="geo-panel-header geo-layer-panel-header">
          <div class="geo-panel-heading">
            <span class="geo-panel-kicker">{{ messages.mapContent }}</span>
            <h2 class="geo-panel-title">{{ messages.layers }}</h2>
            <span class="geo-layer-count">{{ count() }}</span>
          </div>
          <button geoShapeIconButton [label]="messages.closeLayers" (click)="close()">
            <geo-map-icon [icon]="icons.Close" />
          </button>
        </header>
      </ng-content>
      <div class="geo-layer-groups">
        @for (group of groups(); track group.id) {
          <section class="geo-layer-group">
            @if (group.label) {
              <div class="geo-layer-group-heading">
                <h3 class="geo-layer-group-title">{{ group.label }}</h3>
                @if (group.exclusive) {
                  <span class="geo-layer-group-note">{{ messages.oneLayerAtATime }}</span>
                }
              </div>
            }
            <ul class="geo-layer-list">
              @for (item of group.items; track item.layer.id) {
                @let layer = item.layer;
                @let expandedNow = options().itemDetails === 'always' || expanded().has(layer.id);
                @let detailsId = layerDetailsId(layer);
                @let statusLabel = layerStatus(item);
                <li class="geo-layer-item" [attr.data-visible]="layer.visible ?? true">
                  <!-- The row: symbol, title, status, visibility switch and disclosure button. -->
                  <div class="geo-layer-row">
                    @if (options().showSymbolPreview && item.legend?.entries?.[0]; as preview) {
                      <span class="geo-layer-preview">
                        <svg geoMapLegendSymbol [entry]="preview"></svg>
                      </span>
                    }
                    <span class="geo-layer-copy">
                      <strong class="geo-layer-title">{{ layer.title }}</strong>
                      <!-- The kind, and the status in a text node of its own, as React's. -->
                      <span class="geo-layer-meta">
                        <ng-container>{{ layer.kind.toUpperCase() }}</ng-container>
                        @if (statusLabel) {
                          <ng-container>{{ ' · ' + statusLabel }}</ng-container>
                        }
                      </span>
                    </span>
                    @if (options().allowVisibility) {
                      <span class="geo-layer-visibility">
                        <label
                          geoShapeSwitch
                          [label]="layer.title"
                          [checked]="layer.visible ?? true"
                          [disabled]="layer.required"
                          (checkedChange)="actions.setLayerVisibility(layer.id, $event)"
                        ></label>
                      </span>
                    }
                    @if (options().itemDetails === 'disclosure') {
                      <button
                        geoShapeIconButton
                        class="geo-layer-disclosure"
                        [label]="
                          layerLabel(
                            expandedNow ? messages.hideLayerOptions : messages.showLayerOptions,
                            layer
                          )
                        "
                        [attr.aria-expanded]="expandedNow"
                        [attr.aria-controls]="detailsId"
                        (click)="toggle(layer.id)"
                      >
                        <geo-map-icon [icon]="expandedNow ? icons.Collapse : icons.Expand" />
                      </button>
                    }
                  </div>
                  @if (expandedNow) {
                    <!-- The details: badges, opacity slider and move buttons. -->
                    <div
                      class="geo-layer-details"
                      [id]="detailsId"
                      role="group"
                      [attr.aria-label]="layerLabel(messages.layerOptions, layer)"
                    >
                      @if (options().showMetadata) {
                        <span class="geo-layer-metadata">
                          <span geoShapeBadge>{{ layer.kind.toUpperCase() }}</span>
                          @if (layer.exclusiveGroup) {
                            <span geoShapeBadge>{{ messages.chooseOne }}</span>
                          }
                          @if (statusLabel) {
                            <span geoShapeBadge>{{ statusLabel }}</span>
                          }
                        </span>
                      }
                      @if (options().allowOpacity) {
                        <label class="geo-opacity-label">
                          <span class="geo-opacity-value">{{ opacityLabel(layer) }}</span>
                          <input
                            type="range"
                            geoShapeSlider
                            [attr.aria-label]="layerLabel(messages.layerOpacity, layer)"
                            min="0"
                            max="1"
                            step="0.05"
                            [value]="layer.opacity ?? 1"
                            (valueChange)="actions.setLayerOpacity(layer.id, $event)"
                          />
                        </label>
                      }
                      @if (options().allowReorder && layer.reorderable !== false) {
                        <span class="geo-order-buttons">
                          <button
                            geoShapeIconButton
                            [label]="layerLabel(messages.moveLayerUp, layer)"
                            [disabled]="!canMove(item, 1)"
                            (click)="move(layer, 1)"
                          >
                            <geo-map-icon [icon]="icons.MoveUp" />
                          </button>
                          <button
                            geoShapeIconButton
                            [label]="layerLabel(messages.moveLayerDown, layer)"
                            [disabled]="!canMove(item, -1)"
                            (click)="move(layer, -1)"
                          >
                            <geo-map-icon [icon]="icons.MoveDown" />
                          </button>
                        </span>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          </section>
        }
      </div>
      <ng-content select="[geoMapPanelFooter]" />
    }
  `,
})
export class MapLayerPanel {
  /** Corner of the map; defaults to `ui.layerPanel.placement`. */
  readonly placement = input<MapPlacement>()
  /** Lets users show and hide layers; defaults to `ui.layerPanel.allowVisibility`. */
  readonly allowVisibility = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Lets users change opacity; defaults to `ui.layerPanel.allowOpacity`. */
  readonly allowOpacity = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Lets users reorder `reorderable` layers; defaults to `ui.layerPanel.allowReorder`. */
  readonly allowReorder = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Shows each layer's kind and status as badges; defaults to `ui.layerPanel.showMetadata`. */
  readonly showMetadata = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Lists layers under their `group` heading, or in one list; defaults to `ui.layerPanel.groupBy`. */
  readonly groupBy = input<LayerPanelConfig['groupBy']>()
  /** Secondary controls on demand or for every layer; defaults to `ui.layerPanel.itemDetails`. */
  readonly itemDetails = input<LayerPanelConfig['itemDetails']>()
  /** Layers whose details start open; defaults to `ui.layerPanel.defaultExpandedLayerIds`. */
  readonly defaultExpandedLayerIds = input<string[]>()
  /** Shows the first legend symbol beside each title; defaults to `ui.layerPanel.showSymbolPreview`. */
  readonly showSymbolPreview = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })

  protected readonly map = injectMapStatic()
  protected readonly actions = injectMapActions()
  /** A static `role` or `aria-label` on the element replaces the default (while shown). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #open = injectMapRuntime((map) => map.openPanel === 'layers')
  readonly #layers = injectMapRuntime((map) => map.layers)
  readonly #statuses = injectMapRuntime((map) => map.statuses)
  readonly #legends = injectMapRuntime((map) => map.legends)
  readonly #idPrefix = injectUniqueId('geo-layer-panel')
  readonly #injector = inject(Injector)
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  protected readonly hidden = computed(() => !this.#open())
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  protected readonly options = computed<LayerPanelOptions>(() => {
    const ui = this.map().ui.layerPanel
    return {
      allowVisibility: this.allowVisibility() ?? ui.allowVisibility,
      allowOpacity: this.allowOpacity() ?? ui.allowOpacity,
      allowReorder: this.allowReorder() ?? ui.allowReorder,
      showMetadata: this.showMetadata() ?? ui.showMetadata,
      groupBy: this.groupBy() ?? ui.groupBy,
      itemDetails: this.itemDetails() ?? ui.itemDetails,
      defaultExpandedLayerIds: this.defaultExpandedLayerIds() ?? ui.defaultExpandedLayerIds,
      showSymbolPreview: this.showSymbolPreview() ?? ui.showSymbolPreview,
    }
  })

  // React mounts the panel's content only while it is open, so expanded rows start over each
  // time it opens, and (useResettableState) whenever the default expanded ids change. A new
  // object per opening: `#open` changes value only when the panel closes or opens.
  readonly #opening = computed(() => (this.#open() ? {} : null))
  readonly #expandedKey = computed(
    () => ({
      opening: this.#opening(),
      ids: JSON.stringify(this.options().defaultExpandedLayerIds),
    }),
    { equal: (a, b) => a.opening === b.opening && a.ids === b.ids },
  )
  protected readonly expanded = linkedSignal({
    source: this.#expandedKey,
    computation: () => new Set(untracked(this.options).defaultExpandedLayerIds),
  })

  // `layers` is in drawing order; the panel lists the top layer first.
  readonly #items = computed<LayerItem[]>(() => {
    const statusById = new Map(this.#statuses().map((item) => [item.id, item]))
    const legendById = new Map(this.#legends().map((item) => [item.layerId, item]))
    return this.#layers()
      .map((layer, order) => ({
        layer,
        order,
        status: statusById.get(layer.id),
        legend: legendById.get(layer.id),
      }))
      .filter((item) => item.layer.showInLayerControl !== false)
      .reverse()
  })

  protected readonly groups = computed(() => {
    const { messages } = this.map()
    const groupBy = this.options().groupBy
    const result: LayerGroup[] = []
    for (const item of this.#items()) {
      const label = groupBy === 'group' ? (item.layer.group ?? messages.otherLayers) : undefined
      const previous = result.at(-1)
      if (previous && previous.label === label) previous.items.push(item)
      else
        result.push({
          id: `${label ?? 'all'}-${result.length}`,
          ...(label ? { label } : {}),
          exclusive: false,
          items: [item],
        })
    }
    for (const group of result)
      group.exclusive = group.items.some((item) => item.layer.exclusiveGroup)
    return result
  })

  protected readonly count = computed(() => {
    const items = this.#items()
    return formatMapMessage(this.map().messages.layersVisible, {
      visible: items.filter(({ layer }) => layer.visible ?? true).length,
      total: items.length,
    })
  })

  constructor() {
    inject(ShapeCard, { self: true }).hideWhen(() => this.hidden())
  }

  protected close(): void {
    this.actions.setOpenPanel(null)
  }

  /**
   * Moves a layer. The browser blurs a focused element whose row `@for` moves in the DOM (the
   * move button itself, when a row moves up); React focuses it again after its update, so do
   * the same and keep a keyboard user where they were.
   */
  protected move(layer: MapLayerConfig, direction: -1 | 1): void {
    const document = this.#host.ownerDocument
    const focused = document.activeElement as HTMLElement | null
    this.actions.reorderLayer(layer.id, direction)
    if (focused && focused !== this.#host && this.#host.contains(focused))
      afterNextRender(
        () => {
          if (focused.isConnected && document.activeElement !== focused) focused.focus()
        },
        { injector: this.#injector },
      )
  }

  protected toggle(id: string): void {
    this.expanded.update((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  protected layerDetailsId(layer: MapLayerConfig): string {
    return `${this.#idPrefix}-layer-options-${safeId(layer.id)}`
  }

  protected layerStatus(item: LayerItem): string | undefined {
    return layerStatusLabel(item.status, this.map().messages)
  }

  /** A message about one layer (`{layer}` is its title). */
  protected layerLabel(message: string, layer: MapLayerConfig): string {
    return formatMapMessage(message, { layer: layer.title })
  }

  protected opacityLabel(layer: MapLayerConfig): string {
    const opacity = layer.opacity ?? 1
    return formatMapMessage(this.map().messages.opacity, { value: Math.round(opacity * 100) })
  }

  protected canMove(item: LayerItem, direction: -1 | 1): boolean {
    return canReorder(this.#layers(), item.order, direction)
  }
}
