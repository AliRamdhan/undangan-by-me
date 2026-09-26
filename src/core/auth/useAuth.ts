import { useContext } from 'react'
import { AuthContext, type Auth } from './context'

export function useAuth(): Auth {
  const a = useContext(AuthContext)
  if (!a) throw new Error('useAuth outside AuthProvider')
  return a
}
