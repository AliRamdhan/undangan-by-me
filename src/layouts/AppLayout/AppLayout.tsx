import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Toaster } from '@/components/Toaster'
import { useStore } from '@/core/store'
import { PATHS } from '@/route.paths'

const TABS = [
  { to: PATHS.tamu, label: 'Tamu' },
  { to: PATHS.template, label: 'Template' },
  { to: PATHS.dashboard, label: 'Dashboard' },
] as const

const tabCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`

/** Header with the gateway-mode badge and main navigation; pages render in <Outlet/>. */
export function AppLayout() {
  const { meta, api, loadError, reload, busy } = useStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const live = meta?.mode === 'LIVE'
  // Settings must stay reachable when loading fails — that's where the data source is fixed.
  const showError = loadError && pathname !== PATHS.pengaturan

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="text-xl">
              📨
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[15px] leading-tight font-semibold">
                Undangan
                {meta && (
                  // The gateway mode is always visible so nobody finds out after 300 messages.
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide ${live ? 'tint-critical text-critical-ink' : 'tint-warning text-warning-ink'}`}
                    title={live ? 'Blast mengirim pesan sungguhan' : 'Blast hanya simulasi — tidak ada pesan terkirim'}
                  >
                    [{meta.mode}]
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-ink-3">
                {meta?.event.nama_event ?? 'Memuat…'}
                {api.kind === 'mock' && ' · data contoh'}
              </p>
            </div>
          </div>
          <nav aria-label="Menu utama" className="order-3 -mx-1 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} className={tabCls}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {busy && (
              <span className="flex items-center gap-2 text-xs text-ink-3" role="status">
                <span className="size-3 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
                {busy}…
              </span>
            )}
            <NavLink to={PATHS.pengaturan} aria-label="Pengaturan" className={tabCls}>
              ⚙ <span className="hidden sm:inline">Pengaturan</span>
            </NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6">
        {showError ? (
          <div role="alert" className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
            <p className="font-medium">Gagal memuat data</p>
            <p className="text-sm text-ink-2">{loadError}</p>
            <div className="flex gap-2">
              <Button onClick={() => void reload()}>Coba lagi</Button>
              <Button variant="primary" onClick={() => navigate(PATHS.pengaturan)}>
                Buka Pengaturan
              </Button>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <Toaster />
    </div>
  )
}
