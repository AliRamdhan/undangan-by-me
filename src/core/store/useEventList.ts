import { useCallback, useEffect, useState } from 'react'
import type { EventSummary } from '@/core/api/types'
import { useAuth } from '@/core/auth'
import { errorText } from './errors'

/** GET /event — the list page and the header's event switcher. */
export function useEventList() {
  const { app } = useAuth()
  const [events, setEvents] = useState<EventSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setEvents(await app.listEvents())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
  }, [app])

  useEffect(() => {
    // Fetch on mount and whenever the session/backend changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  return { events, error, reload }
}
