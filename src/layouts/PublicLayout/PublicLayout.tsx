import { ArrowRight01Icon, DashboardSquare01Icon, Menu01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from 'cn'
import { useState } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Brand } from '@/components/Brand'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/core/auth'
import { PATHS } from '@/route.paths'
import { cta } from './cta'

/** Landing-page anchors work from any public page; ScrollRestoration scrolls to the hash. */
const NAV = [
  { label: 'Fitur', to: '/#fitur' },
  { label: 'Cara kerja', to: '/#cara-kerja' },
  { label: 'Harga', to: '/#harga' },
  { label: 'Portfolio', to: PATHS.portfolio },
] as const

/**
 * A landing-page anchor clicked while already on `/`: glide there instead of the
 * router's instant jump (instant when the user prefers reduced motion). From
 * other pages the link navigates normally and ScrollRestoration jumps to the hash.
 * Returns whether it handled the click.
 */
function glideToAnchor(to: string, pathname: string, delay = 0) {
  const [path, id] = to.split('#')
  if (!id || path !== pathname) return false
  const go = () => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    window.history.replaceState(window.history.state, '', to)
  }
  if (delay) window.setTimeout(go, delay)
  else go()
  return true
}

/** Shell of the public site (`/`, `/portfolio`): sticky header, page, footer. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollRestoration />
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}

/** Masuk for visitors, Dasbor for a signed-in user. */
function AccountLink({ className }: { className?: string }) {
  const { user, homePath } = useAuth()
  return user ? (
    <Link to={homePath} className={cn(cta(), className)}>
      <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} data-icon="inline-start" />
      Dasbor
    </Link>
  ) : (
    <Link to={PATHS.login} className={cn(cta(), className)}>
      Masuk
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        data-icon="inline-end"
        className="transition-transform group-hover/button:translate-x-0.5"
      />
    </Link>
  )
}

function PublicHeader() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Brand />
        <nav aria-label="Menu utama" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={pathname === item.to ? 'page' : undefined}
              onClick={(e) => glideToAnchor(item.to, pathname) && e.preventDefault()}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="size-8 rounded-full" />
          <AccountLink />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-8 rounded-full md:hidden" aria-label="Buka menu" />}>
              <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 gap-6 p-6">
              <SheetTitle className="text-sm font-semibold">Menu</SheetTitle>
              <nav aria-label="Menu utama" className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={(e) => {
                      setMenuOpen(false)
                      if (glideToAnchor(item.to, pathname, 250)) e.preventDefault()
                    }}
                    aria-current={pathname === item.to ? 'page' : undefined}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

function PublicFooter() {
  const { user, homePath } = useAuth()
  const { pathname } = useLocation()
  const columns = [
    { title: 'Produk', links: NAV },
    { title: 'Akun', links: [user ? { label: 'Dasbor', to: homePath } : { label: 'Masuk', to: PATHS.login }] },
  ]

  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div>
          <Brand />
          <p className="mt-3 max-w-xs text-sm text-pretty text-muted-foreground">
            Undangan digital dan manajemen tamu dalam satu tempat, dari desain sampai link WhatsApp personal.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={(e) => glideToAnchor(l.to, pathname) && e.preventDefault()}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">© {new Date().getFullYear()} Undangan.byme</p>
      </div>
    </footer>
  )
}
