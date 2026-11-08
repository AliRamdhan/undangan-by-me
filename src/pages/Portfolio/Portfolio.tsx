import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { GridBackdrop } from '@/components/GridBackdrop'
import { Button } from '@/components/ui/button'
import { filterPortfolio, parseFilter, PORTFOLIO, usedCategories, type PortfolioCategoryId } from '@/core/domain/portfolio'
import { ActiveCategories, CategoryFilter } from './components/CategoryFilter'
import { PortfolioCard } from './components/PortfolioCard'

const FIRST_PAGE = 9
const MORE = 6
const CATEGORIES = usedCategories(PORTFOLIO)

/** Public design catalogue — no login. The filter lives in repeated `?kategori=` so a filtered view can be shared. */
export function Portfolio() {
  const [params, setParams] = useSearchParams()
  const filter = parseFilter(params.getAll('kategori'))
  const [shown, setShown] = useState(FIRST_PAGE)
  const items = filterPortfolio(PORTFOLIO, filter)

  const choose = (next: PortfolioCategoryId[]) => {
    setShown(FIRST_PAGE)
    setParams(next.length ? { kategori: next } : {}, { replace: true, preventScrollReset: true })
  }

  return (
    <>
      <title>Portfolio · Undangan.byme</title>
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
        <GridBackdrop />
        <div className="mx-auto max-w-3xl px-4 pt-14 pb-12 text-center sm:px-6 sm:pt-20 sm:pb-16">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            Portfolio · {PORTFOLIO.length} desain
          </span>
          <h1 id="hero-title" className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Desain undangan digital
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
            Setiap desain dirancang dengan sepenuh hati, untuk pernikahan, sangjit, hingga acara keluarga. Arahkan kursor ke kartu untuk
            melihat seluruh halaman, lalu buka demonya untuk mencoba undangan seperti yang diterima tamu Anda.
          </p>
        </div>
      </section>

      <section id="gallery" aria-labelledby="gallery-title" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="gallery-title" className="text-2xl font-semibold tracking-tight">
                Koleksi desain
              </h2>
              <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                Menampilkan {items.length} dari {PORTFOLIO.length} desain
              </p>
            </div>
            <CategoryFilter categories={CATEGORIES} value={filter} onChange={choose} />
          </div>
          <ActiveCategories value={filter} onChange={choose} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, shown).map((item) => (
            <PortfolioCard key={item.slug} item={item} onCategory={(id) => choose([id])} />
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
    </>
  )
}
