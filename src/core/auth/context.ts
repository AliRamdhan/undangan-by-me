import { createContext } from 'react'
import type { AppApi, AuthUser } from '@/core/api/types'

export interface Auth {
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
