import { Upload04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Fragment, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { canUploadMedia, uploadMedia } from '@/core/api/media'
import { SLUG_PATTERN } from '@/core/domain/event'
import { isLocalMedia, MEDIA_DIR, mediaAccept, type MediaField as MediaKind } from '@/core/domain/media'
import type { EventInfo } from '@/core/domain/types'
import { FormField, SectionHeader, TextField, type SectionProps } from './form'

type GiftKey = Exclude<keyof EventInfo['gift'], 'qris'>
type MediaKey = Exclude<keyof EventInfo['media'], 'judul_musik'>

const GIFT: { key: GiftKey; label: string; placeholder: string; mono?: boolean }[] = [
  { key: 'bank', label: 'Bank', placeholder: 'BCA' },
  { key: 'atas_nama', label: 'Atas nama', placeholder: 'Rara Anindita' },
  { key: 'norek', label: 'No. rekening', placeholder: '1234567890', mono: true },
]
const MEDIA: { key: MediaKey; label: string; placeholder: string }[] = [
  { key: 'musik', label: 'Musik latar', placeholder: 'https://….mp3 atau unggah' },
  { key: 'cover', label: 'Foto cover', placeholder: 'https://….jpg atau unggah' },
]

/** #A.4 — the `gift` and `media` blocks of the event JSON (URL-CONTRACT.md § 2). */
export function GiftMediaCard({ draft, update }: SectionProps) {
  return (
    <Card>
      <SectionHeader title="Hadiah & Media" code="#A.4" />
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FieldSet>
          <FieldLegend>Hadiah / amplop digital</FieldLegend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {GIFT.map((f) => (
              <TextField
                key={f.key}
                id={`ev-gift-${f.key}`}
                label={f.label}
                placeholder={f.placeholder}
                className={f.mono ? 'font-mono' : undefined}
                inputMode={f.key === 'norek' ? 'numeric' : undefined}
                value={draft.gift[f.key]}
                onChange={(e) => update((d) => void (d.gift[f.key] = e.target.value))}
              />
            ))}
            <MediaField
              field="qris"
              label="Gambar QRIS"
              placeholder="https://… atau unggah"
              slug={draft.slug}
              value={draft.gift.qris}
              onChange={(v) => update((d) => void (d.gift.qris = v))}
            />
          </div>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Media</FieldLegend>
          <div className="grid grid-cols-1 gap-y-4">
            {MEDIA.map((f) => (
              <Fragment key={f.key}>
                <MediaField
                  field={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  slug={draft.slug}
                  value={draft.media[f.key]}
                  onChange={(v) => update((d) => void (d.media[f.key] = v))}
                />
                {f.key === 'musik' && (
                  <TextField
                    id="ev-media-judul_musik"
                    label="Nama musik"
                    placeholder="Kita Usahakan Rumah Itu"
                    hint="Judul lagu yang tampil di pemutar musik undangan"
                    value={draft.media.judul_musik}
                    onChange={(e) => update((d) => void (d.media.judul_musik = e.target.value))}
                  />
                )}
              </Fragment>
            ))}
          </div>
        </FieldSet>
      </CardContent>
    </Card>
  )
}

/**
 * A URL input with "Unggah": the file goes to `public/events/{slug}/assets/media/`
 * (dev server only) and the field takes its relative path, which the invitation
 * page resolves against `/events/{slug}/`.
 */
function MediaField({
  field,
  label,
  placeholder,
  slug,
  value,
  onChange,
}: {
  field: MediaKind
  label: string
  placeholder: string
  slug: string
  value: string
  onChange: (value: string) => void
}) {
  const id = `ev-media-${field}`
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const slugOk = SLUG_PATTERN.test(slug)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      onChange(await uploadMedia(slug, field, file))
      toast.success(`${label} diunggah — simpan event agar tersimpan`)
    } catch (e) {
      toast.error(`Unggah ${label.toLowerCase()}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const local = value.trim() && isLocalMedia(value.trim())
  const hint = local ? (
    slugOk ? (
      <a href={`/events/${slug}/${value.trim()}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        Lihat file
      </a>
    ) : null
  ) : canUploadMedia ? (
    slugOk ? (
      `URL https://… atau unggah ke public/events/${slug}/${MEDIA_DIR}/`
    ) : (
      'Isi slug dulu untuk mengunggah file'
    )
  ) : null

  return (
    <FormField id={id} label={label} hint={hint}>
      <InputGroup>
        <InputGroupInput id={id} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        {canUploadMedia && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="secondary"
              disabled={!slugOk || uploading}
              onClick={() => fileRef.current?.click()}
              aria-label={`Unggah ${label.toLowerCase()}`}
            >
              {uploading ? <Spinner /> : <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} />}
              Unggah
            </InputGroupButton>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={mediaAccept(field)}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </InputGroupAddon>
        )}
      </InputGroup>
    </FormField>
  )
}
