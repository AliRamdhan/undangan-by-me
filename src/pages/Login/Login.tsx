import { Alert02Icon, Login01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { APPS_SCRIPT_URL } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errorText } from '@/core/store'
import { PATHS } from '@/route.paths'

/** POST /auth/login against the Apps Script Web App (VITE_APPS_SCRIPT_URL). */
export function Login() {
  const { user, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // No `from`: `/` sends each role to its start page (event list or the client's own event).
  const from = (location.state as { from?: string } | null)?.from ?? PATHS.root
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  if (user) return <Navigate to={from} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10">
      <div className="fixed top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span aria-hidden>📨</span> Undangan
          </CardTitle>
          <CardDescription>Masuk untuk mengelola event, tamu dan template.</CardDescription>
        </CardHeader>
        <CardContent>
          {!APPS_SCRIPT_URL && (
            <div role="alert" className="mb-4 flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
              <p>
                Server belum dikonfigurasi. Isi <code className="font-mono">VITE_APPS_SCRIPT_URL</code> (URL /exec Apps Script) di{' '}
                <code className="font-mono">.env</code> lalu jalankan/build ulang aplikasi.
              </p>
            </div>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input id="login-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg" disabled={pending || !APPS_SCRIPT_URL}>
              {pending ? <Spinner data-icon="inline-start" /> : <HugeiconsIcon icon={Login01Icon} strokeWidth={2} data-icon="inline-start" />}
              Masuk
            </Button>
          </form>

        </CardContent>
      </Card>

    </div>
  )
}
