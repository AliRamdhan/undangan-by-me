import { RouterProvider } from 'react-router'
import { StoreProvider } from '@/core/store'
import { router } from '@/route'

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  )
}
