import { HP_PATTERN, normalizePhone } from '@/core/domain/phone'

/** The Link_Undangan formula: `{domain}/{slug}/{PIN}` (URL-CONTRACT.md § 1). */
export function linkUndangan(domain: string, slug: string, pin: string): string {
  if (!pin || !domain || !slug) return ''
  const base = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`
  return `${base.replace(/\/+$/, '')}/${slug}/${pin}`
}

/** This app's own invitation page for one guest: `{origin}/events/{slug}/{PIN}`. */
export function linkLocal(origin: string, slug: string, pin: string): string {
  if (!pin || !slug) return ''
  return `${origin.replace(/\/+$/, '')}/events/${encodeURIComponent(slug)}/${pin}`
}

/**
 * The guest's invitation URL: `{domain}/{slug}/{PIN}` when the event has a
 * domain, else this app's own page under `origin` (defaults to the browser's).
 */
export function linkTamu(
  domain: string,
  slug: string,
  pin: string,
  origin: string = globalThis.location?.origin ?? '',
): string {
  return domain.trim() ? linkUndangan(domain, slug, pin) : origin ? linkLocal(origin, slug, pin) : ''
}

/** `https://wa.me/628…?text=…`, or '' when the number is not sendable. */
export function waLink(hp: string, text: string): string {
  const normalized = normalizePhone(hp)
  if (!HP_PATTERN.test(normalized)) return ''
  return `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(text)}`
}
