import { useStore } from '@/core/store'

export function Toaster() {
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
