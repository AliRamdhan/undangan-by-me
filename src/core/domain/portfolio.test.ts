import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  demoUrl,
  filterPortfolio,
  parseFilter,
  PORTFOLIO,
  PORTFOLIO_CATEGORIES,
  thumbUrl,
  usedCategories,
  type PortfolioItem,
} from './portfolio'

const publicDir = fileURLToPath(new URL('../../../public', import.meta.url))

const items: PortfolioItem[] = [
  { slug: 'a', title: 'A', couple: '', categories: ['minimal'] },
  { slug: 'b', title: 'B', couple: '', categories: ['split', 'minimal'] },
]

describe('portfolio filters', () => {
  it('filters by any selected category, empty keeps everything', () => {
    expect(filterPortfolio(items, []).map((i) => i.slug)).toEqual(['a', 'b'])
    expect(filterPortfolio(items, ['split']).map((i) => i.slug)).toEqual(['b'])
    expect(filterPortfolio(items, ['split', 'minimal']).map((i) => i.slug)).toEqual(['a', 'b'])
    expect(filterPortfolio(items, ['sangjit'])).toEqual([])
  })

  it('offers only categories that have items, in display order', () => {
    expect(usedCategories(items).map((c) => c.id)).toEqual(['split', 'minimal'])
  })

  it('reads repeated ?kategori=, keeping known ids once in display order', () => {
    expect(parseFilter(['sangjit'])).toEqual(['sangjit'])
    expect(parseFilter(['sangjit', 'split', 'sangjit'])).toEqual(['split', 'sangjit'])
    expect(parseFilter([])).toEqual([])
    expect(parseFilter(['bogus'])).toEqual([])
  })

  it('builds demo and thumbnail URLs', () => {
    expect(demoUrl('aurum')).toBe('/events/aurum/?demo=1')
    expect(thumbUrl('aurum')).toBe('/events/aurum/assets/portfolio.jpg')
  })
})

describe('PORTFOLIO catalogue', () => {
  it('has unique slugs that are valid event slugs', () => {
    const slugs = PORTFOLIO.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  it('tags every item with at least one known category', () => {
    const known = new Set<string>(PORTFOLIO_CATEGORIES.map((c) => c.id))
    for (const p of PORTFOLIO) {
      expect(p.categories.length).toBeGreaterThan(0)
      for (const c of p.categories) expect(known.has(c)).toBe(true)
    }
  })

  it.each(PORTFOLIO.map((p) => p.slug))('%s ships its page, demo data and thumbnail', (slug) => {
    const dir = `${publicDir}/events/${slug}`
    expect(existsSync(`${dir}/index.html`)).toBe(true)
    expect(existsSync(`${dir}/script.js`)).toBe(true)
    expect(existsSync(`${dir}/assets/portfolio.jpg`)).toBe(true)

    // Same shape as the § 7 `data` response the page renders.
    const demo = JSON.parse(readFileSync(`${dir}/assets/demo.json`, 'utf8'))
    expect(demo.guest).toBeNull()
    expect(demo.event.couple.pria.panggilan).toBeTruthy()
    expect(demo.event.couple.wanita.panggilan).toBeTruthy()
    expect(demo.event.sesi.length).toBeGreaterThan(0)
    // Every local file the demo points at exists (the page only renders safe relative paths).
    const local = [demo.event.media?.musik, demo.event.media?.cover, ...(demo.event.gallery ?? [])].filter(
      (p: string) => p && !/^https?:/.test(p),
    )
    for (const p of local) expect(existsSync(`${dir}/${p}`), `${slug}/${p}`).toBe(true)
  })
})
