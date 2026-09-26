import { Login01Icon, Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { SettingsSheet } from '@/components/SettingsSheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { MOCK_ENABLED } from '@/core/api'
import { SEED_USERS } from '@/core/api/seed'
import { useAuth } from '@/core/auth'
import { errorText } from '@/core/store'
import { PATHS } from '@/route.paths'

/** POST /auth/login. The backend (mock or /exec URL) is picked in Pengaturan first. */
export function Login() {
  const { user, login, settings, app } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // No `from`: `/` sends each role to its start page (event list or the client's own event).
  const from = (location.state as { from?: string } | null)?.from ?? PATHS.root
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <HugeiconsIcon icon={Login01Icon} strokeWidth={2} data-icon="inline-start" />}
              Masuk
            </Button>
          </form>

          {MOCK_ENABLED && app.kind === 'mock' && (
            <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Data contoh — akun demo:</p>
              {SEED_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  className="block font-mono hover:underline"
                  onClick={() => {
                    setEmail(u.email)
                    setPassword(u.password)
                  }}
                >
                  {u.email} / {u.password} ({u.role})
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" className="text-muted-foreground" onClick={() => setSettingsOpen(true)}>
        <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} data-icon="inline-start" />
        Pengaturan server · {settings.mode === 'mock' ? 'data contoh' : settings.url ? 'Google Sheet' : 'URL belum diatur'}
      </Button>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
