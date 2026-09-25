import type { Breakdown } from '@/core/domain/stats'

export function BreakdownBars({ rows }: { rows: Breakdown[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1)
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[96px_1fr_72px] items-center gap-3 text-sm" title={`${r.key}: ${r.hadir} hadir dari ${r.total}`}>
          <span className="truncate text-ink-2">{r.key}</span>
          <div className="flex h-3 gap-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
            {r.hadir > 0 && <div className="h-full rounded-l bg-series-1" style={{ flexGrow: r.hadir, flexBasis: 0 }} />}
            {r.total - r.hadir > 0 && (
              <div
                className={`h-full rounded-r ${r.hadir ? '' : 'rounded-l'}`}
                style={{ flexGrow: r.total - r.hadir, flexBasis: 0, background: 'color-mix(in oklab, var(--series-1) 30%, var(--surface))' }}
              />
            )}
          </div>
          <span className="text-right tabular-nums">
            <b>{r.hadir}</b>
            <span className="text-ink-3"> / {r.total}</span>
          </span>
        </div>
      ))}
      <div className="mt-1 flex gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-series-1" /> Hadir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: 'color-mix(in oklab, var(--series-1) 30%, var(--surface))' }} />
          Lainnya
        </span>
      </div>
    </div>
  )
}
