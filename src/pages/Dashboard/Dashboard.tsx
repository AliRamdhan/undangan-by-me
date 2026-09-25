import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { StatTile } from '@/components/StatTile'
import { computeStats /* HIDDEN(sementara): , type SessionPax */ } from '@/core/domain/stats'
import { useStore } from '@/core/store'
import { /* HIDDEN(sementara): KIRIM_META, */ RSVP_META } from '@/components/StatusBadge'
import { nf, pct } from '@/utils/format'
import { BreakdownBars } from './components/BreakdownBars'
import { StackedBar, type Segment } from './components/StackedBar'

// Status colours are fixed and always shown next to their label + count.
const RSVP_FILL: Record<string, string> = {
  HADIR: 'var(--good)',
  RAGU: 'var(--warning)',
  TIDAK_HADIR: 'var(--neutral)',
  BELUM: 'color-mix(in oklab, var(--neutral) 35%, var(--surface))',
}
// HIDDEN(sementara): Status_Kirim is hidden
// const KIRIM_FILL: Record<string, string> = {
//   DIBACA: 'var(--good)',
//   TERKIRIM: 'color-mix(in oklab, var(--good) 50%, var(--surface))',
//   ANTRI: 'var(--series-1)',
//   GAGAL: 'var(--critical)',
//   BELUM: 'color-mix(in oklab, var(--neutral) 35%, var(--surface))',
// }

// HIDDEN(sementara): quota and RSVP_S* are hidden
// /** Allocated quota vs confirmed attendance on one axis, venue capacity as a reference tick. */
// function SessionMeter({ s }: { s: SessionPax }) {
//   const max = Math.max(s.kapasitas, s.kuota, s.hadir, 1)
//   const over = s.kuota > s.kapasitas && s.kapasitas > 0
//   const rows = [
//     { label: 'Kuota dialokasikan', value: s.kuota, fill: 'var(--series-2)' },
//     { label: 'Konfirmasi hadir', value: s.hadir, fill: 'var(--series-1)' },
//   ]
//   return (
//     <div className="flex flex-col gap-2">
//       <div className="flex flex-wrap items-baseline justify-between gap-2">
//         <h3 className="text-sm font-semibold">
//           {s.kode} · {s.label}
//         </h3>
//         <span className="text-xs text-ink-3">Kapasitas {nf.format(s.kapasitas)}</span>
//       </div>
//       {rows.map((r) => (
//         <div key={r.label} className="grid grid-cols-[130px_1fr_48px] items-center gap-3 text-sm" title={`${r.label}: ${r.value} pax`}>
//           <span className="text-ink-2">{r.label}</span>
//           <div className="relative h-3">
//             <div className="absolute inset-0 rounded bg-surface-2" />
//             <div
//               className="absolute inset-y-0 left-0 rounded"
//               style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, background: r.fill }}
//             />
//             <div
//               aria-hidden
//               className="absolute -inset-y-1 w-0.5 bg-ink"
//               style={{ left: `calc(${(s.kapasitas / max) * 100}% - 1px)` }}
//             />
//           </div>
//           <span className="text-right font-medium tabular-nums">{nf.format(r.value)}</span>
//         </div>
//       ))}
//       {over && (
//         <p className="text-xs text-serious-ink">
//           ⚠ Kuota {nf.format(s.kuota)} pax melebihi kapasitas venue ({nf.format(s.kapasitas)}).
//         </p>
//       )}
//     </div>
//   )
// }

export function Dashboard() {
  const { guests, meta, loading } = useStore()
  if (loading || !meta) return <div className="h-96 animate-pulse rounded-2xl bg-surface" />
  if (!guests.length) return <EmptyState title="Belum ada data tamu">Dashboard terisi otomatis dari 02_Tamu.</EmptyState>

  const s = computeStats(guests, meta.event)
  const answered = s.total - (s.rsvp.BELUM ?? 0)
  // HIDDEN(sementara): send status, HP_Valid and quota no longer count toward "Perlu perhatian".
  // const delivered = (s.kirim.TERKIRIM ?? 0) + (s.kirim.DIBACA ?? 0)
  // const gagal = s.kirim.GAGAL ?? 0
  // const attention = s.pinKosong + s.hpBermasalah + s.pinDuplikat + s.lebihKuota.length + gagal
  const attention = s.pinKosong + s.pinDuplikat

  const rsvpSegments: Segment[] = (['HADIR', 'RAGU', 'TIDAK_HADIR', 'BELUM'] as const).map((k) => ({
    key: k,
    label: RSVP_META[k].label,
    icon: RSVP_META[k].icon,
    count: s.rsvp[k] ?? 0,
    fill: RSVP_FILL[k],
  }))
  // HIDDEN(sementara): Status_Kirim is hidden
  // const kirimSegments: Segment[] = (['DIBACA', 'TERKIRIM', 'ANTRI', 'GAGAL', 'BELUM'] as const).map((k) => ({
  //   key: k,
  //   label: KIRIM_META[k].label,
  //   icon: KIRIM_META[k].icon,
  //   count: s.kirim[k] ?? 0,
  //   fill: KIRIM_FILL[k],
  // }))

  const warnings: { label: string; count: number; detail: string }[] = [
    // HIDDEN(sementara): { label: 'HP bermasalah', count: s.hpBermasalah, detail: 'kosong, format salah, atau duplikat — jalankan Normalisasi HP' },
    { label: 'PIN kosong', count: s.pinKosong, detail: 'belum punya link undangan — jalankan Generate PIN' },
    { label: 'PIN duplikat', count: s.pinDuplikat, detail: 'RSVP untuk PIN ini ditolak (DUPLICATE_PIN)' },
    // HIDDEN(sementara): { label: 'Gagal kirim', count: gagal, detail: 'kirim manual lewat Link WA' },
    // HIDDEN(sementara): { label: 'RSVP melebihi kuota', count: s.lebihKuota.length, detail: s.lebihKuota.map((g) => g.Nama).join(', ') },
  ].filter((w) => w.count > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Total tamu" value={nf.format(s.total)} sub={`${s.akses.find((a) => a.key === 'VIP')?.total ?? 0} VIP`} />
        <StatTile label="Sudah RSVP" value={`${pct(answered, s.total)}%`} sub={`${answered} dari ${s.total} tamu menjawab`} />
        {/* HIDDEN(sementara):
        <StatTile label="Undangan tersampaikan" value={`${pct(delivered, s.total)}%`} sub={`${delivered} terkirim/dibaca`} />
        */}
        <StatTile
          label="Perlu perhatian"
          value={attention ? `! ${attention}` : '✓ 0'}
          tone={attention ? 'critical' : 'good'}
          sub={attention ? 'lihat daftar di bawah' : 'semua data bersih'}
        />
      </div>

      <Card title="Status RSVP">
        <StackedBar segments={rsvpSegments} total={s.total} />
      </Card>
      {/* HIDDEN(sementara): Status kirim — restore by putting both cards back in <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Status kirim">
        <StackedBar segments={kirimSegments} total={s.total} />
      </Card>
      */}

      {/* HIDDEN(sementara): quota and RSVP_S* are hidden
      <Card title="Pax per sesi">
        <div className="grid gap-6 md:grid-cols-2">
          {s.sesi.map((x) => (
            <SessionMeter key={x.kode} s={x} />
          ))}
        </div>
        <p className="mt-4 flex flex-wrap gap-4 text-xs text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-series-2" /> Kuota dialokasikan (Σ Q_Sn)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-series-1" /> Konfirmasi hadir (Σ RSVP_Sn, status Hadir)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-ink" /> Kapasitas venue
          </span>
        </p>
      </Card>
      */}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Per akses">
          <BreakdownBars rows={s.akses} />
        </Card>
        <Card title="Per sisi">
          <BreakdownBars rows={s.sisi} />
        </Card>
        <Card title="Perlu perhatian">
          {warnings.length === 0 ? (
            <p className="text-sm text-good-ink">✓ Tidak ada masalah.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {warnings.map((w) => (
                <li key={w.label} className="flex gap-3">
                  <span className="w-8 shrink-0 text-right font-semibold text-critical-ink tabular-nums">{w.count}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{w.label}</span>
                    <span className="block truncate text-xs text-ink-3" title={w.detail}>
                      {w.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
