import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ManagedUser } from '@/core/api/types'
import { useAuth } from '@/core/auth'
import { errorText } from '@/core/store'

/** POST /users/:email/reset-password — for a client who forgot theirs. */
export function ResetPasswordDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { app } = useAuth()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return toast.error('Password minimal 8 karakter')
    setPending(true)
    try {
      await app.resetPassword(user.id, password)
      toast.success(`Password ${user.email} direset`)
      onClose()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>{user.email} — semua sesi login akun ini akan diakhiri.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rst-password">Password baru (min. 8 karakter)</FieldLabel>
              <Input id="rst-password" type="text" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Reset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
