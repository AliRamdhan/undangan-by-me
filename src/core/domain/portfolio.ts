/**
 * The public design catalogue (/portfolio). Each item is a static invitation in
 * public/events/{slug}/ whose demo (?demo=1) renders its bundled assets/demo.json,
 * so a card never depends on a 01_Event row. Thumbnails come from
 * `npm run portfolio:thumbs`.
 */

/** Filter categories, in display order (the connectied portfolio's set). */
export const PORTFOLIO_CATEGORIES = [
  { id: 'split', label: 'Split' },
  { id: 'decorative', label: 'Dekoratif' },
  { id: 'simple', label: 'Sederhana' },
  { id: 'ethnic', label: 'Etnik' },
  { id: 'minimal', label: 'Minimalis' },
  { id: 'sangjit', label: 'Sangjit' },
  { id: 'exclusive', label: 'Eksklusif' },
] as const

export type PortfolioCategoryId = (typeof PORTFOLIO_CATEGORIES)[number]['id']
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number]
/** Selected categories; empty means all. */
export type PortfolioFilter = readonly PortfolioCategoryId[]

export interface PortfolioItem {
  /** Folder under public/events/ — also the demo URL. */
  slug: string
  /** Design name on the card. */
  title: string
  /** The sample couple shown in the demo. */
  couple: string
  categories: PortfolioCategoryId[]
}

export const PORTFOLIO: readonly PortfolioItem[] = [
  { slug: 'aurum', title: 'Aurum', couple: 'Adrian & Clarissa', categories: ['split', 'exclusive'] },
  { slug: 'shuangxi', title: 'Shuang Xi', couple: 'Angeline & Wilson', categories: ['ethnic', 'sangjit'] },
  { slug: 'bloom', title: 'Bloom', couple: 'Nadia & Raka', categories: ['decorative'] },
  { slug: 'ivory', title: 'Ivory', couple: 'Sekar & Bima', categories: ['minimal', 'simple'] },
  { slug: 'fidaeno', title: 'Fidaeno', couple: 'Fida & Eno', categories: ['decorative', 'simple'] },
  { slug: 'keraton', title: 'Keraton', couple: 'Laras & Prabu', categories: ['ethnic', 'exclusive'] },
  { slug: 'noir', title: 'Noir', couple: 'Alya & Reza', categories: ['split', 'minimal'] },
  { slug: 'senja', title: 'Senja', couple: 'Maya & Arga', categories: ['decorative'] },
  { slug: 'tirta', title: 'Tirta', couple: 'Dinda & Ilham', categories: ['decorative', 'simple'] },
]

/** The live demo: the template rendering its own sample data. */
export const demoUrl = (slug: string) => `/events/${encodeURIComponent(slug)}/?demo=1`

/** Full-page screenshot used as the card image. */
export const thumbUrl = (slug: string) => `/events/${encodeURIComponent(slug)}/assets/portfolio.jpg`

/**
 * Repeated `?kategori=` values → a valid filter: unknown ids and duplicates are
 * dropped, the rest kept in display order. Nothing valid means all.
 */
export function parseFilter(values: readonly string[]): PortfolioCategoryId[] {
  const picked = new Set(values)
  return PORTFOLIO_CATEGORIES.filter((c) => picked.has(c.id)).map((c) => c.id)
}

/** Categories that have at least one item, in display order — no chip ever filters to nothing. */
export function usedCategories(items: readonly PortfolioItem[]): PortfolioCategory[] {
  const used = new Set(items.flatMap((i) => i.categories))
  return PORTFOLIO_CATEGORIES.filter((c) => used.has(c.id))
}

/** Items in any of the selected categories; an empty filter keeps everything. */
export function filterPortfolio(items: readonly PortfolioItem[], filter: PortfolioFilter): PortfolioItem[] {
  return filter.length === 0 ? [...items] : items.filter((i) => i.categories.some((c) => filter.includes(c)))
}

export const categoryLabel = (id: PortfolioCategoryId) => PORTFOLIO_CATEGORIES.find((c) => c.id === id)!.label
