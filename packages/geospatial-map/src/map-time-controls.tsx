'use client'

import { forwardRef, useEffect, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { useMap, useMapIcons } from './map-context'
import { formatMapMessage } from './messages'
import { ShapeIconButton, ShapeSelect, ShapeSlider } from './shapes'
import type { MapPlacement, TimeControlsConfig } from './types'
import { cn } from './utils'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  )
}

export type MapTimeControlsProps = ComponentPropsWithoutRef<'div'> &
  Omit<TimeControlsConfig, 'enabled' | 'placement'> & {
    /** Corner of the map; defaults to `ui.time.placement`. */
    placement?: MapPlacement
  }

/** Time slider and playback for time-aware layers. Renders nothing without time values. */
export const MapTimeControls = forwardRef<HTMLDivElement, MapTimeControlsProps>(
  function MapTimeControls(
    {
      placement,
      speedsMs,
      defaultSpeedMs,
      autoplay,
      loop,
      frameFailurePolicy,
      className,
      ...props
    },
    ref,
  ) {
    const { config, ui, messages, actions, state, times: values, layers, statuses } = useMap()
    const icons = useMapIcons()
    const speeds = speedsMs ?? ui.time.speedsMs
    const initialSpeed = defaultSpeedMs ?? ui.time.defaultSpeedMs
    const loops = loop ?? ui.time.loop
    const failurePolicy = frameFailurePolicy ?? ui.time.frameFailurePolicy
    const motionBlocked = () =>
      (config.accessibility.reducedMotion ?? 'respect') === 'respect' && prefersReducedMotion()

    const [playing, setPlaying] = useState(() => (autoplay ?? ui.time.autoplay) && !motionBlocked())
    const [speedMs, setSpeedMs] = useState(initialSpeed)
    const index = Math.max(0, values.indexOf(state.time ?? values[0] ?? ''))
    const timeLayers = layers.filter((layer) => layer.time)
    const loading = statuses.some(
      (item) => item.loading && timeLayers.some((layer) => layer.id === item.id),
    )
    const hasError = statuses.some(
      (item) =>
        Boolean(item.error) && timeLayers.some((layer) => layer.id === item.id && layer.required),
    )
    const blocksPlayback = hasError && failurePolicy !== 'skip'
    const atEnd = !loops && index === values.length - 1
    if (playing && (blocksPlayback || atEnd)) setPlaying(false)

    const { setTime } = actions
    useEffect(() => {
      if (!playing || loading || blocksPlayback || values.length < 2) return
      const timer = window.setInterval(
        () => setTime(values[loops ? (index + 1) % values.length : index + 1]!),
        speedMs,
      )
      return () => window.clearInterval(timer)
    }, [blocksPlayback, index, loading, loops, playing, setTime, speedMs, values])

    if (!values.length) return null
    return (
      <div
        ref={ref}
        data-slot="map-time-controls"
        data-placement={placement ?? ui.time.placement}
        data-state={playing ? 'playing' : 'paused'}
        aria-label={messages.timeControls}
        {...props}
        className={cn('geo-time-controls', className)}
      >
        <ShapeIconButton
          label={playing ? messages.pauseTime : messages.playTime}
          disabled={blocksPlayback}
          onClick={() => setPlaying((current) => !current && !motionBlocked())}
        >
          {playing ? <icons.Pause aria-hidden="true" /> : <icons.Play aria-hidden="true" />}
        </ShapeIconButton>
        <ShapeIconButton
          label={messages.replayTime}
          onClick={() => {
            setTime(values[0]!)
            setPlaying(!motionBlocked())
          }}
        >
          <icons.Replay aria-hidden="true" />
        </ShapeIconButton>
        <ShapeIconButton
          label={messages.previousTime}
          disabled={!loops && index === 0}
          onClick={() =>
            setTime(values[loops ? (index - 1 + values.length) % values.length : index - 1]!)
          }
        >
          <icons.Previous aria-hidden="true" />
        </ShapeIconButton>
        <ShapeSlider
          aria-label={messages.selectedTime}
          min="0"
          max={values.length - 1}
          value={index}
          step="1"
          onChange={(event) => setTime(values[Number(event.currentTarget.value)]!)}
        />
        <ShapeIconButton
          label={messages.nextTime}
          disabled={!loops && index === values.length - 1}
          onClick={() => setTime(values[loops ? (index + 1) % values.length : index + 1]!)}
        >
          <icons.Next aria-hidden="true" />
        </ShapeIconButton>
        <ShapeSelect
          aria-label={messages.playbackSpeed}
          value={speedMs}
          onChange={(event) => setSpeedMs(Number(event.currentTarget.value))}
        >
          {[...new Set([...speeds, initialSpeed])]
            .sort((a, b) => a - b)
            .map((speed) => (
              <option key={speed} value={speed}>
                {(1000 / speed).toFixed(1)}×
              </option>
            ))}
        </ShapeSelect>
        <output className="geo-time-value" aria-live="polite">
          {formatMapMessage(messages.time, { time: values[index] ?? '' })}
          {loading ? ` · ${messages.loadingFrame}` : ''}
          {hasError ? ` · ${messages.frameUnavailable}` : ''}
        </output>
      </div>
    )
  },
)
