import {
  Analytics01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  FavouriteIcon,
  FileImportIcon,
  MessageEdit01Icon,
  PaintBoardIcon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { cn } from 'cn'
import { Link, useNavigate } from 'react-router'
import { GridBackdrop } from '@/components/GridBackdrop'
import { PhoneMockup } from '@/components/PhoneMockup'
import { useAuth } from '@/core/auth'
import { PORTFOLIO, usedCategories } from '@/core/domain/portfolio'
import {
  formatRupiah,
  formatRupiahK,
  MARKET_RANGE,
  orderLink,
  orderNumber,
  PLAN_CORE,
  PRICING_INCLUDED,
  PRICING_PLANS,
  savingPct,
  startingPrice,
  type PricingPlan,
} from '@/core/domain/pricing'
import { cta } from '@/layouts/PublicLayout'
import { PortfolioCard } from '@/pages/Portfolio/components/PortfolioCard'
import { PATHS } from '@/route.paths'

const CATEGORY_COUNT = usedCategories(PORTFOLIO).length
const [LEFT, CENTER, RIGHT] = [PORTFOLIO[0], PORTFOLIO[1], PORTFOLIO[2]]
const SHOWCASE = PORTFOLIO.slice(0, 3)
const ORDER_NUMBER = orderNumber(import.meta.env.VITE_ORDER_WHATSAPP)
const STARTING_PRICE = startingPrice(PRICING_PLANS)

const HIGHLIGHTS = ['Link WhatsApp per tamu', 'Import CSV & Excel', 'Ucapan tamu langsung di undangan']

const STATS = [
  { value: 'Revisi bebas', label: 'desain fully custom' },
  { value: String(CATEGORY_COUNT), label: 'kategori desain' },
  { value: '1 link', label: 'personal untuk tiap tamu' },
  { value: 'CSV & Excel', label: 'import daftar tamu' },
]

/** Every claim here maps to a shipped feature: the templates in public/events and the admin pages. */
const FEATURES: { icon: IconSvgElement; title: string; body: string }[] = [
  {
    icon: PaintBoardIcon,
    title: 'Desain fully custom',
    body: 'Setiap undangan dirancang khusus mengikuti tema, warna, dan gaya acara Anda. Revisi bebas sampai puas.',
  },
  {
    icon: WhatsappIcon,
    title: 'Link WhatsApp personal',
    body: 'Setiap tamu mendapat link undangan dan pesan dengan namanya sendiri, siap dikirim lewat WhatsApp.',
  },
  {
    icon: FileImportIcon,
    title: 'Import tamu dari Excel',
    body: 'Unggah daftar tamu dari CSV atau Excel (Gelar, Nama, HP). PIN setiap tamu dibuat otomatis.',
  },
  {
    icon: MessageEdit01Icon,
    title: 'Template pesan',
    body: 'Tulis kata-kata undangan sekali, lalu lihat pratinjau persis seperti yang diterima tiap tamu.',
  },
  {
    icon: FavouriteIcon,
    title: 'Fitur undangan lengkap',
    body: 'Musik, galeri, peta lokasi, hitung mundur, ucapan tamu, dan hadiah digital di setiap desain.',
  },
  {
    icon: Analytics01Icon,
    title: 'Dasbor & ekspor',
    body: 'Pantau jumlah tamu dan kelengkapan datanya, lalu ekspor daftar tamu ke Excel.',
  },
]

const STEPS = [
  { title: 'Pilih desain', body: 'Jelajahi portfolio, buka demonya, dan pilih yang paling cocok dengan acara Anda.' },
  { title: 'Isi acara & tamu', body: 'Lengkapi detail acara, lalu import daftar tamu dari CSV atau Excel.' },
  { title: 'Kirim & kelola', body: 'Kirim link personal lewat WhatsApp Anda dan kelola daftar tamu dari dasbor.' },
]

/** Public landing page at `/`. CTAs lead to the portfolio and the login. */
export function Landing() {
  const { user, homePath } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      <title>Undangan · Undangan digital & manajemen tamu</title>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <GridBackdrop />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary" />
              Undangan digital + manajemen tamu
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Undangan digital yang elegan,{' '}
              <span className="bg-linear-to-r from-primary to-violet-600 bg-clip-text text-transparent dark:to-violet-300">
                tamu yang terkelola.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg lg:mx-0">
              Desain fully custom dengan revisi bebas, import daftar tamu dari Excel, lalu kirim link undangan personal ke setiap tamu lewat WhatsApp. Semua
              dari satu dasbor.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link to={PATHS.portfolio} className={cta('default', 'lg')}>
                Lihat desain
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  data-icon="inline-end"
                  className="transition-transform group-hover/button:translate-x-0.5"
                />
              </Link>
              <Link to={user ? homePath : PATHS.login} className={cn(cta('outline', 'lg'), 'bg-background/70')}>
                {user ? 'Buka dasbor' : 'Masuk ke dasbor'}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-primary" />
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* Proof strip — real numbers from the catalogue and the product */}
      <section aria-label="Sekilas" className="border-y bg-card/40">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.value}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Features */}
      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="Fitur"
          title="Semua yang dibutuhkan, dari undangan sampai tamu"
          body="Desain yang memikat untuk tamu, alat yang rapi untuk Anda."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-md">
              <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <HugeiconsIcon icon={f.icon} strokeWidth={2} className="size-5" />
              </span>
              <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="scroll-mt-20 border-y bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-24">
          <SectionHeading eyebrow="Cara kerja" title="Tiga langkah, undangan siap dikirim" />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border bg-background p-6">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Showcase */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading align="left" eyebrow="Portfolio" title="Desain pilihan" body="Arahkan kursor ke kartu untuk melihat seluruh halaman." />
          <Link to={PATHS.portfolio} className={cta('outline')}>
            Lihat semua desain
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE.map((item) => (
            <PortfolioCard key={item.slug} item={item} onCategory={(id) => navigate(`${PATHS.portfolio}?kategori=${id}`)} />
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="harga" className="scroll-mt-20 border-y bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-24">
          <SectionHeading eyebrow="Harga" title="Desain fully custom, revisi bebas" />

          {/* Market anchor */}
          <div className="mx-auto mt-10 max-w-2xl text-center">
            <p className="text-sm text-muted-foreground sm:text-base">Biasanya bikin undangan digital di vendor lain:</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-muted-foreground/50 sm:text-4xl">
              <s>{formatRupiahK(MARKET_RANGE.min)}</s> – <s>{formatRupiahK(MARKET_RANGE.max)}</s>
            </p>
            <div aria-hidden className="mx-auto my-6 h-0.5 w-16 rounded-full bg-border" />
            <p className="text-sm font-medium sm:text-base">Di sini? Mulai dari:</p>
            <p className="mt-1 text-6xl font-semibold tracking-tight text-primary tabular-nums sm:text-7xl">{formatRupiahK(STARTING_PRICE)}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Sekali bayar, hemat hingga {savingPct(STARTING_PRICE, MARKET_RANGE.max)}% dibanding vendor lain.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl items-start gap-4 md:grid-cols-2">
            {PRICING_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
          <ul className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {PRICING_INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-1">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3.5 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          {/* <div className="mx-auto mt-12 max-w-2xl rounded-2xl border bg-background p-6">
            <h3 className="text-base font-semibold">Add-on</h3>
            <dl className="mt-4 divide-y text-sm">
              {PRICING_ADDONS.map((a) => (
                <div key={a.name} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{a.name}</dt>
                  <dd className="shrink-0 font-medium tabular-nums">{a.price}</dd>
                </div>
              ))}
            </dl>
          </div> */}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-16">
          <GridBackdrop line="color-mix(in oklch, var(--color-primary-foreground) 14%, transparent)" glow={false} />
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Siap membuat undangan digital Anda?</h2>
          <p className="mx-auto mt-3 max-w-lg text-pretty opacity-80">Mulai dari memilih desain, lalu kelola tamu dari dasbor.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={PATHS.portfolio} className={cn(cta('default', 'lg'), 'bg-primary-foreground text-primary hover:bg-primary-foreground/90')}>
              Lihat desain
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
            </Link>
            <Link
              to={user ? homePath : PATHS.login}
              className={cn(
                cta('outline', 'lg'),
                'border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:bg-transparent',
              )}
            >
              {user ? 'Buka dasbor' : 'Masuk'}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function SectionHeading({ eyebrow, title, body, align = 'center' }: { eyebrow: string; title: string; body?: string; align?: 'center' | 'left' }) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-pretty text-muted-foreground">{body}</p>}
    </div>
  )
}

const PLAN_NAME = Object.fromEntries(PRICING_PLANS.map((p) => [p.id, p.name]))

/** One package: starting price, inclusions, and the WhatsApp order button (portfolio when no order number is set). */
function PlanCard({ plan }: { plan: PricingPlan }) {
  const href = orderLink(plan, ORDER_NUMBER)
  const variant = plan.featured ? 'default' : 'outline'

  return (
    <div className={cn('flex h-full flex-col rounded-2xl border bg-background p-6', plan.featured && 'border-primary shadow-lg ring-1 ring-primary')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.featured && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">Rekomendasi</span>}
      </div>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{plan.tagline}</p>

      <div className="mt-6">
        <p className="text-sm text-muted-foreground">Mulai dari</p>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatRupiah(plan.price)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Sekali bayar</p>
      </div>

      <ul className="mt-6 flex flex-col gap-2 rounded-xl bg-primary-soft p-3 text-sm font-medium text-primary">
        {PLAN_CORE.map((c) => (
          <li key={c} className="flex gap-2">
            <HugeiconsIcon icon={PaintBoardIcon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
            <span className="text-pretty">{c}</span>
          </li>
        ))}
      </ul>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm">
        {plan.includesPrevious && <li className="font-medium">Semua di {PLAN_NAME[plan.includesPrevious]}, plus:</li>}
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-pretty">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cn(cta(variant, 'lg'), 'w-full')}>
            <HugeiconsIcon icon={WhatsappIcon} strokeWidth={2} data-icon="inline-start" />
            Pesan via WhatsApp
          </a>
        ) : (
          <Link to={PATHS.portfolio} className={cn(cta(variant, 'lg'), 'w-full')}>
            Pilih desain
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
          </Link>
        )}
      </div>
    </div>
  )
}

/** Three designs in phone frames, with two floating feature chips. */
function HeroVisual() {
  return (
    <div className="relative mx-auto h-[23rem] w-full max-w-md sm:h-[30rem]">
      <PhoneMockup slug={LEFT.slug} className="absolute top-10 left-2 w-32 -rotate-6 sm:top-12 sm:w-44" />
      <PhoneMockup slug={RIGHT.slug} className="absolute top-10 right-2 w-32 rotate-6 sm:top-12 sm:w-44" />
      <PhoneMockup
        slug={CENTER.slug}
        alt={`Desain ${CENTER.title}`}
        className="absolute top-0 left-1/2 z-10 w-40 -translate-x-1/2 sm:w-52"
      />
      <FeatureChip icon={WhatsappIcon} title="Link personal terkirim" sub="via WhatsApp" className="bottom-10 left-0 sm:bottom-16" />
      <FeatureChip icon={FileImportIcon} title="Daftar tamu diimpor" sub="dari Excel" className="top-24 right-0 hidden sm:flex" />
    </div>
  )
}

function FeatureChip({ icon, title, sub, className }: { icon: IconSvgElement; title: string; sub: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('absolute z-20 flex items-center gap-2.5 rounded-xl border bg-card/95 py-2 pr-4 pl-2 shadow-lg backdrop-blur', className)}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-xs font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
    </div>
  )
}
