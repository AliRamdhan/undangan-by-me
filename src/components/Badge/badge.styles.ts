export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'muted' | 'info' | 'plain'

export const TONE: Record<Tone, string> = {
  good: 'tint-good text-good-ink',
  warning: 'tint-warning text-warning-ink',
  serious: 'tint-serious text-serious-ink',
  critical: 'tint-critical text-critical-ink',
  muted: 'tint-muted text-ink-2',
  info: 'bg-accent-soft text-accent',
  plain: 'bg-surface-2 text-ink-2',
}
