import type { ReactNode } from 'react'

export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'critical' | 'good' }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface px-5 py-4">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className={`text-3xl font-semibold tabular-nums ${tone === 'critical' ? 'text-critical-ink' : tone === 'good' ? 'text-good-ink' : ''}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </div>
  )
}
