import { describe, expect, it } from 'vitest'
import { SEED_GUESTS, SEED_META, SEED_TEMPLATES, blankGuest } from '@/core/api/seed'
import { cekDuplikat } from '@/core/domain/checks'
import { exportGuestsCsv, parseCsv, parseImport, serializeCsv } from '@/core/domain/csv'
import { applyFormulas } from '@/core/domain/derive'
import { linkUndangan, waLink } from '@/core/domain/link'
import { hpValid, normalizePhone, phoneCounts } from '@/core/domain/phone'
import { generatePins } from '@/core/domain/pin'
import { IMPORT_COLUMNS } from '@/core/domain/schema'
import { computeStats } from '@/core/domain/stats'
import {
  buildContext,
  formatTanggal,
  inspectTemplate,
  pickGreeting,
  pickTemplate,
  renderTemplate,
  TemplateError,
} from '@/core/domain/template'
import type { Guest } from '@/core/domain/types'

const guest = (over: Partial<Guest>): Guest => ({ ...blankGuest(), ...over })

describe('normalizePhone', () => {
  it.each([
    ['08123456789', '+628123456789'],
    ['0812-3456 7891', '+6281234567891'],
    ['(0813) 5555-1212', '+6281355551212'],
    ['628123456789', '+628123456789'],
    ['+62 812 3456 789', '+628123456789'],
    ['8123456789', '+628123456789'],
    ['  ', ''],
    ['nomor-nyusul', 'nomor-nyusul'],
  ])('%s → %s', (raw, out) => expect(normalizePhone(raw)).toBe(out))
})

describe('hpValid', () => {
  const counts = phoneCounts(['08123456789', '+628123456789', '+6281111111111'])
  it('flags empty, bad format and duplicates across spellings', () => {
    expect(hpValid('', counts)).toBe('⚠️ kosong')
    expect(hpValid('abc', counts)).toBe('⚠️ format')
    expect(hpValid('+62812', counts)).toBe('⚠️ format')
    expect(hpValid('08123456789', counts)).toBe('⚠️ duplikat')
    expect(hpValid('+6281111111111', counts)).toBe('✅')
  })
})

describe('generatePins', () => {
  it('200 distinct 6-char strings, avoiding existing ones', () => {
    const existing = ['000001', '123456']
    const pins = generatePins(200, existing)
    expect(new Set(pins).size).toBe(200)
    for (const p of pins) {
      expect(p).toMatch(/^\d{6}$/)
      expect(existing).not.toContain(p)
    }
  })
  it('keeps a leading zero', () => {
    const pins = generatePins(5000, [])
    expect(pins.some((p) => p.startsWith('0'))).toBe(true)
    expect(pins.every((p) => p.length === 6)).toBe(true)
  })
})

describe('links', () => {
  it('builds the invitation link, adding a scheme and trimming slashes', () => {
    expect(linkUndangan('https://undangan.by.me/', 'dimas-rara', '012345')).toBe(
      'https://undangan.by.me/dimas-rara/012345',
    )
    expect(linkUndangan('undangan.by.me', 'x', '1')).toBe('https://undangan.by.me/x/1')
    expect(linkUndangan('undangan.by.me', 'x', '')).toBe('')
  })
  it('wa.me keeps newlines and emoji through encoding', () => {
    const text = 'Halo *Budi*\n💍 14 Nov & 15 Nov'
    const link = waLink('0812-3456-789', text)
    expect(link.startsWith('https://wa.me/628123456789?text=')).toBe(true)
    expect(decodeURIComponent(link.split('text=')[1])).toBe(text)
    expect(waLink('abc', text)).toBe('')
  })
})

describe('template renderer', () => {
  const g = guest({ PIN: '012345', Gelar: 'Bapak', Nama: 'Budi', Q_S2: 2 })
  const ctx = buildContext(g, SEED_META)

  it('renders known tokens, tolerating inner whitespace', () => {
    expect(renderTemplate('{{tamu.gelar}} {{ tamu.nama }} — {{link}}', ctx)).toBe(
      'Bapak Budi — https://undangan.by.me/dimas-rara/012345',
    )
  })
  it('throws on an unknown token instead of rendering a blank', () => {
    expect(() => renderTemplate('Halo {{tamu.namaa}}', ctx)).toThrow(TemplateError)
    const r = inspectTemplate('Halo {{tamu.namaa}} {{sesi3.label}}', ctx)
    expect(r.unknown).toEqual(['tamu.namaa', 'sesi3.label'])
  })
  it('throws on an unbalanced brace', () => {
    expect(() => renderTemplate('Halo {{tamu.nama}', ctx)).toThrow(TemplateError)
    expect(inspectTemplate('Halo {{tamu.nama}', ctx).malformed).toBe(true)
  })
  it('leaves WhatsApp formatting and "!" alone', () => {
    expect(renderTemplate('Halo! *{{tamu.nama}}* _~x~_', ctx)).toBe('Halo! *Budi* _~x~_')
  })
  it('reports known-but-empty tokens', () => {
    expect(inspectTemplate('{{tamu.meja}}', ctx).empty).toEqual(['tamu.meja'])
  })
  it('greet is deterministic per PIN', () => {
    const v = SEED_META.greetings
    expect(pickGreeting('012345', v)).toBe(pickGreeting('012345', v))
    const spread = new Set(['111111', '222222', '333333', '444444', '555555', '666666'].map((p) => pickGreeting(p, v)))
    expect(spread.size).toBeGreaterThan(1)
  })
  it('formats dates as wall-clock Indonesian', () => {
    expect(formatTanggal('2026-11-14')).toBe('Sabtu, 14 November 2026')
  })
  it('every seeded template renders cleanly', () => {
    for (const t of SEED_TEMPLATES) expect(() => renderTemplate(t.Isi_Pesan, ctx)).not.toThrow()
  })
  it('picks (Tipe, Akses) then falls back to (Tipe, SEMUA), skipping inactive', () => {
    expect(pickTemplate(SEED_TEMPLATES, 'UNDANGAN', 'VIP')?.Kode).toBe('UND-VIP')
    expect(pickTemplate(SEED_TEMPLATES, 'UNDANGAN', 'REGULAR')?.Kode).toBe('UND-SEMUA')
    expect(pickTemplate(SEED_TEMPLATES, 'INFO_HARI_H', 'VIP')).toBeUndefined()
  })
})

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [['a', 'b,c', 'd "e"', 'f\ng']]
    expect(parseCsv(serializeCsv(rows))).toEqual(rows)
  })
  it('defuses formula injection but keeps phone numbers', () => {
    const csv = serializeCsv([['=HYPERLINK("x")', '+628123456789', '+cmd', '@SUM(1)']])
    expect(parseCsv(csv)[0]).toEqual([`'=HYPERLINK("x")`, '+628123456789', `'+cmd`, `'@SUM(1)`])
  })
  it('imports B–K, keeping PIN and HP as strings', () => {
    const text = `\uFEFF${IMPORT_COLUMNS.join(',')}\r\n012345,Bapak,Budi,0812 3456 789,,vip,Kantor,pria,1,2\n`
    const { rows, errors } = parseImport(text)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ PIN: '012345', HP: '0812 3456 789', Akses: 'VIP', Sisi: 'PRIA', Q_S1: 1, Q_S2: 2 })
  })
  it('rejects a reordered header', () => {
    const header = [...IMPORT_COLUMNS]
    ;[header[2], header[3]] = [header[3], header[2]]
    const { rows, errors } = parseImport(`${header.join(',')}\nx`)
    expect(rows).toEqual([])
    expect(errors[0]).toMatch(/Header harus persis/)
  })
  it('rejects non-whole quotas with the line number', () => {
    const { errors } = parseImport(`${IMPORT_COLUMNS.join(',')}\n,,Budi,,,,,,1.5,2`)
    expect(errors[0]).toMatch(/Baris 2/)
  })
  it('exports all 28 columns', () => {
    expect(parseCsv(exportGuestsCsv([blankGuest()]))[0]).toHaveLength(28)
  })
})

describe('cekDuplikat on the seeded dirty rows', () => {
  const rows = applyFormulas(SEED_GUESTS, SEED_META.event)
  const issues = cekDuplikat(rows)
  const kinds = new Set(issues.map((i) => i.kind))

  it('reports every planted fault', () => {
    for (const k of [
      'NAMA_KOSONG',
      'PIN_KOSONG',
      'PIN_DUPLIKAT',
      'HP_KOSONG',
      'HP_FORMAT',
      'HP_DUPLIKAT',
      'AKSES_INVALID',
      'LEBIH_KUOTA',
    ] as const)
      expect(kinds, k).toContain(k)
  })
  it('treats 085… and +6285… as the same number', () => {
    expect(issues.filter((i) => i.kind === 'HP_DUPLIKAT').map((i) => i.nama)).toEqual(['Eko Prasetyo', 'Eko P.'])
  })
  it('a clean row produces no issues', () => {
    expect(cekDuplikat([guest({ No: 1, PIN: '123456', Nama: 'A', HP: '+628123456789' })])).toEqual([])
  })
})

describe('computeStats', () => {
  it('matches a hand-counted fixture', () => {
    const fixture = applyFormulas(
      [
        guest({ PIN: '111111', Nama: 'A', HP: '+6281200000001', Akses: 'VIP', Q_S1: 2, Q_S2: 2, Status_RSVP: 'HADIR', RSVP_S1: 2, RSVP_S2: 1, Status_Kirim: 'DIBACA' }),
        guest({ PIN: '111111', Nama: 'B', HP: '', Akses: 'REGULAR', Q_S2: 2, Status_RSVP: 'TIDAK_HADIR', RSVP_S2: 2, Status_Kirim: 'GAGAL' }),
        guest({ PIN: '', Nama: 'C', HP: 'x', Akses: 'REGULAR', Q_S2: 1, Status_RSVP: 'HADIR', RSVP_S2: 3 }),
      ],
      SEED_META.event,
    )
    const s = computeStats(fixture, SEED_META.event)
    expect(s.total).toBe(3)
    expect(s.pinKosong).toBe(1)
    expect(s.pinDuplikat).toBe(2)
    expect(s.hpBermasalah).toBe(2)
    expect(s.rsvp).toMatchObject({ HADIR: 2, TIDAK_HADIR: 1, BELUM: 0, RAGU: 0 })
    expect(s.kirim).toMatchObject({ DIBACA: 1, GAGAL: 1, BELUM: 1 })
    // TIDAK_HADIR pax never count toward attendance.
    expect(s.sesi[0]).toMatchObject({ kuota: 2, hadir: 2, kapasitas: 200 })
    expect(s.sesi[1]).toMatchObject({ kuota: 5, hadir: 4, kapasitas: 400 })
    expect(s.akses.find((b) => b.key === 'REGULAR')).toMatchObject({ total: 2, hadir: 1 })
    expect(s.lebihKuota.map((g) => g.Nama)).toEqual(['C'])
  })
})
