import { Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { TemplateEditor } from '@/components/TemplateEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/core/auth'
import type { Guest, Template } from '@/core/domain/types'
import { errorText, useEventList } from '@/core/store'
import { cn } from '@/lib/utils'
import { masterTemplatePath, PATHS } from '@/route.paths'

const NEW: Template = {
  ID: '',
  Kode: '',
  Tipe: 'UNDANGAN',
  Akses: 'SEMUA',
  Bahasa: 'id',
  Header_Image_URL: '',
  Isi_Pesan: '{{greet}} {{tamu.gelar}} *{{tamu.nama}}*,\n\n',
  Aktif: true,
}

/**
 * /admin/templates — SUPER_ADMIN's master templates (03_Template rows with a
 * blank Event). Every event has every master; an edit reaches every event that
 * has not saved its own version. The preview renders against a chosen event.
 */
export function MasterTemplates() {
  const { app } = useAuth()
  const { events } = useEventList()
  const selected = useParams().templateId ?? null
  const navigate = useNavigate()
  const setSelected = (id: string | null, replace = false) => navigate(id ? masterTemplatePath(id) : PATHS.templates, { replace })
  const [masters, setMasters] = useState<Template[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  // Preview event: picked, else the first one. Its guests are the sample guests.
  const [pickedEvent, setPickedEvent] = useState('')
  const eventId = events?.some((e) => e.id === pickedEvent) ? pickedEvent : (events?.[0]?.id ?? '')
  const [sampleGuests, setSampleGuests] = useState<{ eventId: string; guests: Guest[] }>({ eventId: '', guests: [] })
  const guests = sampleGuests.eventId === eventId ? sampleGuests.guests : []

  const reload = useCallback(async () => {
    try {
      setMasters(await app.listMasterTemplates())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
  }, [app])

  useEffect(() => {
    // Fetch on mount and whenever the session/backend changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  useEffect(() => {
    if (!eventId) return
    let alive = true
    app
      .forEvent(eventId)
      .listGuests()
      .then((guests) => alive && setSampleGuests({ eventId, guests }))
      .catch(() => alive && setSampleGuests({ eventId, guests: [] }))
    return () => {
      alive = false
    }
  }, [app, eventId])

  const renderDraft = useCallback(
    (body: string, guestId: string | null) =>
      eventId ? app.forEvent(eventId).renderDraft(body, guestId) : Promise.reject(new Error('Buat event dulu untuk melihat preview')),
    [app, eventId],
  )

  const current = creating ? null : ((masters ?? []).find((t) => t.ID === selected) ?? masters?.[0] ?? null)
  const eventCount = events?.length ?? 0

  const act = async <T,>(label: string, fn: () => Promise<T>) => {
    setBusy(true)
    try {
      return await fn()
    } catch (e) {
      toast.error(`${label}: ${errorText(e)}`)
      return undefined
    } finally {
      await reload()
      setBusy(false)
    }
  }

  const save = async (draft: Template) => {
    const res = await act('Simpan template', () => app.saveMasterTemplate(draft))
    if (!res) return
    if (!draft.ID) {
      toast.success(`Template ${res.template.Kode} dibuat · tersedia di ${eventCount} event`)
      setCreating(false)
      setSelected(res.template.ID, true)
    } else {
      const kept = res.custom ? ` · ${res.custom} event tetap memakai versinya sendiri` : ''
      toast.success(`Template ${res.template.Kode} disimpan${kept}`)
    }
  }

  const remove = async (t: Template) => {
    const res = await act('Hapus template', () => app.deleteMasterTemplate(t.ID))
    if (!res) return
    toast.success(`Template ${t.Kode} dihapus dari semua event`)
    setSelected(null, true)
  }

  const eventPicker = (
    <NativeSelect aria-label="Event untuk preview" size="sm" className="w-44" value={eventId} onChange={(e) => setPickedEvent(e.target.value)}>
      {(events ?? []).map((ev) => (
        <NativeSelectOption key={ev.id} value={ev.id}>
          {ev.nama_event || ev.slug}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )

  const editorProps = {
    guests,
    renderDraft,
    scope: eventId,
    previewAction: eventCount > 1 ? eventPicker : undefined,
    busy,
    onSave: save,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-wide text-primary uppercase">Template</h1>
          <p className="text-muted-foreground">
            Template master otomatis tersedia di setiap event. Klien hanya bisa mengubah isi pesan, gambar header dan status aktif.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)} disabled={!masters}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          Template baru
        </Button>
      </div>
      <Separator />

      {error ? (
        <Empty role="alert" className="mt-16">
          <EmptyHeader>
            <EmptyTitle>Gagal memuat template</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => void reload()}>
              Coba lagi
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card size="sm" className="self-start">
            <CardContent className="px-2">
              <nav aria-label="Daftar template master" className="flex flex-col gap-1">
                {!masters && <Skeleton className="h-40" />}
                {masters?.length === 0 && <p className="p-3 text-muted-foreground">Belum ada template.</p>}
                {(masters ?? []).map((t) => {
                  const active = !creating && current?.ID === t.ID
                  return (
                    <button
                      key={t.ID}
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => {
                        setCreating(false)
                        setSelected(t.ID)
                      }}
                      className={cn('flex flex-col gap-1 rounded-md px-3 py-2 text-left', active ? 'bg-primary-soft' : 'hover:bg-muted')}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-medium">{t.Kode}</span>
                        {!t.Aktif && <Badge variant="muted">nonaktif</Badge>}
                      </span>
                      <span className="text-muted-foreground">{t.Tipe}</span>
                    </button>
                  )
                })}
              </nav>
            </CardContent>
          </Card>

          {creating ? (
            <TemplateEditor key="new" template={NEW} isNew {...editorProps} />
          ) : current ? (
            <TemplateEditor
              key={current.ID}
              template={current}
              {...editorProps}
              onDelete={() => remove(current)}
              deleteDescription={`Template ini hilang dari ${eventCount} event, termasuk versi yang sudah disesuaikan klien.`}
            />
          ) : (
            masters && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Belum ada template</EmptyTitle>
                  <EmptyDescription>Buat template pertama untuk tipe UNDANGAN; template langsung tersedia di semua event.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          )}
        </div>
      )}
    </div>
  )
}
