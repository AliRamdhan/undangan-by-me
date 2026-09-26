import { AppsScriptApp } from '@/core/api/appsScript'
import { MockApp } from '@/core/api/mock'
import type { AppApi, Session } from '@/core/api/types'

/**
 * The mock backend and its seed data exist only in development (`npm run dev`,
 * tests). `vite build` replaces this with `false`, so every mock branch — and
 * with it mock.ts and seed.ts — is dropped from the production bundle, which
 * always talks to the Apps Script Web App.
 */
export const MOCK_ENABLED = import.meta.env.DEV

export interface ApiSettings {
  mode: 'mock' | 'appsscript'
  url: string
}

const SETTINGS_KEY = 'undangan.settings'
const SESSION_KEY = 'undangan.session'

export function loadSettings(): ApiSettings {
  const envMode = import.meta.env.VITE_API_MODE === 'appsscript' ? 'appsscript' : 'mock'
  const envUrl = import.meta.env.VITE_APPS_SCRIPT_URL ?? ''
  let saved: Partial<ApiSettings> = {}
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<ApiSettings>
  } catch {
    // ignore unreadable storage
  }
  if (!MOCK_ENABLED) return { mode: 'appsscript', url: saved.url || envUrl }
  return { mode: saved.mode ?? envMode, url: saved.url || envUrl }
}

export function saveSettings(s: ApiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode: s.mode, url: s.url }))
  } catch {
    // Settings then last for this page load only.
  }
}

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

export function createApp(s: ApiSettings, session: Session | null, onUnauthorized?: () => void): AppApi {
  const token = session?.token ?? null
  if (MOCK_ENABLED && s.mode === 'mock') return new MockApp(token, onUnauthorized)
  return new AppsScriptApp(s.url, token, onUnauthorized)
}
