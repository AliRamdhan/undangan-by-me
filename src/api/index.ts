import { AppsScriptApi } from './appsScript'
import { MockApi } from './mock'
import type { UndanganApi } from './types'

export interface ApiSettings {
  mode: 'mock' | 'appsscript'
  url: string
  /** Kept in sessionStorage only — never in the bundle or localStorage. */
  key: string
}

const SETTINGS_KEY = 'undangan.settings'
const ADMIN_KEY = 'undangan.adminKey'

export function loadSettings(): ApiSettings {
  const envMode = import.meta.env.VITE_API_MODE === 'appsscript' ? 'appsscript' : 'mock'
  const envUrl = import.meta.env.VITE_APPS_SCRIPT_URL ?? ''
  let saved: Partial<ApiSettings> = {}
  let key = ''
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<ApiSettings>
  } catch {
    // ignore unreadable storage
  }
  try {
    key = sessionStorage.getItem(ADMIN_KEY) ?? ''
  } catch {
    // ignore
  }
  return { mode: saved.mode ?? envMode, url: saved.url || envUrl, key }
}

export function saveSettings(s: ApiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode: s.mode, url: s.url }))
    sessionStorage.setItem(ADMIN_KEY, s.key)
  } catch {
    // Settings then last for this page load only.
  }
}

export function createApi(s: ApiSettings): UndanganApi {
  if (s.mode === 'appsscript' && s.url) return new AppsScriptApi(s.url, s.key)
  return new MockApi()
}
