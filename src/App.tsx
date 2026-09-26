import { ThemeProvider } from 'next-themes'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/core/auth'
import { router } from '@/route'

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="undangan.theme" disableTransitionOnChange>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors closeButton position="bottom-right" />
      </AuthProvider>
    </ThemeProvider>
  )
}
