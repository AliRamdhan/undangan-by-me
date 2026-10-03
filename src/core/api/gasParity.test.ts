/// <reference types="node" />
import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { SEED_GUESTS, SEED_META, SEED_TEMPLATES, seedId } from '@/core/api/seed'
import { cekDuplikat } from '@/core/domain/checks'
import { applyFormulas } from '@/core/domain/derive'
import { validateEvent, withEventDefaults } from '@/core/domain/event'
import { linkUndangan, waLink } from '@/core/domain/link'
import { hpValid, normalizePhone, phoneCounts, phoneKey } from '@/core/domain/phone'
import { PIN_PATTERN } from '@/core/domain/pin'
import * as schema from '@/core/domain/sheetSchema'
import { buildContext, formatTanggal, inspectTemplate, pickGreeting, pickTemplate, renderTemplate } from '@/core/domain/template'
import type { Guest, Template } from '@/core/domain/types'

/**
 * Loads apps-script/*.gs into a Node vm (the way Apps Script concatenates
 * files into one global scope) and checks the server against the client's
 * TypeScript domain code. Google services are only touched inside function
 * bodies, so loading is side-effect free; the handler tests at the bottom
 * add an in-memory SpreadsheetApp.
 */

const GAS_DIR = fileURLToPath(new URL('../../../../apps-script/', import.meta.url))

const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

/** Utilities.computeDigest returns Java-style signed bytes. */
const Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest: (_alg: string, s: string) =>
    Array.from(createHash('sha256').update(s, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
  getUuid: () => randomUUID(),
  formatDate: () => {
    throw new Error('formatDate is not stubbed')
  },
}

type Ctx = vm.Context & Record<string, (...args: never[]) => unknown>

function loadGas(extra: Record<string, unknown> = {}): Ctx {
  const ctx = vm.createContext({ Utilities, console, Logger: { log: () => {} }, ...extra }) as Ctx
  for (const f of readdirSync(GAS_DIR).filter((n) => n.endsWith('.gs')).sort()) {
    vm.runInContext(readFileSync(GAS_DIR + f, 'utf8'), ctx, { filename: f })
  }
  return ctx
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const EVENT_ID = SEED_META.event.id
const USER = { admin: seedId(5, 11), klien: seedId(5, 12), operator: seedId(5, 13) }

/** vm values live in another realm; compare their JSON. */
const plain = <T>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T))
const val = (ctx: Ctx, expr: string) => plain(vm.runInContext(expr, ctx))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (ctx: Ctx, fn: string, ...args: unknown[]): any => plain((ctx[fn] as (...a: unknown[]) => unknown)(...args))

const gas = loadGas()

describe('00_Config.gs ↔ sheetSchema.ts', () => {
  it('uses the same tab names and header rows', () => {
    expect(val(gas, 'SHEETS')).toEqual(schema.SHEETS)
    expect(val(gas, 'EVENT_COLUMNS')).toEqual(schema.EVENT_COLUMNS)
    expect(val(gas, 'SESI_COLUMNS')).toEqual(schema.SESI_COLUMNS)
    expect(val(gas, 'TAMU_COLUMNS')).toEqual(schema.TAMU_SHEET_COLUMNS)
    expect(val(gas, 'TEMPLATE_COLUMNS')).toEqual(schema.TEMPLATE_SHEET_COLUMNS)
    expect(val(gas, 'CONFIG_COLUMNS')).toEqual(schema.CONFIG_COLUMNS)
    expect(val(gas, 'ENUM_COLUMNS')).toEqual(schema.ENUM_COLUMNS)
    expect(val(gas, 'USER_COLUMNS')).toEqual(schema.USER_COLUMNS)
    expect(val(gas, 'SESSION_COLUMNS')).toEqual(schema.SESSION_COLUMNS)
    expect(val(gas, 'HASH_ITERATIONS')).toBe(schema.HASH_ITERATIONS)
  })

  it('maps an event to the same 01_Event and 01_Sesi rows', () => {
    expect(call(gas, 'eventToRow_', SEED_META.event, 'LIVE')).toEqual(schema.eventToRow(SEED_META.event, 'LIVE'))
    for (const s of SEED_META.event.sesi) {
      expect(call(gas, 'sessionToRow_', EVENT_ID, s)).toEqual(schema.sessionToRow(EVENT_ID, s))
    }
    const row = schema.eventToRow(SEED_META.event, 'DRY-RUN')
    const sesi = SEED_META.event.sesi.map((s) => schema.sessionToRow(EVENT_ID, s))
    expect(call(gas, 'rowToEvent_', row, sesi)).toEqual(SEED_META.event)
  })
})

describe('04_Auth.gs', () => {
  it('hashes passwords exactly like sheetSchema.hashPassword', () => {
    for (const [pw, salt] of [
      ['Admin#123', '0123456789abcdef'],
      ['pässwörd ✓', 'a1b2c3d4e5f60718'],
      ['', 'x'],
    ]) {
      expect(call(gas, 'hashPassword_', pw, salt)).toBe(schema.hashPassword(pw, salt, sha256Hex))
    }
  })

  it('maps legacy roles and binds only a CLIENT to an event', () => {
    const pub = (Role: string, Event = 'e1') => call(gas, 'publicUser_', { ID: ' u1 ', Email: ' a@x.com ', Nama: 'A', Role, Event })
    expect(pub('SUPER_ADMIN')).toEqual({ id: 'u1', email: 'a@x.com', nama: 'A', role: 'SUPER_ADMIN', event: '' })
    expect(pub('admin')).toMatchObject({ role: 'SUPER_ADMIN', event: '' })
    expect(pub('CLIENT', ' e1 ')).toMatchObject({ role: 'CLIENT', event: 'e1' })
    expect(pub('OPERATOR')).toMatchObject({ role: 'CLIENT', event: 'e1' })
    expect(pub('')).toMatchObject({ role: 'CLIENT' })
  })

  it('keeps at least one active SUPER_ADMIN', () => {
    const rows = [
      { Email: 'a@x.com', Role: 'SUPER_ADMIN', Aktif: true },
      { Email: 'b@x.com', Role: 'ADMIN', Aktif: 'FALSE' },
      { Email: 'c@x.com', Role: 'CLIENT', Aktif: true },
    ]
    const keep = (email: string, after: unknown) => () => (gas.keepSuperAdmin_ as (...a: unknown[]) => void)(rows, email, after)
    expect(keep('A@x.com', null)).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(keep('a@x.com', { role: 'CLIENT', aktif: true })).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(keep('a@x.com', { role: 'SUPER_ADMIN', aktif: false })).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(keep('b@x.com', { role: 'SUPER_ADMIN', aktif: true })).not.toThrow()
    expect(keep('c@x.com', null)).not.toThrow()
  })

  it('compares in constant time and makes 64-hex tokens', () => {
    expect(call(gas, 'safeEqual_', 'abc', 'abc')).toBe(true)
    expect(call(gas, 'safeEqual_', 'abc', 'abd')).toBe(false)
    expect(call(gas, 'safeEqual_', 'abc', 'abcd')).toBe(false)
    expect(call(gas, 'newToken_')).toMatch(/^[0-9a-f]{64}$/)
    expect(call(gas, 'newSalt_')).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('01_Http.gs + 02_Router.gs', () => {
  const match = (method: string, path: string) => call(gas, 'matchRoute_', method, path)

  it('matches fixed segments before :id', () => {
    expect(match('GET', `event/${EVENT_ID}/guests/check`)).toMatchObject({ handler: 'handleCheckGuests_', params: { code: EVENT_ID } })
    expect(match('GET', 'event/x/guests/g-3')).toMatchObject({ handler: 'handleGetGuest_', params: { code: 'x', id: 'g-3' } })
    expect(match('GET', 'event/x/guests/g1/preview')).toMatchObject({ handler: 'handlePreview_', params: { id: 'g1' } })
    expect(match('GET', 'event/x/templates/validate')).toMatchObject({ handler: 'handleValidateTemplates_' })
    expect(match('GET', 'event/x/templates/t1')).toMatchObject({ handler: 'handleGetTemplate_', params: { id: 't1' } })
    expect(match('PUT', 'event/x/templates/A%20B')).toMatchObject({ handler: 'handleUpdateTemplate_', params: { id: 'A B' } })
    expect(match('GET', '/event/')).toMatchObject({ handler: 'handleListEvents_' })
    expect(match('POST', 'event')).toMatchObject({ handler: 'handleCreateEvent_', opts: { role: 'SUPER_ADMIN', lock: true } })
    expect(match('PUT', 'event/x').opts).toEqual({ lock: true })
    expect(match('DELETE', 'event/x').opts).toEqual({ role: 'SUPER_ADMIN', lock: true })
    for (const m of ['POST', 'PUT', 'DELETE']) {
      expect(match(m, m === 'POST' ? 'event/x/templates' : 'event/x/templates/K').opts).toEqual({ lock: true })
    }
    expect(match('GET', 'users')).toMatchObject({ handler: 'handleListUsers_', opts: { role: 'SUPER_ADMIN' } })
    expect(match('POST', 'users')).toMatchObject({ handler: 'handleCreateUser_', opts: { role: 'SUPER_ADMIN', lock: true } })
    expect(match('PATCH', 'users/u1')).toMatchObject({ handler: 'handleUpdateUser_', params: { id: 'u1' } })
    expect(match('DELETE', 'users/u1')).toMatchObject({ handler: 'handleDeleteUser_', params: { id: 'u1' } })
    expect(match('POST', 'users/u1/reset-password')).toMatchObject({
      handler: 'handleResetPassword_',
      params: { id: 'u1' },
      opts: { role: 'SUPER_ADMIN', lock: true },
    })
    expect(match('GET', 'health')).toMatchObject({ handler: 'handleHealth_', opts: { auth: false } })
    expect(match('POST', 'event/x/guests/bulk-delete')).toMatchObject({ handler: 'handleBulkDeleteGuests_' })
    expect(match('PATCH', 'event/x/guests/g2')).toMatchObject({ handler: 'handlePatchGuest_', params: { id: 'g2' } })
    expect(match('POST', 'event/x/render/draft')).toMatchObject({ handler: 'handleRenderDraft_' })
  })

  it('refuses unknown paths and methods with ROUTE_NOT_FOUND', () => {
    for (const [m, p] of [
      ['GET', 'nope'],
      ['PATCH', 'event/x'],
      ['GET', 'event/x/guests/1/2/3'],
      ['POST', 'event/x/templates/validate'],
      ['PUT', 'users/a@x.com'],
      ['GET', 'users/a@x.com'],
    ]) {
      expect(() => (gas.matchRoute_ as (a: string, b: string) => unknown)(m, p)).toThrow(
        expect.objectContaining({ code: 'ROUTE_NOT_FOUND' }),
      )
    }
  })

  it('parses the request: path, method override, token placement', () => {
    const get = call(gas, 'parseRequest_', 'GET', {
      pathInfo: '/event/e1/guests/g3/preview/',
      parameter: { token: 't1', tipe: 'UNDANGAN' },
    })
    expect(get).toEqual({
      method: 'GET',
      path: 'event/e1/guests/g3/preview',
      query: { token: 't1', tipe: 'UNDANGAN' },
      body: {},
      token: 't1',
    })
    // The real transport: the route in `?path=` (a segment after /exec is sign-in-walled), never echoed into query.
    expect(
      call(gas, 'parseRequest_', 'GET', { parameter: { path: 'event/fidaeno/templates/UND%201', token: 't9' } }),
    ).toMatchObject({ method: 'GET', path: 'event/fidaeno/templates/UND%201', query: { token: 't9' }, token: 't9' })
    expect(
      (call(gas, 'parseRequest_', 'GET', { parameter: { path: 'health' } }) as { query: object }).query,
    ).toEqual({})
    const viaQuery = call(gas, 'parseRequest_', 'POST', { parameter: { path: 'auth/login' }, postData: { contents: '{"email":"a"}' } })
    expect(viaQuery).toMatchObject({ method: 'POST', path: 'auth/login', body: { email: 'a' } })
    const post = (body: unknown) => call(gas, 'parseRequest_', 'POST', { postData: { contents: JSON.stringify(body) } })
    expect(post({ _method: 'patch', token: 't2' })).toMatchObject({ method: 'PATCH', path: '', token: 't2' })
    expect(post({ _method: 'DELETE' }).method).toBe('DELETE')
    expect(post({ _method: 'PUT' }).method).toBe('PUT')
    expect(post({ _method: 'GET' }).method).toBe('POST')
    expect(post({}).method).toBe('POST')
    // GET never takes an override, and ignores the body.
    expect(call(gas, 'parseRequest_', 'GET', { parameter: { _method: 'DELETE' } }).method).toBe('GET')
    expect(call(gas, 'parseRequest_', 'GET', undefined)).toMatchObject({ method: 'GET', path: '' })
  })
})

describe('08_Render.gs ↔ template.ts', () => {
  const guests = applyFormulas(SEED_GUESTS, SEED_META.event)

  it('builds the same context and renders every seed template identically', () => {
    for (const g of guests) {
      const ctx = buildContext(g, SEED_META)
      expect(call(gas, 'buildContext_', g, SEED_META)).toEqual(ctx)
      for (const t of SEED_TEMPLATES) {
        expect(call(gas, 'inspectTemplate_', t.Isi_Pesan, ctx)).toEqual(inspectTemplate(t.Isi_Pesan, ctx))
      }
    }
  })

  it('inspects drafts with unknown, malformed and empty tokens identically', () => {
    const ctx = buildContext({ ...guests[0], Meja: '' }, SEED_META)
    for (const body of [
      '{{ tamu.nama }} {{tamu.meja}} {{nope}} {{tamu.nama}',
      '}} {{link}} {{greet}} {{sesi3.label}}',
      '',
      '{{constructor}} {{__proto__}}',
    ]) {
      expect(call(gas, 'inspectTemplate_', body, ctx)).toEqual(inspectTemplate(body, ctx))
    }
  })

  it('throws the same TemplateError message on a strict render', () => {
    const ctx = buildContext(guests[0], SEED_META)
    const body = 'Hai {{tamu.nama}} {{bogus}} {{x'
    const expected = (() => {
      try {
        renderTemplate(body, ctx)
      } catch (e) {
        return (e as Error).message
      }
    })()
    expect(() => (gas.renderTemplate_ as (b: string, c: unknown) => string)(body, ctx)).toThrow(expected)
    expect(call(gas, 'renderTemplate_', SEED_TEMPLATES[0].Isi_Pesan, ctx)).toBe(renderTemplate(SEED_TEMPLATES[0].Isi_Pesan, ctx))
  })

  it('formats dates, greetings, picks templates and links the same way', () => {
    for (const d of ['2026-11-14', '2026-01-01', '2024-02-29', '2026-08-17', 'bukan tanggal', '']) {
      expect(call(gas, 'formatTanggal_', d)).toBe(formatTanggal(d))
    }
    for (const pin of ['012345', '000000', '729104', '', 'ü😀']) {
      expect(call(gas, 'pickGreeting_', pin, SEED_META.greetings)).toBe(pickGreeting(pin, SEED_META.greetings))
    }
    const withInactive: Template[] = [...SEED_TEMPLATES, { ...SEED_TEMPLATES[1], Kode: 'OFF', Akses: 'KELUARGA', Aktif: false }]
    for (const tipe of ['UNDANGAN', 'REMINDER', 'INFO_HARI_H'] as const) {
      for (const akses of ['VIP', 'KELUARGA', 'PUBLIC', '', 'VVIP']) {
        expect(call(gas, 'pickTemplate_', withInactive, tipe, akses) ?? null).toEqual(pickTemplate(withInactive, tipe, akses) ?? null)
      }
    }
    for (const [d, s, p] of [
      ['https://undangan.by.me/', 'a', '1'],
      ['undangan.by.me', 'a', '1'],
      ['', 'a', '1'],
      ['x.id', 'a', ''],
    ]) {
      expect(call(gas, 'linkUndangan_', d, s, p)).toBe(linkUndangan(d, s, p))
    }
    for (const hp of ['081234567890', '+62 812-3456-7890', 'nomor', '']) {
      expect(call(gas, 'waLink_', hp, 'Halo & selamat 🎉')).toBe(waLink(hp, 'Halo & selamat 🎉'))
    }
  })
})

describe('09_Domain.gs ↔ phone / pin / derive / checks / event', () => {
  const phones = [
    '08123456789',
    '0812-3456 7891',
    '(0813) 5555-1212',
    '+6285700001111',
    '085700001111',
    '6281211110001',
    '81211110001',
    'nomor-nyusul',
    '',
    '   ',
    '+1 555 0100',
    '021-555-0100',
  ]

  it('normalises and validates phones identically', () => {
    const counts = phoneCounts(phones)
    const gasCounts = (gas.phoneCounts_ as (p: string[]) => Map<string, number>)(phones)
    expect(Object.fromEntries(gasCounts)).toEqual(Object.fromEntries(counts))
    for (const hp of phones) {
      expect(call(gas, 'normalizePhone_', hp)).toBe(normalizePhone(hp))
      expect(call(gas, 'phoneKey_', hp)).toBe(phoneKey(hp))
      expect(call(gas, 'hpValid_', hp, gasCounts)).toBe(hpValid(hp, counts))
    }
  })

  it('generates unique 6-digit PINs that avoid existing ones', () => {
    const existing = SEED_GUESTS.map((g) => g.PIN)
    const pins: string[] = call(gas, 'generatePins_', 500, existing)
    expect(pins).toHaveLength(500)
    expect(new Set(pins).size).toBe(500)
    for (const p of pins) {
      expect(p).toMatch(PIN_PATTERN)
      expect(existing).not.toContain(p)
    }
  })

  it('derives No / HP_Valid / Link_Undangan and the issue list identically', () => {
    const derived = applyFormulas(SEED_GUESTS, SEED_META.event)
    expect(call(gas, 'applyFormulas_', SEED_GUESTS, SEED_META.event)).toEqual(derived)
    expect(call(gas, 'cekDuplikat_', derived)).toEqual(cekDuplikat(derived))
  })

  it('fills event defaults and validates events identically', () => {
    const cases = [
      SEED_META.event,
      {},
      { slug: '1bad', couple: { pria: { hp: 'abc', email: 'x@' }, hashtag: '#dua kata' }, sesi: [{ label: 'A', mulai: '10:00', selesai: '09:00' }] },
      { ...SEED_META.event, batas_rsvp: '2026-12-01', domain: 'not a domain' },
      { ...SEED_META.event, couple: { ...SEED_META.event.couple, hashtag: '#ÜberCafé_1' } },
    ]
    for (const c of cases) {
      const filled = withEventDefaults(structuredClone(c) as never)
      expect(call(gas, 'withEventDefaults_', c)).toEqual(filled)
      expect(call(gas, 'validateEvent_', filled)).toEqual(validateEvent(filled))
    }
  })
})

// ── handlers against an in-memory spreadsheet ───────────────────────────────

type Cell = string | number | boolean | Date

class FakeRange {
  private sh: FakeSheet
  private r: number
  private c: number
  private nr: number
  private nc: number
  constructor(sh: FakeSheet, r: number, c: number, nr: number, nc: number) {
    this.sh = sh
    this.r = r
    this.c = c
    this.nr = nr
    this.nc = nc
  }
  getValues(): Cell[][] {
    return Array.from({ length: this.nr }, (_, i) =>
      Array.from({ length: this.nc }, (_, j) => this.sh.data[this.r - 1 + i]?.[this.c - 1 + j] ?? ''),
    )
  }
  setValues(v: Cell[][]) {
    if (v.length !== this.nr || v.some((row) => row.length !== this.nc)) throw new Error('setValues: shape mismatch')
    v.forEach((row, i) =>
      row.forEach((cell, j) => {
        const ri = this.r - 1 + i
        while (this.sh.data.length <= ri) this.sh.data.push([])
        this.sh.data[ri][this.c - 1 + j] = this.sh.textCol(this.c + j) && typeof cell === 'number' ? String(cell) : cell
      }),
    )
    return this
  }
  setNumberFormat(f: string) {
    if (f === '@') for (let j = 0; j < this.nc; j++) this.sh.textCols.add(this.c + j)
    return this
  }
  setFontWeight() {
    return this
  }
  setBackground() {
    return this
  }
  setDataValidation() {
    return this
  }
  setValue(v: Cell) {
    return this.setValues([[v]])
  }
}

class FakeSheet {
  data: Cell[][] = []
  textCols = new Set<number>()
  name: string
  constructor(name: string) {
    this.name = name
  }
  textCol(c: number) {
    return this.textCols.has(c)
  }
  getLastRow() {
    for (let i = this.data.length; i > 0; i--) if (this.data[i - 1].some((c) => c !== '' && c !== undefined)) return i
    return 0
  }
  getLastColumn() {
    return Math.max(0, ...this.data.map((r) => r.length))
  }
  getMaxRows() {
    return Math.max(1000, this.data.length)
  }
  getRange(r: number, c: number, nr = 1, nc = 1) {
    return new FakeRange(this, r, c, nr, nc)
  }
  deleteRows(start: number, n: number) {
    this.data.splice(start - 1, n)
  }
  insertColumnBefore(c: number) {
    this.data.forEach((r) => r.splice(c - 1, 0, ''))
    this.textCols = new Set([...this.textCols].map((x) => (x >= c ? x + 1 : x)))
  }
  setFrozenRows() {}
  /** Rows as header-keyed objects (for assertions). */
  objects() {
    const [h, ...rows] = this.data
    return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])))
  }
}

function makeServices(sheets: Record<string, Cell[][]>) {
  const map = new Map(Object.entries(sheets).map(([n, d]) => [n, Object.assign(new FakeSheet(n), { data: d })]))
  const store = new Map<string, string>()
  const ss = {
    getSheetByName: (n: string) => map.get(n) ?? null,
    getSpreadsheetTimeZone: () => 'Asia/Jakarta',
  }
  return {
    map,
    services: {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
      Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
      CacheService: {
        getScriptCache: () => ({
          get: (k: string) => store.get(k) ?? null,
          put: (k: string, v: string) => void store.set(k, v),
          remove: (k: string) => void store.delete(k),
          removeAll: (ks: string[]) => ks.forEach((k) => store.delete(k)),
        }),
      },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
      ContentService: {
        MimeType: { JSON: 'JSON' },
        createTextOutput: (s: string) => ({ content: s, setMimeType() { return this } }),
      },
    },
  }
}

function seedWorkbook() {
  const table = <K extends string>(cols: readonly K[], rows: Partial<Record<K, Cell>>[]): Cell[][] => [
    [...cols],
    ...rows.map((r) => cols.map((c) => r[c] ?? '')),
  ]
  const salt = '0123456789abcdef'
  const guestRow = (event: string, g: Guest) => ({ Event: event, ...g })
  return {
    '01_Event': table(schema.EVENT_COLUMNS, [{ ...schema.eventToRow(SEED_META.event, 'DRY-RUN'), Dibuat: '2026-01-01T00:00:00.000Z' }]),
    '01_Sesi': table(schema.SESI_COLUMNS, SEED_META.event.sesi.map((s) => schema.sessionToRow(EVENT_ID, s))),
    '02_Tamu': table(schema.TAMU_SHEET_COLUMNS, [
      ...SEED_GUESTS.slice(0, 3).map((g) => guestRow(EVENT_ID, g)),
      guestRow('other', { ...SEED_GUESTS[3] }),
      ...SEED_GUESTS.slice(23, 25).map((g) => guestRow(EVENT_ID, g)),
    ]),
    '03_Template': table(
      schema.TEMPLATE_SHEET_COLUMNS,
      SEED_TEMPLATES.map((t) => ({ Event: EVENT_ID, ...t, Aktif: t.Aktif ? 'TRUE' : 'Ya-bukan' })),
    ),
    _Config: table(schema.CONFIG_COLUMNS, [{ Key: 'GREETINGS', Value: SEED_META.greetings.join('|') }]),
    _Users: table(schema.USER_COLUMNS, [
      // Legacy role values: ADMIN reads as SUPER_ADMIN, OPERATOR as CLIENT (here without an event).
      { ID: USER.admin, Email: 'Admin@Example.com', Nama: 'Admin', Role: 'ADMIN', Salt: salt, Password_Hash: schema.hashPassword('Admin#123', salt, sha256Hex), Aktif: true, Dibuat: '2026-01-01T00:00:00.000Z' },
      { ID: USER.klien, Email: 'klien@example.com', Nama: 'Klien', Role: 'CLIENT', Event: EVENT_ID, Salt: salt, Password_Hash: schema.hashPassword('Klien#123', salt, sha256Hex), Aktif: 'TRUE' },
      { ID: USER.operator, Email: 'operator@example.com', Nama: 'Op', Role: 'OPERATOR', Salt: salt, Password_Hash: schema.hashPassword('Operator#123', salt, sha256Hex), Aktif: 'Ya' },
    ]),
    _Sessions: table(schema.SESSION_COLUMNS, [{ Token_Hash: 'dead', Email: 'x', Kedaluwarsa: '2000-01-01T00:00:00.000Z' }]),
  }
}

describe('handlers (in-memory sheet)', () => {
  const setup = () => {
    const { map, services } = makeServices(seedWorkbook())
    const ctx = loadGas(services)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const send = (method: string, path: string, body: Record<string, unknown> = {}): any => {
      const res =
        method === 'GET'
          ? (ctx.doGet as (e: unknown) => { content: string })({ parameter: { ...body, path } })
          : (ctx.doPost as (e: unknown) => { content: string })({
              // The route rides in the query string (`?path=`), as the client sends it.
              parameter: { path },
              postData: { contents: JSON.stringify(method === 'POST' ? body : { ...body, _method: method }) },
            })
      return JSON.parse(res.content)
    }
    const login = (email = 'admin@example.com', password = 'Admin#123') => send('POST', 'auth/login', { email, password }).data.token as string
    const klien = () => login('klien@example.com', 'Klien#123')
    /** `users/:id` for the _Users row with this email (any case). */
    const u = (email: string) => {
      const row = map.get('_Users')!.objects().find((r) => String(r.Email).toLowerCase() === email.toLowerCase())
      return `users/${row ? row.ID : 'nobody'}`
    }
    return { map, send, login, klien, u }
  }
  const E = `event/${EVENT_ID}`
  const fidaeno = { ...SEED_META.event, slug: 'fidaeno', nama_event: 'Fida & Eno' }

  it('logs in, gates by token and role, and locks out after 5 failures', () => {
    const { map, send } = setup()
    expect(send('GET', 'health')).toMatchObject({ v: 1, ok: true, code: 'OK', data: { ok: true } })
    expect(send('GET', 'event')).toMatchObject({ ok: false, code: 'AUTH' })
    const res = send('POST', 'auth/login', { email: 'ADMIN@example.com', password: 'Admin#123' })
    expect(res.data.user).toEqual({ id: USER.admin, email: 'Admin@Example.com', nama: 'Admin', role: 'SUPER_ADMIN', event: '' })
    expect(res.data.token).toMatch(/^[0-9a-f]{64}$/)
    const sessions = map.get('_Sessions')!.objects()
    expect(sessions).toHaveLength(1) // the expired one was pruned
    expect(sessions[0].Token_Hash).toBe(sha256Hex(res.data.token))
    expect(send('GET', 'auth/me', { token: res.data.token }).data.role).toBe('SUPER_ADMIN')

    // A CLIENT (legacy OPERATOR) with no event cannot sign in.
    expect(send('POST', 'auth/login', { email: 'operator@example.com', password: 'Operator#123' })).toMatchObject({
      code: 'LOGIN_FAILED',
      message: expect.stringMatching(/belum terhubung ke event/),
    })

    const kres = send('POST', 'auth/login', { email: 'klien@example.com', password: 'Klien#123' })
    expect(kres.data.user).toEqual({ id: USER.klien, email: 'klien@example.com', nama: 'Klien', role: 'CLIENT', event: EVENT_ID })
    const op = kres.data.token as string
    expect(send('GET', 'auth/me', { token: op }).data).toEqual(kres.data.user)
    expect(send('POST', 'event', { token: op, event: SEED_META.event })).toMatchObject({ code: 'FORBIDDEN' })
    expect(send('GET', 'event/nope', { token: op })).toMatchObject({ code: 'NOT_FOUND' })
    expect(send('GET', 'what', { token: op })).toMatchObject({ code: 'ROUTE_NOT_FOUND' })

    for (let i = 0; i < 5; i++) expect(send('POST', 'auth/login', { email: 'klien@example.com', password: 'x' }).code).toBe('LOGIN_FAILED')
    expect(send('POST', 'auth/login', { email: 'Klien@example.com', password: 'Klien#123' }).code).toBe('LOGIN_LOCKED')

    expect(send('POST', 'auth/logout', { token: op }).ok).toBe(true)
    expect(send('GET', 'auth/me', { token: op }).code).toBe('AUTH')
  })

  it('changes a password and revokes the other sessions', () => {
    const { send, login } = setup()
    const a = login()
    const b = login()
    expect(send('POST', 'auth/change-password', { token: a, oldPassword: 'Admin#123', newPassword: 'short' }).code).toBe('VALIDATION')
    expect(send('POST', 'auth/change-password', { token: a, oldPassword: 'wrong', newPassword: 'NewPass#456' }).code).toBe('VALIDATION')
    expect(send('POST', 'auth/change-password', { token: a, oldPassword: 'Admin#123', newPassword: 'NewPass#456' }).ok).toBe(true)
    expect(send('GET', 'auth/me', { token: a }).ok).toBe(true)
    expect(send('GET', 'auth/me', { token: b }).code).toBe('AUTH')
    expect(send('POST', 'auth/login', { email: 'admin@example.com', password: 'NewPass#456' }).ok).toBe(true)
  })

  it('serves guests scoped to the event, addressed by ID, with derived columns', () => {
    const { map, send, login } = setup()
    const token = login()
    const list = send('GET', `${E}/guests`, { token }).data as Guest[]
    const expected = applyFormulas([...SEED_GUESTS.slice(0, 3), ...SEED_GUESTS.slice(23, 25)], SEED_META.event)
    expect(list).toEqual(expected)
    expect(list[0]).not.toHaveProperty('Event')

    // A PIN-less guest is addressed like any other: by ID.
    const taufik = list[3]
    expect(taufik.PIN).toBe('')
    expect(send('GET', `${E}/guests/${taufik.ID}`, { token }).data.Nama).toBe('Taufik Hidayat')
    expect(send('GET', `${E}/guests/012345`, { token }).code).toBe('NOT_FOUND') // a PIN is not an ID
    expect(send('GET', `${E}/guests/${SEED_GUESTS[3].ID}`, { token }).code).toBe('NOT_FOUND') // another event's guest

    // PATCH: manual keys only; HP stays text; the ID never changes.
    expect(send('PATCH', `${E}/guests/${list[0].ID}`, { token, fields: { PIN: '1' } }).code).toBe('VALIDATION')
    expect(send('PATCH', `${E}/guests/${list[0].ID}`, { token, fields: { ID: 'x' } }).code).toBe('VALIDATION')
    const patched = send('PATCH', `${E}/guests/${taufik.ID}`, { token, fields: { HP: '081299990000', Q_S2: 3 } }).data
    expect(patched).toMatchObject({ ID: taufik.ID, HP: '081299990000', Q_S2: 3, HP_Valid: '✅', No: taufik.No })

    // Create: ID and PIN generated, appended last within the event, derived columns written.
    const created = send('POST', `${E}/guests`, { token, fields: { Nama: 'Baru', HP: '0811' } }).data
    expect(created).toMatchObject({ Nama: 'Baru', No: 6, HP_Valid: '⚠️ format', Akses: 'REGULAR', Q_S2: 2 })
    expect(created.ID).toMatch(UUID)
    expect(created.PIN).toMatch(PIN_PATTERN)
    expect(created.Link_Undangan).toBe(`https://undangan.by.me/dimas-rara/${created.PIN}`)
    const row = map.get('02_Tamu')!.objects().at(-1)!
    expect(row).toMatchObject({ ID: created.ID, Event: EVENT_ID, No: 6, PIN: created.PIN, Link_Undangan: created.Link_Undangan })

    // Import + generate-pins + normalize-phones + check.
    expect(send('POST', `${E}/guests/import`, { token, rows: [{ PIN: '', Gelar: 'Ibu', Nama: 'Imp', HP: '0812 1111 2222', Email: '' }] }).data).toEqual({ added: 1, updated: 0 })
    expect(send('POST', `${E}/guests/generate-pins`, { token }).data).toBe(3)
    expect(send('POST', `${E}/guests/normalize-phones`, { token }).data).toBeGreaterThan(0)
    const after = send('GET', `${E}/guests`, { token }).data as Guest[]
    expect(after.every((g) => PIN_PATTERN.test(g.PIN) && UUID.test(g.ID))).toBe(true)
    expect(new Set(after.map((g) => g.ID)).size).toBe(after.length)
    expect(after.map((g) => g.No)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(send('GET', `${E}/guests/check`, { token }).data).toEqual(cekDuplikat(after))

    // Delete one, then bulk-delete; `other` is untouched.
    expect(send('DELETE', `${E}/guests/${after[0].ID}`, { token }).ok).toBe(true)
    expect(send('POST', `${E}/guests/bulk-delete`, { token, ids: [after[1].ID, after[2].ID] }).data).toBe(2)
    expect(send('POST', `${E}/guests/bulk-delete`, { token, ids: [after[1].ID] }).code).toBe('NOT_FOUND')
    const rest = send('GET', `${E}/guests`, { token }).data as Guest[]
    expect(rest.map((g) => g.No)).toEqual([1, 2, 3, 4])
    expect(map.get('02_Tamu')!.objects().filter((r) => r.Event === 'other')).toHaveLength(1)
  })

  it('imports by HP: a known number updates that guest, blank cells keep its data', () => {
    const { send, login } = setup()
    const token = login()
    const before = send('GET', `${E}/guests`, { token }).data as Guest[]
    const bambang = before[0]
    expect(bambang.HP).toBe('+6281211110001')
    const row = (f: Record<string, string>) => ({ PIN: '', Gelar: '', Nama: '', HP: '', Email: '', ...f })
    const res = send('POST', `${E}/guests/import`, {
      token,
      rows: [
        row({ Gelar: '', Nama: 'Bambang Baru', HP: '0812-1111-0001' }), // existing, other format; Gelar blank → kept
        row({ Gelar: 'Sdr.', Nama: 'Anyar', HP: '081277778888' }), // new
        row({ Gelar: 'Bapak', Nama: '', HP: '6281277778888' }), // same file, same HP → merges into the new row
        row({ Nama: 'Tanpa HP' }), // no HP → always new
        row({ Nama: 'Tanpa HP' }),
        row({ Nama: before[1].Nama, HP: before[1].HP }), // identical → not counted as updated
      ],
    }).data
    expect(res).toEqual({ added: 3, updated: 1 })
    const after = send('GET', `${E}/guests`, { token }).data as Guest[]
    expect(after).toHaveLength(before.length + 3)
    expect(after[0]).toMatchObject({ ID: bambang.ID, PIN: bambang.PIN, Gelar: bambang.Gelar, Nama: 'Bambang Baru', HP: bambang.HP, Meja: bambang.Meja })
    expect(after.filter((g) => g.Nama === 'Anyar')).toMatchObject([{ Gelar: 'Bapak', HP: '081277778888' }])
    expect(after.filter((g) => g.Nama === 'Tanpa HP')).toHaveLength(2)
  })

  it('gives a row typed into the sheet without an ID a new one on read', () => {
    const { map, send, login } = setup()
    const token = login()
    const tamu = map.get('02_Tamu')!
    tamu.data[1][0] = ''
    const [first] = send('GET', `${E}/guests`, { token }).data as Guest[]
    expect(first.ID).toMatch(UUID)
    expect(tamu.objects()[0].ID).toBe(first.ID)
    expect(send('GET', `${E}/guests`, { token }).data[0].ID).toBe(first.ID)
  })

  it('renders previews, drafts and links through the one renderer', () => {
    const { map, send, login } = setup()
    const token = login()
    const g = applyFormulas(SEED_GUESTS.slice(0, 3), SEED_META.event)[0]
    const tpl = pickTemplate(SEED_TEMPLATES, 'UNDANGAN', g.Akses)!
    const text = renderTemplate(tpl.Isi_Pesan, buildContext(g, SEED_META))
    expect(send('GET', `${E}/guests/${g.ID}/preview`, { token, tipe: 'UNDANGAN' }).data).toEqual({ kode: tpl.Kode, text, waLink: waLink(g.HP, text) })
    expect(send('GET', `${E}/guests/${g.ID}/preview`, { token, tipe: 'INFO_HARI_H' }).code).toBe('NO_TEMPLATE')
    const draft = send('POST', `${E}/render/draft`, { token, body: 'Hai {{tamu.nama}} {{x}}', id: null }).data
    expect(draft).toEqual({ text: 'Hai Nama Tamu {{x}}', unknown: ['x'], malformed: false, empty: [] })
    expect(send('POST', `${E}/render/draft`, { token, body: '{{tamu.nama}}', id: g.ID }).data.text).toBe(g.Nama)

    const links = send('POST', `${E}/guests/links`, { token, ids: null, tipe: 'UNDANGAN' }).data
    expect(links.written).toBe(3)
    expect(links.skipped.map((s: { reason: string }) => s.reason)).toEqual(['PIN kosong — link undangan belum ada', 'PIN kosong — link undangan belum ada'])
    const row = map.get('02_Tamu')!.objects()[0]
    expect(row.Preview_Pesan).toBe(text)
    expect(row.Link_WA).toBe(waLink(g.HP, text))
    expect(send('POST', `${E}/guests/links`, { token, ids: [g.ID], tipe: 'UNDANGAN' }).data.written).toBe(1)

    // Validate ≡ mock.validateTemplates on the same rows.
    const reports = send('GET', `${E}/templates/validate`, { token }).data
    expect(reports.map((r: { kode: string }) => r.kode)).toEqual(SEED_TEMPLATES.filter((t) => t.Aktif).map((t) => t.Kode))
  })

  it('does template CRUD by ID, with Kode unique per event', () => {
    const { send, login } = setup()
    const token = login()
    const list = send('GET', `${E}/templates`, { token }).data as Template[]
    expect(list).toEqual(SEED_TEMPLATES)
    const t = { ...SEED_TEMPLATES[0], ID: '', Kode: ' NEW ' }
    const made = send('POST', `${E}/templates`, { token, template: t }).data as Template
    expect(made.Kode).toBe('NEW')
    expect(made.ID).toMatch(UUID)
    expect(send('POST', `${E}/templates`, { token, template: t }).code).toBe('VALIDATION')
    expect(send('PUT', `${E}/templates/${made.ID}`, { token, template: { ...t, Kode: 'UND-VIP' } }).code).toBe('VALIDATION')
    // A new Kode keeps the ID; an ID in the body is ignored.
    expect(send('PUT', `${E}/templates/${made.ID}`, { token, template: { ...t, ID: 'x', Kode: 'NEW2', Aktif: false } }).data).toMatchObject({ ID: made.ID, Kode: 'NEW2', Aktif: false })
    expect(send('GET', `${E}/templates/${made.ID}`, { token }).data).toMatchObject({ Kode: 'NEW2', Aktif: false })
    expect(send('GET', `${E}/templates/NEW2`, { token }).code).toBe('NOT_FOUND') // a Kode is not an ID
    expect(send('DELETE', `${E}/templates/${made.ID}`, { token }).ok).toBe(true)
    expect(send('GET', `${E}/templates/${made.ID}`, { token }).code).toBe('NOT_FOUND')
    expect(send('GET', `${E}/templates`, { token }).data).toHaveLength(SEED_TEMPLATES.length)
  })

  it('creates, renames (the ID stays) and deletes events', () => {
    const { map, send, login } = setup()
    const token = login()
    expect(send('GET', 'event', { token }).data).toEqual([
      { id: EVENT_ID, slug: 'dimas-rara', nama_event: SEED_META.event.nama_event, tipe: 'PERNIKAHAN', tanggal_utama: '2026-11-14', mode: 'DRY-RUN', jumlah_tamu: 5, jumlah_template: 6 },
    ])
    expect(send('GET', E, { token }).data).toEqual(SEED_META)
    expect(send('GET', 'event/dimas-rara', { token }).code).toBe('NOT_FOUND') // a slug is not an ID

    const bad = send('POST', 'event', { token, event: { slug: 'Bad Slug' } })
    expect(bad.code).toBe('VALIDATION')
    expect(bad.message).toMatch(/^Data event belum lengkap: .*slug \(/)
    expect(send('POST', 'event', { token, event: { ...SEED_META.event, id: '' } }).code).toBe('DUPLICATE_SLUG')

    // A copied event gets its own IDs: the event's and its sessions' ids in the body are ignored.
    const fresh = { ...SEED_META.event, slug: 'baru', couple: { ...SEED_META.event.couple, pria: { ...SEED_META.event.couple.pria, hp: '0812 7777 0001' } } }
    const created = send('POST', 'event', { token, event: fresh, mode: 'LIVE' }).data
    expect(created).toMatchObject({ mode: 'LIVE', greetings: SEED_META.greetings })
    expect(created.event.id).toMatch(UUID)
    expect(created.event.id).not.toBe(EVENT_ID)
    expect(created.event.couple.pria.hp).toBe('+6281277770001')
    const baruSesi = map.get('01_Sesi')!.objects().filter((r) => r.Event === created.event.id)
    expect(baruSesi.map((r) => r.Kode)).toEqual(['S1', 'S2'])
    expect(baruSesi.every((r) => UUID.test(String(r.ID)) && !SEED_META.event.sesi.some((s) => s.id === r.ID))).toBe(true)

    expect(send('PUT', `event/${created.event.id}`, { token, event: { ...fresh, slug: 'dimas-rara' } }).code).toBe('DUPLICATE_SLUG')
    const renamed = send('PUT', E, { token, event: { ...SEED_META.event, slug: 'dr-2026', sesi: [SEED_META.event.sesi[1]] } }).data
    expect(renamed.event).toMatchObject({ id: EVENT_ID, slug: 'dr-2026' })
    // A kept session keeps its ID; S-codes are renumbered.
    expect(renamed.event.sesi.map((s: { id: string; kode: string; label: string }) => [s.id, s.kode, s.label])).toEqual([[SEED_META.event.sesi[1].id, 'S1', 'Resepsi']])
    const guests = send('GET', `${E}/guests`, { token }).data as Guest[]
    expect(guests).toHaveLength(5)
    expect(guests[0].Link_Undangan).toBe('https://undangan.by.me/dr-2026/012345')
    expect(send('GET', `${E}/templates`, { token }).data).toHaveLength(6)
    // Nothing else had to move: every other tab points at the ID.
    expect(map.get('_Users')!.objects().find((r) => r.Email === 'klien@example.com')!.Event).toBe(EVENT_ID)

    expect(send('DELETE', E, { token }).data).toEqual({ tamu: 5, template: 6, sesi: 1, akun: 1 })
    expect(send('GET', 'event', { token }).data.map((e: { slug: string }) => e.slug)).toEqual(['baru'])
    expect(map.get('02_Tamu')!.objects().map((r) => r.Event)).toEqual(['other'])
    expect(map.get('_Users')!.objects().map((r) => r.Email)).toEqual(['Admin@Example.com', 'operator@example.com'])
  })

  it('scopes a CLIENT to its own event', () => {
    const { map, send, login, klien, u } = setup()
    const sa = login()
    const fid = send('POST', 'event', { token: sa, event: fidaeno }).data.event.id as string
    expect(send('GET', 'event', { token: sa }).data.map((e: { slug: string }) => e.slug)).toEqual(['dimas-rara', 'fidaeno'])

    const token = klien()
    expect(send('GET', 'event', { token }).data.map((e: { id: string }) => e.id)).toEqual([EVENT_ID])
    expect(send('GET', E, { token }).data).toEqual(SEED_META)
    expect(send('GET', `${E}/guests`, { token }).data).toHaveLength(5)

    // Another event — existing or not — is indistinguishable: NOT_FOUND with one message.
    const F = `event/${fid}`
    const other = [
      send('GET', F, { token }),
      send('GET', `${F}/guests`, { token }),
      send('PATCH', `${F}/guests/${SEED_GUESTS[0].ID}`, { token, fields: { Meja: 'X' } }),
      send('GET', `${F}/templates`, { token }),
      send('PUT', F, { token, event: fidaeno }),
      send('GET', 'event/nope', { token }),
    ]
    for (const r of other) expect(r).toMatchObject({ ok: false, code: 'NOT_FOUND', message: 'Event tidak ditemukan' })

    // Own event data: yes, except slug / domain; mode is ignored.
    const put = send('PUT', E, { token, event: { ...SEED_META.event, nama_event: 'Baru' }, mode: 'LIVE' })
    expect(put.data).toMatchObject({ mode: 'DRY-RUN', event: { id: EVENT_ID, nama_event: 'Baru', slug: 'dimas-rara' } })
    expect(send('PUT', E, { token, event: { ...SEED_META.event, slug: 'dr-2026' } })).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Slug dan domain hanya bisa diubah SUPER_ADMIN',
    })
    expect(send('PUT', E, { token, event: { ...SEED_META.event, domain: 'lain.id' } }).code).toBe('FORBIDDEN')
    expect(send('GET', E, { token }).data.event).toMatchObject({ slug: 'dimas-rara', domain: SEED_META.event.domain })

    // Templates: full CRUD.
    const t = { ...SEED_TEMPLATES[0], ID: '', Kode: 'KLIEN' }
    const made = send('POST', `${E}/templates`, { token, template: t }).data
    expect(made.Kode).toBe('KLIEN')
    expect(send('PUT', `${E}/templates/${made.ID}`, { token, template: { ...t, Aktif: false } }).data.Aktif).toBe(false)
    expect(send('DELETE', `${E}/templates/${made.ID}`, { token }).ok).toBe(true)

    // SUPER_ADMIN only.
    for (const [m, p, b] of [
      ['POST', 'event', { event: { ...fidaeno, slug: 'x' } }],
      ['DELETE', E, {}],
      ['GET', 'users', {}],
      ['POST', 'users', { email: 'z@x.com', nama: 'Z', role: 'CLIENT', event: EVENT_ID, password: 'Password#1' }],
      ['PATCH', u('klien@example.com'), { aktif: false }],
      ['POST', u('klien@example.com') + '/reset-password', { password: 'Password#1' }],
      ['DELETE', u('klien@example.com'), {}],
    ] as const) {
      expect(send(m, p, { token, ...b }).code).toBe('FORBIDDEN')
    }
    expect(map.get('01_Event')!.objects().map((r) => r.Slug)).toEqual(['dimas-rara', 'fidaeno'])
    expect(map.get('_Users')!.objects()).toHaveLength(3)
  })

  it('manages users by ID: validation, self and session guards', () => {
    const { map, send, login, klien, u } = setup()
    const sa = login()
    const fid = send('POST', 'event', { token: sa, event: fidaeno }).data.event.id as string

    const list = send('GET', 'users', { token: sa }).data
    expect(list).toEqual([
      { id: USER.admin, email: 'Admin@Example.com', nama: 'Admin', role: 'SUPER_ADMIN', event: '', aktif: true, dibuat: '2026-01-01T00:00:00.000Z', loginTerakhir: expect.any(String) },
      { id: USER.klien, email: 'klien@example.com', nama: 'Klien', role: 'CLIENT', event: EVENT_ID, aktif: true, dibuat: '', loginTerakhir: '' },
      { id: USER.operator, email: 'operator@example.com', nama: 'Op', role: 'CLIENT', event: '', aktif: true, dibuat: '', loginTerakhir: '' },
    ])
    expect(JSON.stringify(list)).not.toMatch(/Password_Hash|Salt|passwordHash|salt/)

    // Create: validation.
    const base = { email: 'fe@example.com', nama: 'Fida', role: 'CLIENT', event: fid, password: 'Klien#123' }
    const create = (over: Record<string, unknown>) => send('POST', 'users', { token: sa, ...base, ...over })
    expect(create({ email: 'bukan-email' })).toMatchObject({ code: 'VALIDATION' })
    expect(create({ email: 'KLIEN@example.com' })).toMatchObject({ code: 'VALIDATION', message: 'Email sudah terdaftar' })
    expect(create({ password: 'short' }).code).toBe('VALIDATION')
    expect(create({ role: 'ADMIN' }).code).toBe('VALIDATION')
    expect(create({ event: '' }).code).toBe('VALIDATION')
    expect(create({ event: 'nope' }).code).toBe('VALIDATION')
    expect(create({ event: 'fidaeno' }).code).toBe('VALIDATION') // a slug is not an event ID
    const made = create({}).data
    expect(made).toEqual({ id: expect.stringMatching(UUID), email: 'fe@example.com', nama: 'Fida', role: 'CLIENT', event: fid, aktif: true, dibuat: expect.any(String), loginTerakhir: '' })
    const row = map.get('_Users')!.objects().at(-1)!
    expect(row.ID).toBe(made.id)
    expect(row.Password_Hash).toBe(schema.hashPassword('Klien#123', String(row.Salt), sha256Hex))
    // SUPER_ADMIN never carries an event.
    expect(create({ email: 'sa2@example.com', role: 'SUPER_ADMIN', event: fid }).data).toMatchObject({ role: 'SUPER_ADMIN', event: '' })

    // Update: nama only keeps sessions; event change revokes them.
    const FE = `users/${made.id}`
    let fe = login('fe@example.com', 'Klien#123')
    expect(send('PATCH', FE, { token: sa, nama: 'Fida E' }).data.nama).toBe('Fida E')
    expect(send('GET', 'auth/me', { token: fe }).ok).toBe(true)
    expect(send('PATCH', FE, { token: sa, event: 'nope' }).code).toBe('VALIDATION')
    expect(send('PATCH', FE, { token: sa, event: EVENT_ID }).data.event).toBe(EVENT_ID)
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    fe = login('fe@example.com', 'Klien#123')
    expect(send('GET', 'auth/me', { token: fe }).data.event).toBe(EVENT_ID)

    // Deactivate revokes; login refused; reactivate.
    expect(send('PATCH', FE, { token: sa, aktif: false }).data.aktif).toBe(false)
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    expect(send('POST', 'auth/login', { email: 'fe@example.com', password: 'Klien#123' }).code).toBe('LOGIN_FAILED')
    expect(send('PATCH', FE, { token: sa, aktif: true }).data.aktif).toBe(true)

    // Reset password revokes and swaps the password.
    fe = login('fe@example.com', 'Klien#123')
    expect(send('POST', FE + '/reset-password', { token: sa, password: 'short' }).code).toBe('VALIDATION')
    expect(send('POST', FE + '/reset-password', { token: sa, password: 'Baru#4567' }).ok).toBe(true)
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    expect(send('POST', 'auth/login', { email: 'fe@example.com', password: 'Klien#123' }).code).toBe('LOGIN_FAILED')
    fe = login('fe@example.com', 'Baru#4567')

    // Promote to SUPER_ADMIN (event cleared, sessions revoked), demote back to CLIENT (event required).
    expect(send('PATCH', FE, { token: sa, role: 'SUPER_ADMIN' }).data).toMatchObject({ role: 'SUPER_ADMIN', event: '' })
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    expect(send('PATCH', FE, { token: sa, role: 'CLIENT' }).code).toBe('VALIDATION')
    expect(send('PATCH', FE, { token: sa, role: 'CLIENT', event: fid }).data).toMatchObject({ role: 'CLIENT', event: fid })

    // Self guards.
    expect(send('PATCH', u('admin@example.com'), { token: sa, role: 'CLIENT', event: fid })).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/akun sendiri/) })
    expect(send('PATCH', u('admin@example.com'), { token: sa, aktif: false })).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/akun sendiri/) })
    expect(send('DELETE', u('admin@example.com'), { token: sa })).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/akun sendiri/) })
    expect(send('PATCH', u('admin@example.com'), { token: sa, nama: 'Boss' }).data).toMatchObject({ nama: 'Boss', role: 'SUPER_ADMIN' })
    expect(send('GET', 'auth/me', { token: sa }).ok).toBe(true)

    // Unknown user — and an email is not an ID.
    expect(send('PATCH', 'users/nobody', { token: sa, nama: 'x' }).code).toBe('NOT_FOUND')
    expect(send('POST', 'users/nobody/reset-password', { token: sa, password: 'Password#1' }).code).toBe('NOT_FOUND')
    expect(send('DELETE', `users/${encodeURIComponent('klien@example.com')}`, { token: sa }).code).toBe('NOT_FOUND')

    // Delete revokes.
    const k = klien()
    expect(send('DELETE', u('Klien@Example.com'), { token: sa }).ok).toBe(true)
    expect(send('GET', 'auth/me', { token: k }).code).toBe('AUTH')
    expect(send('GET', 'users', { token: sa }).data.map((x: { email: string }) => x.email)).toEqual([
      'Admin@Example.com',
      'operator@example.com',
      'fe@example.com',
      'sa2@example.com',
    ])
  })

  it('setup() migrates a slug-keyed workbook to row IDs, idempotently', () => {
    // The workbook as it was before IDs: no ID column, `Event` holds the slug.
    const legacy = seedWorkbook()
    for (const tab of ['01_Event', '01_Sesi', '02_Tamu', '03_Template', '_Users'] as const) {
      legacy[tab] = legacy[tab].map((r) => r.slice(1).map((c) => (c === EVENT_ID ? 'dimas-rara' : c)))
    }
    const { map, services } = makeServices(legacy)
    const ctx = loadGas(services)
    const ss = services.SpreadsheetApp.getActiveSpreadsheet()
    ;(ctx.migrateIds_ as (s: unknown) => void)(ss)

    for (const tab of ['01_Event', '01_Sesi', '02_Tamu', '03_Template', '_Users']) {
      const sh = map.get(tab)!
      expect(sh.data[0][0], tab).toBe('ID')
      const ids = sh.objects().map((r) => String(r.ID))
      expect(ids.every((id) => UUID.test(id)), tab).toBe(true)
      expect(new Set(ids).size, tab).toBe(ids.length)
    }
    const eventId = String(map.get('01_Event')!.objects()[0].ID)
    expect(map.get('01_Sesi')!.objects().map((r) => r.Event)).toEqual([eventId, eventId])
    expect(map.get('02_Tamu')!.objects().map((r) => r.Event)).toEqual([eventId, eventId, eventId, 'other', eventId, eventId])
    expect(new Set(map.get('03_Template')!.objects().map((r) => r.Event))).toEqual(new Set([eventId]))
    expect(map.get('_Users')!.objects().map((r) => r.Event)).toEqual(['', eventId, ''])

    // Running it again changes nothing.
    const before = JSON.stringify([...map.entries()].map(([n, sh]) => [n, sh.data]))
    ;(ctx.migrateIds_ as (s: unknown) => void)(ss)
    expect(JSON.stringify([...map.entries()].map(([n, sh]) => [n, sh.data]))).toBe(before)
  })

  it('keeps a CLIENT on its event when SUPER_ADMIN renames the slug', () => {
    const { send, login, klien } = setup()
    const sa = login()
    const token = klien()
    expect(send('PUT', E, { token: sa, event: { ...SEED_META.event, slug: 'dr-2026' } }).ok).toBe(true)
    // The session stays valid and still points at the same event ID.
    expect(send('GET', 'auth/me', { token }).data).toMatchObject({ role: 'CLIENT', event: EVENT_ID })
    expect(send('GET', 'event', { token }).data.map((e: { slug: string }) => e.slug)).toEqual(['dr-2026'])
    expect(send('GET', `${E}/guests`, { token }).data).toHaveLength(5)
  })
})
