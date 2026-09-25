import { DatePicker } from '@/components/DatePicker'
import { Card, CardContent } from '@/components/ui/card'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { BAHASA, EVENT_TIPE, TIMEZONES, WEB_TEMPLATES } from '@/core/domain/types'
import { FormField, SectionHeader, TextField, type SectionProps } from './form'

/** `https://undangan.by.me/` — what the slug is appended to (URL-CONTRACT.md § 1). */
function urlPrefix(domain: string): string {
  const d = domain.trim().replace(/\/+$/, '')
  if (!d) return 'https://…/'
  return `${/^https?:\/\//i.test(d) ? d : `https://${d}`}/`
}

/** #A.2 Data Event, with #A.2.1 Pengaturan Event nested inside (as in the design). */
export function EventDataCard({ draft, update, err, touch }: SectionProps) {
  const [remDate = '', remTime = ''] = draft.tanggal_pengingat.split('T')
  const setReminder = (date: string, time: string) =>
    update((d) => {
      d.tanggal_pengingat = date ? `${date}T${time || '09:00'}` : ''
    })

  return (
    <Card>
      <SectionHeader title="Data Event" code="#A.2" />
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <TextField
            id="ev-nama"
            label="Nama event *"
            placeholder="Pernikahan Dimas & Rara"
            value={draft.nama_event}
            onChange={(e) => update((d) => void (d.nama_event = e.target.value))}
            onBlur={touch('nama_event')}
            error={err('nama_event')}
          />
          <FormField id="ev-tipe" label="Jenis event *" error={err('tipe')}>
            <NativeSelect
              id="ev-tipe"
              className="w-full"
              value={draft.tipe}
              aria-invalid={!!err('tipe')}
              onChange={(e) => update((d) => void (d.tipe = e.target.value))}
              onBlur={touch('tipe')}
            >
              <NativeSelectOption value="">Pilih jenis event</NativeSelectOption>
              {EVENT_TIPE.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>

          <FormField
            id="ev-slug"
            label={
              <>
                URL event *{' '}
                <span className="font-mono font-normal text-primary">{urlPrefix(draft.domain)}</span>
              </>
            }
            error={err('slug')}
            hint="Huruf kecil, angka dan tanda hubung. Link tamu: …/slug/PIN"
          >
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText className="font-mono">/</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="ev-slug"
                className="font-mono"
                placeholder="dimas-rara"
                aria-invalid={!!err('slug')}
                value={draft.slug}
                onChange={(e) => update((d) => void (d.slug = e.target.value.toLowerCase().replace(/\s+/g, '-')))}
                onBlur={touch('slug')}
              />
            </InputGroup>
          </FormField>
          <FormField id="ev-tanggal" label="Tanggal acara *" error={err('tanggal_utama')}>
            <DatePicker
              id="ev-tanggal"
              value={draft.tanggal_utama}
              invalid={!!err('tanggal_utama')}
              onChange={(v) => {
                update((d) => void (d.tanggal_utama = v))
                touch('tanggal_utama')()
              }}
            />
          </FormField>

          <FormField id="ev-hashtag" label="Hashtag" error={err('couple.hashtag')}>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>#</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="ev-hashtag"
                placeholder="DimasRara"
                aria-invalid={!!err('couple.hashtag')}
                value={draft.couple.hashtag.replace(/^#/, '')}
                onChange={(e) =>
                  update((d) => {
                    const v = e.target.value.replace(/^#+/, '')
                    d.couple.hashtag = v ? `#${v}` : ''
                  })
                }
                onBlur={touch('couple.hashtag')}
              />
            </InputGroup>
          </FormField>
          <FormField id="ev-pengingat" label="Pengingat acara" hint="Kapan pesan REMINDER dikirim">
            <div className="flex gap-2">
              <DatePicker id="ev-pengingat" value={remDate} onChange={(v) => setReminder(v, remTime)} className="flex-1" />
              <Input
                type="time"
                aria-label="Jam pengingat"
                className="w-24"
                disabled={!remDate}
                value={remTime}
                onChange={(e) => setReminder(remDate, e.target.value)}
              />
            </div>
          </FormField>

          <FormField id="ev-template" label="Template web" hint="Desain halaman undangan">
            <NativeSelect
              id="ev-template"
              className="w-full"
              value={draft.web_template}
              onChange={(e) => update((d) => void (d.web_template = e.target.value))}
            >
              <NativeSelectOption value="">Pilih template</NativeSelectOption>
              {WEB_TEMPLATES.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="ev-rsvp" label="Batas RSVP *" error={err('batas_rsvp')}>
            <DatePicker
              id="ev-rsvp"
              value={draft.batas_rsvp}
              invalid={!!err('batas_rsvp')}
              onChange={(v) => {
                update((d) => void (d.batas_rsvp = v))
                touch('batas_rsvp')()
              }}
            />
          </FormField>
        </div>

        <Card className="gap-0 overflow-hidden pt-0">
          <SectionHeader
            title="Pengaturan Event"
            code="#A.2.1"
            className="bg-primary py-3 text-primary-foreground [&_[data-slot=badge]]:bg-primary-foreground/20 [&_[data-slot=badge]]:text-primary-foreground"
          />
          <CardContent className="pt-4">
            <FieldSet>
              <FieldLegend>Waktu & Bahasa</FieldLegend>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <FormField id="ev-tz" label="Zona waktu *" error={err('timezone')} hint="Label saja — jam tidak dikonversi">
                  <NativeSelect
                    id="ev-tz"
                    className="w-full"
                    value={draft.timezone}
                    onChange={(e) => update((d) => void (d.timezone = e.target.value))}
                  >
                    {TIMEZONES.map((t) => (
                      <NativeSelectOption key={t} value={t}>
                        {t}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id="ev-bahasa" label="Bahasa">
                  <NativeSelect
                    id="ev-bahasa"
                    className="w-full"
                    value={draft.bahasa}
                    onChange={(e) => update((d) => void (d.bahasa = e.target.value))}
                  >
                    {BAHASA.map((b) => (
                      <NativeSelectOption key={b.value} value={b.value}>
                        {b.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormField>
                <div className="sm:col-span-2">
                  <TextField
                    id="ev-domain"
                    label="Domain undangan *"
                    className="font-mono"
                    placeholder="https://undangan.by.me"
                    value={draft.domain}
                    onChange={(e) => update((d) => void (d.domain = e.target.value.trim()))}
                    onBlur={touch('domain')}
                    error={err('domain')}
                  />
                </div>
              </div>
            </FieldSet>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}
