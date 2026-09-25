import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { TemplateReport } from '@/core/api/types'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
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
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Template baru
        </Button>
        <Button onClick={validate} disabled={!!busy}>
          Validasi Template
        </Button>
        <Button onClick={() => setLinksOpen(true)} disabled={!!busy}>
          Generate Link Manual
        </Button>
        <p className="text-sm text-ink-3 sm:ml-auto">Lookup: (Tipe, Akses) → fallback (Tipe, SEMUA)</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Daftar template" className="flex flex-col gap-1 self-start rounded-2xl border border-line bg-surface p-2">
          {loading && <div className="h-40 animate-pulse rounded-lg bg-surface-2" />}
          {!loading && templates.length === 0 && <p className="p-3 text-sm text-ink-3">Belum ada template.</p>}
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
                className={`flex flex-col gap-1 rounded-lg px-3 py-2 text-left ${active ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-medium">{t.Kode}</span>
                  {!t.Aktif && <Badge tone="muted">nonaktif</Badge>}
                </span>
                <span className="text-xs text-ink-3">
                  {t.Tipe} · {t.Akses}
                </span>
              </button>
            )
          })}
        </nav>

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
            <EmptyState title="Belum ada template">Buat template pertama untuk tipe UNDANGAN, akses SEMUA.</EmptyState>
          )
        )}
      </div>

      <ValidateReport report={report} onClose={() => setReport(null)} />
      <GenerateLinksDialog open={linksOpen} onClose={() => setLinksOpen(false)} selection={null} />
    </div>
  )
}
