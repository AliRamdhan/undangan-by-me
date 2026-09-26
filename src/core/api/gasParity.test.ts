/// <reference types="node" />
import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { SEED_GUESTS, SEED_META, SEED_TEMPLATES } from '@/core/api/seed'
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
      expect(call(gas, 'sessionToRow_', 'dimas-rara', s)).toEqual(schema.sessionToRow('dimas-rara', s))
    }
    const row = schema.eventToRow(SEED_META.event, 'DRY-RUN')
    const sesi = SEED_META.event.sesi.map((s) => schema.sessionToRow('dimas-rara', s))
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
    const pub = (Role: string, Event = 'e1') => call(gas, 'publicUser_', { Email: ' a@x.com ', Nama: 'A', Role, Event })
    expect(pub('SUPER_ADMIN')).toEqual({ email: 'a@x.com', nama: 'A', role: 'SUPER_ADMIN', event: '' })
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

  it('matches fixed segments before :id / :kode', () => {
    expect(match('GET', 'event/dimas-rara/guests/check')).toMatchObject({ handler: 'handleCheckGuests_', params: { code: 'dimas-rara' } })
    expect(match('GET', 'event/x/guests/row-3')).toMatchObject({ handler: 'handleGetGuest_', params: { code: 'x', id: 'row-3' } })
    expect(match('GET', 'event/x/guests/012345/preview')).toMatchObject({ handler: 'handlePreview_', params: { id: '012345' } })
    expect(match('GET', 'event/x/templates/validate')).toMatchObject({ handler: 'handleValidateTemplates_' })
    expect(match('GET', 'event/x/templates/UND-VIP')).toMatchObject({ handler: 'handleGetTemplate_', params: { kode: 'UND-VIP' } })
    expect(match('PUT', 'event/x/templates/A%20B')).toMatchObject({ handler: 'handleUpdateTemplate_', params: { kode: 'A B' } })
    expect(match('GET', '/event/')).toMatchObject({ handler: 'handleListEvents_' })
    expect(match('POST', 'event')).toMatchObject({ handler: 'handleCreateEvent_', opts: { role: 'SUPER_ADMIN', lock: true } })
    expect(match('PUT', 'event/x').opts).toEqual({ lock: true })
    expect(match('DELETE', 'event/x').opts).toEqual({ role: 'SUPER_ADMIN', lock: true })
    for (const m of ['POST', 'PUT', 'DELETE']) {
      expect(match(m, m === 'POST' ? 'event/x/templates' : 'event/x/templates/K').opts).toEqual({ lock: true })
    }
    expect(match('GET', 'users')).toMatchObject({ handler: 'handleListUsers_', opts: { role: 'SUPER_ADMIN' } })
    expect(match('POST', 'users')).toMatchObject({ handler: 'handleCreateUser_', opts: { role: 'SUPER_ADMIN', lock: true } })
    expect(match('PATCH', 'users/a%2Bb%40x.com')).toMatchObject({ handler: 'handleUpdateUser_', params: { email: 'a+b@x.com' } })
    expect(match('DELETE', 'users/a@x.com')).toMatchObject({ handler: 'handleDeleteUser_', params: { email: 'a@x.com' } })
    expect(match('POST', 'users/a%40x.com/reset-password')).toMatchObject({
      handler: 'handleResetPassword_',
      params: { email: 'a@x.com' },
      opts: { role: 'SUPER_ADMIN', lock: true },
    })
    expect(match('GET', 'health')).toMatchObject({ handler: 'handleHealth_', opts: { auth: false } })
    expect(match('POST', 'event/x/guests/bulk-delete')).toMatchObject({ handler: 'handleBulkDeleteGuests_' })
    expect(match('PATCH', 'event/x/guests/row-2')).toMatchObject({ handler: 'handlePatchGuest_', params: { id: 'row-2' } })
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
      pathInfo: '/event/dimas-rara/guests/row-3/',
      parameter: { token: 't1', rowHint: '3', nama: 'Budi' },
    })
    expect(get).toEqual({
      method: 'GET',
      path: 'event/dimas-rara/guests/row-3',
      query: { token: 't1', rowHint: 3, nama: 'Budi' },
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
  const guestRow = (slug: string, g: Guest) => ({ Event: slug, ...g })
  return {
    '01_Event': table(schema.EVENT_COLUMNS, [{ ...schema.eventToRow(SEED_META.event, 'DRY-RUN'), Dibuat: '2026-01-01T00:00:00.000Z' }]),
    '01_Sesi': table(schema.SESI_COLUMNS, SEED_META.event.sesi.map((s) => schema.sessionToRow('dimas-rara', s))),
    '02_Tamu': table(schema.TAMU_SHEET_COLUMNS, [
      ...SEED_GUESTS.slice(0, 3).map((g) => guestRow('dimas-rara', g)),
      guestRow('other', { ...SEED_GUESTS[3] }),
      ...SEED_GUESTS.slice(23, 25).map((g) => guestRow('dimas-rara', g)),
    ]),
    '03_Template': table(
      schema.TEMPLATE_SHEET_COLUMNS,
      SEED_TEMPLATES.map((t) => ({ Event: 'dimas-rara', ...t, Aktif: t.Aktif ? 'TRUE' : 'Ya-bukan' })),
    ),
    _Config: table(schema.CONFIG_COLUMNS, [{ Key: 'GREETINGS', Value: SEED_META.greetings.join('|') }]),
    _Users: table(schema.USER_COLUMNS, [
      // Legacy role values: ADMIN reads as SUPER_ADMIN, OPERATOR as CLIENT (here without an event).
      { Email: 'Admin@Example.com', Nama: 'Admin', Role: 'ADMIN', Salt: salt, Password_Hash: schema.hashPassword('Admin#123', salt, sha256Hex), Aktif: true, Dibuat: '2026-01-01T00:00:00.000Z' },
      { Email: 'klien@example.com', Nama: 'Klien', Role: 'CLIENT', Event: 'dimas-rara', Salt: salt, Password_Hash: schema.hashPassword('Klien#123', salt, sha256Hex), Aktif: 'TRUE' },
      { Email: 'operator@example.com', Nama: 'Op', Role: 'OPERATOR', Salt: salt, Password_Hash: schema.hashPassword('Operator#123', salt, sha256Hex), Aktif: 'Ya' },
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
    return { map, send, login, klien }
  }
  const u = (email: string) => `users/${encodeURIComponent(email)}`
  const fidaeno = { ...SEED_META.event, slug: 'fidaeno', nama_event: 'Fida & Eno' }

  it('logs in, gates by token and role, and locks out after 5 failures', () => {
    const { map, send } = setup()
    expect(send('GET', 'health')).toMatchObject({ v: 1, ok: true, code: 'OK', data: { ok: true } })
    expect(send('GET', 'event')).toMatchObject({ ok: false, code: 'AUTH' })
    const res = send('POST', 'auth/login', { email: 'ADMIN@example.com', password: 'Admin#123' })
    expect(res.data.user).toEqual({ email: 'Admin@Example.com', nama: 'Admin', role: 'SUPER_ADMIN', event: '' })
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
    expect(kres.data.user).toEqual({ email: 'klien@example.com', nama: 'Klien', role: 'CLIENT', event: 'dimas-rara' })
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

  it('serves guests scoped to the event, with row-{No} ids and derived columns', () => {
    const { map, send, login } = setup()
    const token = login()
    const list = send('GET', 'event/dimas-rara/guests', { token }).data as Guest[]
    const expected = applyFormulas([...SEED_GUESTS.slice(0, 3), ...SEED_GUESTS.slice(23, 25)], SEED_META.event)
    expect(list).toEqual(expected)
    expect(list[0]).not.toHaveProperty('Event')

    // PIN-less guest by row-{No}; the nama must still match.
    const taufik = list[3]
    expect(taufik.PIN).toBe('')
    expect(send('GET', `event/dimas-rara/guests/row-${taufik.No}`, { token, nama: taufik.Nama }).data.Nama).toBe('Taufik Hidayat')
    expect(send('GET', `event/dimas-rara/guests/row-${taufik.No}`, { token, nama: 'Orang Lain' }).code).toBe('STALE_ROW')
    expect(send('GET', 'event/dimas-rara/guests/999999', { token }).code).toBe('NOT_FOUND')

    // PATCH: manual keys only; HP stays text.
    expect(send('PATCH', 'event/dimas-rara/guests/012345', { token, fields: { PIN: '1' } }).code).toBe('VALIDATION')
    const patched = send('PATCH', `event/dimas-rara/guests/row-${taufik.No}`, { token, nama: taufik.Nama, rowHint: taufik.No, fields: { HP: '081299990000', Q_S2: 3 } }).data
    expect(patched).toMatchObject({ HP: '081299990000', Q_S2: 3, HP_Valid: '✅', No: taufik.No })

    // Create: PIN generated, appended last within the event, derived columns written.
    const created = send('POST', 'event/dimas-rara/guests', { token, fields: { Nama: 'Baru', HP: '0811' } }).data
    expect(created).toMatchObject({ Nama: 'Baru', No: 6, HP_Valid: '⚠️ format', Akses: 'REGULAR', Q_S2: 2 })
    expect(created.PIN).toMatch(PIN_PATTERN)
    expect(created.Link_Undangan).toBe(`https://undangan.by.me/dimas-rara/${created.PIN}`)
    const row = map.get('02_Tamu')!.objects().at(-1)!
    expect(row).toMatchObject({ Event: 'dimas-rara', No: 6, PIN: created.PIN, Link_Undangan: created.Link_Undangan })

    // Import + generate-pins + normalize-phones + check.
    expect(send('POST', 'event/dimas-rara/guests/import', { token, rows: [{ PIN: '', Gelar: 'Ibu', Nama: 'Imp', HP: '0812 1111 2222', Email: '' }] }).data).toBe(1)
    expect(send('POST', 'event/dimas-rara/guests/generate-pins', { token }).data).toBe(3)
    expect(send('POST', 'event/dimas-rara/guests/normalize-phones', { token }).data).toBeGreaterThan(0)
    const after = send('GET', 'event/dimas-rara/guests', { token }).data as Guest[]
    expect(after.every((g) => PIN_PATTERN.test(g.PIN))).toBe(true)
    expect(after.map((g) => g.No)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(send('GET', 'event/dimas-rara/guests/check', { token }).data).toEqual(cekDuplikat(after))

    // Delete one, then bulk-delete; `other` is untouched.
    expect(send('DELETE', `event/dimas-rara/guests/${after[0].PIN}`, { token }).ok).toBe(true)
    expect(send('POST', 'event/dimas-rara/guests/bulk-delete', { token, refs: [after[1], after[2]].map((g) => ({ PIN: g.PIN, rowHint: g.No - 1, nama: g.Nama })) }).data).toBe(2)
    const rest = send('GET', 'event/dimas-rara/guests', { token }).data as Guest[]
    expect(rest.map((g) => g.No)).toEqual([1, 2, 3, 4])
    expect(map.get('02_Tamu')!.objects().filter((r) => r.Event === 'other')).toHaveLength(1)
  })

  it('renders previews, drafts and links through the one renderer', () => {
    const { map, send, login } = setup()
    const token = login()
    const g = applyFormulas(SEED_GUESTS.slice(0, 3), SEED_META.event)[0]
    const tpl = pickTemplate(SEED_TEMPLATES, 'UNDANGAN', g.Akses)!
    const text = renderTemplate(tpl.Isi_Pesan, buildContext(g, SEED_META))
    expect(send('GET', `event/dimas-rara/guests/${g.PIN}/preview`, { token, tipe: 'UNDANGAN' }).data).toEqual({ kode: tpl.Kode, text, waLink: waLink(g.HP, text) })
    expect(send('GET', `event/dimas-rara/guests/${g.PIN}/preview`, { token, tipe: 'INFO_HARI_H' }).code).toBe('NO_TEMPLATE')
    const draft = send('POST', 'event/dimas-rara/render/draft', { token, body: 'Hai {{tamu.nama}} {{x}}', ref: null }).data
    expect(draft).toEqual({ text: 'Hai Nama Tamu {{x}}', unknown: ['x'], malformed: false, empty: [] })

    const links = send('POST', 'event/dimas-rara/guests/links', { token, refs: null, tipe: 'UNDANGAN' }).data
    expect(links.written).toBe(3)
    expect(links.skipped.map((s: { reason: string }) => s.reason)).toEqual(['PIN kosong — link undangan belum ada', 'PIN kosong — link undangan belum ada'])
    const row = map.get('02_Tamu')!.objects()[0]
    expect(row.Preview_Pesan).toBe(text)
    expect(row.Link_WA).toBe(waLink(g.HP, text))

    // Validate ≡ mock.validateTemplates on the same rows.
    const reports = send('GET', 'event/dimas-rara/templates/validate', { token }).data
    expect(reports.map((r: { kode: string }) => r.kode)).toEqual(SEED_TEMPLATES.filter((t) => t.Aktif).map((t) => t.Kode))
  })

  it('does template CRUD with Kode unique per event', () => {
    const { send, login } = setup()
    const token = login()
    const list = send('GET', 'event/dimas-rara/templates', { token }).data as Template[]
    expect(list).toEqual(SEED_TEMPLATES)
    const t = { ...SEED_TEMPLATES[0], Kode: ' NEW ' }
    expect(send('POST', 'event/dimas-rara/templates', { token, template: t }).data.Kode).toBe('NEW')
    expect(send('POST', 'event/dimas-rara/templates', { token, template: t }).code).toBe('VALIDATION')
    expect(send('PUT', 'event/dimas-rara/templates/NEW', { token, template: { ...t, Kode: 'UND-VIP' } }).code).toBe('VALIDATION')
    expect(send('PUT', 'event/dimas-rara/templates/NEW', { token, template: { ...t, Kode: 'NEW2', Aktif: false } }).data).toMatchObject({ Kode: 'NEW2', Aktif: false })
    expect(send('GET', 'event/dimas-rara/templates/NEW2', { token }).data.Aktif).toBe(false)
    expect(send('GET', 'event/dimas-rara/templates/NEW', { token }).code).toBe('NOT_FOUND')
    expect(send('DELETE', 'event/dimas-rara/templates/NEW2', { token }).ok).toBe(true)
    expect(send('GET', 'event/dimas-rara/templates', { token }).data).toHaveLength(SEED_TEMPLATES.length)
  })

  it('creates, renames (cascade) and deletes events', () => {
    const { map, send, login } = setup()
    const token = login()
    expect(send('GET', 'event', { token }).data).toEqual([
      { slug: 'dimas-rara', nama_event: SEED_META.event.nama_event, tipe: 'PERNIKAHAN', tanggal_utama: '2026-11-14', mode: 'DRY-RUN', jumlah_tamu: 5, jumlah_template: 6 },
    ])
    expect(send('GET', 'event/dimas-rara', { token }).data).toEqual(SEED_META)

    const bad = send('POST', 'event', { token, event: { slug: 'Bad Slug' } })
    expect(bad.code).toBe('VALIDATION')
    expect(bad.message).toMatch(/^Data event belum lengkap: .*slug \(/)
    expect(send('POST', 'event', { token, event: SEED_META.event }).code).toBe('DUPLICATE_SLUG')

    const fresh = { ...SEED_META.event, slug: 'baru', couple: { ...SEED_META.event.couple, pria: { ...SEED_META.event.couple.pria, hp: '0812 7777 0001' } } }
    const created = send('POST', 'event', { token, event: fresh, mode: 'LIVE' }).data
    expect(created).toMatchObject({ mode: 'LIVE', greetings: SEED_META.greetings })
    expect(created.event.couple.pria.hp).toBe('+6281277770001')
    expect(map.get('01_Sesi')!.objects().filter((r) => r.Event === 'baru').map((r) => r.Kode)).toEqual(['S1', 'S2'])

    expect(send('PUT', 'event/baru', { token, event: { ...fresh, slug: 'dimas-rara' } }).code).toBe('DUPLICATE_SLUG')
    const renamed = send('PUT', 'event/dimas-rara', { token, event: { ...SEED_META.event, slug: 'dr-2026', sesi: [SEED_META.event.sesi[1]] } }).data
    expect(renamed.event.slug).toBe('dr-2026')
    expect(renamed.event.sesi.map((s: { kode: string; label: string }) => [s.kode, s.label])).toEqual([['S1', 'Resepsi']])
    expect(send('GET', 'event/dimas-rara', { token }).code).toBe('NOT_FOUND')
    const guests = send('GET', 'event/dr-2026/guests', { token }).data as Guest[]
    expect(guests).toHaveLength(5)
    expect(guests[0].Link_Undangan).toBe('https://undangan.by.me/dr-2026/012345')
    expect(send('GET', 'event/dr-2026/templates', { token }).data).toHaveLength(6)

    // The client moved with the rename, and goes with the delete.
    expect(map.get('_Users')!.objects().find((r) => r.Email === 'klien@example.com')!.Event).toBe('dr-2026')
    expect(send('DELETE', 'event/dr-2026', { token }).data).toEqual({ tamu: 5, template: 6, sesi: 1, akun: 1 })
    expect(send('GET', 'event', { token }).data.map((e: { slug: string }) => e.slug)).toEqual(['baru'])
    expect(map.get('02_Tamu')!.objects().map((r) => r.Event)).toEqual(['other'])
    expect(map.get('_Users')!.objects().map((r) => r.Email)).toEqual(['Admin@Example.com', 'operator@example.com'])
  })

  it('scopes a CLIENT to its own event', () => {
    const { map, send, login, klien } = setup()
    const sa = login()
    expect(send('POST', 'event', { token: sa, event: fidaeno }).ok).toBe(true)
    expect(send('GET', 'event', { token: sa }).data.map((e: { slug: string }) => e.slug)).toEqual(['dimas-rara', 'fidaeno'])

    const token = klien()
    expect(send('GET', 'event', { token }).data.map((e: { slug: string }) => e.slug)).toEqual(['dimas-rara'])
    expect(send('GET', 'event/dimas-rara', { token }).data).toEqual(SEED_META)
    expect(send('GET', 'event/dimas-rara/guests', { token }).data).toHaveLength(5)

    // Another event — existing or not — is indistinguishable: NOT_FOUND with one message.
    const other = [
      send('GET', 'event/fidaeno', { token }),
      send('GET', 'event/fidaeno/guests', { token }),
      send('PATCH', 'event/fidaeno/guests/012345', { token, fields: { Meja: 'X' } }),
      send('GET', 'event/fidaeno/templates', { token }),
      send('PUT', 'event/fidaeno', { token, event: fidaeno }),
      send('GET', 'event/nope', { token }),
    ]
    for (const r of other) expect(r).toMatchObject({ ok: false, code: 'NOT_FOUND', message: 'Event tidak ditemukan' })

    // Own event data: yes, except slug / domain; mode is ignored.
    const put = send('PUT', 'event/dimas-rara', { token, event: { ...SEED_META.event, nama_event: 'Baru' }, mode: 'LIVE' })
    expect(put.data).toMatchObject({ mode: 'DRY-RUN', event: { nama_event: 'Baru', slug: 'dimas-rara' } })
    expect(send('PUT', 'event/dimas-rara', { token, event: { ...SEED_META.event, slug: 'dr-2026' } })).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Slug dan domain hanya bisa diubah SUPER_ADMIN',
    })
    expect(send('PUT', 'event/dimas-rara', { token, event: { ...SEED_META.event, domain: 'lain.id' } }).code).toBe('FORBIDDEN')
    expect(send('GET', 'event/dimas-rara', { token }).data.event).toMatchObject({ slug: 'dimas-rara', domain: SEED_META.event.domain })

    // Templates: full CRUD.
    const t = { ...SEED_TEMPLATES[0], Kode: 'KLIEN' }
    expect(send('POST', 'event/dimas-rara/templates', { token, template: t }).data.Kode).toBe('KLIEN')
    expect(send('PUT', 'event/dimas-rara/templates/KLIEN', { token, template: { ...t, Aktif: false } }).data.Aktif).toBe(false)
    expect(send('DELETE', 'event/dimas-rara/templates/KLIEN', { token }).ok).toBe(true)

    // SUPER_ADMIN only.
    for (const [m, p, b] of [
      ['POST', 'event', { event: { ...fidaeno, slug: 'x' } }],
      ['DELETE', 'event/dimas-rara', {}],
      ['GET', 'users', {}],
      ['POST', 'users', { email: 'z@x.com', nama: 'Z', role: 'CLIENT', event: 'dimas-rara', password: 'Password#1' }],
      ['PATCH', u('klien@example.com'), { aktif: false }],
      ['POST', u('klien@example.com') + '/reset-password', { password: 'Password#1' }],
      ['DELETE', u('klien@example.com'), {}],
    ] as const) {
      expect(send(m, p, { token, ...b }).code).toBe('FORBIDDEN')
    }
    expect(map.get('01_Event')!.objects().map((r) => r.Slug)).toEqual(['dimas-rara', 'fidaeno'])
    expect(map.get('_Users')!.objects()).toHaveLength(3)
  })

  it('manages users: validation, self and session guards', () => {
    const { map, send, login, klien } = setup()
    const sa = login()
    expect(send('POST', 'event', { token: sa, event: fidaeno }).ok).toBe(true)

    const list = send('GET', 'users', { token: sa }).data
    expect(list).toEqual([
      { email: 'Admin@Example.com', nama: 'Admin', role: 'SUPER_ADMIN', event: '', aktif: true, dibuat: '2026-01-01T00:00:00.000Z', loginTerakhir: expect.any(String) },
      { email: 'klien@example.com', nama: 'Klien', role: 'CLIENT', event: 'dimas-rara', aktif: true, dibuat: '', loginTerakhir: '' },
      { email: 'operator@example.com', nama: 'Op', role: 'CLIENT', event: '', aktif: true, dibuat: '', loginTerakhir: '' },
    ])
    expect(JSON.stringify(list)).not.toMatch(/Password_Hash|Salt|passwordHash|salt/)

    // Create: validation.
    const base = { email: 'fe@example.com', nama: 'Fida', role: 'CLIENT', event: 'fidaeno', password: 'Klien#123' }
    const create = (over: Record<string, unknown>) => send('POST', 'users', { token: sa, ...base, ...over })
    expect(create({ email: 'bukan-email' })).toMatchObject({ code: 'VALIDATION' })
    expect(create({ email: 'KLIEN@example.com' })).toMatchObject({ code: 'VALIDATION', message: 'Email sudah terdaftar' })
    expect(create({ password: 'short' }).code).toBe('VALIDATION')
    expect(create({ role: 'ADMIN' }).code).toBe('VALIDATION')
    expect(create({ event: '' }).code).toBe('VALIDATION')
    expect(create({ event: 'nope' }).code).toBe('VALIDATION')
    const made = create({}).data
    expect(made).toEqual({ email: 'fe@example.com', nama: 'Fida', role: 'CLIENT', event: 'fidaeno', aktif: true, dibuat: expect.any(String), loginTerakhir: '' })
    const row = map.get('_Users')!.objects().at(-1)!
    expect(row.Password_Hash).toBe(schema.hashPassword('Klien#123', String(row.Salt), sha256Hex))
    // SUPER_ADMIN never carries an event.
    expect(create({ email: 'sa2@example.com', role: 'SUPER_ADMIN', event: 'fidaeno' }).data).toMatchObject({ role: 'SUPER_ADMIN', event: '' })

    // Update: nama only keeps sessions; event change revokes them.
    let fe = login('fe@example.com', 'Klien#123')
    expect(send('PATCH', u('FE@example.com'), { token: sa, nama: 'Fida E' }).data.nama).toBe('Fida E')
    expect(send('GET', 'auth/me', { token: fe }).ok).toBe(true)
    expect(send('PATCH', u('fe@example.com'), { token: sa, event: 'nope' }).code).toBe('VALIDATION')
    expect(send('PATCH', u('fe@example.com'), { token: sa, event: 'dimas-rara' }).data.event).toBe('dimas-rara')
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    fe = login('fe@example.com', 'Klien#123')
    expect(send('GET', 'auth/me', { token: fe }).data.event).toBe('dimas-rara')

    // Deactivate revokes; login refused; reactivate.
    expect(send('PATCH', u('fe@example.com'), { token: sa, aktif: false }).data.aktif).toBe(false)
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    expect(send('POST', 'auth/login', { email: 'fe@example.com', password: 'Klien#123' }).code).toBe('LOGIN_FAILED')
    expect(send('PATCH', u('fe@example.com'), { token: sa, aktif: true }).data.aktif).toBe(true)

    // Reset password revokes and swaps the password.
    fe = login('fe@example.com', 'Klien#123')
    expect(send('POST', u('fe@example.com') + '/reset-password', { token: sa, password: 'short' }).code).toBe('VALIDATION')
    expect(send('POST', u('fe@example.com') + '/reset-password', { token: sa, password: 'Baru#4567' }).ok).toBe(true)
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    expect(send('POST', 'auth/login', { email: 'fe@example.com', password: 'Klien#123' }).code).toBe('LOGIN_FAILED')
    fe = login('fe@example.com', 'Baru#4567')

    // Promote to SUPER_ADMIN (event cleared, sessions revoked), demote back to CLIENT (event required).
    expect(send('PATCH', u('fe@example.com'), { token: sa, role: 'SUPER_ADMIN' }).data).toMatchObject({ role: 'SUPER_ADMIN', event: '' })
    expect(send('GET', 'auth/me', { token: fe }).code).toBe('AUTH')
    expect(send('PATCH', u('fe@example.com'), { token: sa, role: 'CLIENT' }).code).toBe('VALIDATION')
    expect(send('PATCH', u('fe@example.com'), { token: sa, role: 'CLIENT', event: 'fidaeno' }).data).toMatchObject({ role: 'CLIENT', event: 'fidaeno' })

    // Self guards.
    expect(send('PATCH', u('admin@example.com'), { token: sa, role: 'CLIENT', event: 'fidaeno' })).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/akun sendiri/) })
    expect(send('PATCH', u('admin@example.com'), { token: sa, aktif: false })).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/akun sendiri/) })
    expect(send('DELETE', u('admin@example.com'), { token: sa })).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/akun sendiri/) })
    expect(send('PATCH', u('admin@example.com'), { token: sa, nama: 'Boss' }).data).toMatchObject({ nama: 'Boss', role: 'SUPER_ADMIN' })
    expect(send('GET', 'auth/me', { token: sa }).ok).toBe(true)

    // Unknown user.
    expect(send('PATCH', u('nobody@example.com'), { token: sa, nama: 'x' }).code).toBe('NOT_FOUND')
    expect(send('POST', u('nobody@example.com') + '/reset-password', { token: sa, password: 'Password#1' }).code).toBe('NOT_FOUND')
    expect(send('DELETE', u('nobody@example.com'), { token: sa }).code).toBe('NOT_FOUND')

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

  it('carries a CLIENT along when SUPER_ADMIN renames its event', () => {
    const { send, login, klien } = setup()
    const sa = login()
    const token = klien()
    expect(send('PUT', 'event/dimas-rara', { token: sa, event: { ...SEED_META.event, slug: 'dr-2026' } }).ok).toBe(true)
    expect(send('GET', 'auth/me', { token }).data).toMatchObject({ role: 'CLIENT', event: 'dr-2026' })
    expect(send('GET', 'event', { token }).data.map((e: { slug: string }) => e.slug)).toEqual(['dr-2026'])
    expect(send('GET', 'event/dr-2026/guests', { token }).data).toHaveLength(5)
    expect(send('GET', 'event/dimas-rara', { token }).code).toBe('NOT_FOUND')
  })
})
