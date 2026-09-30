import { AppsScriptApp } from '@/core/api/appsScript'
import type { AppApi, Session } from '@/core/api/types'

/**
 * The Apps Script Web App's /exec URL. Build-time only (`.env` for dev,
 * `.env.production` for a build) — users cannot point the app elsewhere.
 */
export const APPS_SCRIPT_URL = (import.meta.env.VITE_APPS_SCRIPT_URL ?? '').trim()

const SESSION_KEY = 'undangan.session'

/** The stored login, or null once it has expired. */
export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null
    if (s?.token && Date.parse(s.expiresAt) > Date.now()) return s
  } catch {
    // ignore unreadable storage
  }
  return null
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // The session then lasts for this page load only.
  }
}

export function createApp(session: Session | null, onUnauthorized?: () => void): AppApi {
  return new AppsScriptApp(APPS_SCRIPT_URL, session?.token ?? null, onUnauthorized)
}
