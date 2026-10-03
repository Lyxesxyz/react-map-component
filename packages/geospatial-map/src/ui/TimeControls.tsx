import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { ShapeIconButton, ShapeSelect, ShapeSlider } from './shapes'
import type { MapMessages, MapPlacement } from '../types'
import { formatMapMessage } from '../config'

export function TimeControls({
  values,
  value,
  speedsMs = [500, 900, 1500],
  defaultSpeedMs = 900,
  autoplay = false,
  loop = true,
  frameFailurePolicy = 'pause',
  reducedMotion = 'respect',
  placement = 'bottom-left',
  messages,
  loading = false,
  hasError = false,
  onChange,
}: {
  values: string[]
  value: string | null
  speedsMs?: number[]
  defaultSpeedMs?: number
  autoplay?: boolean
  loop?: boolean
  frameFailurePolicy?: 'pause' | 'retain-last' | 'skip'
  reducedMotion?: 'respect' | 'ignore'
  placement?: MapPlacement
  messages: MapMessages
  loading?: boolean
  hasError?: boolean
  onChange: (value: string) => void
}) {
  const [playing, setPlaying] = useState(autoplay)
  const [speedMs, setSpeedMs] = useState(defaultSpeedMs)
  const index = Math.max(0, values.indexOf(value ?? values[0] ?? ''))
  const blocksPlayback = hasError && frameFailurePolicy !== 'skip'

  useEffect(() => {
    if (blocksPlayback) setPlaying(false)
  }, [blocksPlayback])

  useEffect(() => {
    if (!playing || loading || blocksPlayback || values.length < 2) return
    if (
      reducedMotion === 'respect' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setPlaying(false)
      return
    }
    if (!loop && index === values.length - 1) {
      setPlaying(false)
      return
    }
    const timer = window.setInterval(
      () => onChange(values[loop ? (index + 1) % values.length : index + 1]!),
      speedMs,
    )
    return () => window.clearInterval(timer)
  }, [blocksPlayback, index, loading, loop, onChange, playing, reducedMotion, speedMs, values])

  if (!values.length) return null
  return (
    <div
      className="geo-time-controls"
      data-placement={placement}
      aria-label={messages.timeControls}
    >
      <ShapeIconButton
        label={playing ? messages.pauseTime : messages.playTime}
        disabled={blocksPlayback}
        onClick={() => setPlaying((current) => !current)}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </ShapeIconButton>
      <ShapeIconButton
        label={messages.replayTime}
        onClick={() => {
          onChange(values[0]!)
          setPlaying(true)
        }}
      >
        <RotateCcw aria-hidden="true" />
      </ShapeIconButton>
      <ShapeIconButton
        label={messages.previousTime}
        disabled={!loop && index === 0}
        onClick={() =>
          onChange(values[loop ? (index - 1 + values.length) % values.length : index - 1]!)
        }
      >
        <ChevronLeft aria-hidden="true" />
      </ShapeIconButton>
      <ShapeSlider
        aria-label={messages.selectedTime}
        min="0"
        max={values.length - 1}
        value={index}
        step="1"
        onChange={(event) => onChange(values[Number(event.currentTarget.value)]!)}
      />
      <ShapeIconButton
        label={messages.nextTime}
        disabled={!loop && index === values.length - 1}
        onClick={() => onChange(values[loop ? (index + 1) % values.length : index + 1]!)}
      >
        <ChevronRight aria-hidden="true" />
      </ShapeIconButton>
      <ShapeSelect
        aria-label={messages.playbackSpeed}
        value={speedMs}
        onChange={(event) => setSpeedMs(Number(event.currentTarget.value))}
      >
        {[...new Set([...speedsMs, defaultSpeedMs])]
          .sort((a, b) => a - b)
          .map((speed) => (
            <option key={speed} value={speed}>
              {(1000 / speed).toFixed(1)}×
            </option>
          ))}
      </ShapeSelect>
      <output aria-live="polite">
        {formatMapMessage(messages.time, { time: values[index] ?? '' })}
        {loading ? ` · ${messages.loadingFrame}` : ''}
        {hasError ? ` · ${messages.frameUnavailable}` : ''}
      </output>
    </div>
  )
}
