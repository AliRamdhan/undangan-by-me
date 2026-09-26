import { createContext } from 'react'
import type { UndanganApi } from '@/core/api/types'
import type { Guest, Meta, Template } from '@/core/domain/types'

/** Data of the event in the URL (`/events/:slug/…`); one provider per slug. */
export interface Store {
  slug: string
  api: UndanganApi
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
}

export const StoreContext = createContext<Store | null>(null)
