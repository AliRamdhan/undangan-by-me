import { IMPORT_COLUMNS, SHEET_COLUMNS } from '@/core/domain/schema'
import type { Guest, GuestInput } from '@/core/domain/types'

/** RFC 4180 parser: quoted fields, embedded commas/newlines, "" escapes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * Neutralises spreadsheet formula injection. Pesan_Tamu and Nama_Pax come
 * from the public RSVP form, so a cell like `=HYPERLINK(…)` must not execute
 * when the export is opened. Phone numbers like `+62812…` are left alone.
 */
function defuse(value: string): string {
  if (/^[=@\t\r]/.test(value)) return `'${value}`
  if (/^[+-]/.test(value) && !/^[+-]?[\d\s\-().]+$/.test(value)) return `'${value}`
  return value
}

function quote(value: string): string {
  const v = defuse(value)
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n'
}

/** Every column A–AB, for a backup or a handover. */
export function exportGuestsCsv(guests: readonly Guest[]): string {
  const header = [...SHEET_COLUMNS]
  const body = guests.map((g) => header.map((k) => String(g[k] ?? '')))
  return serializeCsv([header, ...body])
}

/** An empty 02_Tamu_import.csv with the right header. */
export function importTemplateCsv(): string {
  return serializeCsv([[...IMPORT_COLUMNS]])
}

export type ImportRow = GuestInput & { PIN: string }

export interface ImportResult {
  rows: ImportRow[]
  errors: string[]
}

// HIDDEN(sementara): Q_S1/Q_S2 are not imported
// function wholeNumber(raw: string): number | null {
//   const v = raw.trim()
//   if (v === '') return 0
//   return /^\d+$/.test(v) ? Number(v) : null
// }

/** Parses a 02_Tamu_import.csv (or pasted CSV text). */
export function parseImport(text: string): ImportResult {
  return parseImportTable(parseCsv(text))
}

/**
 * Validates an import table, from CSV or the first sheet of an .xlsx. The
 * header must be exactly IMPORT_COLUMNS in order — unlike connectied's
 * importer, which reads by column index and silently shifts data when a
 * column is added.
 */
export function parseImportTable(table: readonly (readonly string[])[]): ImportResult {
  if (!table.length) return { rows: [], errors: ['File kosong'] }
  const header = table[0].map((h) => h.trim())
  const expected = [...IMPORT_COLUMNS]
  if (header.length !== expected.length || header.some((h, i) => h !== expected[i])) {
    return {
      rows: [],
      errors: [`Header harus persis: ${expected.join(', ')}. Ditemukan: ${header.join(', ') || '(kosong)'}`],
    }
  }

  const rows: ImportRow[] = []
  const errors: string[] = []
  table.slice(1).forEach((cells) => {
    // HIDDEN(sementara): const line = i + 2 — only used by the quota check
    const get = (k: (typeof IMPORT_COLUMNS)[number]) => (cells[expected.indexOf(k)] ?? '').trim()
    // HIDDEN(sementara): quota columns are hidden
    // const q1 = wholeNumber(get('Q_S1'))
    // const q2 = wholeNumber(get('Q_S2'))
    // if (q1 === null || q2 === null) {
    //   errors.push(`Baris ${line}: Q_S1/Q_S2 harus bilangan bulat ≥ 0`)
    //   return
    // }
    rows.push({
      // Not in the import file: filled right after import by generatePins.
      PIN: '',
      Gelar: get('Gelar'),
      Nama: get('Nama'),
      HP: get('HP'),
      Email: get('Email'),
      // HIDDEN(sementara): Akses/Grup/Sisi/Q_S1/Q_S2 are not imported; same defaults
      // as a new guest in GuestDrawer.
      // Akses: get('Akses').toUpperCase(),
      // Grup: get('Grup'),
      // Sisi: get('Sisi').toUpperCase(),
      // Q_S1: q1,
      // Q_S2: q2,
      Akses: 'REGULAR',
      Grup: '',
      Sisi: '',
      Q_S1: 0,
      Q_S2: 1,
      Meja: '',
      Note_Unik: '',
      Catatan: '',
    })
  })
  return { rows, errors }
}
