import { Link, NavLink, Outlet } from 'react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/core/auth'
import { PATHS } from '@/route.paths'

const navCls = ({ isActive }: { isActive: boolean }) =>
  buttonVariants({ variant: 'ghost', size: 'lg', className: isActive ? 'bg-primary-soft text-primary hover:bg-primary-soft' : 'text-muted-foreground' })

/** Global header (brand, admin nav, theme, account); event pages add their own bar via EventLayout. */
export function AppLayout() {
  const { isSuperAdmin, homePath } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link to={homePath} className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="text-xl">
              📨
            </span>
            <div className="min-w-0">
              <p className="text-[15px] leading-tight font-semibold">Undangan</p>
              <p className="truncate text-xs text-ink-3">
                {isSuperAdmin ? 'Super admin' : 'Klien'}
              </p>
            </div>
          </Link>
          {isSuperAdmin && (
            <nav aria-label="Menu admin" className="flex gap-1">
              <NavLink to={PATHS.events} className={navCls}>
                Event
              </NavLink>
              <NavLink to={PATHS.users} className={navCls}>
                Pengguna
              </NavLink>
              <NavLink to={PATHS.templates} className={navCls}>
                Template
              </NavLink>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
