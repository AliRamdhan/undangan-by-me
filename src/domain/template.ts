import { linkUndangan } from './link'
import type { Guest, Meta, Session, Template, TemplateTipe } from './types'

// Mirror of renderTemplate_() for the mock adapter only. With the Apps Script
// adapter every render goes to the server so there is one renderer
// (STRUCTURE.md § Why Preview_Pesan and Link_WA are script-written).

const SESI_FIELDS = ['label', 'tanggal', 'jam', 'tempat', 'alamat', 'maps', 'dresscode', 'stream'] as const

/** Every token a template may use (STRUCTURE.md § Available tokens). */
export const TOKENS: readonly { group: string; tokens: readonly string[] }[] = [
  {
    group: 'Tamu',
    tokens: [
      'tamu.gelar',
      'tamu.nama',
      'tamu.pin',
      'tamu.q_s1',
      'tamu.q_s2',
      'tamu.rsvp_s1',
      'tamu.rsvp_s2',
      'tamu.meja',
      'tamu.note_unik',
      'link',
      'greet',
    ],
  },
  {
    group: 'Event',
    tokens: [
      'event.pria',
      'event.wanita',
      'event.pria_lengkap',
      'event.wanita_lengkap',
      'event.pria_ortu',
      'event.wanita_ortu',
      'event.nama',
      'event.hashtag',
      'event.tanggal',
      'event.batas_rsvp',
      'event.cs_nama',
      'event.cs_hp',
    ],
  },
  { group: 'Sesi 1', tokens: SESI_FIELDS.map((f) => `sesi1.${f}`) },
  { group: 'Sesi 2', tokens: SESI_FIELDS.map((f) => `sesi2.${f}`) },
]

export const KNOWN_TOKENS: ReadonlySet<string> = new Set(TOKENS.flatMap((g) => g.tokens))

const TOKEN_RE = /\{\{([^{}]*)\}\}/g

export type RenderContext = Record<string, string>

export interface RenderResult {
  text: string
  /** Tokens that do not exist — a render with any of these must not be sent. */
  unknown: string[]
  /** A `{{` or `}}` without its partner, e.g. `{{tamu.nama}`. */
  malformed: boolean
  /** Known tokens that resolved to an empty string — allowed, but worth a look. */
  empty: string[]
}

export class TemplateError extends Error {
  readonly unknown: string[]
  readonly malformed: boolean
  constructor(unknown: string[], malformed: boolean) {
    const parts = []
    if (unknown.length) parts.push(`token tidak dikenal: ${unknown.map((t) => `{{${t}}}`).join(', ')}`)
    if (malformed) parts.push('kurung kurawal tidak seimbang')
    super(`Template tidak valid — ${parts.join('; ')}`)
    this.name = 'TemplateError'
    this.unknown = unknown
    this.malformed = malformed
  }
}

/** Non-throwing render for live preview and validation reports. */
export function inspectTemplate(body: string, ctx: RenderContext): RenderResult {
  const unknown = new Set<string>()
  const empty = new Set<string>()
  const text = body.replace(TOKEN_RE, (whole, inner: string) => {
    const token = inner.trim()
    if (!KNOWN_TOKENS.has(token) || !(token in ctx)) {
      unknown.add(token)
      return whole
    }
    const value = ctx[token]
    if (value === '') empty.add(token)
    return value
  })
  const malformed = /\{\{|\}\}/.test(body.replace(TOKEN_RE, ''))
  return { text, unknown: [...unknown], malformed, empty: [...empty] }
}

/** Strict render: an unknown token throws rather than reaching a guest as a blank. */
export function renderTemplate(body: string, ctx: RenderContext): string {
  const r = inspectTemplate(body, ctx)
  if (r.unknown.length || r.malformed) throw new TemplateError(r.unknown, r.malformed)
  return r.text
}

/** Deterministic per PIN so a retry re-renders the identical message. */
export function pinHash(pin: string): number {
  // FNV-1a plus a murmur3 finaliser: a plain `h*31+c` leaves the low bits so
  // regular that `% 4` hands most PINs the same greeting.
  let h = 0x811c9dc5
  for (const ch of pin) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return h >>> 0
}

export function pickGreeting(pin: string, variants: readonly string[]): string {
  if (!variants.length) return ''
  return variants[pinHash(pin) % variants.length]
}

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** `2026-11-14` → `Sabtu, 14 November 2026`. Wall-clock: never shifted by timezone. */
export function formatTanggal(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return DATE_FMT.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])))
}

function sessionContext(prefix: string, s: Session | undefined, tz: string): RenderContext {
  const jam = s && s.mulai ? `${s.mulai}${s.selesai ? `–${s.selesai}` : ''} ${tz}`.trim() : ''
  return {
    [`${prefix}.label`]: s?.label ?? '',
    [`${prefix}.tanggal`]: s ? formatTanggal(s.tanggal) : '',
    [`${prefix}.jam`]: jam,
    [`${prefix}.tempat`]: s?.tempat ?? '',
    [`${prefix}.alamat`]: s?.alamat ?? '',
    [`${prefix}.maps`]: s?.maps ?? '',
    [`${prefix}.dresscode`]: s?.dress_code ?? '',
    [`${prefix}.stream`]: s?.live_stream ?? '',
  }
}

export function buildContext(g: Guest, meta: Meta): RenderContext {
  const { event } = meta
  return {
    'tamu.gelar': g.Gelar,
    'tamu.nama': g.Nama,
    'tamu.pin': g.PIN,
    'tamu.q_s1': String(g.Q_S1),
    'tamu.q_s2': String(g.Q_S2),
    'tamu.rsvp_s1': String(g.RSVP_S1),
    'tamu.rsvp_s2': String(g.RSVP_S2),
    'tamu.meja': g.Meja,
    'tamu.note_unik': g.Note_Unik,
    link: linkUndangan(event.domain, event.slug, g.PIN),
    greet: pickGreeting(g.PIN, meta.greetings),
    'event.pria': event.couple.pria.panggilan,
    'event.wanita': event.couple.wanita.panggilan,
    'event.pria_lengkap': event.couple.pria.lengkap,
    'event.wanita_lengkap': event.couple.wanita.lengkap,
    'event.pria_ortu': event.couple.pria.ortu,
    'event.wanita_ortu': event.couple.wanita.ortu,
    'event.nama': event.nama_event,
    'event.hashtag': event.couple.hashtag,
    'event.tanggal': formatTanggal(event.tanggal_utama),
    'event.batas_rsvp': formatTanggal(event.batas_rsvp),
    'event.cs_nama': event.cs.nama,
    'event.cs_hp': event.cs.hp,
    ...sessionContext('sesi1', event.sesi[0], event.timezone),
    ...sessionContext('sesi2', event.sesi[1], event.timezone),
  }
}

/** Lookup is (Tipe, Akses) falling back to (Tipe, SEMUA); inactive rows never match. */
export function pickTemplate(
  templates: readonly Template[],
  tipe: TemplateTipe,
  akses: string,
): Template | undefined {
  const active = templates.filter((t) => t.Aktif && t.Tipe === tipe)
  return active.find((t) => t.Akses === akses) ?? active.find((t) => t.Akses === 'SEMUA')
}
