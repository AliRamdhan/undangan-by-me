import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/core/auth'
import { StoreProvider, useEventList, useStore } from '@/core/store'
import { eventPaths, PATHS } from '@/route.paths'

/** `/admin/events/:eventId/…`: one store per event — remounted on an event change so no state leaks across events. */
export function EventLayout() {
  const eventId = useParams().eventId!
  const { user, homePath } = useAuth()
  // A CLIENT only has its own event — any other ID goes home.
  if (user?.role === 'CLIENT' && user.event !== eventId) return <Navigate to={homePath} replace />
  return (
    <StoreProvider key={eventId} eventId={eventId}>
      <EventShell />
    </StoreProvider>
  )
}

const tabCls = ({ isActive }: { isActive: boolean }) =>
  buttonVariants({ variant: 'ghost', size: 'lg', className: isActive ? 'bg-primary-soft text-primary hover:bg-primary-soft' : 'text-muted-foreground' })

/** A CLIENT gets just its event's name; SUPER_ADMIN gets navigation across events. */
function EventShell() {
  const { meta } = useStore()
  const { isSuperAdmin } = useAuth()
  return isSuperAdmin ? <AdminEventShell /> : <Shell switcher={<p className="font-medium">{meta?.event.nama_event}</p>} />
}

/** SUPER_ADMIN: back to the list, and a switcher across every event. */
function AdminEventShell() {
  const { eventId, meta } = useStore()
  const { events } = useEventList()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const paths = eventPaths(eventId)

  // Keep the same page (tamu/template/…) when switching to another event; a template :templateId does not carry over.
  const switchTo = (next: string) => {
    const page = pathname.slice(paths.root.length).split('/')[1] || 'event'
    navigate(`${eventPaths(next).root}/${page}`)
  }

  return (
    <Shell
      switcher={
        <>
          <Link to={PATHS.events} className={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Semua event">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
          {events && events.length > 1 ? (
            <NativeSelect aria-label="Pilih event" value={eventId} onChange={(e) => switchTo(e.target.value)} className="min-w-48">
              {events.map((ev) => (
                <NativeSelectOption key={ev.id} value={ev.id}>
                  {ev.nama_event || ev.slug}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <p className="font-medium">{meta?.event.nama_event}</p>
          )}
        </>
      }
    />
  )
}

function Shell({ switcher }: { switcher: React.ReactNode }) {
  const { eventId, loadError, reload, busy } = useStore()
  const { homePath } = useAuth()
  const paths = eventPaths(eventId)
  const tabs = [
    { to: paths.event, label: 'Data Event' },
    { to: paths.tamu, label: 'Tamu' },
    { to: paths.template, label: 'Template' },
    // { to: paths.dashboard, label: 'Dashboard' },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3">
        {switcher}
        <nav aria-label="Menu event" className="order-3 -mx-1 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} className={tabCls}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        {busy && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3.5" />
            {busy}…
          </span>
        )}
      </div>

      {loadError ? (
        <Empty role="alert" className="mt-16">
          <EmptyHeader>
            <EmptyTitle>Gagal memuat event</EmptyTitle>
            <EmptyDescription>{loadError}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button variant="outline" onClick={() => void reload()}>
              Coba lagi
            </Button>
            <Link to={homePath} className={buttonVariants()}>
              Kembali
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <Outlet />
      )}
    </div>
  )
}
