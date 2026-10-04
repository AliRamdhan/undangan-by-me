import { Delete02Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useId, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
// HIDDEN(sementara): import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
// HIDDEN(sementara): import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { HP_PATTERN, normalizePhone } from '@/core/domain/phone'
import { /* HIDDEN(sementara): AKSES, SISI, */ GELAR, MANUAL_KEYS, type Guest, type GuestInput } from '@/core/domain/types'
import { useStore } from '@/core/store'
// HIDDEN(sementara): Status_RSVP and Status_Kirim are hidden
// import { KirimBadge, RsvpBadge } from '@/components/StatusBadge'

type Form = Record<keyof GuestInput, string>

function toForm(g: Guest | null): Form {
  return {
    Gelar: g?.Gelar ?? '',
    Nama: g?.Nama ?? '',
    HP: g?.HP ?? '',
    Email: g?.Email ?? '',
    Akses: g?.Akses ?? 'REGULAR',
    Grup: g?.Grup ?? '',
    Sisi: g?.Sisi ?? '',
    Q_S1: String(g?.Q_S1 ?? 0),
    Q_S2: String(g?.Q_S2 ?? 1),
    Meja: g?.Meja ?? '',
    Note_Unik: g?.Note_Unik ?? '',
    Catatan: g?.Catatan ?? '',
  }
}

function validate(f: Form): Partial<Record<keyof GuestInput, string>> {
  const e: Partial<Record<keyof GuestInput, string>> = {}
  if (!f.Nama.trim()) e.Nama = 'Nama wajib diisi'
  // HIDDEN(sementara): Akses is hidden, so it can't block a save it can't show.
  // if (!(AKSES as readonly string[]).includes(f.Akses)) e.Akses = `Pilih salah satu: ${AKSES.join(', ')}`
  for (const k of ['Q_S1', 'Q_S2'] as const) if (!/^\d+$/.test(f[k].trim())) e[k] = 'Bilangan bulat ≥ 0'
  if (f.HP.trim() && !HP_PATTERN.test(normalizePhone(f.HP))) e.HP = 'Format tidak dikenali — gunakan 08xx atau +628xx'
  return e
}

/** Only changed manual columns are sent — the smallest possible write. */
function diff(before: Form, after: Form): Partial<GuestInput> {
  const out: Partial<GuestInput> = {}
  for (const k of MANUAL_KEYS) {
    if (before[k] === after[k]) continue
    const v = after[k].trim()
    Object.assign(out, { [k]: k === 'Q_S1' || k === 'Q_S2' ? Number(v) : v })
  }
  return out
}

/** Error beats hint: a field shows one line under it, never both. */
function Hint({ error, children }: { error?: string; children?: ReactNode }) {
  if (error) return <FieldError>{error}</FieldError>
  return children ? <FieldDescription>{children}</FieldDescription> : null
}

function ReadOnly({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children || <span className="text-ink-3">—</span>}</dd>
    </div>
  )
}

export function GuestDialog({
  guest,
  isNew,
  open,
  onClose,
  onPreview,
  // HIDDEN(sementara): groups, — only the hidden Grup field reads it
}: {
  guest: Guest | null
  isNew: boolean
  open: boolean
  onClose: () => void
  onPreview: (g: Guest) => void
  groups: string[]
}) {
  const { run, busy } = useStore()
  const initial = toForm(isNew ? null : guest)
  const [form, setForm] = useState<Form>(initial)
  const [touched, setTouched] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const errors = validate(form)
  const changes = diff(initial, form)
  const dirty = Object.keys(changes).length > 0
  const id = useId()
  const fid = (k: string) => `${id}-${k}`

  const set = (k: keyof GuestInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setTouched(true)
    if (Object.keys(errors).length) return
    const saved = await run(isNew ? 'Tambah tamu' : 'Simpan tamu', (api) =>
      api.saveGuest(isNew || !guest ? null : guest.ID, changes),
    )
    if (saved) {
      toast.success(isNew ? `${saved.Nama} ditambahkan · PIN ${saved.PIN}` : `${saved.Nama} disimpan`)
      onClose()
    }
  }

  const remove = async () => {
    if (!guest) return
    const n = await run('Hapus tamu', (api) => api.deleteGuests([guest.ID]))
    setConfirmDelete(false)
    if (n) {
      toast.success(`${guest.Nama || 'Tamu'} dihapus`)
      onClose()
    }
  }

  const normalizedHp = normalizePhone(form.HP)
  const showErr = (k: keyof GuestInput) => (touched || form[k] !== initial[k] ? errors[k] : undefined)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-6 pr-12">
          <DialogTitle className="truncate text-base">{isNew ? 'Tambah Tamu' : guest?.Nama || '(tanpa nama)'}</DialogTitle>
          <DialogDescription render={<div />} className="flex flex-wrap items-center gap-2">
            {!isNew && guest ? (
              <>
                <span>Baris {guest.No}</span>
                <span>·</span>
                <span>
                  PIN <span className="font-mono">{guest.PIN || 'belum ada'}</span>
                </span>
                {/* HIDDEN(sementara): <RsvpBadge status={guest.Status_RSVP} /> */}
                {/* HIDDEN(sementara): <KirimBadge status={guest.Status_Kirim} /> */}
              </>
            ) : (
              'PIN dibuat otomatis saat disimpan.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          id={fid('form')}
          className="min-h-0 flex-1 overflow-y-auto p-6"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Identitas</FieldLegend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                <Field>
                  <FieldLabel htmlFor={fid('gelar')}>Gelar</FieldLabel>
                  <Input id={fid('gelar')} list={fid('gelar-list')} value={form.Gelar} onChange={set('Gelar')} />
                  <datalist id={fid('gelar-list')}>
                    {GELAR.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </Field>
                <Field data-invalid={!!showErr('Nama')}>
                  <FieldLabel htmlFor={fid('nama')}>Nama *</FieldLabel>
                  <Input
                    id={fid('nama')}
                    value={form.Nama}
                    onChange={set('Nama')}
                    autoFocus={isNew}
                    aria-invalid={!!showErr('Nama')}
                  />
                  <Hint error={showErr('Nama')} />
                </Field>
              </div>
              <Field data-invalid={!!showErr('HP')}>
                <FieldLabel htmlFor={fid('hp')}>HP (WhatsApp)</FieldLabel>
                <Input
                  id={fid('hp')}
                  inputMode="tel"
                  autoComplete="off"
                  className="font-mono"
                  value={form.HP}
                  onChange={set('HP')}
                  aria-invalid={!!showErr('HP')}
                  onBlur={() => {
                    if (HP_PATTERN.test(normalizedHp)) setForm((f) => ({ ...f, HP: normalizedHp }))
                  }}
                />
                <Hint error={showErr('HP')}>
                  {form.HP.trim() && normalizedHp !== form.HP.trim() && HP_PATTERN.test(normalizedHp) ? (
                    <>
                      Disimpan sebagai <span className="font-mono">{normalizedHp}</span>
                    </>
                  ) : (
                    '08xx, 628xx atau +628xx — spasi dan strip dibersihkan otomatis'
                  )}
                </Hint>
              </Field>
              <Field>
                <FieldLabel htmlFor={fid('email')}>Email</FieldLabel>
                <Input id={fid('email')} type="email" value={form.Email} onChange={set('Email')} />
              </Field>
            </FieldSet>

            <FieldSet>
              {/* HIDDEN(sementara): <FieldLegend variant="label">Segmentasi</FieldLegend> */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* HIDDEN(sementara): segmentasi (Akses, Sisi, Grup). Values are still carried in the form but never sent unless changed.
                <Field data-invalid={!!showErr('Akses')}>
                  <FieldLabel htmlFor={fid('akses')}>Akses</FieldLabel>
                  <NativeSelect
                    id={fid('akses')}
                    className="w-full"
                    value={form.Akses}
                    onChange={set('Akses')}
                    aria-invalid={!!showErr('Akses')}
                  >
                    {!(AKSES as readonly string[]).includes(form.Akses) && (
                      <NativeSelectOption value={form.Akses}>{form.Akses || '(kosong)'} — tidak valid</NativeSelectOption>
                    )}
                    {AKSES.map((a) => (
                      <NativeSelectOption key={a} value={a}>
                        {a}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <Hint error={showErr('Akses')} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={fid('sisi')}>Sisi</FieldLabel>
                  <Input id={fid('sisi')} list={fid('sisi-list')} value={form.Sisi} onChange={set('Sisi')} />
                  <datalist id={fid('sisi-list')}>
                    {SISI.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>
                <Field>
                  <FieldLabel htmlFor={fid('grup')}>Grup</FieldLabel>
                  <Input id={fid('grup')} list={fid('grup-list')} value={form.Grup} onChange={set('Grup')} />
                  <datalist id={fid('grup-list')}>
                    {groups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </Field>
                */}
                {/* HIDDEN(sementara): quota inputs. Values are still carried in the form but never sent unless changed.
                <Field data-invalid={!!showErr('Q_S1')}>
                  <FieldLabel htmlFor={fid('q1')}>Kuota S1 (pax)</FieldLabel>
                  <Input id={fid('q1')} type="number" min={0} step={1} inputMode="numeric" value={form.Q_S1} onChange={set('Q_S1')} aria-invalid={!!showErr('Q_S1')} />
                  <Hint error={showErr('Q_S1')} />
                </Field>
                <Field data-invalid={!!showErr('Q_S2')}>
                  <FieldLabel htmlFor={fid('q2')}>Kuota S2 (pax)</FieldLabel>
                  <Input id={fid('q2')} type="number" min={0} step={1} inputMode="numeric" value={form.Q_S2} onChange={set('Q_S2')} aria-invalid={!!showErr('Q_S2')} />
                  <Hint error={showErr('Q_S2')} />
                </Field>
                */}
                {/* HIDDEN(sementara): Meja
                <Field>
                  <FieldLabel htmlFor={fid('meja')}>Meja</FieldLabel>
                  <Input id={fid('meja')} value={form.Meja} onChange={set('Meja')} />
                </Field>
                */}
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">Operasional</FieldLegend>
              <Field>
                <FieldLabel htmlFor={fid('note')}>Note unik</FieldLabel>
                <Textarea id={fid('note')} rows={2} value={form.Note_Unik} onChange={set('Note_Unik')} />
                <FieldDescription>Masuk ke pesan lewat {'{{tamu.note_unik}}'}</FieldDescription>
              </Field>
              {/* HIDDEN(sementara): Catatan internal
              <Field>
                <FieldLabel htmlFor={fid('catatan')}>Catatan internal</FieldLabel>
                <Textarea id={fid('catatan')} rows={2} value={form.Catatan} onChange={set('Catatan')} />
                <FieldDescription>Tidak pernah dikirim ke tamu</FieldDescription>
              </Field>
              */}
            </FieldSet>

            {!isNew && guest && (
              <section className="rounded-lg bg-muted p-4">
                <h3 className="mb-1 flex items-center gap-2 font-semibold tracking-wide text-muted-foreground uppercase">
                  Otomatis <span className="font-normal normal-case">— diisi script/formula, tidak bisa diedit</span>
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {/* HIDDEN(sementara):
                  <ReadOnly label="HP_Valid">
                    <Badge variant={guest.HP_Valid === '✅' ? 'good' : 'serious'}>{guest.HP_Valid}</Badge>
                  </ReadOnly>
                  */}
                  {/* HIDDEN(sementara): Status RSVP
                  <ReadOnly label="Status RSVP">
                    <RsvpBadge status={guest.Status_RSVP} />
                  </ReadOnly>
                  */}
                  {/* HIDDEN(sementara):
                  <ReadOnly label="RSVP S1 / S2">
                    <span className={guest.RSVP_S1 > guest.Q_S1 || guest.RSVP_S2 > guest.Q_S2 ? 'font-semibold text-critical-ink' : ''}>
                      {guest.RSVP_S1} / {guest.RSVP_S2}
                    </span>
                  </ReadOnly>
                  */}
                  {/* HIDDEN(sementara): RSVP details
                  <ReadOnly label="Waktu RSVP">{guest.RSVP_Waktu}</ReadOnly>
                  <ReadOnly label="Nama pax">{guest.Nama_Pax}</ReadOnly>
                  */}
                  {/* HIDDEN(sementara):
                  <ReadOnly label="Status kirim">
                    <KirimBadge status={guest.Status_Kirim} />
                    {guest.Kirim_Count > 0 && <span className="ml-2 text-xs text-ink-3">{guest.Kirim_Count}× · {guest.Kirim_Terakhir}</span>}
                  </ReadOnly>
                  {guest.Kirim_Error && (
                    <div className="col-span-2">
                      <ReadOnly label="Error kirim">
                        <span className="text-critical-ink">{guest.Kirim_Error}</span>
                      </ReadOnly>
                    </div>
                  )}
                  */}
                  {/* HIDDEN(sementara): Pesan_Tamu comes from the RSVP form
                  {guest.Pesan_Tamu && (
                    <div className="col-span-2">
                      <ReadOnly label="Ucapan tamu">“{guest.Pesan_Tamu}”</ReadOnly>
                    </div>
                  )}
                  */}
                  <div className="col-span-2">
                    <ReadOnly label="Link undangan">
                      {guest.Link_Undangan && (
                        <a href={guest.Link_Undangan} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
                          {guest.Link_Undangan}
                        </a>
                      )}
                    </ReadOnly>
                  </div>
                  <div className="col-span-2">
                    <ReadOnly label="Link WA">
                      {guest.Link_WA ? (
                        <a href={guest.Link_WA} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          Buka WhatsApp dengan pesan terisi
                          <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-ink-3">Belum dibuat — Template → Generate Link Manual</span>
                      )}
                    </ReadOnly>
                  </div>
                </dl>
              </section>
            )}
          </FieldGroup>
        </form>

        <DialogFooter className="flex-row flex-wrap justify-end border-t p-4">
          {!isNew && (
            <Button variant="destructive" className="mr-auto" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
              Hapus
            </Button>
          )}
          {!isNew && guest && (
            <Button variant="outline" onClick={() => onPreview(guest)} disabled={dirty} title={dirty ? 'Simpan dulu perubahan' : undefined}>
              Preview Pesan
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form={fid('form')} disabled={!!busy || (!isNew && !dirty)}>
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? 'Menyimpan…' : isNew ? 'Tambah' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tamu ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {guest?.Nama || 'Tamu'} dihapus permanen dari 02_Tamu. Riwayat di 04_Log dan 05_RSVP tetap ada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={!!busy}>
              Ya, hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
