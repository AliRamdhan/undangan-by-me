import { cekDuplikat } from '@/core/domain/checks'
import { validateEvent, withEventDefaults } from '@/core/domain/event'
import type { ImportRow } from '@/core/domain/csv'
import { applyFormulas } from '@/core/domain/derive'
import { waLink } from '@/core/domain/link'
import { normalizePhone } from '@/core/domain/phone'
import { generatePins } from '@/core/domain/pin'
import { buildContext, inspectTemplate, pickTemplate, TemplateError, renderTemplate } from '@/core/domain/template'
import { MANUAL_KEYS, type EventInfo, type Guest, type GuestInput, type Meta, type Template, type TemplateTipe } from '@/core/domain/types'
import { blankGuest, SEED_EVENTS, SEED_USERS } from '@/core/api/seed'
import {
  ApiError,
  type AppApi,
  type AuthUser,
  type DeletedEvent,
  type EventSummary,
  type GuestRef,
  type LinkResult,
  type ManagedUser,
  type NewUser,
  type Role,
  type Session,
  type TemplateReport,
  type UndanganApi,
  type UserPatch,
} from '@/core/api/types'

const STORAGE_KEY = 'undangan.mock.v3'
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000

interface EventDb {
  meta: Meta
  /** Stored without formula columns; they are recomputed on every read. */
  guests: Guest[]
  templates: Template[]
}

interface Db {
  events: EventDb[]
  users: (ManagedUser & { password: string })[]
  sessions: Record<string, { email: string; expiresAt: string }>
}

type SeedEvents = readonly EventDb[]

function seedEvents(events: SeedEvents = SEED_EVENTS): EventDb[] {
  return structuredClone(events) as EventDb[]
}

function seedUsers(): Db['users'] {
  return SEED_USERS.map((u) => ({ ...u, aktif: true, dibuat: '2026-09-01T00:00:00.000Z', loginTerakhir: '' }))
}

function seed(events?: SeedEvents): Db {
  return { events: seedEvents(events), users: seedUsers(), sessions: {} }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const db = JSON.parse(raw) as Db
      // Stored before the event form existed? Fill the new fields instead of breaking the form.
      for (const e of db.events) e.meta.event = withEventDefaults(e.meta.event)
      return db
    }
  } catch {
    // Private window / blocked storage: fall through to an in-memory seed.
  }
  return seed()
}

/** One store per page, shared by every MockApp — a new session must see the old one's writes. */
let shared: Db | null = null
const db = (): Db => (shared ??= load())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db()))
  } catch {
    // Storage full or blocked — the session keeps working from memory.
  }
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

const publicUser = ({ email, nama, role, event }: AuthUser): AuthUser => ({ email, nama, role, event })
const managedUser = (u: Db['users'][number]): ManagedUser => ({
  email: u.email,
  nama: u.nama,
  role: u.role,
  event: u.event,
  aktif: u.aktif,
  dibuat: u.dibuat,
  loginTerakhir: u.loginTerakhir,
})
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Ends every session of one account — after a password reset, deactivation or role/event change. */
function revoke(email: string) {
  for (const [token, s] of Object.entries(db().sessions)) if (sameEmail(s.email, email)) delete db().sessions[token]
}

/**
 * Seeded, browser-local stand-in for the Apps Script backend, including its
 * auth: sessions are checked and ADMIN-only routes refuse with FORBIDDEN.
 */
export class MockApp implements AppApi {
  readonly kind = 'mock' as const
  private readonly token: string | null
  private readonly onUnauthorized?: () => void

  constructor(token: string | null = null, onUnauthorized?: () => void) {
    this.token = token
    this.onUnauthorized = onUnauthorized
  }

  /** Back to the seeded events (tests may pass their own). Logins survive unless `everything` is set. */
  static reset(everything = false, events?: SeedEvents) {
    const keep = everything || !shared ? null : { users: shared.users, sessions: shared.sessions }
    shared = keep ? { events: seedEvents(events), ...keep } : seed(events)
    persist()
  }

  /** The signed-in user, or AUTH/FORBIDDEN like the server's middleware. */
  guard(role?: Role): AuthUser {
    const s = this.token ? db().sessions[this.token] : undefined
    const user = s && Date.parse(s.expiresAt) > Date.now() ? db().users.find((u) => u.email === s.email) : undefined
    if (!user || !user.aktif || (user.role === 'CLIENT' && !user.event)) {
      this.onUnauthorized?.()
      throw new ApiError('AUTH', user ? 'Akun tidak aktif atau belum terhubung ke event' : 'Sesi berakhir — silakan login lagi')
    }
    if (role && user.role !== role) throw new ApiError('FORBIDDEN', `Aksi ini hanya untuk ${role}`)
    return publicUser(user)
  }

  /** The user, if it may touch `/event/:slug/…` — a CLIENT only its own; others look nonexistent. */
  guardEvent(slug: string, role?: Role): AuthUser {
    const user = this.guard(role)
    if (user.role === 'CLIENT' && user.event !== slug) throw new ApiError('NOT_FOUND', 'Event tidak ditemukan')
    return user
  }

  event(slug: string): EventDb {
    const e = db().events.find((x) => x.meta.event.slug === slug)
    if (!e) throw new ApiError('NOT_FOUND', `Event ${slug} tidak ditemukan`)
    return e
  }

  async login(email: string, password: string): Promise<Session> {
    await delay()
    const user = db().users.find((u) => sameEmail(u.email, email))
    if (!user || !user.aktif || user.password !== password) throw new ApiError('LOGIN_FAILED', 'Email atau password salah')
    if (user.role === 'CLIENT' && !user.event) throw new ApiError('LOGIN_FAILED', 'Akun belum terhubung ke event — hubungi admin')
    user.loginTerakhir = new Date().toISOString()
    const token = crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    db().sessions[token] = { email: user.email, expiresAt }
    persist()
    return { token, expiresAt, user: publicUser(user) }
  }

  async logout() {
    if (this.token) delete db().sessions[this.token]
    persist()
  }

  async me() {
    await delay(40)
    return this.guard()
  }

  async changePassword(oldPassword: string, newPassword: string) {
    await delay()
    const { email } = this.guard()
    const user = db().users.find((u) => u.email === email)!
    if (user.password !== oldPassword) throw new ApiError('VALIDATION', 'Password lama salah')
    if (newPassword.length < MIN_PASSWORD) throw new ApiError('VALIDATION', `Password baru minimal ${MIN_PASSWORD} karakter`)
    user.password = newPassword
    // Other devices are signed out; this one keeps its session.
    for (const [token, s] of Object.entries(db().sessions)) if (s.email === email && token !== this.token) delete db().sessions[token]
    persist()
  }

  async listEvents(): Promise<EventSummary[]> {
    await delay()
    const user = this.guard()
    const visible = user.role === 'CLIENT' ? db().events.filter((e) => e.meta.event.slug === user.event) : db().events
    return visible.map(({ meta, guests, templates }) => ({
      slug: meta.event.slug,
      nama_event: meta.event.nama_event,
      tipe: meta.event.tipe,
      tanggal_utama: meta.event.tanggal_utama,
      mode: meta.mode,
      jumlah_tamu: guests.length,
      jumlah_template: templates.length,
    }))
  }

  async createEvent(event: EventInfo) {
    await delay()
    this.guard('SUPER_ADMIN')
    const next = cleanEvent(event)
    if (db().events.some((e) => e.meta.event.slug === next.slug)) {
      throw new ApiError('DUPLICATE_SLUG', `Slug ${next.slug} sudah dipakai event lain`)
    }
    const meta: Meta = { mode: 'DRY-RUN', greetings: structuredClone(SEED_EVENTS[0].meta.greetings), event: next }
    db().events.push({ meta, guests: [], templates: [] })
    persist()
    return structuredClone(meta)
  }

  async deleteEvent(slug: string): Promise<DeletedEvent> {
    await delay()
    this.guard('SUPER_ADMIN')
    const e = this.event(slug)
    db().events = db().events.filter((x) => x !== e)
    // The event's CLIENT accounts have nothing left to open.
    const clients = db().users.filter((u) => u.role === 'CLIENT' && u.event === slug)
    clients.forEach((u) => revoke(u.email))
    db().users = db().users.filter((u) => !clients.includes(u))
    persist()
    return { tamu: e.guests.length, template: e.templates.length, sesi: e.meta.event.sesi.length, akun: clients.length }
  }

  async listUsers() {
    await delay()
    this.guard('SUPER_ADMIN')
    return db().users.map(managedUser)
  }

  /** Role/event rules shared by create and update. */
  private checkAccount(role: Role, event: string) {
    if (!(['SUPER_ADMIN', 'CLIENT'] as const).includes(role)) throw new ApiError('VALIDATION', `Role ${role} tidak dikenal`)
    if (role === 'CLIENT' && !db().events.some((e) => e.meta.event.slug === event)) {
      throw new ApiError('VALIDATION', 'Akun CLIENT wajib terhubung ke event yang ada')
    }
  }

  /** At least one active SUPER_ADMIN must survive `next`. */
  private keepSuperAdmin(next: Db['users']) {
    if (!next.some((u) => u.role === 'SUPER_ADMIN' && u.aktif)) {
      throw new ApiError('VALIDATION', 'Harus tersisa minimal satu SUPER_ADMIN aktif')
    }
  }

  private findUser(email: string) {
    const u = db().users.find((x) => sameEmail(x.email, email))
    if (!u) throw new ApiError('NOT_FOUND', `Akun ${email} tidak ditemukan`)
    return u
  }

  async createUser(input: NewUser) {
    await delay()
    this.guard('SUPER_ADMIN')
    const email = input.email.trim()
    if (!EMAIL_PATTERN.test(email)) throw new ApiError('VALIDATION', 'Email tidak valid')
    if (db().users.some((u) => sameEmail(u.email, email))) throw new ApiError('VALIDATION', 'Email sudah terdaftar')
    if (input.password.length < MIN_PASSWORD) throw new ApiError('VALIDATION', `Password minimal ${MIN_PASSWORD} karakter`)
    this.checkAccount(input.role, input.event)
    const user = {
      email,
      nama: input.nama.trim() || email,
      role: input.role,
      event: input.role === 'CLIENT' ? input.event : '',
      password: input.password,
      aktif: true,
      dibuat: new Date().toISOString(),
      loginTerakhir: '',
    }
    db().users.push(user)
    persist()
    return managedUser(user)
  }

  async updateUser(email: string, patch: UserPatch) {
    await delay()
    const me = this.guard('SUPER_ADMIN')
    const u = this.findUser(email)
    const next = { ...u, ...patch }
    next.nama = next.nama.trim() || next.email
    if (next.role === 'SUPER_ADMIN') next.event = ''
    this.checkAccount(next.role, next.event)
    if (sameEmail(u.email, me.email) && (next.role !== u.role || !next.aktif)) {
      throw new ApiError('VALIDATION', 'Tidak bisa menonaktifkan atau menurunkan role akun sendiri')
    }
    this.keepSuperAdmin(db().users.map((x) => (x === u ? next : x)))
    const endSessions = next.role !== u.role || next.event !== u.event || next.aktif !== u.aktif
    Object.assign(u, next)
    if (endSessions) revoke(u.email)
    persist()
    return managedUser(u)
  }

  async resetPassword(email: string, password: string) {
    await delay()
    this.guard('SUPER_ADMIN')
    const u = this.findUser(email)
    if (password.length < MIN_PASSWORD) throw new ApiError('VALIDATION', `Password minimal ${MIN_PASSWORD} karakter`)
    u.password = password
    revoke(u.email)
    persist()
  }

  async deleteUser(email: string) {
    await delay()
    const me = this.guard('SUPER_ADMIN')
    const u = this.findUser(email)
    if (sameEmail(u.email, me.email)) throw new ApiError('VALIDATION', 'Tidak bisa menghapus akun sendiri')
    this.keepSuperAdmin(db().users.filter((x) => x !== u))
    revoke(u.email)
    db().users = db().users.filter((x) => x !== u)
    persist()
  }

  forEvent(slug: string): UndanganApi {
    return new MockApi(this, slug)
  }
}

/** Validasi Data Event, then the same clean-up the sheet write does. */
function cleanEvent(event: EventInfo): EventInfo {
  const next = withEventDefaults(structuredClone(event))
  const errs = Object.entries(validateEvent(next))
  if (errs.length) {
    throw new ApiError('VALIDATION', `Data event belum lengkap: ${errs.map(([k, m]) => `${k} (${m})`).join(', ')}`)
  }
  // Session codes follow row order, like the 01_Sesi table.
  next.sesi = next.sesi.map((s, i) => ({ ...s, kode: `S${i + 1}` }))
  for (const p of [next.couple.pria, next.couple.wanita]) p.hp = normalizePhone(p.hp)
  return next
}

/**
 * One event of the mock. It plays the "script" role: it owns PIN generation,
 * rendering and the script columns, and — like writeCells_() — refuses to
 * write anything but manual columns.
 */
export class MockApi implements UndanganApi {
  readonly kind = 'mock' as const
  readonly slug: string
  private readonly app: MockApp

  constructor(app: MockApp, slug: string) {
    this.app = app
    this.slug = slug
  }

  /** The event's data, after the session + event-access check every route runs first. */
  private ev(role?: Role): EventDb {
    this.app.guardEvent(this.slug, role)
    return this.app.event(this.slug)
  }

  private rows(e: EventDb): Guest[] {
    return applyFormulas(e.guests, e.meta.event)
  }

  /** PIN first; rowHint + nama only for PIN-less or PIN-sharing rows, revalidated. */
  private resolve(e: EventDb, ref: GuestRef): number {
    const g = e.guests
    const hint = ref.rowHint - 1
    const hintOk = g[hint] !== undefined && g[hint].PIN === ref.PIN && g[hint].Nama === ref.nama
    if (ref.PIN) {
      const hits = g.flatMap((x, i) => (x.PIN === ref.PIN ? [i] : []))
      if (hits.length === 1) return hits[0]
      if (hits.length === 0) throw new ApiError('NOT_FOUND', `PIN ${ref.PIN} tidak ditemukan`)
      if (hintOk) return hint
      throw new ApiError('DUPLICATE_PIN', `PIN ${ref.PIN} dipakai ${hits.length} tamu — jalankan Cek Duplikat`)
    }
    if (hintOk) return hint
    throw new ApiError('STALE_ROW', 'Baris sudah berubah (diurutkan/diedit). Muat ulang lalu coba lagi.')
  }

  async getMeta() {
    await delay()
    return structuredClone(this.ev().meta)
  }

  async saveEvent(event: EventInfo) {
    await delay()
    const user = this.app.guardEvent(this.slug)
    const e = this.app.event(this.slug)
    const next = cleanEvent(event)
    // The slug/domain are the invitation URL: only SUPER_ADMIN moves it.
    if (user.role === 'CLIENT' && (next.slug !== e.meta.event.slug || next.domain !== e.meta.event.domain)) {
      throw new ApiError('FORBIDDEN', 'Slug dan domain hanya bisa diubah SUPER_ADMIN')
    }
    if (next.slug !== this.slug && db().events.some((x) => x.meta.event.slug === next.slug)) {
      throw new ApiError('DUPLICATE_SLUG', `Slug ${next.slug} sudah dipakai event lain`)
    }
    e.meta.event = next
    // Clients follow their event to the new slug.
    for (const u of db().users) if (u.event === this.slug) u.event = next.slug
    persist()
    return structuredClone(e.meta)
  }

  async listGuests() {
    await delay()
    return this.rows(this.ev())
  }

  async saveGuest(ref: GuestRef | null, fields: Partial<GuestInput>) {
    await delay()
    const e = this.ev()
    const clean: Partial<GuestInput> = {}
    for (const [k, v] of Object.entries(fields)) {
      if (!(MANUAL_KEYS as readonly string[]).includes(k)) {
        throw new ApiError('VALIDATION', `Kolom ${k} bukan kolom manual — tidak boleh ditulis`)
      }
      Object.assign(clean, { [k]: v })
    }
    let idx: number
    if (ref) {
      idx = this.resolve(e, ref)
      e.guests[idx] = { ...e.guests[idx], ...clean }
    } else {
      const [pin] = generatePins(1, e.guests.map((g) => g.PIN))
      e.guests.push({ ...blankGuest(), ...clean, PIN: pin })
      idx = e.guests.length - 1
    }
    persist()
    return this.rows(e)[idx]
  }

  async deleteGuests(refs: GuestRef[]) {
    await delay()
    const e = this.ev()
    const idxs = new Set(refs.map((r) => this.resolve(e, r)))
    e.guests = e.guests.filter((_, i) => !idxs.has(i))
    persist()
    return idxs.size
  }

  async importGuests(rows: ImportRow[]) {
    await delay()
    const e = this.ev()
    for (const r of rows) e.guests.push({ ...blankGuest(), ...r })
    persist()
    return rows.length
  }

  async generatePins() {
    await delay()
    const e = this.ev()
    const empty = e.guests.filter((g) => !g.PIN)
    const pins = generatePins(empty.length, e.guests.map((g) => g.PIN))
    empty.forEach((g, i) => (g.PIN = pins[i]))
    persist()
    return empty.length
  }

  async normalizePhones() {
    await delay()
    let changed = 0
    for (const g of this.ev().guests) {
      const n = normalizePhone(g.HP)
      if (n !== g.HP) {
        g.HP = n
        changed++
      }
    }
    persist()
    return changed
  }

  async checkGuests() {
    await delay()
    return cekDuplikat(this.rows(this.ev()))
  }

  async listTemplates() {
    await delay()
    return structuredClone(this.ev().templates)
  }

  async saveTemplate(t: Template, originalKode?: string) {
    await delay()
    const e = this.ev()
    const kode = t.Kode.trim()
    if (!kode) throw new ApiError('VALIDATION', 'Kode template wajib diisi')
    const clash = e.templates.find((x) => x.Kode === kode && x.Kode !== originalKode)
    if (clash) throw new ApiError('VALIDATION', `Kode ${kode} sudah dipakai`)
    const next = { ...t, Kode: kode }
    const i = originalKode === undefined ? -1 : e.templates.findIndex((x) => x.Kode === originalKode)
    if (originalKode !== undefined && i < 0) throw new ApiError('NOT_FOUND', `Template ${originalKode} tidak ditemukan`)
    if (i >= 0) e.templates[i] = next
    else e.templates.push(next)
    persist()
  }

  async deleteTemplate(kode: string) {
    await delay()
    const e = this.ev()
    e.templates = e.templates.filter((t) => t.Kode !== kode)
    persist()
  }

  async validateTemplates(): Promise<TemplateReport[]> {
    await delay()
    const e = this.ev()
    const guests = this.rows(e)
    return e.templates
      .filter((t) => t.Aktif)
      .map((t) => {
        const targets = t.Akses === 'SEMUA' ? guests : guests.filter((g) => g.Akses === t.Akses)
        const sample = targets.length ? targets : [blankGuest()]
        const results = sample.map((g) => inspectTemplate(t.Isi_Pesan, buildContext(g, e.meta)))
        // Blank for every guest means it is event data that is missing, not a per-guest gap.
        const empty = results[0].empty.filter((tok) => results.every((r) => r.empty.includes(tok)))
        return {
          kode: t.Kode,
          tipe: t.Tipe,
          akses: t.Akses,
          rendered: targets.length,
          unknown: results[0].unknown,
          malformed: results[0].malformed,
          empty,
        }
      })
  }

  private render(e: EventDb, g: Guest, tipe: TemplateTipe) {
    const tpl = pickTemplate(e.templates, tipe, g.Akses)
    if (!tpl) throw new ApiError('NO_TEMPLATE', `Tidak ada template ${tipe} aktif untuk akses ${g.Akses || '(kosong)'} atau SEMUA`)
    try {
      const text = renderTemplate(tpl.Isi_Pesan, buildContext(g, e.meta))
      return { kode: tpl.Kode, text, waLink: waLink(g.HP, text) }
    } catch (err) {
      if (err instanceof TemplateError) throw new ApiError('TEMPLATE', `${tpl.Kode}: ${err.message}`)
      throw err
    }
  }

  async previewMessage(ref: GuestRef, tipe: TemplateTipe) {
    await delay()
    const e = this.ev()
    return this.render(e, this.rows(e)[this.resolve(e, ref)], tipe)
  }

  async renderDraft(body: string, ref: GuestRef | null) {
    const e = this.ev()
    const g = ref ? this.rows(e)[this.resolve(e, ref)] : { ...blankGuest(), Nama: 'Nama Tamu', PIN: '000000' }
    return inspectTemplate(body, buildContext(g, e.meta))
  }

  async generateLinks(refs: GuestRef[] | null, tipe: TemplateTipe): Promise<LinkResult> {
    await delay(250)
    const e = this.ev()
    const rows = this.rows(e)
    const idxs = refs ? refs.map((r) => this.resolve(e, r)) : rows.map((_, i) => i)
    const result: LinkResult = { written: 0, skipped: [] }
    for (const i of idxs) {
      const g = rows[i]
      const skip = (reason: string) => result.skipped.push({ pin: g.PIN, nama: g.Nama, reason })
      if (!g.PIN) {
        skip('PIN kosong — link undangan belum ada')
        continue
      }
      try {
        const { text, waLink: link } = this.render(e, g, tipe)
        e.guests[i].Preview_Pesan = text
        e.guests[i].Link_WA = link
        if (!link) skip(`HP "${g.HP}" tidak valid — pesan dibuat tanpa link WA`)
        result.written++
      } catch (err) {
        skip(err instanceof Error ? err.message : String(err))
      }
    }
    persist()
    return result
  }
}
