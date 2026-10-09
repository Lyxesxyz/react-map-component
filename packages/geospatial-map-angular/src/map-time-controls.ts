import { isPlatformBrowser } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core'
import { injectMapActions, injectMapRuntime, injectMapStatic } from './map-context'
import { MapIconView } from './map-icon'
import { formatMapMessage } from './messages'
import { ShapeIconButton, ShapeSelect, ShapeSlider } from './shapes'
import type { ShapeSelectOption } from './shapes'
import { injectHostAttribute, optionalBooleanAttribute, partHostStyle } from './signals'
import type { MapPlacement, TimeControlsConfig } from './types'

// Only called in the browser: in event handlers and after the first render.
function prefersReducedMotion(): boolean {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * Time slider and playback for time-aware layers. Behaviour defaults come from `ui.time`.
 * Hidden (with no classes or ARIA) while no layer has time values.
 */
@Component({
  selector: 'geo-map-time-controls',
  imports: [MapIconView, ShapeIconButton, ShapeSelect, ShapeSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.geo-time-controls]': '!hidden()',
    '[attr.role]': 'hidden() ? null : (consumerRole ?? "group")',
    '[attr.data-slot]': 'hidden() ? null : "map-time-controls"',
    '[attr.data-placement]': 'hidden() ? null : (placement() ?? map().ui.time.placement)',
    '[attr.data-state]': 'hidden() ? null : (playing() ? "playing" : "paused")',
    '[attr.aria-label]': 'hidden() ? null : (consumerLabel ?? map().messages.timeControls)',
    '[style]': 'hostStyle()',
  },
  template: `
    @if (!hidden()) {
      @let messages = map().messages;
      @let icons = map().icons;
      @let count = values().length;
      <button
        geoShapeIconButton
        [label]="playing() ? messages.pauseTime : messages.playTime"
        [disabled]="blocksPlayback()"
        (click)="togglePlaying()"
      >
        <geo-map-icon [icon]="playing() ? icons.Pause : icons.Play" />
      </button>
      <button geoShapeIconButton [label]="messages.replayTime" (click)="replay()">
        <geo-map-icon [icon]="icons.Replay" />
      </button>
      <button
        geoShapeIconButton
        [label]="messages.previousTime"
        [disabled]="!loops() && index() === 0"
        (click)="step(-1)"
      >
        <geo-map-icon [icon]="icons.Previous" />
      </button>
      <input
        type="range"
        geoShapeSlider
        [attr.aria-label]="messages.selectedTime"
        min="0"
        [max]="count - 1"
        [value]="index()"
        step="1"
        (valueChange)="selectFrame($event)"
      />
      <button
        geoShapeIconButton
        [label]="messages.nextTime"
        [disabled]="!loops() && index() === count - 1"
        (click)="step(1)"
      >
        <geo-map-icon [icon]="icons.Next" />
      </button>
      <geo-shape-select
        [ariaLabel]="messages.playbackSpeed"
        [options]="speedOptions()"
        [value]="selectedSpeed()"
        (valueChange)="selectSpeed($event)"
      />
      <!-- Time changes are announced by the map's live region. -->
      <output class="geo-time-value" aria-live="off">{{ valueText() }}</output>
    }
  `,
})
export class MapTimeControls {
  /** Corner of the map; defaults to `ui.time.placement`. */
  readonly placement = input<MapPlacement>()
  /** Frame durations users can choose, in milliseconds; defaults to `ui.time.speedsMs`. */
  readonly speedsMs = input<number[]>()
  /** Initially selected frame duration; defaults to `ui.time.defaultSpeedMs`. */
  readonly defaultSpeedMs = input<number>()
  /** Starts playing (not with reduced motion); defaults to `ui.time.autoplay`. */
  readonly autoplay = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /** Goes on from the first frame after the last; defaults to `ui.time.loop`. */
  readonly loop = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBooleanAttribute,
  })
  /**
   * When a required time layer fails to load a frame: stop playback (`'pause'`) or go on
   * (`'skip'`); defaults to `ui.time.frameFailurePolicy`.
   */
  readonly frameFailurePolicy = input<TimeControlsConfig['frameFailurePolicy']>()

  protected readonly map = injectMapStatic()
  /** A static `role` or `aria-label` on the element replaces the default (while shown). */
  protected readonly consumerRole = injectHostAttribute('role')
  protected readonly consumerLabel = injectHostAttribute('aria-label')
  readonly #actions = injectMapActions()
  protected readonly values = injectMapRuntime((map) => map.times)
  readonly #time = injectMapRuntime((map) => map.state.time)
  readonly #layers = injectMapRuntime((map) => map.layers)
  readonly #statuses = injectMapRuntime((map) => map.statuses)
  readonly #browser = isPlatformBrowser(inject(PLATFORM_ID))

  readonly #speeds = computed(() => this.speedsMs() ?? this.map().ui.time.speedsMs)
  readonly #initialSpeed = computed(
    () => this.defaultSpeedMs() ?? this.map().ui.time.defaultSpeedMs,
  )
  protected readonly loops = computed(() => this.loop() ?? this.map().ui.time.loop)
  readonly #failurePolicy = computed(
    () => this.frameFailurePolicy() ?? this.map().ui.time.frameFailurePolicy,
  )

  // Own state, read from the inputs once, on first use (React's `useState` initializers). The
  // server can't know about reduced motion: the browser checks it after the first render.
  protected readonly playing = linkedSignal(() =>
    untracked(() => this.autoplay() ?? this.map().ui.time.autoplay),
  )
  readonly #speedMs = linkedSignal(() => untracked(this.#initialSpeed))

  protected readonly hidden = computed(() => !this.values().length)
  protected readonly index = computed(() => {
    const values = this.values()
    return Math.max(0, values.indexOf(this.#time() ?? values[0] ?? ''))
  })
  readonly #timeLayers = computed(() =>
    this.#layers().filter((layer) => 'time' in layer && layer.time),
  )
  readonly #loading = computed(() =>
    this.#statuses().some(
      (item) => item.loading && this.#timeLayers().some((layer) => layer.id === item.id),
    ),
  )
  readonly #hasError = computed(() =>
    this.#statuses().some(
      (item) =>
        Boolean(item.error) &&
        this.#timeLayers().some((layer) => layer.id === item.id && layer.required),
    ),
  )
  protected readonly blocksPlayback = computed(
    () => this.#hasError() && this.#failurePolicy() !== 'skip',
  )
  readonly #atEnd = computed(() => !this.loops() && this.index() === this.values().length - 1)

  protected readonly speedOptions = computed<ShapeSelectOption[]>(() =>
    [...new Set([...this.#speeds(), this.#initialSpeed()])]
      .sort((a, b) => a - b)
      .map((speed) => ({ value: String(speed), label: `${(1000 / speed).toFixed(1)}×` })),
  )
  protected readonly selectedSpeed = computed(() => String(this.#speedMs()))
  protected readonly valueText = computed(() => {
    const { messages } = this.map()
    return (
      formatMapMessage(messages.time, { time: this.values()[this.index()] ?? '' }) +
      (this.#loading() ? ` · ${messages.loadingFrame}` : '') +
      (this.#hasError() ? ` · ${messages.frameUnavailable}` : '')
    )
  })
  protected readonly hostStyle = partHostStyle(() => this.hidden())

  constructor() {
    // A failed required frame, or the last frame without looping, stops playback.
    effect(() => {
      if (this.playing() && (this.blocksPlayback() || this.#atEnd())) this.playing.set(false)
    })
    afterNextRender(() => {
      if (this.#motionBlocked()) this.playing.set(false)
    })
    // Playback, in the browser only: one frame every `speedMs`, waiting while a frame loads.
    // The timer runs outside the Angular zone; the time it sets reaches the view as a signal.
    const zone = inject(NgZone)
    effect((onCleanup) => {
      const values = this.values()
      const index = this.index()
      const loops = this.loops()
      const speedMs = this.#speedMs()
      if (!this.#browser || !this.playing() || this.#loading() || this.blocksPlayback()) return
      if (values.length < 2) return
      const timer = zone.runOutsideAngular(() =>
        setInterval(() => {
          const next = index + 1
          this.#actions.setTime(values[loops ? next % values.length : next]!)
        }, speedMs),
      )
      onCleanup(() => clearInterval(timer))
    })
  }

  /** Whether reduced motion keeps playback from starting by itself (browser only). */
  #motionBlocked(): boolean {
    return (
      (this.map().config.accessibility.reducedMotion ?? 'respect') === 'respect' &&
      prefersReducedMotion()
    )
  }

  protected togglePlaying(): void {
    this.playing.update((current) => !current && !this.#motionBlocked())
  }

  protected replay(): void {
    this.#actions.setTime(this.values()[0]!)
    this.playing.set(!this.#motionBlocked())
  }

  /** Moves `delta` frames, wrapping around when looping. */
  protected step(delta: number): void {
    const values = this.values()
    const next = this.index() + delta
    this.#actions.setTime(values[this.loops() ? (next + values.length) % values.length : next]!)
  }

  protected selectFrame(index: number): void {
    this.#actions.setTime(this.values()[index]!)
  }

  protected selectSpeed(value: string): void {
    this.#speedMs.set(Number(value))
  }
}
