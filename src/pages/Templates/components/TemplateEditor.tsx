import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { WhatsAppBubble } from '@/components/WhatsAppBubble'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { HIDDEN_TOKENS, TOKENS, type RenderResult } from '@/core/domain/template'
import { /* HIDDEN(sementara): TEMPLATE_AKSES, */ TEMPLATE_TIPE, type Template } from '@/core/domain/types'
import { errorText, useStore } from '@/core/store'

type DraftRender = { key: string; result?: RenderResult; error?: string }

export function TemplateEditor({ template, isNew, onDone }: { template: Template; isNew: boolean; onDone: (id?: string) => void }) {
  const { api, run, busy, guests } = useStore()
  const [draft, setDraft] = useState<Template>(template)
  const [sampleId, setSampleId] = useState<string>(() => guests.find((g) => g.PIN && g.Nama)?.ID ?? '')
  const [render, setRender] = useState<DraftRender | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(template)

  const sample = guests.find((g) => g.ID === sampleId) ?? null
  const key = `${draft.Isi_Pesan}\u0000${sample?.ID}`

  // Debounced live render through the API — the backend renderer, not a local copy.
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      api
        .renderDraft(draft.Isi_Pesan, sample?.ID ?? null)
        .then((result) => alive && setRender({ key, result }))
        .catch((e: unknown) => alive && setRender({ key, error: errorText(e) }))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [api, draft.Isi_Pesan, sample, key])

  const insert = (token: string) => {
    const el = area.current
    const text = `{{${token}}}`
    const start = el?.selectionStart ?? draft.Isi_Pesan.length
    const end = el?.selectionEnd ?? start
    const body = draft.Isi_Pesan.slice(0, start) + text + draft.Isi_Pesan.slice(end)
    setDraft((d) => ({ ...d, Isi_Pesan: body }))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    })
  }

  const r = render?.result
  const invalid = !!r && (r.unknown.length > 0 || r.malformed)

  const save = async () => {
    if (!draft.Kode.trim()) {
      toast.error('Kode template wajib diisi')
      return
    }
    const saved = await run('Simpan template', (api) => api.saveTemplate(draft))
    if (saved) {
      toast.success(`Template ${saved.Kode} disimpan`)
      onDone(saved.ID)
    }
  }

  const remove = async () => {
    const ok = await run('Hapus template', (api) => api.deleteTemplate(template.ID).then(() => true))
    setConfirmDelete(false)
    if (ok) {
      toast.success(`Template ${template.Kode} dihapus`)
      onDone()
    }
  }

  const set = <K extends keyof Template>(k: K, v: Template[K]) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <Card>
        <CardContent>
          <FieldGroup>
            {/* HIDDEN(sementara): sm:grid-cols-4 while Akses is hidden */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="tpl-kode">Kode *</FieldLabel>
                <Input id="tpl-kode" className="font-mono" value={draft.Kode} onChange={(e) => set('Kode', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="tpl-tipe">Tipe</FieldLabel>
                <NativeSelect
                  id="tpl-tipe"
                  className="w-full"
                  value={draft.Tipe}
                  onChange={(e) => set('Tipe', e.target.value as Template['Tipe'])}
                >
                  {TEMPLATE_TIPE.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {t}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {/* HIDDEN(sementara): Akses — new templates stay SEMUA
              <Field>
                <FieldLabel htmlFor="tpl-akses">Akses</FieldLabel>
                <NativeSelect
                  id="tpl-akses"
                  className="w-full"
                  value={draft.Akses}
                  onChange={(e) => set('Akses', e.target.value as Template['Akses'])}
                >
                  {TEMPLATE_AKSES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {t}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              */}
              <Field orientation="horizontal" className="self-end pb-1.5">
                <Checkbox id="tpl-aktif" checked={draft.Aktif} onCheckedChange={(on) => set('Aktif', on)} />
                <FieldLabel htmlFor="tpl-aktif">Aktif</FieldLabel>
              </Field>
            </div>

            <Field>
              <FieldTitle>Sisipkan token</FieldTitle>
              <div className="flex flex-col gap-2">
                {TOKENS.map((g) => (
                  <div key={g.group} className="flex flex-wrap items-center gap-1">
                    <span className="w-14 shrink-0 text-muted-foreground">{g.group}</span>
                    {/* HIDDEN(sementara): HIDDEN_TOKENS filter */}
                    {g.tokens.filter((t) => !HIDDEN_TOKENS.has(t)).map((t) => (
                      <Button key={t} variant="outline" size="xs" className="font-mono" onClick={() => insert(t)}>
                        {t.includes('.') ? t.split('.')[1] : t}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            </Field>

            <Field data-invalid={invalid}>
              <FieldLabel htmlFor="tpl-isi">Isi pesan</FieldLabel>
              <Textarea
                id="tpl-isi"
                ref={area}
                rows={14}
                spellCheck={false}
                aria-invalid={invalid}
                className="font-mono text-[13px] leading-relaxed"
                value={draft.Isi_Pesan}
                onChange={(e) => set('Isi_Pesan', e.target.value)}
              />
              {invalid && r ? (
                <FieldError>
                  {r.unknown.length > 0 && (
                    <>
                      Token tidak dikenal:{' '}
                      {r.unknown.map((t) => (
                        <code key={t} className="mr-1 font-mono">{`{{${t}}}`}</code>
                      ))}
                    </>
                  )}
                  {r.malformed && <span className="block">Ada {'{{'} atau {'}}'} tanpa pasangan.</span>}
                </FieldError>
              ) : (
                <FieldDescription>
                  Format WhatsApp: *tebal*, _miring_, ~coret~. Token {'{{…}}'} yang tidak dikenal akan ditolak, bukan dikirim
                  kosong.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="tpl-img">URL gambar header (opsional)</FieldLabel>
              <Input
                id="tpl-img"
                value={draft.Header_Image_URL}
                onChange={(e) => set('Header_Image_URL', e.target.value)}
                placeholder="https://…"
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap gap-2 border-t">
          {!isNew && (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
              Hapus
            </Button>
          )}
          <span className="ml-auto" />
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(template)}>
              Buang perubahan
            </Button>
          )}
          <Button onClick={save} disabled={!!busy || (!dirty && !isNew) || invalid} title={invalid ? 'Perbaiki token dulu' : undefined}>
            {isNew ? 'Buat template' : 'Simpan'}
          </Button>
        </CardFooter>
      </Card>

      <Card className="self-start xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardAction>
            <NativeSelect aria-label="Tamu contoh" size="sm" className="w-44" value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
              <NativeSelectOption value="">Tamu contoh (dummy)</NativeSelectOption>
              {guests
                .filter((g) => g.PIN && g.Nama)
                .map((g) => (
                  <NativeSelectOption key={g.ID} value={g.ID}>
                    {g.Nama} {/* HIDDEN(sementara): · {g.Akses} */}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </CardAction>
        </CardHeader>
        <CardContent>
          {render?.error ? (
            <p className="text-critical-ink">{render.error}</p>
          ) : r ? (
            <div className="flex flex-col gap-3">
              <WhatsAppBubble text={r.text} />
              {r.empty.length > 0 && (
                <p className="text-warning-ink">⚠ Kosong untuk tamu ini: {r.empty.map((t) => `{{${t}}}`).join(', ')}</p>
              )}
              <p className="text-muted-foreground">{r.text.length} karakter</p>
            </div>
          ) : (
            <Skeleton className="h-64 rounded-xl" />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus template {template.Kode}?</AlertDialogTitle>
            <AlertDialogDescription>Tamu dengan akses ini akan memakai template SEMUA sebagai gantinya.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={!!busy}>
              Ya, hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
