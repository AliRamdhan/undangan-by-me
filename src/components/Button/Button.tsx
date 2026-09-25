import type { ButtonHTMLAttributes } from 'react'
import { VARIANT, type Variant } from './button.styles'

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm'
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  )
}
