import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { PATHS } from '@/route.paths'

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
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">Event</h3>
                <p className="text-muted-foreground">
                  {ev.nama_event || '(belum diisi)'} · {ev.tanggal_utama ? formatTanggal(ev.tanggal_utama) : 'tanggal belum diisi'}
                </p>
                <p className="font-mono text-xs break-all text-ink-3">
                  {ev.domain.replace(/\/+$/, '')}/{ev.slug}/{'{PIN}'}
                </p>
                <Link to={PATHS.event} onClick={onDone} className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
                  Ubah data event
                </Link>
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
