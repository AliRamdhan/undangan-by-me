import { useEffect, useState } from 'react'
import { Button } from './components/ui'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { GuestsPage } from './features/guests/GuestsPage'
import { SettingsDrawer } from './features/settings/SettingsDrawer'
import { TemplatesPage } from './features/templates/TemplatesPage'
import { useStore } from './state/store'

const TABS = [
  { id: 'tamu', label: 'Tamu' },
  { id: 'template', label: 'Template' },
  { id: 'dashboard', label: 'Dashboard' },
] as const
type TabId = (typeof TABS)[number]['id']

const readHash = (): TabId => {
  const h = window.location.hash.slice(1)
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'tamu'
}

function Toasts() {
  const { toasts, dismiss } = useStore()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            t.tone === 'error' ? 'border-critical/40 tint-critical text-critical-ink' : 'border-line bg-surface text-ink'
          }`}
        >
          <span aria-hidden>{t.tone === 'error' ? '!' : t.tone === 'ok' ? '✓' : 'i'}</span>
          <span className="flex-1">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink" aria-label="Tutup notifikasi">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { meta, api, loadError, reload, busy } = useStore()
  const [tab, setTab] = useState<TabId>(readHash)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const onHash = () => setTab(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const live = meta?.mode === 'LIVE'

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="text-xl">
              📨
            </span>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[15px] leading-tight font-semibold">
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
              </h1>
              <p className="truncate text-xs text-ink-3">
                {meta?.event.nama_event ?? 'Memuat…'}
                {api.kind === 'mock' && ' · data contoh'}
              </p>
            </div>
          </div>
          <nav aria-label="Menu utama" className="order-3 -mx-1 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}
              >
                {t.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {busy && (
              <span className="flex items-center gap-2 text-xs text-ink-3" role="status">
                <span className="size-3 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
                {busy}…
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Pengaturan">
              ⚙ <span className="hidden sm:inline">Pengaturan</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6">
        {loadError ? (
          <div role="alert" className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
            <p className="font-medium">Gagal memuat data</p>
            <p className="text-sm text-ink-2">{loadError}</p>
            <div className="flex gap-2">
              <Button onClick={() => void reload()}>Coba lagi</Button>
              <Button variant="primary" onClick={() => setSettingsOpen(true)}>
                Buka Pengaturan
              </Button>
            </div>
          </div>
        ) : tab === 'tamu' ? (
          <GuestsPage />
        ) : tab === 'template' ? (
          <TemplatesPage />
        ) : (
          <DashboardPage />
        )}
      </main>

      {settingsOpen && <SettingsDrawer open onClose={() => setSettingsOpen(false)} />}
      <Toasts />
    </div>
  )
}
