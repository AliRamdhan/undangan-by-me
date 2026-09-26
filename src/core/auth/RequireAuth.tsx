import { Navigate, Outlet, useLocation } from 'react-router'
import { PATHS } from '@/route.paths'
import { useAuth } from './useAuth'

/** Route guard: everything below it needs a session; otherwise back to /login, remembering where we were. */
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={PATHS.login} replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
