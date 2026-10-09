import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import Graticule from 'ol/layer/Graticule.js'
import Stroke from 'ol/style/Stroke.js'
import { GeospatialMap, type MapOpenLayersHook } from '@/components/geospatial-map'
import {
  createFeaturesConfig,
  defaultFeaturesOptions,
  graticuleOptions,
  popupAnchorOptions,
  rendererOptions,
  type FeaturesOptions,
} from '@demo-shared/src/fixtures'

// 0.4 features in one place: the built-in world basemap (no basemap configured), clustering,
// the WebGL renderer, a feature-anchored popup, the hover tooltip, and an OpenLayers layer the
// configuration does not offer (a graticule) added through `[onOpenLayersMap]`. The stations and
// the configuration are in apps/demo-shared/src/fixtures.ts. The host element has
// `display: contents`, so the toolbar and the map sit in the harness section as in React.
@Component({
  selector: 'app-features',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  // The labels' text is split into the same text nodes as in React (React's `{' '}` is
  // `{{ ' ' }}` here, next to an <ng-container>), so it renders to the same pixels.
  template: `
    <div class="demo-composed-toolbar" role="group" aria-label="0.4 feature controls">
      <label
        ><input
          #clusterBox
          type="checkbox"
          [checked]="cluster()"
          (change)="cluster.set(clusterBox.checked)"
        />{{ ' ' }}<ng-container>Cluster points</ng-container></label
      >
      <label
        ><ng-container>Renderer</ng-container>{{ ' '
        }}<select
          #rendererSelect
          [disabled]="cluster()"
          (change)="chooseRenderer(rendererSelect.value)"
        >
          @for (option of rendererOptions; track option) {
            <option
              [value]="option"
              [selected]="option === renderer()"
              [textContent]="option"
            ></option>
          }</select
      ></label>
      <label
        ><ng-container>Popup</ng-container>{{ ' '
        }}<select #anchorSelect (change)="chooseAnchor(anchorSelect.value)">
          @for (option of popupAnchorOptions; track option.value) {
            <option
              [value]="option.value"
              [selected]="option.value === anchor()"
              [textContent]="option.label"
            ></option>
          }</select
      ></label>
      <label
        ><input
          #graticuleBox
          type="checkbox"
          [checked]="graticule()"
          (change)="showGraticule(graticuleBox.checked)"
        />{{ ' ' }}<ng-container>Graticule (OpenLayers layer)</ng-container></label
      >
      <output aria-label="Graticule layer"
        ><ng-container>Graticule layer: </ng-container
        >{{ graticuleAttached() ? 'on the map' : 'not attached' }}</output
      >
    </div>
    <geo-map [config]="config()" [onOpenLayersMap]="addGraticule" />
  `,
})
export class FeaturesScenario {
  protected readonly cluster = signal(defaultFeaturesOptions.cluster)
  protected readonly renderer = signal(defaultFeaturesOptions.renderer)
  protected readonly anchor = signal(defaultFeaturesOptions.anchor)
  protected readonly graticule = signal(false)
  protected readonly graticuleAttached = signal(false)
  private graticuleLayer: Graticule | null = null

  /** Rebuilt whenever an option changes (React rebuilds it on every render). */
  protected readonly config = computed(() =>
    createFeaturesConfig({
      cluster: this.cluster(),
      renderer: this.renderer(),
      anchor: this.anchor(),
    }),
  )

  protected readonly rendererOptions = rendererOptions
  protected readonly popupAnchorOptions = popupAnchorOptions

  /** Adds the graticule once the OpenLayers map exists; the map runs the returned cleanup. */
  protected readonly addGraticule: MapOpenLayersHook = (map) => {
    const layer = new Graticule({
      strokeStyle: new Stroke({
        color: graticuleOptions.strokeColor,
        width: graticuleOptions.strokeWidth,
      }),
      showLabels: graticuleOptions.showLabels,
      wrapX: graticuleOptions.wrapX,
      visible: this.graticule(),
      zIndex: graticuleOptions.zIndex,
    })
    map.addLayer(layer)
    this.graticuleLayer = layer
    // Shows that the layer stays on the map when the configuration changes.
    const check = () => this.graticuleAttached.set(map.getAllLayers().includes(layer))
    map.on('rendercomplete', check)
    return () => {
      map.un('rendercomplete', check)
      map.removeLayer(layer)
      this.graticuleLayer = null
    }
  }

  protected chooseRenderer(value: string): void {
    this.renderer.set(value as FeaturesOptions['renderer'])
  }

  protected chooseAnchor(value: string): void {
    this.anchor.set(value as FeaturesOptions['anchor'])
  }

  protected showGraticule(visible: boolean): void {
    this.graticule.set(visible)
    this.graticuleLayer?.setVisible(visible)
  }
}
