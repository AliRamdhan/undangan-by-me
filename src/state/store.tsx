import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApi, loadSettings, saveSettings, type ApiSettings } from '../api'
import type { UndanganApi } from '../api/types'
import { errorText } from './errors'
import type { Guest, Meta, Template } from '../domain/types'

export interface Toast {
  id: number
  tone: 'ok' | 'error' | 'info'
  text: string
}

interface Store {
  api: UndanganApi
  settings: ApiSettings
  applySettings: (s: ApiSettings) => void
  meta: Meta | null
  guests: Guest[]
  templates: Template[]
  loading: boolean
  loadError: string | null
  /** Label of the action in flight, if any — the UI disables other actions meanwhile. */
  busy: string | null
  reload: () => Promise<void>
  /**
   * Runs one backend action, then refetches: the backend (sheet) is the
   * source of truth, so the UI never patches its own copy optimistically.
   */
  run: <T>(label: string, fn: (api: UndanganApi) => Promise<T>) => Promise<T | undefined>
  toasts: Toast[]
  toast: (tone: Toast['tone'], text: string) => void
  dismiss: (id: number) => void
}

const Ctx = createContext<Store | null>(null)

let toastSeq = 0

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadSettings)
  const api = useMemo(() => createApi(settings), [settings])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback(
    (tone: Toast['tone'], text: string) => {
      const id = ++toastSeq
      setToasts((t) => [...t.slice(-3), { id, tone, text }])
      setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4000)
    },
    [dismiss],
  )

  const reload = useCallback(async () => {
    try {
      const [m, g, t] = await Promise.all([api.getMeta(), api.listGuests(), api.listTemplates()])
      setMeta(m)
      setGuests(g)
      setTemplates(t)
      setLoadError(null)
    } catch (e) {
      setLoadError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    // Initial fetch and refetch on adapter change; state is set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const run = useCallback(
    async <T,>(label: string, fn: (api: UndanganApi) => Promise<T>) => {
      setBusy(label)
      try {
        return await fn(api)
      } catch (e) {
        toast('error', `${label}: ${errorText(e)}`)
        return undefined
      } finally {
        await reload()
        setBusy(null)
      }
    },
    [api, reload, toast],
  )

  const applySettings = useCallback((s: ApiSettings) => {
    saveSettings(s)
    setLoading(true)
    setSettings(s)
  }, [])

  const value: Store = {
    api,
    settings,
    applySettings,
    meta,
    guests,
    templates,
    loading,
    loadError,
    busy,
    reload,
    run,
    toasts,
    toast,
    dismiss,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
