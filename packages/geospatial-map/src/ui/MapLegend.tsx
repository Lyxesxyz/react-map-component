import type { LegendEntry, NormalizedLegend, SymbolSpec } from '../types.js'
import { ShapeCard } from './shapes.js'

function symbolColors(symbol: SymbolSpec): { fill: string; stroke: string; width: number } {
  if (symbol.kind === 'line')
    return { fill: 'none', stroke: symbol.color, width: symbol.width ?? 2 }
  return {
    fill: symbol.fillColor ?? 'transparent',
    stroke: symbol.strokeColor ?? symbol.fillColor ?? '#64748b',
    width: symbol.strokeWidth ?? 1,
  }
}

function LegendMark({ entry }: { entry: LegendEntry }) {
  if (entry.symbol.kind === 'gradient') {
    const id = `gradient-${entry.id.replaceAll(/[^a-zA-Z0-9_-]/g, '-')}`
    const min = entry.symbol.stops[0]?.value ?? 0
    const max = entry.symbol.stops.at(-1)?.value ?? 1
    return (
      <svg className="geo-legend-gradient" viewBox="0 0 72 14" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            {entry.symbol.stops.map((stop) => (
              <stop
                key={`${stop.value}-${stop.color}`}
                offset={max === min ? 0 : (stop.value - min) / (max - min)}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
        </defs>
        <rect x="0.5" y="0.5" width="71" height="13" rx="2" fill={`url(#${id})`} stroke="#64748b" />
      </svg>
    )
  }
  const colors = symbolColors(entry.symbol)
  if (entry.symbol.kind === 'line')
    return (
      <svg className="geo-legend-symbol" viewBox="0 0 28 18" aria-hidden="true">
        <line x1="2" y1="9" x2="26" y2="9" stroke={colors.stroke} strokeWidth={colors.width} />
      </svg>
    )
  if (entry.symbol.kind === 'point') {
    const shape = entry.symbol.shape ?? 'circle'
    return (
      <svg className="geo-legend-symbol" viewBox="0 0 28 18" aria-hidden="true">
        {shape === 'circle' ? (
          <circle
            cx="14"
            cy="9"
            r="6"
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={colors.width}
          />
        ) : shape === 'triangle' ? (
          <path
            d="M14 2 22 16 6 16Z"
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={colors.width}
          />
        ) : (
          <rect
            x="8"
            y="3"
            width="12"
            height="12"
            transform={shape === 'diamond' ? 'rotate(45 14 9)' : undefined}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={colors.width}
          />
        )}
      </svg>
    )
  }
  return (
    <svg className="geo-legend-symbol" viewBox="0 0 28 18" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="22"
        height="12"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={colors.width}
      />
    </svg>
  )
}

export function MapLegend({ legends }: { legends: NormalizedLegend[] }) {
  const visible = legends.filter((legend) => legend.visible)
  if (!visible.length) return null
  return (
    <ShapeCard className="geo-legend" aria-label="Map legend">
      <h2>Legend</h2>
      {visible.map((legend) => (
        <details key={legend.layerId} open>
          <summary>{legend.title}</summary>
          {legend.subtitle && <p className="geo-muted">{legend.subtitle}</p>}
          {legend.description && <p>{legend.description}</p>}
          <ul>
            {legend.entries.map((entry) => (
              <li key={entry.id}>
                <LegendMark entry={entry} />
                <span>{entry.label}</span>
              </li>
            ))}
          </ul>
          {legend.units && <p className="geo-legend-units">Units: {legend.units}</p>}
          {legend.sourceNote && <p className="geo-legend-source">{legend.sourceNote}</p>}
        </details>
      ))}
    </ShapeCard>
  )
}
