import { describe, expect, it } from 'vitest'
import {
  formatRupiah,
  formatRupiahK,
  MARKET_RANGE,
  orderLink,
  orderMessage,
  orderNumber,
  PRICING_PLANS,
  savingPct,
  startingPrice,
} from './pricing'

describe('pricing', () => {
  it('formats rupiah in full and short form', () => {
    expect(formatRupiah(79_000)).toBe('Rp79.000')
    expect(formatRupiah(1_250_000)).toBe('Rp1.250.000')
    expect(formatRupiahK(79_000)).toBe('Rp 79k')
    expect(formatRupiahK(800_000)).toBe('Rp 800k')
    expect(formatRupiahK(79_500)).toBe('Rp79.500')
  })

  it('starts from the cheapest package and saves against the market top', () => {
    expect(startingPrice(PRICING_PLANS)).toBe(79_000)
    expect(savingPct(79_000, MARKET_RANGE.max)).toBe(90)
    expect(savingPct(900_000, MARKET_RANGE.max)).toBe(0)
  })

  it('keeps plans ordered by price, below the market, with exactly one featured package', () => {
    const prices = PRICING_PLANS.map((p) => p.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(Math.max(...prices)).toBeLessThan(MARKET_RANGE.min)
    expect(PRICING_PLANS.filter((p) => p.featured)).toHaveLength(1)
    for (const p of PRICING_PLANS) {
      if (p.includesPrevious) expect(PRICING_PLANS.some((q) => q.id === p.includesPrevious)).toBe(true)
    }
  })

  it('accepts only a valid Indonesian mobile as the order number', () => {
    expect(orderNumber('0812-3456-7890')).toBe('+6281234567890')
    expect(orderNumber('')).toBe('')
    expect(orderNumber(undefined)).toBe('')
    expect(orderNumber('021123')).toBe('')
  })

  it('builds a wa.me order link naming the package and its starting price', () => {
    const [esensial] = PRICING_PLANS
    const link = orderLink(esensial, '+6281234567890')
    expect(link).toBe(`https://wa.me/6281234567890?text=${encodeURIComponent(orderMessage(esensial))}`)
    expect(decodeURIComponent(link)).toContain('paket Esensial (mulai dari Rp79.000)')
    expect(orderLink(esensial, '')).toBe('')
  })
})
