import { useEffect, useRef, useState } from 'react'
import { refOf } from '@/core/api/types'
import { WhatsAppBubble } from '@/components/WhatsAppBubble'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { fieldBase, inputCls } from '@/components/Input'
import { TOKENS, type RenderResult } from '@/core/domain/template'
import { TEMPLATE_AKSES, TEMPLATE_TIPE, type Template } from '@/core/domain/types'
import { errorText, useStore } from '@/core/store'

type DraftRender = { key: string; result?: RenderResult; error?: string }

export function TemplateEditor({ template, isNew, onDone }: { template: Template; isNew: boolean; onDone: (kode?: string) => void }) {
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
