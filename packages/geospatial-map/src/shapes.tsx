'use client'

import { forwardRef } from 'react'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { cn } from './utils'

// "Shapes" are the small UI primitives every map part is built from. This is the one file to
// edit if you want the map to use your design system: keep the exported names and props, and
// replace the bodies (for example with your shadcn/ui Button, Select, Switch, Slider, Card…).

export type ShapeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export const ShapeButton = forwardRef<HTMLButtonElement, ShapeButtonProps>(function ShapeButton(
  { className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      className={cn('geo-shape-button', className)}
      {...props}
    />
  )
})

export type ShapeIconButtonProps = ShapeButtonProps & {
  /** Accessible name; also shown as the native tooltip. */
  label: string
  children: ReactNode
}

export const ShapeIconButton = forwardRef<HTMLButtonElement, ShapeIconButtonProps>(
  function ShapeIconButton({ label, className, ...props }, ref) {
    return (
      <ShapeButton
        ref={ref}
        data-slot="icon-button"
        className={cn('geo-shape-icon-button', className)}
        aria-label={label}
        title={label}
        {...props}
      />
    )
  },
)

export const ShapeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function ShapeSelect({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        data-slot="select"
        className={cn('geo-shape-select', className)}
        {...props}
      />
    )
  },
)

export const ShapeSlider = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function ShapeSlider({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="range"
        data-slot="slider"
        className={cn('geo-shape-slider', className)}
        {...props}
      />
    )
  },
)

export type ShapeSwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
}

export const ShapeSwitch = forwardRef<HTMLInputElement, ShapeSwitchProps>(function ShapeSwitch(
  { label, className, ...props },
  ref,
) {
  return (
    <label data-slot="switch" className={cn('geo-shape-switch', className)}>
      <input ref={ref} type="checkbox" {...props} />
      <span className="geo-shape-switch-track" aria-hidden="true" />
      <span className="geo-shape-switch-label">{label}</span>
    </label>
  )
})

export const ShapeCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ShapeCard({ className, ...props }, ref) {
    return <div ref={ref} data-slot="card" className={cn('geo-shape-card', className)} {...props} />
  },
)

export const ShapeAlert = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ShapeAlert({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="alert"
        data-slot="alert"
        className={cn('geo-shape-alert', className)}
        {...props}
      />
    )
  },
)

export const ShapeLabel = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function ShapeLabel({ className, ...props }, ref) {
    return (
      <label ref={ref} data-slot="label" className={cn('geo-shape-label', className)} {...props} />
    )
  },
)

export const ShapeBadge = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  function ShapeBadge({ className, ...props }, ref) {
    return (
      <span ref={ref} data-slot="badge" className={cn('geo-shape-badge', className)} {...props} />
    )
  },
)
