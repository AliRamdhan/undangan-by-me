import { createContext } from 'react'
import type { ApiSettings } from '@/core/api'
import type { AppApi, AuthUser } from '@/core/api/types'

export interface Auth {
  /** Backend choice (mock / Apps Script URL), needed before anyone can log in. */
  settings: ApiSettings
  /** Switching backend ends the session: a token belongs to one backend. */
  applySettings: (s: ApiSettings) => void
  /** Auth + event list, carrying the current token. */
  app: AppApi
  user: AuthUser | null
  isSuperAdmin: boolean
  /** Where this user starts: the event list for SUPER_ADMIN, its own event for a CLIENT. */
  homePath: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
}

export const AuthContext = createContext<Auth | null>(null)
