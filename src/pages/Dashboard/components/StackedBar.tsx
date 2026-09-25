import { useState } from 'react'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { nf, pct } from '@/utils/format'

export interface Segment {
  key: string
  label: string
  icon: string
  count: number
  fill: string
}

/** One 100% bar, 2px gaps between segments, hover readout, and a legend that doubles as the table view. */
export function StackedBar({ segments, total }: { segments: Segment[]; total: number }) {
  const [hover, setHover] = useState<string | null>(null)
  const h = segments.find((s) => s.key === hover)
  const shown = segments.filter((s) => s.count > 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="h-5 text-sm text-ink-2" aria-live="polite">
        {h ? (
          <>
            <b className="text-ink">{h.label}</b>: {nf.format(h.count)} tamu ({pct(h.count, total)}%)
          </>
        ) : (
          <span className="text-ink-3">Arahkan kursor ke bar untuk detail</span>
        )}
      </div>
      <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={segments.map((s) => `${s.label} ${s.count}`).join(', ')}>
        {shown.map((s, i) => (
          <div
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className={`h-full transition-opacity ${i === 0 ? 'rounded-l' : ''} ${i === shown.length - 1 ? 'rounded-r' : ''} ${hover && hover !== s.key ? 'opacity-50' : ''}`}
            style={{ flexGrow: s.count, flexBasis: 0, minWidth: 4, background: s.fill }}
          />
        ))}
        {!shown.length && <div className="h-full flex-1 rounded bg-muted" />}
      </div>
      <Table className="text-sm">
        <TableBody>
          {segments.map((s) => (
            <TableRow
              key={s.key}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              data-state={hover === s.key ? 'selected' : undefined}
              className="border-0"
            >
              <TableCell className="w-5 py-1 pr-2 pl-0">
                <span className="inline-block size-3 rounded-sm align-[-1px]" style={{ background: s.fill }} aria-hidden />
              </TableCell>
              <TableCell className="w-full py-1 text-muted-foreground">
                <span aria-hidden className="mr-1 text-ink-3">
                  {s.icon}
                </span>
                {s.label}
              </TableCell>
              <TableCell className="py-1 pl-4 text-right font-medium tabular-nums">{nf.format(s.count)}</TableCell>
              <TableCell className="w-12 py-1 pr-0 pl-3 text-right text-ink-3 tabular-nums">{pct(s.count, total)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
