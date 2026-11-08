import { ArrowDown01Icon, DashboardSquare01Icon, Login01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, buttonVariants } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAuth } from '@/core/auth'
import { filterPortfolio, parseFilter, PORTFOLIO, usedCategories, type PortfolioFilter } from '@/core/domain/portfolio'
import { PATHS } from '@/route.paths'
import { PortfolioCard } from './components/PortfolioCard'

const FIRST_PAGE = 9
const MORE = 6
const CATEGORIES = usedCategories(PORTFOLIO)

const chip =
  'rounded-full px-3.5 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90'

/** Public design catalogue — no login. The filter lives in `?kategori=` so a filtered view can be shared. */
export function Portfolio() {
  const { user, homePath } = useAuth()
  const [params, setParams] = useSearchParams()
  const filter = parseFilter(params.get('kategori'))
  const [shown, setShown] = useState(FIRST_PAGE)
  const items = filterPortfolio(PORTFOLIO, filter)

  const choose = (next: PortfolioFilter) => {
    setShown(FIRST_PAGE)
    setParams(next === 'all' ? {} : { kategori: next }, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <title>Portfolio · Undangan</title>
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to={PATHS.portfolio} className="flex items-center gap-2.5">
            <span aria-hidden className="text-xl">
              📨
            </span>
            <span className="text-[15px] font-semibold">Undangan</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to={homePath} className={buttonVariants({ variant: 'outline' })}>
                <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} data-icon="inline-start" />
                Dasbor
              </Link>
            ) : (
              <Link to={PATHS.login} className={buttonVariants({ variant: 'outline' })}>
                <HugeiconsIcon icon={Login01Icon} strokeWidth={2} data-icon="inline-start" />
                Masuk
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center sm:px-6 sm:pt-16">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">Portfolio</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Desain undangan digital</h1>
          <p className="mt-3 text-pretty text-muted-foreground">
            Setiap desain dirancang dengan sepenuh hati, untuk pernikahan, sangjit, hingga acara keluarga. Arahkan kursor ke kartu untuk
            melihat seluruh halaman, lalu buka demonya untuk mencoba undangan seperti yang diterima tamu Anda.
          </p>
        </section>

        <section id="gallery" aria-label="Galeri desain" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 pb-16 sm:px-6">
          <div className="mb-6 flex flex-col items-center gap-3">
            <ToggleGroup
              aria-label="Filter kategori"
              variant="outline"
              size="lg"
              className="max-w-full flex-wrap justify-center"
              value={[filter]}
              onValueChange={(v) => v.length && choose(v[0] as PortfolioFilter)}
            >
              <ToggleGroupItem value="all" className={chip}>
                Semua
              </ToggleGroupItem>
              {CATEGORIES.map((c) => (
                <ToggleGroupItem key={c.id} value={c.id} className={chip}>
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {items.length} desain
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, shown).map((item) => (
              <PortfolioCard key={item.slug} item={item} onCategory={choose} />
            ))}
          </div>

          {items.length > shown && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" size="lg" onClick={() => setShown((n) => n + MORE)}>
                <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} data-icon="inline-start" />
                Muat lagi
              </Button>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">Undangan digital · by.me</footer>
    </div>
  )
}
