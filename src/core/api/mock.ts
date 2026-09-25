import { cekDuplikat } from '@/core/domain/checks'
import { validateEvent, withEventDefaults } from '@/core/domain/event'
import type { ImportRow } from '@/core/domain/csv'
import { applyFormulas } from '@/core/domain/derive'
import { waLink } from '@/core/domain/link'
import { normalizePhone } from '@/core/domain/phone'
import { generatePins } from '@/core/domain/pin'
import { buildContext, inspectTemplate, pickTemplate, TemplateError, renderTemplate } from '@/core/domain/template'
import { MANUAL_KEYS, type EventInfo, type Guest, type GuestInput, type Meta, type Template, type TemplateTipe } from '@/core/domain/types'
import { blankGuest, SEED_GUESTS, SEED_META, SEED_TEMPLATES } from '@/core/api/seed'
import { ApiError, type GuestRef, type LinkResult, type TemplateReport, type UndanganApi } from '@/core/api/types'

const STORAGE_KEY = 'undangan.mock.v1'

interface Db {
  meta: Meta
  /** Stored without formula columns; they are recomputed on every read. */
  guests: Guest[]
  templates: Template[]
}

function seed(): Db {
  return structuredClone({ meta: SEED_META, guests: SEED_GUESTS, templates: SEED_TEMPLATES })
}

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const db = JSON.parse(raw) as Db
      // Stored before the event form existed? Fill the new fields instead of breaking the form.
      db.meta.event = withEventDefaults(db.meta.event)
      return db
    }
  } catch {
    // Private window / blocked storage: fall through to an in-memory seed.
  }
  return seed()
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

/**
 * Seeded, browser-local stand-in for the Apps Script backend. It plays the
 * "script" role: it owns PIN generation, rendering and the script columns,
 * and — like writeCells_() — refuses to write anything but manual columns.
 */
export class MockApi implements UndanganApi {
  readonly kind = 'mock' as const
  private db: Db = load()

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db))
    } catch {
      // Storage full or blocked — the session keeps working from memory.
    }
  }

  static reset() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  private rows(): Guest[] {
    return applyFormulas(this.db.guests, this.db.meta.event)
  }

  /** PIN first; rowHint + nama only for PIN-less or PIN-sharing rows, revalidated. */
  private resolve(ref: GuestRef): number {
    const g = this.db.guests
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
    return structuredClone(this.db.meta)
  }

  async saveEvent(event: EventInfo) {
    await delay()
    const next = withEventDefaults(structuredClone(event))
    const errs = Object.entries(validateEvent(next))
    if (errs.length) {
      throw new ApiError('VALIDATION', `Data event belum lengkap: ${errs.map(([k, m]) => `${k} (${m})`).join(', ')}`)
    }
    // Session codes follow row order, like the 01_Event session table.
    next.sesi = next.sesi.map((s, i) => ({ ...s, kode: `S${i + 1}` }))
    for (const p of [next.couple.pria, next.couple.wanita]) p.hp = normalizePhone(p.hp)
    this.db.meta.event = next
    this.persist()
    return structuredClone(this.db.meta)
  }

  async listGuests() {
    await delay()
    return this.rows()
  }

  async saveGuest(ref: GuestRef | null, fields: Partial<GuestInput>) {
    await delay()
    const clean: Partial<GuestInput> = {}
    for (const [k, v] of Object.entries(fields)) {
      if (!(MANUAL_KEYS as readonly string[]).includes(k)) {
        throw new ApiError('VALIDATION', `Kolom ${k} bukan kolom manual — tidak boleh ditulis`)
      }
      Object.assign(clean, { [k]: v })
    }
    let idx: number
    if (ref) {
      idx = this.resolve(ref)
      this.db.guests[idx] = { ...this.db.guests[idx], ...clean }
    } else {
      const [pin] = generatePins(1, this.db.guests.map((g) => g.PIN))
      this.db.guests.push({ ...blankGuest(), ...clean, PIN: pin })
      idx = this.db.guests.length - 1
    }
    this.persist()
    return this.rows()[idx]
  }

  async deleteGuests(refs: GuestRef[]) {
    await delay()
    const idxs = new Set(refs.map((r) => this.resolve(r)))
    this.db.guests = this.db.guests.filter((_, i) => !idxs.has(i))
    this.persist()
    return idxs.size
  }

  async importGuests(rows: ImportRow[]) {
    await delay()
    for (const r of rows) this.db.guests.push({ ...blankGuest(), ...r })
    this.persist()
    return rows.length
  }

  async generatePins() {
    await delay()
    const empty = this.db.guests.filter((g) => !g.PIN)
    const pins = generatePins(empty.length, this.db.guests.map((g) => g.PIN))
    empty.forEach((g, i) => (g.PIN = pins[i]))
    this.persist()
    return empty.length
  }

  async normalizePhones() {
    await delay()
    let changed = 0
    for (const g of this.db.guests) {
      const n = normalizePhone(g.HP)
      if (n !== g.HP) {
        g.HP = n
        changed++
      }
    }
    this.persist()
    return changed
  }

  async checkGuests() {
    await delay()
    return cekDuplikat(this.rows())
  }

  async listTemplates() {
    await delay()
    return structuredClone(this.db.templates)
  }

  async saveTemplate(t: Template, originalKode?: string) {
    await delay()
    const kode = t.Kode.trim()
    if (!kode) throw new ApiError('VALIDATION', 'Kode template wajib diisi')
    const clash = this.db.templates.find((x) => x.Kode === kode && x.Kode !== originalKode)
    if (clash) throw new ApiError('VALIDATION', `Kode ${kode} sudah dipakai`)
    const next = { ...t, Kode: kode }
    const i = originalKode === undefined ? -1 : this.db.templates.findIndex((x) => x.Kode === originalKode)
    if (i >= 0) this.db.templates[i] = next
    else this.db.templates.push(next)
    this.persist()
  }

  async deleteTemplate(kode: string) {
    await delay()
    this.db.templates = this.db.templates.filter((t) => t.Kode !== kode)
    this.persist()
  }

  async validateTemplates(): Promise<TemplateReport[]> {
    await delay()
    const guests = this.rows()
    return this.db.templates
      .filter((t) => t.Aktif)
      .map((t) => {
        const targets = t.Akses === 'SEMUA' ? guests : guests.filter((g) => g.Akses === t.Akses)
        const sample = targets.length ? targets : [blankGuest()]
        const results = sample.map((g) => inspectTemplate(t.Isi_Pesan, buildContext(g, this.db.meta)))
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

  private render(g: Guest, tipe: TemplateTipe) {
    const tpl = pickTemplate(this.db.templates, tipe, g.Akses)
    if (!tpl) throw new ApiError('NO_TEMPLATE', `Tidak ada template ${tipe} aktif untuk akses ${g.Akses || '(kosong)'} atau SEMUA`)
    try {
      const text = renderTemplate(tpl.Isi_Pesan, buildContext(g, this.db.meta))
      return { kode: tpl.Kode, text, waLink: waLink(g.HP, text) }
    } catch (e) {
      if (e instanceof TemplateError) throw new ApiError('TEMPLATE', `${tpl.Kode}: ${e.message}`)
      throw e
    }
  }

  async previewMessage(ref: GuestRef, tipe: TemplateTipe) {
    await delay()
    return this.render(this.rows()[this.resolve(ref)], tipe)
  }

  async renderDraft(body: string, ref: GuestRef | null) {
    const g = ref ? this.rows()[this.resolve(ref)] : { ...blankGuest(), Nama: 'Nama Tamu', PIN: '000000' }
    return inspectTemplate(body, buildContext(g, this.db.meta))
  }

  async generateLinks(refs: GuestRef[] | null, tipe: TemplateTipe): Promise<LinkResult> {
    await delay(250)
    const rows = this.rows()
    const idxs = refs ? refs.map((r) => this.resolve(r)) : rows.map((_, i) => i)
    const result: LinkResult = { written: 0, skipped: [] }
    for (const i of idxs) {
      const g = rows[i]
      const skip = (reason: string) => result.skipped.push({ pin: g.PIN, nama: g.Nama, reason })
      if (!g.PIN) {
        skip('PIN kosong — link undangan belum ada')
        continue
      }
      try {
        const { text, waLink: link } = this.render(g, tipe)
        this.db.guests[i].Preview_Pesan = text
        this.db.guests[i].Link_WA = link
        if (!link) skip(`HP "${g.HP}" tidak valid — pesan dibuat tanpa link WA`)
        result.written++
      } catch (e) {
        skip(e instanceof Error ? e.message : String(e))
      }
    }
    this.persist()
    return result
  }
}
