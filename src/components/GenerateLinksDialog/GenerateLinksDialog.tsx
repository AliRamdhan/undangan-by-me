import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import type { GuestRef, LinkResult } from '@/core/api/types'
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
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Link Manual</DialogTitle>
          <DialogDescription>
            {/* HIDDEN(sementara): Pesan dirender per tamu memakai template aktif (Tipe, Akses) → fallback (Tipe, SEMUA). Operator lalu klik <b>Buka WA</b> dan menekan kirim sendiri — jalur tanpa risiko untuk tamu VIP. */}
            Pesan dirender per tamu memakai template aktif sesuai Tipe. Operator lalu klik <b>Buka WA</b> dan menekan kirim
            sendiri.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <b className="text-good-ink">{result.written} pesan</b> ditulis ke Preview_Pesan & Link_WA.
            </p>
            {result.skipped.length > 0 && (
              <>
                <p className="text-muted-foreground">{result.skipped.length} catatan:</p>
                <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                  {result.skipped.map((s, i) => (
                    <li key={i} className="flex gap-3 px-3 py-2">
                      <span className="w-36 shrink-0 truncate font-medium">{s.nama || '(tanpa nama)'}</span>
                      <span className="min-w-0 flex-1 text-muted-foreground">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <Field>
            <FieldLabel htmlFor="links-tipe">Tipe pesan</FieldLabel>
            <NativeSelect id="links-tipe" className="w-full" value={tipe} onChange={(e) => setTipe(e.target.value as TemplateTipe)}>
              {TEMPLATE_TIPE.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {t}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              Cakupan: {selection ? `${selection.length} tamu terpilih` : `semua ${guests.length} tamu`}.
            </FieldDescription>
          </Field>
        )}
        <DialogFooter>
          {result ? (
            <Button onClick={close}>Selesai</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Batal
              </Button>
              <Button onClick={submit} disabled={!!busy || count === 0}>
                {busy && <Spinner data-icon="inline-start" />}
                {busy ? 'Membuat…' : `Buat untuk ${count} tamu`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
