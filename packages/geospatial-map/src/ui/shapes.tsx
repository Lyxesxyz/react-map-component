import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

export function ShapeButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`geo-shape-button ${className}`.trim()} {...props} />
}

export function ShapeIconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <ShapeButton className="geo-shape-icon-button" aria-label={label} title={label} {...props}>
      {children}
    </ShapeButton>
  )
}

export function ShapeSelect({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`geo-shape-select ${className}`.trim()} {...props} />
}

export function ShapeSlider({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className={`geo-shape-slider ${className}`.trim()} {...props} />
}

export function ShapeSwitch({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="geo-shape-switch">
      <input type="checkbox" {...props} />
      <span aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

export function ShapeCard({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`geo-shape-card ${className}`.trim()} {...props} />
}

export function ShapeAlert({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="geo-shape-alert" role="alert" {...props}>
      {children}
    </div>
  )
}

export function ShapeLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="geo-shape-label" {...props} />
}

export function ShapeBadge({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`geo-shape-badge ${className}`.trim()} {...props} />
}
