import { Navigate, Outlet } from 'react-router'
import { useAuth } from './useAuth'

/** SUPER_ADMIN-only pages (event list, new event, accounts); a CLIENT goes back to its own event. */
export function RequireSuperAdmin() {
  const { isSuperAdmin, homePath } = useAuth()
  if (!isSuperAdmin) return <Navigate to={homePath} replace />
  return <Outlet />
}

/** `/` — each role's start page. A component, since a loader cannot read the session. */
export function HomeRedirect() {
  const { homePath } = useAuth()
  return <Navigate to={homePath} replace />
}
