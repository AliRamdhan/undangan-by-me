import { toast } from 'sonner'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApi, loadSettings, saveSettings, type ApiSettings } from '@/core/api'
import type { UndanganApi } from '@/core/api/types'
import { errorText } from './errors'
import type { Guest, Meta, Template } from '@/core/domain/types'
import { StoreContext, type Store } from './context'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadSettings)
  const api = useMemo(() => createApi(settings), [settings])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)


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
        toast.error(`${label}: ${errorText(e)}`)
        return undefined
      } finally {
        await reload()
        setBusy(null)
      }
    },
    [api, reload],
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
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
