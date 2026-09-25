export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90 border-transparent',
  secondary: 'bg-surface text-ink border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink',
  danger: 'bg-surface text-critical-ink border-line hover:tint-critical',
}
