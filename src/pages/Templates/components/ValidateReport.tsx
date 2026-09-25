import type { TemplateReport } from '@/core/api/types'
import { Badge } from '@/components/Badge'
import { Dialog } from '@/components/Dialog'

export function ValidateReport({ report, onClose }: { report: TemplateReport[] | null; onClose: () => void }) {
  const bad = (report ?? []).filter((r) => r.unknown.length || r.malformed)
  return (
    <Dialog open={report !== null} onClose={onClose} wide title="Validasi Template">
      <p className="mb-4 text-sm text-ink-2">
        Semua template aktif di-render coba ke setiap tamu yang cocok.{' '}
        {bad.length === 0 ? (
          <b className="text-good-ink">✓ Semua lolos.</b>
        ) : (
          <b className="text-critical-ink">{bad.length} template tidak bisa dikirim.</b>
        )}
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {(report ?? []).map((r) => {
          const ok = !r.unknown.length && !r.malformed
          return (
            <li key={r.kode} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ok ? 'good' : 'critical'}>{ok ? '✓ Lolos' : '! Gagal'}</Badge>
                <span className="font-mono font-medium">{r.kode}</span>
                <span className="text-ink-3">
                  {r.tipe} · {r.akses} · {r.rendered} tamu
                </span>
              </div>
              {r.unknown.length > 0 && (
                <p className="text-critical-ink">Token tidak dikenal: {r.unknown.map((t) => `{{${t}}}`).join(', ')}</p>
              )}
              {r.malformed && <p className="text-critical-ink">Kurung kurawal tidak seimbang</p>}
              {r.empty.length > 0 && (
                <p className="text-warning-ink">⚠ Selalu kosong (data event belum diisi?): {r.empty.map((t) => `{{${t}}}`).join(', ')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
