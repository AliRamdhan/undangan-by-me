import { toast } from 'sonner'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApp, loadSession, saveSession } from '@/core/api'
import type { Session } from '@/core/api/types'
import { eventPaths, PATHS } from '@/route.paths'
import { AuthContext, type Auth } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)

  const end = useCallback((s: Session | null) => {
    saveSession(s)
    setSession(s)
  }, [])

  // Any AUTH answer (expired/revoked token) drops the session; RequireAuth then redirects.
  const expire = useCallback(() => {
    if (!loadSession()) return
    end(null)
    toast.error('Sesi berakhir — silakan login lagi')
  }, [end])

  const app = useMemo(() => createApp(session, expire), [session, expire])

  useEffect(() => {
    // A stored token may have been revoked server-side; /auth/me refreshes the user or expires it.
    if (!session) return
    app
      .me()
      .then((user) => {
        if (JSON.stringify(user) !== JSON.stringify(session.user)) end({ ...session, user })
      })
      .catch(() => {
        // AUTH already went through expire(); network errors keep the session for a retry.
      })
    // Once per token, not on every user refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app])

  const login = useCallback(
    async (email: string, password: string) => {
      end(await app.login(email.trim(), password))
    },
    [app, end],
  )

  const logout = useCallback(async () => {
    try {
      await app.logout()
    } catch {
      // The token is dropped locally either way.
    }
    end(null)
  }, [app, end])

  const changePassword = useCallback((o: string, n: string) => app.changePassword(o, n), [app])

  const user = session?.user ?? null
  const value: Auth = {
    app,
    user,
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    homePath: user?.role === 'CLIENT' ? eventPaths(user.event).event : PATHS.events,
    login,
    logout,
    changePassword,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
