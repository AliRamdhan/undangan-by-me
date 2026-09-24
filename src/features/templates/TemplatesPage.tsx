import { useEffect, useRef, useState } from 'react'
import { refOf, type TemplateReport } from '../../api/types'
import { WhatsAppBubble } from '../../components/WhatsAppText'
import { Badge, Button, Card, Dialog, EmptyState, Field, fieldBase, inputCls } from '../../components/ui'
import { TOKENS, type RenderResult } from '../../domain/template'
import { TEMPLATE_AKSES, TEMPLATE_TIPE, type Template } from '../../domain/types'
import { errorText } from '../../state/errors'
import { useStore } from '../../state/store'
import { LinksDialog } from './LinksDialog'

const NEW: Template = {
  Kode: '',
  Tipe: 'UNDANGAN',
  Akses: 'SEMUA',
  Bahasa: 'id',
  Header_Image_URL: '',
  Isi_Pesan: '{{greet}} {{tamu.gelar}} *{{tamu.nama}}*,\n\n',
  Aktif: true,
}

type DraftRender = { key: string; result?: RenderResult; error?: string }

function TemplateEditor({ template, isNew, onDone }: { template: Template; isNew: boolean; onDone: (kode?: string) => void }) {
  const { api, run, busy, toast, guests } = useStore()
  const [draft, setDraft] = useState<Template>(template)
  const [pin, setPin] = useState<string>(() => guests.find((g) => g.PIN && g.Nama)?.PIN ?? '')
  const [render, setRender] = useState<DraftRender | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(template)

  const sample = guests.find((g) => g.PIN === pin) ?? null
  const key = `${draft.Isi_Pesan}\u0000${sample?.No}|${sample?.PIN}`

  // Debounced live render through the API — the backend renderer, not a local copy.
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      api
        .renderDraft(draft.Isi_Pesan, sample ? refOf(sample) : null)
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
      toast('error', 'Kode template wajib diisi')
      return
    }
    const ok = await run('Simpan template', (api) => api.saveTemplate(draft, isNew ? undefined : template.Kode).then(() => true))
    if (ok) {
      toast('ok', `Template ${draft.Kode} disimpan`)
      onDone(draft.Kode.trim())
    }
  }

  const remove = async () => {
    const ok = await run('Hapus template', (api) => api.deleteTemplate(template.Kode).then(() => true))
    if (ok) {
      toast('ok', `Template ${template.Kode} dihapus`)
      onDone()
    }
  }

  const set = <K extends keyof Template>(k: K, v: Template[K]) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Kode *" htmlFor="tpl-kode">
              <input id="tpl-kode" className={`${inputCls} font-mono`} value={draft.Kode} onChange={(e) => set('Kode', e.target.value)} />
            </Field>
            <Field label="Tipe" htmlFor="tpl-tipe">
              <select id="tpl-tipe" className={inputCls} value={draft.Tipe} onChange={(e) => set('Tipe', e.target.value as Template['Tipe'])}>
                {TEMPLATE_TIPE.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Akses" htmlFor="tpl-akses">
              <select id="tpl-akses" className={inputCls} value={draft.Akses} onChange={(e) => set('Akses', e.target.value as Template['Akses'])}>
                {TEMPLATE_AKSES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Status" htmlFor="tpl-aktif">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  id="tpl-aktif"
                  type="checkbox"
                  checked={draft.Aktif}
                  onChange={(e) => set('Aktif', e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Aktif
              </label>
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Sisipkan token</p>
            <div className="flex flex-col gap-2">
              {TOKENS.map((g) => (
                <div key={g.group} className="flex flex-wrap items-center gap-1">
                  <span className="w-14 shrink-0 text-xs text-ink-3">{g.group}</span>
                  {g.tokens.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => insert(t)}
                      className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2 hover:border-accent hover:text-accent"
                    >
                      {t.includes('.') ? t.split('.')[1] : t}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <Field
            label="Isi pesan"
            htmlFor="tpl-isi"
            hint="Format WhatsApp: *tebal*, _miring_, ~coret~. Token {{…}} yang tidak dikenal akan ditolak, bukan dikirim kosong."
          >
            <textarea
              id="tpl-isi"
              ref={area}
              rows={14}
              spellCheck={false}
              className={`${fieldBase} w-full py-2 font-mono text-[13px] leading-relaxed ${invalid ? 'border-critical' : ''}`}
              value={draft.Isi_Pesan}
              onChange={(e) => set('Isi_Pesan', e.target.value)}
            />
          </Field>
          {r && (r.unknown.length > 0 || r.malformed) && (
            <p role="alert" className="rounded-lg tint-critical p-3 text-sm text-critical-ink">
              {r.unknown.length > 0 && (
                <>
                  Token tidak dikenal:{' '}
                  {r.unknown.map((t) => (
                    <code key={t} className="mr-1 font-mono">{`{{${t}}}`}</code>
                  ))}
                </>
              )}
              {r.malformed && <span className="block">Ada {'{{'} atau {'}}'} tanpa pasangan.</span>}
            </p>
          )}
          <Field label="URL gambar header (opsional)" htmlFor="tpl-img">
            <input id="tpl-img" className={inputCls} value={draft.Header_Image_URL} onChange={(e) => set('Header_Image_URL', e.target.value)} placeholder="https://…" />
          </Field>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {!isNew &&
              (confirmDelete ? (
                <>
                  <span className="text-sm text-critical-ink">Hapus {template.Kode}?</span>
                  <Button size="sm" onClick={() => setConfirmDelete(false)}>
                    Batal
                  </Button>
                  <Button size="sm" variant="danger" onClick={remove} disabled={!!busy}>
                    Ya, hapus
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
                  Hapus
                </Button>
              ))}
            <span className="ml-auto" />
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(template)}>
                Buang perubahan
              </Button>
            )}
            <Button
              variant="primary"
              onClick={save}
              disabled={!!busy || (!dirty && !isNew) || invalid}
              title={invalid ? 'Perbaiki token dulu' : undefined}
            >
              {isNew ? 'Buat template' : 'Simpan'}
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="Preview"
        className="self-start xl:sticky xl:top-4"
        action={
          <select
            aria-label="Tamu contoh"
            className={`${fieldBase} h-8 w-44 text-[13px]`}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          >
            <option value="">Tamu contoh (dummy)</option>
            {guests
              .filter((g) => g.PIN && g.Nama)
              .map((g) => (
                <option key={`${g.No}-${g.PIN}`} value={g.PIN}>
                  {g.Nama} · {g.Akses}
                </option>
              ))}
          </select>
        }
      >
        {render?.error ? (
          <p className="text-sm text-critical-ink">{render.error}</p>
        ) : r ? (
          <div className="flex flex-col gap-3">
            <WhatsAppBubble text={r.text} />
            {r.empty.length > 0 && (
              <p className="text-xs text-warning-ink">
                ⚠ Kosong untuk tamu ini: {r.empty.map((t) => `{{${t}}}`).join(', ')}
              </p>
            )}
            <p className="text-xs text-ink-3">{r.text.length} karakter</p>
          </div>
        ) : (
          <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
        )}
      </Card>
    </div>
  )
}

function ValidateReport({ report, onClose }: { report: TemplateReport[] | null; onClose: () => void }) {
  const bad = (report ?? []).filter((r) => r.unknown.length || r.malformed)
  return (
    <Dialog open={report !== null} onClose={onClose} wide title="Validasi Template">
      <p className="mb-4 text-sm text-ink-2">
        Semua template aktif di-render coba ke setiap tamu yang cocok.{' '}
        {bad.length === 0 ? (
          <b className="text-good-ink">✓ Semua lolos.</b>
        ) : (
          <b className="text-critical-ink">{bad.length} template tidak bisa dikirim.</b>
        )}
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {(report ?? []).map((r) => {
          const ok = !r.unknown.length && !r.malformed
          return (
            <li key={r.kode} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ok ? 'good' : 'critical'}>{ok ? '✓ Lolos' : '! Gagal'}</Badge>
                <span className="font-mono font-medium">{r.kode}</span>
                <span className="text-ink-3">
                  {r.tipe} · {r.akses} · {r.rendered} tamu
                </span>
              </div>
              {r.unknown.length > 0 && (
                <p className="text-critical-ink">Token tidak dikenal: {r.unknown.map((t) => `{{${t}}}`).join(', ')}</p>
              )}
              {r.malformed && <p className="text-critical-ink">Kurung kurawal tidak seimbang</p>}
              {r.empty.length > 0 && (
                <p className="text-warning-ink">⚠ Selalu kosong (data event belum diisi?): {r.empty.map((t) => `{{${t}}}`).join(', ')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}

export function TemplatesPage() {
  const { templates, run, busy, loading } = useStore()
  const [selected, setSelected] = useState<string | null>(null)
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
              if (kode) setSelected(kode)
            }}
          />
        ) : current ? (
          <TemplateEditor
            key={current.Kode}
            template={current}
            isNew={false}
            onDone={(kode) => setSelected(kode ?? null)}
          />
        ) : (
          !loading && (
            <EmptyState title="Belum ada template">Buat template pertama untuk tipe UNDANGAN, akses SEMUA.</EmptyState>
          )
        )}
      </div>

      <ValidateReport report={report} onClose={() => setReport(null)} />
      <LinksDialog open={linksOpen} onClose={() => setLinksOpen(false)} selection={null} />
    </div>
  )
}
