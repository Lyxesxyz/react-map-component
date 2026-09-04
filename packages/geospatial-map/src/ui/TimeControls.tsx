import { useEffect, useState } from 'react'
import { ShapeIconButton, ShapeSelect, ShapeSlider } from './shapes.js'

export function TimeControls({
  values,
  value,
  speedsMs = [500, 900, 1500],
  defaultSpeedMs = 900,
  loading = false,
  hasError = false,
  onChange,
}: {
  values: string[]
  value: string | null
  speedsMs?: number[]
  defaultSpeedMs?: number
  loading?: boolean
  hasError?: boolean
  onChange: (value: string) => void
}) {
  const [playing, setPlaying] = useState(false)
  const [speedMs, setSpeedMs] = useState(defaultSpeedMs)
  const index = Math.max(0, values.indexOf(value ?? values[0] ?? ''))

  useEffect(() => {
    if (hasError) setPlaying(false)
  }, [hasError])

  useEffect(() => {
    if (!playing || loading || hasError || values.length < 2) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPlaying(false)
      return
    }
    const timer = window.setInterval(() => onChange(values[(index + 1) % values.length]!), speedMs)
    return () => window.clearInterval(timer)
  }, [hasError, index, loading, onChange, playing, speedMs, values])

  if (!values.length) return null
  return (
    <div className="geo-time-controls" aria-label="Time controls">
      <ShapeIconButton
        label={playing ? 'Pause time animation' : 'Play time animation'}
        disabled={hasError}
        onClick={() => setPlaying((current) => !current)}
      >
        {playing ? 'Ⅱ' : '▶'}
      </ShapeIconButton>
      <ShapeIconButton
        label="Replay time animation"
        onClick={() => {
          onChange(values[0]!)
          setPlaying(true)
        }}
      >
        ↻
      </ShapeIconButton>
      <ShapeIconButton
        label="Previous time"
        onClick={() => onChange(values[(index - 1 + values.length) % values.length]!)}
      >
        ‹
      </ShapeIconButton>
      <ShapeSlider
        aria-label="Selected time"
        min="0"
        max={values.length - 1}
        value={index}
        step="1"
        onChange={(event) => onChange(values[Number(event.currentTarget.value)]!)}
      />
      <ShapeIconButton
        label="Next time"
        onClick={() => onChange(values[(index + 1) % values.length]!)}
      >
        ›
      </ShapeIconButton>
      <ShapeSelect
        aria-label="Playback speed"
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
        Time {values[index]}
        {loading ? ' · loading frame' : ''}
        {hasError ? ' · frame unavailable; playback paused' : ''}
      </output>
    </div>
  )
}
