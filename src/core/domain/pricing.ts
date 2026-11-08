/**
 * The public price list (landing page, #harga). Every design is custom, starting
 * from a portfolio design, with revisions as needed — so prices are "mulai dari".
 * Packages differ only by guest management; every claim must match a shipped
 * feature (no RSVP or automatic WhatsApp blast yet).
 */

import { HP_PATTERN, normalizePhone } from '@/core/domain/phone'
import { waLink } from '@/core/domain/link'

export interface PricingPlan {
  id: 'undangan' | 'tamu'
  name: string
  /** One-line pitch under the name. */
  tagline: string
  /** Starting price in rupiah ("mulai dari"). */
  price: number
  /** Shown above the list as "Semua di <name>, plus:". */
  includesPrevious?: PricingPlan['id']
  features: readonly string[]
  /** The recommended package — highlighted. */
  featured?: boolean
}

/** Active period of every package's invitation page. */
export const ACTIVE_PERIOD = '1 tahun'

/** What every package gets, shown once as a small note under the cards. */
export const PRICING_INCLUDED: readonly string[] = [
  'Desain fully custom',
  'Revisi bebas sampai puas',
  'Dibuatkan admin, Anda tinggal kirim',
  `Aktif ${ACTIVE_PERIOD}`,
]

/** Shown at the top of every package card, before its own features. */
export const PLAN_CORE: readonly string[] = ['Desain fully custom & eksklusif', 'Revisi bebas sampai puas']

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'undangan',
    name: 'Esensial',
    tagline: 'Undangan website saja. Satu link untuk dibagikan ke semua tamu.',
    price: 79_000,
    features: [
      'Galeri foto & musik latar',
      'Hitung mundur, peta lokasi, simpan ke kalender',
      'Beberapa sesi acara & link live streaming',
      'Hadiah digital: rekening & QRIS',
      'Nama tamu di sampul lewat link',
    ],
  },
  {
    id: 'tamu',
    name: 'Lengkap',
    tagline: 'Undangan plus manajemen tamu: kelola daftar tamu dan kirim ke tiap tamu.',
    price: 149_000,
    includesPrevious: 'undangan',
    featured: true,
    features: [
      'Login dasbor untuk Anda sendiri',
      'Daftar tamu: input manual atau import Excel/CSV, tanpa batas',
      'Link personal ber-PIN untuk tiap tamu',
      'Template pesan dengan pratinjau per tamu',
      // 'Kirim WhatsApp manual satu per satu dari WA Anda',
      'Ucapan tamu langsung di undangan',
      'Ekspor daftar tamu ke Excel',
    ],
  },
]

/** What other vendors usually charge (riset Nov 2026: Viding, Katsudoto, Ze Invitation). */
export const MARKET_RANGE = { min: 300_000, max: 800_000 } as const

export interface PricingAddon {
  name: string
  /** Display price, e.g. "Rp25.000" or "50% harga paket". */
  price: string
}

export const PRICING_ADDONS: readonly PricingAddon[] = [
  { name: 'Domain .my.id', price: formatRupiah(25_000) },
  { name: 'Domain .com', price: formatRupiah(250_000) },
  { name: 'Pengerjaan kilat 24 jam', price: formatRupiah(50_000) },
  { name: 'Perpanjang masa aktif 12 bulan', price: formatRupiah(50_000) },
  { name: 'Undangan acara kedua (lamaran, khitanan)', price: '50% harga paket' },
]

/** `Rp149.000` — Indonesian grouping, no decimals. */
export function formatRupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount)}`
}

/** `Rp 79k` — the short form for headline prices (whole thousands only). */
export function formatRupiahK(amount: number): string {
  return amount % 1000 === 0 ? `Rp ${amount / 1000}k` : formatRupiah(amount)
}

/** The cheapest package's price — the "mulai dari" headline. */
export function startingPrice(plans: readonly Pick<PricingPlan, 'price'>[]): number {
  return Math.min(...plans.map((p) => p.price))
}

/** Whole-percent saving of `price` against the top of the market range. */
export function savingPct(price: number, marketMax: number): number {
  if (marketMax <= price) return 0
  return Math.round((1 - price / marketMax) * 100)
}

/** The prefilled WhatsApp message for ordering a package. */
export function orderMessage(plan: Pick<PricingPlan, 'name' | 'price'>): string {
  return `Halo, saya ingin memesan undangan digital paket ${plan.name} (mulai dari ${formatRupiah(plan.price)}). Boleh dibantu?`
}

/** The order number from VITE_ORDER_WHATSAPP, normalised; '' when unset or not a valid mobile. */
export function orderNumber(raw: string | undefined): string {
  const normalized = normalizePhone(raw ?? '')
  return HP_PATTERN.test(normalized) ? normalized : ''
}

/** wa.me link to order `plan`, or '' when there is no valid order number. */
export function orderLink(plan: Pick<PricingPlan, 'name' | 'price'>, number: string): string {
  return number ? waLink(number, orderMessage(plan)) : ''
}
