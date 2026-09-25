import { ThemeProvider } from 'next-themes'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { StoreProvider } from '@/core/store'
import { router } from '@/route'

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="undangan.theme" disableTransitionOnChange>
      <StoreProvider>
        <RouterProvider router={router} />
        <Toaster richColors closeButton position="bottom-right" />
      </StoreProvider>
    </ThemeProvider>
  )
}
