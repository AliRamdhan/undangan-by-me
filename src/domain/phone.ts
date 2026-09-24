import type { HpValid } from './types'

/** Indonesian mobile, normalised: +62 8xx, 9–13 digits after the country code. */
export const HP_PATTERN = /^\+628\d{7,11}$/

/**
 * `Normalisasi Nomor HP`: strips spaces, dashes, dots and parens, then maps
 * 08xx / 628xx / 8xx → +628xx. Anything it cannot interpret is returned
 * trimmed but otherwise untouched, so HP_Valid can flag it instead of the
 * normaliser guessing.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const compact = trimmed.replace(/[\s\-.()]/g, '')
  if (!/^\+?\d+$/.test(compact)) return trimmed
  if (compact.startsWith('+62')) return compact
  if (compact.startsWith('62')) return `+${compact}`
  if (compact.startsWith('08')) return `+62${compact.slice(1)}`
  if (compact.startsWith('8')) return `+62${compact}`
  return compact
}

/** Key used for duplicate detection — two spellings of one number collide. */
export function phoneKey(raw: string): string {
  return normalizePhone(raw).replace(/^\+/, '')
}

/**
 * The HP_Valid formula column. `counts` maps phoneKey → occurrences across
 * the whole guest list.
 */
export function hpValid(raw: string, counts: ReadonlyMap<string, number>): HpValid {
  if (!raw.trim()) return '⚠️ kosong'
  if (!HP_PATTERN.test(normalizePhone(raw))) return '⚠️ format'
  if ((counts.get(phoneKey(raw)) ?? 0) > 1) return '⚠️ duplikat'
  return '✅'
}

export function phoneCounts(phones: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const hp of phones) {
    if (!hp.trim()) continue
    const k = phoneKey(hp)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}
