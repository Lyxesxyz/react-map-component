import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import { GeospatialMap } from '@/components/geospatial-map'
import {
  borderWidthRange,
  createArcgisConfig,
  defaultArcgisOptions,
} from '@demo-shared/src/fixtures'

// The receiving team's main use case: an Equal Earth basemap they already have in ArcGIS
// Online, configured with nothing but its URL, with indicator layers on top. The border
// controls show basemap style overrides; the map projection comes from the service.
// The configuration is `createArcgisConfig()` in apps/demo-shared/src/fixtures.ts. The host
// element has `display: contents`, so the toolbar and the map sit in the harness section as in
// React.
@Component({
  selector: 'app-arcgis',
  imports: [GeospatialMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  // The labels' text is split into the same text nodes as in React (React's `{' '}` is
  // `{{ ' ' }}` here, next to an <ng-container>), so it renders to the same pixels. React's
  // `onChange` on the colour and range inputs fires on every `input` event.
  template: `
    <div class="demo-composed-toolbar" role="group" aria-label="ArcGIS basemap controls">
      <label
        ><ng-container>Border colour</ng-container>{{ ' '
        }}<input
          #colorInput
          type="color"
          [value]="borderColor()"
          (input)="borderColor.set(colorInput.value)"
      /></label>
      <label
        ><ng-container>Border width</ng-container>{{ ' '
        }}<input
          #widthInput
          type="range"
          [min]="borderWidthRange.min"
          [max]="borderWidthRange.max"
          [step]="borderWidthRange.step"
          [value]="borderWidth()"
          (input)="chooseWidth(widthInput.value)"
      /></label>
      <label
        ><input
          #labelsBox
          type="checkbox"
          [checked]="labelsAboveData()"
          (change)="labelsAboveData.set(labelsBox.checked)"
        />{{ ' ' }}<ng-container>Labels and borders above data</ng-container></label
      >
    </div>
    <geo-map [config]="config()" />
  `,
})
export class ArcgisScenario {
  protected readonly borderColor = signal(defaultArcgisOptions.borderColor)
  protected readonly borderWidth = signal(defaultArcgisOptions.borderWidth)
  protected readonly labelsAboveData = signal(defaultArcgisOptions.labelsAboveData)

  /** Rebuilt whenever an option changes (React rebuilds it on every render). */
  protected readonly config = computed(() =>
    createArcgisConfig({
      borderColor: this.borderColor(),
      borderWidth: this.borderWidth(),
      labelsAboveData: this.labelsAboveData(),
    }),
  )

  protected readonly borderWidthRange = borderWidthRange

  protected chooseWidth(value: string): void {
    this.borderWidth.set(Number(value))
  }
}
