'use client'

import { forwardRef, useId } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useMapRuntime, useMapStatic } from './map-context'
import { formatMapMessage } from './messages'
import { ShapeCard } from './shapes'
import type { LegendEntry, LegendPanelConfig, MapPlacement, SymbolSpec } from './types'
import { cn, safeId } from './utils'

// Symbol outlines without a configured stroke use `currentColor`; the stylesheet sets it from
// the `--geo-symbol-stroke` token.

function symbolColors(symbol: SymbolSpec): { fill: string; stroke: string; width: number } {
  if (symbol.kind === 'line')
    return { fill: 'none', stroke: symbol.color, width: symbol.width ?? 2 }
  return {
    fill: symbol.fillColor ?? 'transparent',
    stroke: symbol.strokeColor ?? symbol.fillColor ?? 'currentColor',
    width: symbol.strokeWidth ?? 1,
  }
}

export type MapLegendSymbolProps = ComponentPropsWithoutRef<'svg'> & { entry: LegendEntry }

/** The small SVG swatch for one legend entry (point, line, polygon, or gradient). */
export const MapLegendSymbol = forwardRef<SVGSVGElement, MapLegendSymbolProps>(
  function MapLegendSymbol({ entry, className, ...props }, ref) {
    const gradientId = `${safeId(useId())}-gradient`
    if (entry.symbol.kind === 'gradient') {
      const min = entry.symbol.stops[0]?.value ?? 0
      const max = entry.symbol.stops.at(-1)?.value ?? 1
      return (
        <svg
          ref={ref}
          viewBox="0 0 72 14"
          aria-hidden="true"
          {...props}
          className={cn('geo-legend-gradient', className)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1">
              {entry.symbol.stops.map((stop) => (
                <stop
                  key={`${stop.value}-${stop.color}`}
                  offset={max === min ? 0 : (stop.value - min) / (max - min)}
                  stopColor={stop.color}
                />
              ))}
            </linearGradient>
          </defs>
          <rect
            x="0.5"
            y="0.5"
            width="71"
            height="13"
            rx="2"
            fill={`url(#${gradientId})`}
            stroke="currentColor"
          />
        </svg>
      )
    }
    const colors = symbolColors(entry.symbol)
    const svgProps = {
      ref,
      viewBox: '0 0 28 18',
      'aria-hidden': true,
      ...props,
      className: cn('geo-legend-symbol', className),
    } as const
    if (entry.symbol.kind === 'line')
      return (
        <svg {...svgProps}>
          <line x1="2" y1="9" x2="26" y2="9" stroke={colors.stroke} strokeWidth={colors.width} />
        </svg>
      )
    const shapeProps = { fill: colors.fill, stroke: colors.stroke, strokeWidth: colors.width }
    if (entry.symbol.kind === 'point') {
      const shape = entry.symbol.shape ?? 'circle'
      const radius = Math.min(8, Math.max(2, entry.symbol.radius ?? 6))
      return (
        <svg {...svgProps}>
          {shape === 'circle' ? (
            <circle cx="14" cy="9" r={radius} {...shapeProps} />
          ) : shape === 'triangle' ? (
            <path d="M14 2 22 16 6 16Z" {...shapeProps} />
          ) : (
            <rect
              x="8"
              y="3"
              width="12"
              height="12"
              transform={shape === 'diamond' ? 'rotate(45 14 9)' : undefined}
              {...shapeProps}
            />
          )}
        </svg>
      )
    }
    return (
      <svg {...svgProps}>
        <rect x="3" y="3" width="22" height="12" {...shapeProps} />
      </svg>
    )
  },
)

export type MapLegendProps = ComponentPropsWithoutRef<'div'> &
  Partial<Pick<LegendPanelConfig, 'layout' | 'expanded'>> & {
    /** Corner of the map; defaults to `ui.legend.placement`. `expanded` opens each layer's entries. */
    placement?: MapPlacement
    /** Replaces the default "Legend" heading. */
    header?: ReactNode
    /** Rendered after the legends. */
    footer?: ReactNode
  }

/** Legends for every visible layer. Renders nothing when no layer has a legend. */
export const MapLegend = forwardRef<HTMLDivElement, MapLegendProps>(function MapLegend(
  { placement, layout, expanded, header, footer, className, ...props },
  ref,
) {
  const { ui, messages } = useMapStatic()
  const legends = useMapRuntime((map) => map.legends)
  const visible = legends.filter((legend) => legend.visible)
  if (!visible.length) return null
  const resolvedLayout = layout ?? ui.legend.layout
  return (
    <ShapeCard
      ref={ref}
      role="region"
      data-slot="map-legend"
      data-placement={placement ?? ui.legend.placement}
      data-layout={resolvedLayout}
      aria-label={messages.legend}
      {...props}
      className={cn('geo-legend', `geo-legend-${resolvedLayout}`, className)}
    >
      {header ?? <h2 className="geo-legend-heading">{messages.legend}</h2>}
      {visible.map((legend) => (
        <details
          key={legend.layerId}
          className="geo-legend-layer"
          open={expanded ?? ui.legend.expanded}
        >
          <summary className="geo-legend-title">{legend.title}</summary>
          {legend.subtitle && <p className="geo-legend-subtitle">{legend.subtitle}</p>}
          {legend.description && <p className="geo-legend-description">{legend.description}</p>}
          <ul className="geo-legend-entries">
            {legend.entries.map((entry) => (
              <li key={entry.id} className="geo-legend-entry">
                <MapLegendSymbol entry={entry} />
                <span className="geo-legend-label">{entry.label}</span>
              </li>
            ))}
          </ul>
          {legend.units && (
            <p className="geo-legend-units">
              {formatMapMessage(messages.units, { units: legend.units })}
            </p>
          )}
          {legend.sourceNote && <p className="geo-legend-source">{legend.sourceNote}</p>}
        </details>
      ))}
      {footer}
    </ShapeCard>
  )
})
