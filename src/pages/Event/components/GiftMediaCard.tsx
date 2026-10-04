import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, Upload04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Fragment, useRef, useState, type DragEvent } from 'react'
import { cn } from 'cn'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
      <CardContent className="grid grid-cols-1 gap-6">
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
            <GalleryField slug={draft.slug} value={draft.gallery} edit={(fn) => update((d) => fn(d.gallery))} />
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

/**
 * `event.gallery`: the invitation's "Our Moments" grid, in this order. Uploads
 * run one at a time (unique file names, selection order kept) and each path is
 * appended as soon as it lands, so a failed file does not lose the others.
 * Files can be dropped onto the field and tiles dragged to reorder; the arrow
 * buttons stay for keyboard and touch, where HTML5 drag-and-drop does not work.
 */
function GalleryField({
  slug,
  value,
  edit,
}: {
  slug: string
  value: string[]
  edit: (fn: (list: string[]) => void) => void
}) {
  const id = 'ev-gallery'
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [url, setUrl] = useState('')
  /** Index of the tile being dragged, and of the tile it is over. */
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [fileOver, setFileOver] = useState(false)
  const slugOk = SLUG_PATTERN.test(slug)
  const canDrop = canUploadMedia && slugOk && !uploading

  const upload = async (files: File[]) => {
    if (!files.length) return
    let done = 0
    for (const [i, file] of files.entries()) {
      setUploading(files.length - i)
      try {
        const path = await uploadMedia(slug, 'gallery', file)
        edit((list) => void list.push(path))
        done++
      } catch (e) {
        toast.error(`Unggah ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setUploading(0)
    if (fileRef.current) fileRef.current.value = ''
    if (done) toast.success(`${done} foto diunggah — simpan event agar tersimpan`)
  }

  const addUrl = () => {
    const v = url.trim()
    if (!v) return
    edit((list) => void list.push(v))
    setUrl('')
  }

  const moveTo = (from: number, to: number) =>
    edit((list) => {
      if (from === to || to < 0 || to >= list.length) return
      list.splice(to, 0, ...list.splice(from, 1))
    })

  const endDrag = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

  const src = (v: string) => (isLocalMedia(v) ? `/events/${slug}/${v}` : v)

  const hint = canUploadMedia
    ? slugOk
      ? `URL https://… atau unggah ke public/events/${slug}/${MEDIA_DIR}/ · kosongkan untuk menyembunyikan galeri`
      : 'Isi slug dulu untuk mengunggah file'
    : 'Kosongkan untuk menyembunyikan galeri'

  return (
    <FormField id={id} label={`Galeri foto (${value.length})`} hint={hint}>
      <div
        className={cn('relative rounded-lg', fileOver && 'ring-2 ring-primary ring-offset-2')}
        onDragOver={(e) => {
          if (!hasFiles(e) || !canDrop) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setFileOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false)
        }}
        onDrop={(e) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          setFileOver(false)
          if (canDrop) void upload(Array.from(e.dataTransfer.files))
        }}
      >
        {value.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
            {value.map((v, i) => (
              <li
                key={`${i}-${v}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(i))
                  setDragFrom(i)
                }}
                onDragOver={(e) => {
                  if (dragFrom === null) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOver(i)
                }}
                onDrop={(e) => {
                  if (dragFrom === null) return
                  e.preventDefault()
                  moveTo(dragFrom, i)
                  endDrag()
                }}
                onDragEnd={endDrag}
                className={cn(
                  'group relative aspect-[3/4] cursor-grab overflow-hidden rounded-md border bg-muted active:cursor-grabbing',
                  dragFrom === i && 'opacity-40',
                  dragOver === i && dragFrom !== i && 'ring-2 ring-primary',
                )}
              >
                <img
                  src={src(v)}
                  alt={`Foto ${i + 1}`}
                  loading="lazy"
                  draggable={false}
                  className="size-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="secondary"
                      disabled={i === 0}
                      onClick={() => moveTo(i, i - 1)}
                      aria-label={`Geser foto ${i + 1} ke kiri`}
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="secondary"
                      disabled={i === value.length - 1}
                      onClick={() => moveTo(i, i + 1)}
                      aria-label={`Geser foto ${i + 1} ke kanan`}
                    >
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="destructive"
                    onClick={() => edit((list) => void list.splice(i, 1))}
                    aria-label={`Hapus foto ${i + 1}`}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          canUploadMedia && (
            <button
              type="button"
              disabled={!canDrop}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} />
              Seret foto ke sini atau klik untuk memilih
            </button>
          )
        )}
        {fileOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 text-sm font-medium">
            Lepas untuk mengunggah
          </div>
        )}
      </div>
      <InputGroup>
        <InputGroupInput
          id={id}
          placeholder="https://….jpg"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addUrl()
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="ghost" disabled={!url.trim()} onClick={addUrl}>
            Tambah
          </InputGroupButton>
          {canUploadMedia && (
            <>
              <InputGroupButton
                variant="secondary"
                disabled={!slugOk || uploading > 0}
                onClick={() => fileRef.current?.click()}
                aria-label="Unggah foto galeri"
              >
                {uploading ? <Spinner /> : <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} />}
                {uploading ? `Sisa ${uploading}` : 'Unggah'}
              </InputGroupButton>
              <input
                ref={fileRef}
                type="file"
                hidden
                multiple
                accept={mediaAccept('gallery')}
                onChange={(e) => void upload(Array.from(e.target.files ?? []))}
              />
            </>
          )}
        </InputGroupAddon>
      </InputGroup>
    </FormField>
  )
}
