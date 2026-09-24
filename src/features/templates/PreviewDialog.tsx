import { useEffect, useState } from 'react'
import { refOf, type Preview } from '../../api/types'
import { WhatsAppBubble } from '../../components/WhatsAppText'
import { Button, Dialog, fieldBase } from '../../components/ui'
import { TEMPLATE_TIPE, type Guest, type TemplateTipe } from '../../domain/types'
import { errorText } from '../../state/errors'
import { useStore } from '../../state/store'

type Loaded = { key: string; preview?: Preview; error?: string }

/** Blast → Preview Pesan: exactly what THIS guest will receive, from the one renderer. */
export function PreviewDialog({ guest, onClose }: { guest: Guest | null; onClose: () => void }) {
  const { api, toast } = useStore()
  const [tipe, setTipe] = useState<TemplateTipe>('UNDANGAN')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = guest ? `${guest.No}|${guest.PIN}|${tipe}` : ''

  useEffect(() => {
    if (!guest) return
    let alive = true
    api
      .previewMessage(refOf(guest), tipe)
      .then((preview) => alive && setLoaded({ key, preview }))
      .catch((e: unknown) => alive && setLoaded({ key, error: errorText(e) }))
    return () => {
      alive = false
    }
  }, [api, guest, tipe, key])

  const current = loaded?.key === key ? loaded : null

  const copy = async () => {
    if (!current?.preview) return
    try {
      await navigator.clipboard.writeText(current.preview.text)
      toast('ok', 'Pesan disalin')
    } catch {
      toast('error', 'Tidak bisa menyalin — izin clipboard ditolak')
    }
  }

  return (
    <Dialog
      open={!!guest}
      onClose={onClose}
      title={`Preview Pesan — ${guest?.Nama || ''}`}
      footer={
        <>
          <Button onClick={copy} disabled={!current?.preview}>
            Salin teks
          </Button>
          {current?.preview?.waLink ? (
            <a
              href={current.preview.waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-ink hover:opacity-90"
            >
              Buka di WhatsApp ↗
            </a>
          ) : (
            <Button variant="primary" disabled title="HP tidak valid">
              Buka di WhatsApp
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="preview-tipe" className="text-ink-2">
            Tipe
          </label>
          <select
            id="preview-tipe"
            className={`${fieldBase} h-9 w-auto`}
            value={tipe}
            onChange={(e) => setTipe(e.target.value as TemplateTipe)}
          >
            {TEMPLATE_TIPE.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {current?.preview && (
            <span className="text-ink-3">
              Template <span className="font-mono">{current.preview.kode}</span> · {current.preview.text.length} karakter
            </span>
          )}
        </div>
        {!current && <div className="h-48 animate-pulse rounded-xl bg-surface-2" />}
        {current?.error && (
          <p role="alert" className="rounded-lg tint-critical p-3 text-sm text-critical-ink">
            {current.error}
          </p>
        )}
        {current?.preview && <WhatsAppBubble text={current.preview.text} />}
        {current?.preview && !current.preview.waLink && (
          <p className="text-sm text-serious-ink">HP tamu ini belum valid, jadi link WhatsApp tidak bisa dibuat.</p>
        )}
      </div>
    </Dialog>
  )
}
