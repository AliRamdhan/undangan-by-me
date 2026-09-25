import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { ApiSettings } from '@/core/api'
import { MockApi } from '@/core/api/mock'
import { formatTanggal } from '@/core/domain/template'
import { useStore } from '@/core/store'

const SOURCES = [
  { value: 'mock', label: 'Data contoh', sub: 'Tersimpan di browser ini saja' },
  { value: 'appsscript', label: 'Google Sheet', sub: 'Lewat Apps Script Web App' },
] as const

/** Pengaturan as a right-hand sheet, opened from the ⚙ button in the header. */
export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="text-base">Pengaturan</SheetTitle>
          <SheetDescription>Sumber data aplikasi dan ringkasan event.</SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so each open starts from the saved settings, never a stale draft. */}
        <SettingsForm onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const { settings, applySettings, meta, api, reload } = useStore()
  const [form, setForm] = useState<ApiSettings>(settings)
  const ev = meta?.event

  const apply = () => {
    if (form.mode === 'appsscript' && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(form.url.trim())) {
      toast.error('URL harus berupa URL /exec dari deployment Apps Script')
      return
    }
    applySettings({ ...form, url: form.url.trim() })
    toast.success(form.mode === 'mock' ? 'Memakai data contoh lokal' : 'Terhubung ke Apps Script')
    onDone()
  }

  const resetMock = async () => {
    MockApi.reset()
    applySettings({ ...settings })
    await reload()
    toast.success('Data contoh dikembalikan ke awal')
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6">
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Sumber data</FieldLegend>
            <RadioGroup
              aria-label="Sumber data"
              value={form.mode}
              onValueChange={(v) => setForm((f) => ({ ...f, mode: v as ApiSettings['mode'] }))}
              className="grid grid-cols-2 gap-2"
            >
              {SOURCES.map((o) => (
                <FieldLabel key={o.value} htmlFor={`src-${o.value}`}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>{o.label}</FieldTitle>
                      <FieldDescription>{o.sub}</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value={o.value} id={`src-${o.value}`} />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
            {form.mode === 'appsscript' && (
              <>
                <Field>
                  <FieldLabel htmlFor="set-url">URL Web App (/exec)</FieldLabel>
                  <Input
                    id="set-url"
                    className="font-mono"
                    placeholder="https://script.google.com/macros/s/…/exec"
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  />
                  <FieldDescription>Deploy → Web app → Execute as: Me · Who has access: Anyone</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="set-key">Admin key</FieldLabel>
                  <Input
                    id="set-key"
                    type="password"
                    autoComplete="off"
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  />
                  <FieldDescription>
                    Nilai ADMIN_API_KEY di Script Properties. Hanya disimpan di tab ini (sessionStorage).
                  </FieldDescription>
                </Field>
              </>
            )}
          </FieldSet>

          {ev && (
            <>
              <Separator />
              <section className="flex flex-col gap-3">
                <h3 className="font-medium">Event (01_Event, baca saja)</h3>
                <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Nama</dt>
                  <dd>{ev.nama_event}</dd>
                  <dt className="text-muted-foreground">Tanggal</dt>
                  <dd>{formatTanggal(ev.tanggal_utama)}</dd>
                  <dt className="text-muted-foreground">Batas RSVP</dt>
                  <dd>{formatTanggal(ev.batas_rsvp)}</dd>
                  <dt className="text-muted-foreground">Link</dt>
                  <dd className="font-mono text-xs break-all">
                    {ev.domain.replace(/\/+$/, '')}/{ev.slug}/{'{PIN}'}
                  </dd>
                  <dt className="text-muted-foreground">Kontak</dt>
                  <dd>
                    {ev.cs.nama} · <span className="font-mono">{ev.cs.hp}</span>
                  </dd>
                </dl>
                <ul className="flex flex-col gap-2">
                  {ev.sesi.map((s) => (
                    <li key={s.kode} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">
                        {s.kode} · {s.label}
                      </p>
                      <p className="text-muted-foreground">
                        {formatTanggal(s.tanggal)}, {s.mulai}–{s.selesai} {ev.timezone}
                      </p>
                      <p className="text-ink-3">{s.tempat}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-3">Ubah data event di spreadsheet (01_Event), lalu Validasi Data Event.</p>
              </section>
            </>
          )}
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row flex-wrap justify-end border-t">
        {api.kind === 'mock' && form.mode === 'mock' && (
          <Button variant="ghost" className="mr-auto" onClick={resetMock}>
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon="inline-start" />
            Reset data contoh
          </Button>
        )}
        <Button variant="outline" onClick={onDone}>
          Batal
        </Button>
        <Button onClick={apply}>Terapkan</Button>
      </SheetFooter>
    </>
  )
}
