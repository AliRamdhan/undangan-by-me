import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { DatePicker } from '@/components/DatePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { blankSession } from '@/core/domain/event'
import type { Session } from '@/core/domain/types'
import { FormField, TextField, type SectionProps } from './form'

const TEXT_FIELDS: { key: keyof Session; label: string; placeholder: string; wide?: boolean }[] = [
  { key: 'tempat', label: 'Nama tempat', placeholder: 'Masjid Al-Azhar' },
  { key: 'dress_code', label: 'Dress code', placeholder: 'Putih' },
  { key: 'alamat', label: 'Alamat', placeholder: 'Jl. …', wide: true },
  { key: 'maps', label: 'Link Google Maps', placeholder: 'https://maps.app.goo.gl/…' },
  { key: 'live_stream', label: 'Link live stream', placeholder: 'https://youtube.com/…' },
]

/** #A.3 — the 01_Event session table (row 32): one row per session, a third is just another row. */
export function SessionsCard({ draft, update, err, touch }: SectionProps) {
  const renumber = (list: Session[]) => list.map((s, i) => ({ ...s, kode: `S${i + 1}` }))

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          Sesi Acara
          <Badge variant="secondary" className="font-mono">
            #A.3
          </Badge>
        </CardTitle>
        <CardDescription>Dipakai token {'{{sesi1.*}}'} dan {'{{sesi2.*}}'} di template pesan.</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            onClick={() =>
              update((d) => {
                d.sesi = renumber([...d.sesi, { ...blankSession(''), tanggal: d.tanggal_utama }])
              })
            }
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Tambah sesi
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {draft.sesi.length === 0 && (
          <p className="text-muted-foreground">Belum ada sesi. Tambahkan minimal satu (mis. Akad Nikah).</p>
        )}
        {draft.sesi.length > 2 && (
          <p className="rounded-lg tint-warning p-3 text-warning-ink">
            ⚠ 02_Tamu hanya punya kolom kuota & RSVP untuk S1 dan S2. Sesi ketiga dst. butuh kolom tambahan di sheet.
          </p>
        )}
        {draft.sesi.map((s, i) => {
          const set = (key: keyof Session, value: string) =>
            update((d) => {
              d.sesi[i] = { ...d.sesi[i], [key]: value }
            })
          const p = (key: string) => `sesi.${i}.${key}`
          return (
            <section key={i} aria-label={`Sesi ${s.kode}`} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="info" className="font-mono">
                  {s.kode}
                </Badge>
                <span className="font-medium">{s.label || 'Sesi baru'}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto text-destructive"
                  aria-label={`Hapus sesi ${s.kode}`}
                  onClick={() => update((d) => void (d.sesi = renumber(d.sesi.filter((_, j) => j !== i))))}
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <TextField
                    id={`ev-s${i}-label`}
                    label="Nama sesi *"
                    placeholder="Akad Nikah"
                    value={s.label}
                    onChange={(e) => set('label', e.target.value)}
                    onBlur={touch(p('label'))}
                    error={err(p('label'))}
                  />
                </div>
                <FormField id={`ev-s${i}-tanggal`} label="Tanggal *" error={err(p('tanggal'))}>
                  <DatePicker
                    id={`ev-s${i}-tanggal`}
                    value={s.tanggal}
                    invalid={!!err(p('tanggal'))}
                    onChange={(v) => {
                      set('tanggal', v)
                      touch(p('tanggal'))()
                    }}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField id={`ev-s${i}-mulai`} label="Mulai *" error={err(p('mulai'))}>
                    <Input
                      id={`ev-s${i}-mulai`}
                      type="time"
                      aria-invalid={!!err(p('mulai'))}
                      value={s.mulai}
                      onChange={(e) => set('mulai', e.target.value)}
                      onBlur={touch(p('mulai'))}
                    />
                  </FormField>
                  <FormField id={`ev-s${i}-selesai`} label="Selesai" error={err(p('selesai'))}>
                    <Input
                      id={`ev-s${i}-selesai`}
                      type="time"
                      aria-invalid={!!err(p('selesai'))}
                      value={s.selesai}
                      onChange={(e) => set('selesai', e.target.value)}
                      onBlur={touch(p('selesai'))}
                    />
                  </FormField>
                </div>
                {TEXT_FIELDS.map((f) => (
                  <div key={f.key} className={f.wide ? 'sm:col-span-2' : undefined}>
                    <TextField
                      id={`ev-s${i}-${f.key}`}
                      label={f.label}
                      placeholder={f.placeholder}
                      value={s[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </CardContent>
    </Card>
  )
}
