import { useContext } from 'react'
import { StoreContext, type Store } from './context'

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
