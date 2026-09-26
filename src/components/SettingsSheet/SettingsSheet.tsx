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
import { MOCK_ENABLED, type ApiSettings } from '@/core/api'
import { MockApp } from '@/core/api/mock'
import { useAuth } from '@/core/auth'
import { formatTanggal } from '@/core/domain/template'
import { useOptionalStore } from '@/core/store'
import { eventPaths } from '@/route.paths'

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
  const { settings, applySettings, app } = useAuth()
  // Inside an event page this also shows that event's summary.
  const store = useOptionalStore()
  const [form, setForm] = useState<ApiSettings>(settings)
  const ev = store?.meta?.event
  const backendChanged = form.mode !== settings.mode || form.url.trim() !== settings.url

  const apply = () => {
    if (form.mode === 'appsscript' && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(form.url.trim())) {
      toast.error('URL harus berupa URL /exec dari deployment Apps Script')
      return
    }
    applySettings({ ...form, url: form.url.trim() })
    if (backendChanged) toast.success(form.mode === 'mock' ? 'Memakai data contoh lokal — silakan login' : 'Sumber data diganti — silakan login')
    onDone()
  }

  const resetMock = async () => {
    // Events go back to the seed; logins survive so nobody is thrown out.
    if (!MOCK_ENABLED) return
    MockApp.reset()
    await store?.reload()
    toast.success('Data contoh dikembalikan ke awal')
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6">
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Sumber data</FieldLegend>
            {/* Data contoh exists only in development; a production build always uses the Google Sheet. */}
            {MOCK_ENABLED && (
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
            )}
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
                {backendChanged && (
                  <FieldDescription>Mengganti sumber data akan mengeluarkan sesi login saat ini.</FieldDescription>
                )}
              </>
            )}
          </FieldSet>

          {ev && store && (
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
                <Link to={eventPaths(store.slug).event} onClick={onDone} className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
                  Ubah data event
                </Link>
              </section>
            </>
          )}
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row flex-wrap justify-end border-t">
        {MOCK_ENABLED && app.kind === 'mock' && form.mode === 'mock' && (
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
