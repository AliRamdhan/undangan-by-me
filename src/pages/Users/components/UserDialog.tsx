import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ROLES, type EventSummary, type ManagedUser, type Role } from '@/core/api/types'
import { useAuth } from '@/core/auth'
import { errorText } from '@/core/store'

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin — semua event & akun',
  CLIENT: 'Klien — satu event',
}

interface Props {
  /** null = create. */
  user: ManagedUser | null
  events: readonly EventSummary[]
  /** Preselected event for a new client account (from `?event=`). */
  defaultEvent: string
  onClose: () => void
  onSaved: () => void
}

/** POST /users or PATCH /users/:email. Mounted per open, so the form always starts from `user`. */
export function UserDialog({ user, events, defaultEvent, onClose, onSaved }: Props) {
  const { app, user: me } = useAuth()
  const isNew = !user
  const isSelf = !!user && user.email.toLowerCase() === me?.email.toLowerCase()
  const [form, setForm] = useState({
    email: user?.email ?? '',
    nama: user?.nama ?? '',
    role: user?.role ?? ('CLIENT' as Role),
    event: user?.event || defaultEvent || events[0]?.slug || '',
    password: '',
    aktif: user?.aktif ?? true,
  })
  const [pending, setPending] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.role === 'CLIENT' && !form.event) return toast.error('Pilih event untuk akun klien')
    if (isNew && form.password.length < 8) return toast.error('Password minimal 8 karakter')
    const event = form.role === 'CLIENT' ? form.event : ''
    setPending(true)
    try {
      if (isNew) {
        await app.createUser({ email: form.email.trim(), nama: form.nama.trim(), role: form.role, event, password: form.password })
        toast.success(`Akun ${form.email.trim()} dibuat`)
      } else {
        await app.updateUser(user.email, { nama: form.nama.trim(), role: form.role, event, aktif: form.aktif })
        toast.success(`Akun ${user.email} disimpan`)
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setPending(false)
    }
  }

  const accessChanged = !isNew && (form.role !== user.role || (form.role === 'CLIENT' && form.event !== user.event) || form.aktif !== user.aktif)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Tambah akun' : 'Ubah akun'}</DialogTitle>
            <DialogDescription>{isNew ? 'Klien hanya bisa membuka satu event yang dipilih di sini.' : user.email}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {isNew && (
              <Field>
                <FieldLabel htmlFor="usr-email">Email</FieldLabel>
                <Input id="usr-email" type="email" required autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="usr-nama">Nama</FieldLabel>
              <Input id="usr-nama" value={form.nama} placeholder="mis. Dimas & Rara" onChange={(e) => set('nama', e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="usr-role">Role</FieldLabel>
              <NativeSelect id="usr-role" className="w-full" value={form.role} disabled={isSelf} onChange={(e) => set('role', e.target.value as Role)}>
                {ROLES.map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {isSelf && <FieldDescription>Role akun sendiri tidak bisa diubah.</FieldDescription>}
            </Field>
            {form.role === 'CLIENT' && (
              <Field>
                <FieldLabel htmlFor="usr-event">Event</FieldLabel>
                <NativeSelect id="usr-event" className="w-full" required value={form.event} onChange={(e) => set('event', e.target.value)}>
                  <NativeSelectOption value="">— pilih event —</NativeSelectOption>
                  {events.map((ev) => (
                    <NativeSelectOption key={ev.slug} value={ev.slug}>
                      {ev.nama_event || ev.slug} (/{ev.slug})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {isNew ? (
              <Field>
                <FieldLabel htmlFor="usr-password">Password awal (min. 8 karakter)</FieldLabel>
                <Input
                  id="usr-password"
                  type="text"
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
                <FieldDescription>Kirim ke klien lewat jalur pribadi; klien bisa menggantinya sendiri.</FieldDescription>
              </Field>
            ) : (
              <Field orientation="horizontal">
                <Checkbox id="usr-aktif" checked={form.aktif} disabled={isSelf} onCheckedChange={(on) => set('aktif', on)} />
                <FieldLabel htmlFor="usr-aktif">Akun aktif</FieldLabel>
              </Field>
            )}
            {accessChanged && <FieldDescription>Akses berubah — sesi login akun ini akan diakhiri.</FieldDescription>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {isNew ? 'Buat akun' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
