import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { TemplateReport } from '@/core/api/types'
import { Badge } from '@/components/ui/badge'
import { Add01Icon, FileSearchIcon, Link04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Template } from '@/core/domain/types'
import { GenerateLinksDialog } from '@/components/GenerateLinksDialog'
import { useStore } from '@/core/store'
import { TemplateEditor } from './components/TemplateEditor'
import { ValidateReport } from './components/ValidateReport'
import { PATHS, templatePath } from '@/route.paths'

const NEW: Template = {
  Kode: '',
  Tipe: 'UNDANGAN',
  Akses: 'SEMUA',
  Bahasa: 'id',
  Header_Image_URL: '',
  Isi_Pesan: '{{greet}} {{tamu.gelar}} *{{tamu.nama}}*,\n\n',
  Aktif: true,
}

export function Templates() {
  const { templates, run, busy, loading } = useStore()
  // The selected template lives in the URL (/template/:kode), so it is linkable and survives refresh.
  const selected = useParams().kode ?? null
  const navigate = useNavigate()
  const setSelected = (kode: string | null, replace = false) =>
    navigate(kode ? templatePath(kode) : PATHS.template, { replace })
  const [creating, setCreating] = useState(false)
  const [report, setReport] = useState<TemplateReport[] | null>(null)
  const [linksOpen, setLinksOpen] = useState(false)

  const current = creating ? null : (templates.find((t) => t.Kode === selected) ?? templates[0] ?? null)

  const validate = async () => {
    const r = await run('Validasi Template', (api) => api.validateTemplates())
    if (r) setReport(r)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={() => setCreating(true)}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          Template baru
        </Button>
        <Button variant="outline" onClick={validate} disabled={!!busy}>
          <HugeiconsIcon icon={FileSearchIcon} strokeWidth={2} data-icon="inline-start" />
          Validasi Template
        </Button>
        <Button variant="outline" onClick={() => setLinksOpen(true)} disabled={!!busy}>
          <HugeiconsIcon icon={Link04Icon} strokeWidth={2} data-icon="inline-start" />
          Generate Link Manual
        </Button>
        <p className="text-xs text-muted-foreground sm:ml-auto">Lookup: (Tipe, Akses) → fallback (Tipe, SEMUA)</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card size="sm" className="self-start">
        <CardContent className="px-2">
        <nav aria-label="Daftar template" className="flex flex-col gap-1">
          {loading && <Skeleton className="h-40" />}
          {!loading && templates.length === 0 && <p className="p-3 text-muted-foreground">Belum ada template.</p>}
          {templates.map((t) => {
            const active = !creating && current?.Kode === t.Kode
            return (
              <button
                key={t.Kode}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  setCreating(false)
                  setSelected(t.Kode)
                }}
                className={cn('flex flex-col gap-1 rounded-md px-3 py-2 text-left', active ? 'bg-primary-soft' : 'hover:bg-muted')}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-medium">{t.Kode}</span>
                  {!t.Aktif && <Badge variant="muted">nonaktif</Badge>}
                </span>
                <span className="text-muted-foreground">
                  {t.Tipe} · {t.Akses}
                </span>
              </button>
            )
          })}
        </nav>
        </CardContent>
        </Card>

        {creating ? (
          <TemplateEditor
            key="new"
            template={NEW}
            isNew
            onDone={(kode) => {
              setCreating(false)
              if (kode) setSelected(kode, true)
            }}
          />
        ) : current ? (
          <TemplateEditor
            key={current.Kode}
            template={current}
            isNew={false}
            onDone={(kode) => setSelected(kode ?? null, true)}
          />
        ) : (
          !loading && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Belum ada template</EmptyTitle>
                <EmptyDescription>Buat template pertama untuk tipe UNDANGAN, akses SEMUA.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        )}
      </div>

      <ValidateReport report={report} onClose={() => setReport(null)} />
      <GenerateLinksDialog open={linksOpen} onClose={() => setLinksOpen(false)} selection={null} />
    </div>
  )
}
