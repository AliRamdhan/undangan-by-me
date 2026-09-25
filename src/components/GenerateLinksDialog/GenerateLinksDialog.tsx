import { useState } from 'react'
import type { GuestRef, LinkResult } from '@/core/api/types'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { inputCls } from '@/components/Input'
import { TEMPLATE_TIPE, type TemplateTipe } from '@/core/domain/types'
import { useStore } from '@/core/store'

/**
 * Template → Generate Link Manual: fills Preview_Pesan + Link_WA through the
 * backend renderer — the zero-risk manual channel (BLAST-FLOW.md).
 */
export function GenerateLinksDialog({
  open,
  onClose,
  selection,
}: {
  open: boolean
  onClose: () => void
  /** Selected guests, or null for "every guest". */
  selection: GuestRef[] | null
}) {
  const { run, busy, guests } = useStore()
  const [tipe, setTipe] = useState<TemplateTipe>('UNDANGAN')
  const [result, setResult] = useState<LinkResult | null>(null)
  const count = selection?.length ?? guests.length

  const close = () => {
    setResult(null)
    onClose()
  }

  const submit = async () => {
    const r = await run('Generate Link Manual', (api) => api.generateLinks(selection, tipe))
    if (r) setResult(r)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Generate Link Manual"
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            Selesai
          </Button>
        ) : (
          <>
            <Button onClick={close}>Batal</Button>
            <Button variant="primary" onClick={submit} disabled={!!busy || count === 0}>
              {busy ? 'Membuat…' : `Buat untuk ${count} tamu`}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            <b className="text-good-ink">{result.written} pesan</b> ditulis ke Preview_Pesan & Link_WA.
          </p>
          {result.skipped.length > 0 && (
            <>
              <p className="text-ink-2">{result.skipped.length} catatan:</p>
              <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {result.skipped.map((s, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2">
                    <span className="w-36 shrink-0 truncate font-medium">{s.nama || '(tanpa nama)'}</span>
                    <span className="min-w-0 flex-1 text-ink-2">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-ink-2">
            Pesan dirender per tamu memakai template aktif (Tipe, Akses) → fallback (Tipe, SEMUA). Operator lalu klik
            <b> Buka WA</b> dan menekan kirim sendiri — jalur tanpa risiko untuk tamu VIP.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-2">Tipe pesan</span>
            <select className={inputCls} value={tipe} onChange={(e) => setTipe(e.target.value as TemplateTipe)}>
              {TEMPLATE_TIPE.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <p className="text-ink-3">
            Cakupan: {selection ? `${selection.length} tamu terpilih` : `semua ${guests.length} tamu`}.
          </p>
        </div>
      )}
    </Dialog>
  )
}
