import { useId, useState, type ReactNode } from 'react'
import { refOf } from '../../api/types'
import { /* HIDDEN(sementara): Badge, */ Button, Drawer, Field, fieldBase, inputCls } from '../../components/ui'
import { HP_PATTERN, normalizePhone } from '../../domain/phone'
import { AKSES, GELAR, MANUAL_KEYS, SISI, type Guest, type GuestInput } from '../../domain/types'
import { useStore } from '../../state/store'
import { /* HIDDEN(sementara): KirimBadge, */ RsvpBadge } from './status'

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
  if (!(AKSES as readonly string[]).includes(f.Akses)) e.Akses = `Pilih salah satu: ${AKSES.join(', ')}`
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

function ReadOnly({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children || <span className="text-ink-3">—</span>}</dd>
    </div>
  )
}

export function GuestDrawer({
  guest,
  isNew,
  open,
  onClose,
  onPreview,
  groups,
}: {
  guest: Guest | null
  isNew: boolean
  open: boolean
  onClose: () => void
  onPreview: (g: Guest) => void
  groups: string[]
}) {
  const { run, busy, toast } = useStore()
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
      api.saveGuest(isNew || !guest ? null : refOf(guest), changes),
    )
    if (saved) {
      toast('ok', isNew ? `${saved.Nama} ditambahkan · PIN ${saved.PIN}` : `${saved.Nama} disimpan`)
      onClose()
    }
  }

  const remove = async () => {
    if (!guest) return
    const n = await run('Hapus tamu', (api) => api.deleteGuests([refOf(guest)]))
    if (n) {
      toast('ok', `${guest.Nama || 'Tamu'} dihapus`)
      onClose()
    }
  }

  const normalizedHp = normalizePhone(form.HP)
  const showErr = (k: keyof GuestInput) => (touched || form[k] !== initial[k] ? errors[k] : undefined)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isNew ? 'Tambah Tamu' : guest?.Nama || '(tanpa nama)'}
      subtitle={
        !isNew && guest ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>Baris {guest.No}</span>
            <span>·</span>
            <span>
              PIN <span className="font-mono">{guest.PIN || 'belum ada'}</span>
            </span>
            <RsvpBadge status={guest.Status_RSVP} />
            {/* HIDDEN(sementara): <KirimBadge status={guest.Status_Kirim} /> */}
          </span>
        ) : (
          'PIN dibuat otomatis saat disimpan.'
        )
      }
      footer={
        confirmDelete ? (
          <>
            <span className="mr-auto self-center text-sm text-critical-ink">Hapus tamu ini permanen?</span>
            <Button onClick={() => setConfirmDelete(false)}>Batal</Button>
            <Button variant="danger" onClick={remove} disabled={!!busy}>
              Ya, hapus
            </Button>
          </>
        ) : (
          <>
            {!isNew && (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
                Hapus
              </Button>
            )}
            {!isNew && guest && (
              <Button onClick={() => onPreview(guest)} disabled={dirty} title={dirty ? 'Simpan dulu perubahan' : undefined}>
                Preview Pesan
              </Button>
            )}
            <Button onClick={onClose}>Batal</Button>
            <Button variant="primary" onClick={save} disabled={!!busy || (!isNew && !dirty)}>
              {busy ? 'Menyimpan…' : isNew ? 'Tambah' : 'Simpan'}
            </Button>
          </>
        )
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Identitas</legend>
          <Field label="Gelar" htmlFor={fid('gelar')}>
            <input id={fid('gelar')} list={fid('gelar-list')} className={inputCls} value={form.Gelar} onChange={set('Gelar')} />
            <datalist id={fid('gelar-list')}>
              {GELAR.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label="Nama *" htmlFor={fid('nama')} error={showErr('Nama')}>
            <input id={fid('nama')} className={inputCls} value={form.Nama} onChange={set('Nama')} autoFocus={isNew} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="HP (WhatsApp)"
              htmlFor={fid('hp')}
              error={showErr('HP')}
              hint={
                form.HP.trim() && normalizedHp !== form.HP.trim() && HP_PATTERN.test(normalizedHp) ? (
                  <>
                    Disimpan sebagai <span className="font-mono">{normalizedHp}</span>
                  </>
                ) : (
                  '08xx, 628xx atau +628xx — spasi dan strip dibersihkan otomatis'
                )
              }
            >
              <input
                id={fid('hp')}
                inputMode="tel"
                autoComplete="off"
                className={`${inputCls} font-mono`}
                value={form.HP}
                onChange={set('HP')}
                onBlur={() => {
                  if (HP_PATTERN.test(normalizedHp)) setForm((f) => ({ ...f, HP: normalizedHp }))
                }}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Email" htmlFor={fid('email')}>
              <input id={fid('email')} type="email" className={inputCls} value={form.Email} onChange={set('Email')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Segmentasi</legend>
          <Field label="Akses" htmlFor={fid('akses')} error={showErr('Akses')}>
            <select id={fid('akses')} className={inputCls} value={form.Akses} onChange={set('Akses')}>
              {!(AKSES as readonly string[]).includes(form.Akses) && (
                <option value={form.Akses}>{form.Akses || '(kosong)'} — tidak valid</option>
              )}
              {AKSES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sisi" htmlFor={fid('sisi')}>
            <input id={fid('sisi')} list={fid('sisi-list')} className={inputCls} value={form.Sisi} onChange={set('Sisi')} />
            <datalist id={fid('sisi-list')}>
              {SISI.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Grup" htmlFor={fid('grup')}>
            <input id={fid('grup')} list={fid('grup-list')} className={inputCls} value={form.Grup} onChange={set('Grup')} />
            <datalist id={fid('grup-list')}>
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          {/* HIDDEN(sementara): quota inputs. Values are still carried in the form but never sent unless changed.
          <Field label="Kuota S1 (pax)" htmlFor={fid('q1')} error={showErr('Q_S1')}>
            <input id={fid('q1')} type="number" min={0} step={1} inputMode="numeric" className={inputCls} value={form.Q_S1} onChange={set('Q_S1')} />
          </Field>
          <Field label="Kuota S2 (pax)" htmlFor={fid('q2')} error={showErr('Q_S2')}>
            <input id={fid('q2')} type="number" min={0} step={1} inputMode="numeric" className={inputCls} value={form.Q_S2} onChange={set('Q_S2')} />
          </Field>
          */}
          <Field label="Meja" htmlFor={fid('meja')}>
            <input id={fid('meja')} className={inputCls} value={form.Meja} onChange={set('Meja')} />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Operasional</legend>
          <Field label="Note unik" htmlFor={fid('note')} hint="Masuk ke pesan lewat {{tamu.note_unik}}">
            <textarea id={fid('note')} rows={2} className={`${fieldBase} w-full py-2`} value={form.Note_Unik} onChange={set('Note_Unik')} />
          </Field>
          <Field label="Catatan internal" htmlFor={fid('catatan')} hint="Tidak pernah dikirim ke tamu">
            <textarea id={fid('catatan')} rows={2} className={`${fieldBase} w-full py-2`} value={form.Catatan} onChange={set('Catatan')} />
          </Field>
        </fieldset>

        {!isNew && guest && (
          <section className="rounded-xl bg-surface-2 p-4">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">
              ⚙ Otomatis <span className="font-normal normal-case">— diisi script/formula, tidak bisa diedit</span>
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {/* HIDDEN(sementara):
              <ReadOnly label="HP_Valid">
                <Badge tone={guest.HP_Valid === '✅' ? 'good' : 'serious'}>{guest.HP_Valid}</Badge>
              </ReadOnly>
              */}
              <ReadOnly label="Status RSVP">
                <RsvpBadge status={guest.Status_RSVP} />
              </ReadOnly>
              {/* HIDDEN(sementara):
              <ReadOnly label="RSVP S1 / S2">
                <span className={guest.RSVP_S1 > guest.Q_S1 || guest.RSVP_S2 > guest.Q_S2 ? 'font-semibold text-critical-ink' : ''}>
                  {guest.RSVP_S1} / {guest.RSVP_S2}
                </span>
              </ReadOnly>
              */}
              <ReadOnly label="Waktu RSVP">{guest.RSVP_Waktu}</ReadOnly>
              <ReadOnly label="Nama pax">{guest.Nama_Pax}</ReadOnly>
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
              {guest.Pesan_Tamu && (
                <div className="col-span-2">
                  <ReadOnly label="Ucapan tamu">“{guest.Pesan_Tamu}”</ReadOnly>
                </div>
              )}
              <div className="col-span-2">
                <ReadOnly label="Link undangan">
                  {guest.Link_Undangan && (
                    <a href={guest.Link_Undangan} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">
                      {guest.Link_Undangan}
                    </a>
                  )}
                </ReadOnly>
              </div>
              <div className="col-span-2">
                <ReadOnly label="Link WA">
                  {guest.Link_WA ? (
                    <a href={guest.Link_WA} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Buka WhatsApp dengan pesan terisi ↗
                    </a>
                  ) : (
                    <span className="text-ink-3">Belum dibuat — Template → Generate Link Manual</span>
                  )}
                </ReadOnly>
              </div>
            </dl>
          </section>
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  )
}
