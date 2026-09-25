import { Copy01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { WhatsAppBubble } from '@/components/WhatsAppBubble'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { refOf, type Preview } from '@/core/api/types'
import { TEMPLATE_TIPE, type Guest, type TemplateTipe } from '@/core/domain/types'
import { errorText, useStore } from '@/core/store'

type Loaded = { key: string; preview?: Preview; error?: string }

/** Blast → Preview Pesan: exactly what THIS guest will receive, from the one renderer. */
export function MessagePreviewDialog({ guest, onClose }: { guest: Guest | null; onClose: () => void }) {
  const { api } = useStore()
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
      toast.success('Pesan disalin')
    } catch {
      toast.error('Tidak bisa menyalin — izin clipboard ditolak')
    }
  }

  return (
    <Dialog open={!!guest} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preview Pesan — {guest?.Nama || ''}</DialogTitle>
          <DialogDescription>
            {current?.preview
              ? `Template ${current.preview.kode} · ${current.preview.text.length} karakter`
              : 'Pesan persis seperti yang diterima tamu ini.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto">
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel htmlFor="preview-tipe">Tipe</FieldLabel>
            <NativeSelect id="preview-tipe" value={tipe} onChange={(e) => setTipe(e.target.value as TemplateTipe)}>
              {TEMPLATE_TIPE.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {t}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {!current && <Skeleton className="h-48 rounded-xl" />}
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
        <DialogFooter>
          <Button variant="outline" onClick={copy} disabled={!current?.preview}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} data-icon="inline-start" />
            Salin teks
          </Button>
          {current?.preview?.waLink ? (
            <a href={current.preview.waLink} target="_blank" rel="noreferrer" className={buttonVariants()}>
              Buka di WhatsApp
              <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} data-icon="inline-end" />
            </a>
          ) : (
            <Button disabled title="HP tidak valid">
              Buka di WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
