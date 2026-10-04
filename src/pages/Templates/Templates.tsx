import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import type { TemplateReport } from '@/core/api/types'
import { Badge } from '@/components/ui/badge'
import { FileSearchIcon, Link04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Template } from '@/core/domain/types'
import { GenerateLinksDialog } from '@/components/GenerateLinksDialog'
import { TemplateEditor } from '@/components/TemplateEditor'
import { useAuth } from '@/core/auth'
import { useStore } from '@/core/store'
import { ValidateReport } from './components/ValidateReport'
import { eventPaths, PATHS, templatePath } from '@/route.paths'

/**
 * An event's templates: the SUPER_ADMIN's master templates (menu Template).
 * Saving here writes the event's own version (text, header image, Aktif);
 * templates are never created or deleted per event.
 */
export function Templates() {
  const { api, eventId, templates, guests, run, busy, loading } = useStore()
  const { isSuperAdmin } = useAuth()
  // The selected template lives in the URL (/template/:templateId), so it is linkable and survives refresh.
  const selected = useParams().templateId ?? null
  const navigate = useNavigate()
  const setSelected = (id: string | null, replace = false) =>
    navigate(id ? templatePath(eventId, id) : eventPaths(eventId).template, { replace })
  const [report, setReport] = useState<TemplateReport[] | null>(null)
  const [linksOpen, setLinksOpen] = useState(false)
  const renderDraft = useCallback((body: string, guestId: string | null) => api.renderDraft(body, guestId), [api])

  const current = templates.find((t) => t.ID === selected) ?? templates[0] ?? null

  const validate = async () => {
    const r = await run('Validasi Template', (api) => api.validateTemplates())
    if (r) setReport(r)
  }

  const save = async (draft: Template) => {
    const saved = await run('Simpan template', (api) => api.saveTemplate(draft))
    if (saved) toast.success(`Template ${saved.Kode} disimpan`)
  }

  const reset = async (t: Template) => {
    const saved = await run('Kembalikan ke master', (api) => api.resetTemplate(t.ID))
    if (saved) toast.success(`Template ${saved.Kode} kembali mengikuti master`)
    return saved
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={validate} disabled={!!busy}>
          <HugeiconsIcon icon={FileSearchIcon} strokeWidth={2} data-icon="inline-start" />
          Validasi Template
        </Button>
        <Button variant="outline" onClick={() => setLinksOpen(true)} disabled={!!busy}>
          <HugeiconsIcon icon={Link04Icon} strokeWidth={2} data-icon="inline-start" />
          Generate Link Manual
        </Button>
        {/* HIDDEN(sementara): Akses is hidden
        <p className="text-xs text-muted-foreground sm:ml-auto">Lookup: (Tipe, Akses) → fallback (Tipe, SEMUA)</p>
        */}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card size="sm" className="self-start">
        <CardContent className="px-2">
        <nav aria-label="Daftar template" className="flex flex-col gap-1">
          {loading && <Skeleton className="h-40" />}
          {!loading && templates.length === 0 && <p className="p-3 text-muted-foreground">Belum ada template.</p>}
          {templates.map((t) => {
            const active = current?.ID === t.ID
            return (
              <button
                key={t.ID}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => setSelected(t.ID)}
                className={cn('flex flex-col gap-1 rounded-md px-3 py-2 text-left', active ? 'bg-primary-soft' : 'hover:bg-muted')}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-medium">{t.Kode}</span>
                  {!t.Aktif && <Badge variant="muted">nonaktif</Badge>}
                  {t.Custom && <Badge variant="muted">disesuaikan</Badge>}
                </span>
                {/* HIDDEN(sementara): {t.Tipe} · {t.Akses} */}
                <span className="text-muted-foreground">{t.Tipe}</span>
              </button>
            )
          })}
        </nav>
        </CardContent>
        </Card>

        {current ? (
          <TemplateEditor
            key={current.ID}
            template={current}
            lockIdentity
            guests={guests}
            renderDraft={renderDraft}
            busy={!!busy}
            onSave={save}
            onReset={() => reset(current)}
          />
        ) : (
          !loading && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Belum ada template</EmptyTitle>
                <EmptyDescription>
                  Template dibuat oleh Super Admin di menu Template dan otomatis tersedia untuk setiap event.
                </EmptyDescription>
              </EmptyHeader>
              {isSuperAdmin && (
                <EmptyContent>
                  <Link to={PATHS.templates} className={buttonVariants({ variant: 'outline' })}>
                    Kelola template master
                  </Link>
                </EmptyContent>
              )}
            </Empty>
          )
        )}
      </div>

      <ValidateReport report={report} onClose={() => setReport(null)} />
      <GenerateLinksDialog open={linksOpen} onClose={() => setLinksOpen(false)} selection={null} />
    </div>
  )
}
