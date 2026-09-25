import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { SettingsSheet } from '@/components/SettingsSheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, buttonVariants } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useStore } from '@/core/store'
import { PATHS } from '@/route.paths'

const TABS = [
  { to: PATHS.root, label: 'Events' },
  { to: PATHS.tamu, label: 'Tamu' },
  { to: PATHS.template, label: 'Template' },
  // { to: PATHS.dashboard, label: 'Dashboard' },
] as const

const tabCls = ({ isActive }: { isActive: boolean }) =>
  buttonVariants({ variant: 'ghost', size: 'lg', className: isActive ? 'bg-primary-soft text-primary hover:bg-primary-soft' : 'text-muted-foreground' })

/** Header with the gateway-mode badge and main navigation; pages render in <Outlet/>. */
export function AppLayout() {
  const { meta, api, loadError, reload, busy } = useStore()
  // Pengaturan is a sheet over the current page, so it stays reachable even when loading fails.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const live = meta?.mode === 'LIVE'

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="text-xl">
              📨
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[15px] leading-tight font-semibold">
                Undangan
                {/* {meta && (
                  // The gateway mode is always visible so nobody finds out after 300 messages.
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide ${live ? 'tint-critical text-critical-ink' : 'tint-warning text-warning-ink'}`}
                    title={live ? 'Blast mengirim pesan sungguhan' : 'Blast hanya simulasi — tidak ada pesan terkirim'}
                  >
                    [{meta.mode}]
                  </span>
                )} */}
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
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3.5" />
                {busy}…
              </span>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="lg"
              aria-label="Pengaturan"
              aria-expanded={settingsOpen}
              className={settingsOpen ? 'bg-primary-soft text-primary hover:bg-primary-soft' : 'text-muted-foreground'}
              onClick={() => setSettingsOpen((o) => !o)}
            >
              <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
              <span className="hidden sm:inline">Pengaturan</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6">
        {loadError ? (
          <Empty role="alert" className="mt-16">
            <EmptyHeader>
              <EmptyTitle>Gagal memuat data</EmptyTitle>
              <EmptyDescription>{loadError}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              <Button variant="outline" onClick={() => void reload()}>
                Coba lagi
              </Button>
              <Button onClick={() => setSettingsOpen(true)}>Buka Pengaturan</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Outlet />
        )}
      </main>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
