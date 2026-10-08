import { vi } from 'vitest'
import type { MapControllerOptions } from '../src/core/map-controller'
import type {
  AttributionSpec,
  FeatureEvent,
  MapOrigin,
  MapSelection,
  MapViewState,
  NormalizedLegend,
} from '../src/types'

// A stand-in for the OpenLayers controller (jsdom has no canvas). Tests mock
// `../src/core/map-controller` with it:
//
//   vi.mock('../src/core/map-controller', async () => (await import('./fake-controller')).module)
//
// It records what the engine asks of it, and lets a test play the renderer's and the user's part.

/** What the next controllers report. */
export const fakeData: {
  legends: NormalizedLegend[]
  attributions: AttributionSpec[]
  features: Record<string, FeatureEvent>
} = { legends: [], attributions: [], features: {} }

export class FakeController {
  #options: MapControllerOptions
  #view: Required<MapViewState>
  readonly #renderListeners = new Set<() => void>()

  constructor(options: MapControllerOptions) {
    this.#options = options
    this.#view = { rotation: 0, ...options.view } as Required<MapViewState>
    controllers.push(this)
  }

  /** The options of the creation, then of the latest `update`. */
  options(): MapControllerOptions {
    return this.#options
  }

  readonly update = vi.fn((next: MapControllerOptions, resync = false) => {
    this.#options = next
    // A resync (a refused proposal) puts the map back on the host's state.
    if (resync) this.#view = { ...this.#view, ...next.view }
  })
  readonly setView = vi.fn((next: Partial<MapViewState>, origin: MapOrigin = 'user') => {
    this.#view = { ...this.#view, ...next }
    this.#options.onViewChange?.({ view: this.#view, origin })
  })
  readonly setSelection = vi.fn((_selection: MapSelection | null) => undefined)
  readonly setLayerVisibility = vi.fn()
  readonly setLayerOpacity = vi.fn()
  readonly reorderOverlay = vi.fn()
  readonly setTime = vi.fn()
  readonly fit = vi.fn()
  readonly fitSelection = vi.fn(() => false)
  readonly fitData = vi.fn()
  readonly exportImage = vi.fn(() => Promise.resolve(new Blob()))
  readonly destroy = vi.fn()

  getView(): Required<MapViewState> {
    return this.#view
  }
  describeSelection(selection: MapSelection | null): FeatureEvent | null {
    return (selection && fakeData.features[selection.featureId]) ?? null
  }
  getLegends(): NormalizedLegend[] {
    return fakeData.legends
  }
  getAttributions(): AttributionSpec[] {
    return fakeData.attributions
  }
  getLayerStates() {
    return {}
  }
  getActiveBasemapId(): string {
    return this.#options.activeBasemapId ?? ''
  }
  setBasemap(): boolean {
    return false
  }
  getOpenLayersMap() {
    return { fake: 'ol-map' }
  }
  pixelAt(): [number, number] {
    return [120, 80]
  }
  onRender(listener: () => void): () => void {
    this.#renderListeners.add(listener)
    return () => this.#renderListeners.delete(listener)
  }

  /** Plays the renderer: the first frame was drawn. */
  ready(): void {
    this.#options.onReady?.(this.#view)
  }
  /** Plays the renderer: a frame was drawn. */
  render(): void {
    for (const listener of this.#renderListeners) listener()
  }
  /** Plays the user: the map was dragged or zoomed to `next`. */
  move(next: Partial<MapViewState>): void {
    this.setView(next, 'user')
  }
  /** Plays the user: the pointer is over a feature (or over none with `null`). */
  hover(feature: FeatureEvent | null): void {
    this.#options.onFeatureHover?.(feature)
  }
  /** Plays the user: a click on a feature (or on empty space with `null`). */
  click(feature: FeatureEvent | null): void {
    this.#options.onFeatureSelect?.(feature)
  }
}

/** Every controller created since the last `resetControllers()`, oldest first. */
export const controllers: FakeController[] = []

export function resetControllers(): void {
  controllers.length = 0
  fakeData.legends = []
  fakeData.attributions = []
  fakeData.features = {}
}

/** The mocked `core/map-controller` module. */
export const module = {
  createMapController: (options: MapControllerOptions) => new FakeController(options),
}
