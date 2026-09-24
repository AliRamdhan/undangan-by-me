import { useState } from 'react'
import type { ApiSettings } from '../../api'
import { MockApi } from '../../api/mock'
import { Button, Drawer, Field, inputCls } from '../../components/ui'
import { formatTanggal } from '../../domain/template'
import { useStore } from '../../state/store'

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, applySettings, meta, api, reload, toast } = useStore()
  const [form, setForm] = useState<ApiSettings>(settings)
  const ev = meta?.event

  const apply = () => {
    if (form.mode === 'appsscript' && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(form.url.trim())) {
      toast('error', 'URL harus berupa URL /exec dari deployment Apps Script')
      return
    }
    applySettings({ ...form, url: form.url.trim() })
    toast('ok', form.mode === 'mock' ? 'Memakai data contoh lokal' : 'Terhubung ke Apps Script')
    onClose()
  }

  const resetMock = async () => {
    MockApi.reset()
    applySettings({ ...settings })
    await reload()
    toast('ok', 'Data contoh dikembalikan ke awal')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Pengaturan"
      footer={
        <>
          <Button onClick={onClose}>Tutup</Button>
          <Button variant="primary" onClick={apply}>
            Terapkan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Sumber data</h3>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sumber data">
            {(
              [
                ['mock', 'Data contoh', 'Tersimpan di browser ini saja'],
                ['appsscript', 'Google Sheet', 'Lewat Apps Script Web App'],
              ] as const
            ).map(([v, label, sub]) => (
              <label
                key={v}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 ${form.mode === v ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={v}
                  checked={form.mode === v}
                  onChange={() => setForm((f) => ({ ...f, mode: v }))}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-ink-3">{sub}</span>
              </label>
            ))}
          </div>
          {form.mode === 'appsscript' && (
            <>
              <Field label="URL Web App (/exec)" htmlFor="set-url" hint="Deploy → Web app → Execute as: Me · Who has access: Anyone">
                <input
                  id="set-url"
                  className={`${inputCls} font-mono text-xs`}
                  placeholder="https://script.google.com/macros/s/…/exec"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                />
              </Field>
              <Field
                label="Admin key"
                htmlFor="set-key"
                hint="Nilai ADMIN_API_KEY di Script Properties. Hanya disimpan di tab ini (sessionStorage)."
              >
                <input
                  id="set-key"
                  type="password"
                  autoComplete="off"
                  className={inputCls}
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                />
              </Field>
            </>
          )}
          {api.kind === 'mock' && form.mode === 'mock' && (
            <Button variant="ghost" size="sm" className="self-start" onClick={resetMock}>
              ↺ Reset data contoh
            </Button>
          )}
        </section>

        {ev && (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Event (01_Event, baca saja)</h3>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-ink-3">Nama</dt>
              <dd>{ev.nama_event}</dd>
              <dt className="text-ink-3">Tanggal</dt>
              <dd>{formatTanggal(ev.tanggal_utama)}</dd>
              <dt className="text-ink-3">Batas RSVP</dt>
              <dd>{formatTanggal(ev.batas_rsvp)}</dd>
              <dt className="text-ink-3">Link</dt>
              <dd className="font-mono text-xs break-all">
                {ev.domain.replace(/\/+$/, '')}/{ev.slug}/{'{PIN}'}
              </dd>
              <dt className="text-ink-3">Kontak</dt>
              <dd>
                {ev.cs.nama} · <span className="font-mono">{ev.cs.hp}</span>
              </dd>
            </dl>
            <ul className="flex flex-col gap-2">
              {ev.sesi.map((s) => (
                <li key={s.kode} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-medium">
                    {s.kode} · {s.label}
                  </p>
                  <p className="text-ink-2">
                    {formatTanggal(s.tanggal)}, {s.mulai}–{s.selesai} {ev.timezone}
                  </p>
                  <p className="text-ink-3">{s.tempat}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-3">Ubah data event di spreadsheet (01_Event), lalu Validasi Data Event.</p>
          </section>
        )}
      </div>
    </Drawer>
  )
}
