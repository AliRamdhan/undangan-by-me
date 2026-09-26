import { LockPasswordIcon, Logout01Icon, UserCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/core/auth'
import { errorText } from '@/core/store'
import { PATHS } from '@/route.paths'

/** Signed-in user, role, Ganti password and Keluar. */
export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [pwOpen, setPwOpen] = useState(false)
  if (!user) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="lg" aria-label={`Akun: ${user.nama}`} className="text-muted-foreground" />}>
          <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} />
          <span className="hidden max-w-32 truncate sm:inline">{user.nama}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate font-medium text-foreground">{user.nama}</span>
              <span className="block truncate">{user.email}</span>
              <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{user.role}</span>
              {user.role === 'CLIENT' && <span className="mt-1 block truncate font-mono">/{user.event}</span>}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPwOpen(true)}>
            <HugeiconsIcon icon={LockPasswordIcon} strokeWidth={2} />
            Ganti password
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              await logout()
              navigate(PATHS.login, { replace: true })
            }}
          >
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  )
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { changePassword } = useAuth()
  const [form, setForm] = useState({ old: '', next: '', repeat: '' })
  const [pending, setPending] = useState(false)
  const mismatch = form.repeat !== '' && form.next !== form.repeat

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.next.length < 8) return toast.error('Password baru minimal 8 karakter')
    if (mismatch) return toast.error('Ulangi password baru dengan sama persis')
    setPending(true)
    try {
      await changePassword(form.old, form.next)
      toast.success('Password diganti')
      setForm({ old: '', next: '', repeat: '' })
      onOpenChange(false)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setPending(false)
    }
  }

  const field = (key: keyof typeof form, label: string, autoComplete: string) => (
    <Field data-invalid={key === 'repeat' && mismatch ? true : undefined}>
      <FieldLabel htmlFor={`pw-${key}`}>{label}</FieldLabel>
      <Input
        id={`pw-${key}`}
        type="password"
        autoComplete={autoComplete}
        required
        aria-invalid={key === 'repeat' && mismatch ? true : undefined}
        value={form[key]}
        onChange={(ev) => setForm((f) => ({ ...f, [key]: ev.target.value }))}
      />
    </Field>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Ganti password</DialogTitle>
            <DialogDescription>Sesi di perangkat lain akan dikeluarkan.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {field('old', 'Password lama', 'current-password')}
            {field('next', 'Password baru (min. 8 karakter)', 'new-password')}
            {field('repeat', 'Ulangi password baru', 'new-password')}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
