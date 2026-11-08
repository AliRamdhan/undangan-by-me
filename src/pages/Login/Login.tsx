import { Alert02Icon, ArrowLeft01Icon, CheckmarkCircle02Icon, Login01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Brand } from '@/components/Brand'
import { GridBackdrop } from '@/components/GridBackdrop'
import { PhoneMockup } from '@/components/PhoneMockup'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { APPS_SCRIPT_URL } from '@/core/api'
import { useAuth } from '@/core/auth'
import { PORTFOLIO } from '@/core/domain/portfolio'
import { errorText } from '@/core/store'
import { PATHS } from '@/route.paths'

const POINTS = ['Link WhatsApp personal untuk tiap tamu', 'Import daftar tamu dari CSV atau Excel', 'Pantau tamu & undangan tersampaikan']

/** POST /auth/login against the Apps Script Web App (VITE_APPS_SCRIPT_URL). Split screen: brand panel + form. */
export function Login() {
  const { user, homePath, login } = useAuth()
  const location = useLocation()
  // The page RequireAuth bounced from; without one each role lands on its own start page.
  const from = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  // Also the post-login redirect: login() stores the session, the re-render lands here with the fresh homePath.
  if (user) return <Navigate to={from ?? homePath} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      await login(email, password)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <title>Masuk · Undangan</title>
      <BrandPanel />

      <div className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Brand className="lg:invisible" />
          <ThemeToggle className="size-8 rounded-full" />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Masuk ke dasbor</h1>
          <p className="mt-2 text-sm text-muted-foreground">Masuk untuk mengelola event, tamu dan template.</p>

          {!APPS_SCRIPT_URL && (
            <div role="alert" className="mt-6 flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
              <p>
                Server belum dikonfigurasi. Isi <code className="font-mono">VITE_APPS_SCRIPT_URL</code> (URL /exec Apps Script) di{' '}
                <code className="font-mono">.env</code> lalu jalankan/build ulang aplikasi.
              </p>
            </div>
          )}

          <form onSubmit={submit} className="mt-8 flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  className="h-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg" className="h-10 w-full rounded-full text-sm" disabled={pending || !APPS_SCRIPT_URL}>
              {pending ? <Spinner data-icon="inline-start" /> : <HugeiconsIcon icon={Login01Icon} strokeWidth={2} data-icon="inline-start" />}
              Masuk
            </Button>
          </form>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link to={PATHS.root} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
              Kembali ke beranda
            </Link>
            <Link to={PATHS.portfolio} className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
              Lihat portfolio desain
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Desktop-only left half: fixed dark panel (same in both themes) selling the dashboard. */
function BrandPanel() {
  const [a, b] = PORTFOLIO
  return (
    <aside className="relative isolate hidden flex-col overflow-hidden bg-neutral-950 p-10 text-white lg:flex">
      <GridBackdrop line="rgb(255 255 255 / 0.07)" />
      <Brand className="text-white" />

      <div className="mt-16 max-w-md">
        <h2 className="text-3xl font-semibold tracking-tight text-balance xl:text-4xl">Kelola undangan dan tamu dalam satu dasbor.</h2>
        <ul className="mt-8 flex flex-col gap-3 text-sm text-white/75">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-5 text-primary" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div aria-hidden className="relative mt-auto h-64 xl:h-72">
        <PhoneMockup slug={a.slug} className="absolute bottom-[-6rem] left-4 w-40 -rotate-6 border-neutral-800 xl:w-44" />
        <PhoneMockup slug={b.slug} className="absolute bottom-[-8rem] left-44 w-40 rotate-3 border-neutral-800 xl:left-52 xl:w-44" />
      </div>
    </aside>
  )
}
