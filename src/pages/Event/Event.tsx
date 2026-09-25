import { Alert02Icon, FloppyDiskIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { validateEvent, withEventDefaults } from '@/core/domain/event'
import type { EventInfo } from '@/core/domain/types'
import { useStore } from '@/core/store'
import { CoupleCard } from './components/CoupleCard'
import { EventDataCard } from './components/EventDataCard'
import { GiftMediaCard } from './components/GiftMediaCard'
import { SessionsCard } from './components/SessionsCard'
import type { SectionProps } from './components/form'

export function EventPage() {
  const { meta, loading } = useStore()
  if (loading || !meta) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[480px] rounded-xl" />
        <Skeleton className="h-[480px] rounded-xl" />
      </div>
    )
  }
  const saved = withEventDefaults(meta.event)
  // Remount on every saved version so the draft always starts from what the sheet holds.
  return <EventForm key={JSON.stringify(saved)} saved={saved} />
}

function EventForm({ saved }: { saved: EventInfo }) {
  const { run, busy } = useStore()
  const [draft, setDraft] = useState<EventInfo>(saved)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const errors = validateEvent(draft)
  const errorCount = Object.keys(errors).length
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const linkChanged = draft.slug !== saved.slug || draft.domain !== saved.domain

  const section: SectionProps = {
    draft,
    update: (fn) =>
      setDraft((d) => {
        const next = structuredClone(d)
        fn(next)
        return next
      }),
    err: (path) => (submitted || touched.has(path) ? errors[path] : undefined),
    touch: (path) => () => setTouched((t) => (t.has(path) ? t : new Set(t).add(path))),
  }

  const save = async () => {
    setSubmitted(true)
    if (errorCount) {
      toast.error(`Data event belum lengkap — periksa ${errorCount} isian bertanda merah`)
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      return
    }
    const ok = await run('Simpan event', (api) => api.saveEvent(draft))
    if (ok) toast.success('Data event disimpan')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-wide text-primary uppercase">Data Event</h1>
        <p className="text-muted-foreground">
          Isi dulu sebelum tamu dan template — setara 01_Event + Validasi Data Event di spreadsheet.
        </p>
        <Separator className="mt-3" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CoupleCard {...section} />
        <EventDataCard {...section} />
      </div>
      <SessionsCard {...section} />
      <GiftMediaCard {...section} />

      <div className="sticky bottom-0 z-20 -mx-4 mt-2 flex flex-wrap items-center gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={dirty ? 'font-medium' : 'text-muted-foreground'}>
            {dirty ? 'Ada perubahan yang belum disimpan' : 'Semua perubahan tersimpan'}
            {submitted && errorCount > 0 && <span className="text-destructive"> · {errorCount} isian perlu diperbaiki</span>}
          </span>
          {linkChanged && (
            <span className="flex items-center gap-1 text-warning-ink">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5" />
              Domain/slug berubah — semua link undangan ikut berubah, link yang sudah terkirim tidak berlaku lagi.
            </span>
          )}
        </div>
        {dirty && (
          <Button variant="ghost" onClick={() => {
            setDraft(saved)
            setTouched(new Set())
            setSubmitted(false)
          }}>
            Buang perubahan
          </Button>
        )}
        <Button size="lg" onClick={save} disabled={!dirty || !!busy}>
          {busy ? <Spinner data-icon="inline-start" /> : <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} data-icon="inline-start" />}
          Simpan
        </Button>
      </div>
    </div>
  )
}
