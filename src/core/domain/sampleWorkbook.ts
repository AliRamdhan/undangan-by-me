import type { Workbook, Worksheet } from 'exceljs'
import { ROLES } from '@/core/api/types'
import { SEED_EVENTS, SEED_USERS } from '@/core/api/seed'
import { applyFormulas } from '@/core/domain/derive'
import {
  CONFIG_COLUMNS,
  ENUM_COLUMNS,
  EVENT_COLUMNS,
  SESI_COLUMNS,
  SESSION_COLUMNS,
  SHEETS,
  TAMU_SHEET_COLUMNS,
  TEMPLATE_SHEET_COLUMNS,
  USER_COLUMNS,
  eventToRow,
  hashPassword,
  sessionToRow,
} from '@/core/domain/sheetSchema'
import { AKSES, EVENT_TIPE, GELAR, SISI, STATUS_KIRIM, STATUS_RSVP, TEMPLATE_AKSES, TEMPLATE_TIPE } from '@/core/domain/types'

export interface SampleDeps {
  ExcelJS: typeof import('exceljs')
  sha256Hex: (s: string) => string
  /** Fresh per user, so two installs never share a salt. */
  randomSalt: () => string
  now: Date
}

/** Rows below the data that still get dropdowns, so new guests typed in the sheet are validated too. */
const VALIDATED_ROWS = 500

/** Columns kept as text so Sheets doesn't strip leading zeros (`0812…`, PIN `012345`). */
const TEXT_COLUMNS = new Set(['PIN', 'HP', 'Pria_HP', 'Wanita_HP', 'CS_HP', 'Gift_Norek', 'Tanggal', 'Mulai', 'Selesai', 'Tanggal_Utama', 'Tanggal_Pengingat', 'Batas_RSVP'])

const WIDTH: Record<string, number> = {
  Nama: 26,
  Nama_Event: 28,
  HP: 16,
  Email: 24,
  Isi_Pesan: 60,
  Alamat: 40,
  Link_Undangan: 40,
  Preview_Pesan: 40,
  Link_WA: 30,
  Password_Hash: 30,
  Token_Hash: 30,
  Value: 40,
  Catatan: 40,
}

function table(wb: Workbook, name: string, columns: readonly string[], rows: readonly Record<string, unknown>[]): Worksheet {
  const ws = wb.addWorksheet(name)
  ws.columns = columns.map((key) => ({
    header: key,
    key,
    width: WIDTH[key] ?? Math.max(10, key.length + 2),
    style: TEXT_COLUMNS.has(key) ? { numFmt: '@' } : {},
  }))
  for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c, r[c] ?? ''])))
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  return ws
}

function dropdown(ws: Worksheet, column: string, values: readonly string[], strict = true) {
  const col = ws.getColumn(column)
  for (let r = 2; r <= VALIDATED_ROWS; r++) {
    ws.getCell(r, col.number).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: strict,
      errorTitle: 'Nilai tidak dikenal',
      error: `Pilih salah satu: ${values.join(', ')}`,
    }
  }
}

const PANDUAN = [
  'Undangan — database contoh (multi-event)',
  '',
  '1. File → Import file ini ke Google Sheets (Replace spreadsheet).',
  '2. Extensions → Apps Script: salin semua file dari folder apps-script/ (atau `clasp push`).',
  '3. Jalankan fungsi setup() sekali dari editor — membuat tab/format yang kurang dan menyembunyikan tab _.',
  '4. Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone. Salin URL /exec.',
  '5. Di client/.env isi VITE_APPS_SCRIPT_URL dengan URL /exec, lalu jalankan/build aplikasi dan login.',
  '',
  'Role:',
  '  SUPER_ADMIN — melihat & mengelola semua event, membuat/menghapus event, mengelola akun (menu Pengguna).',
  '  CLIENT — hanya satu event (kolom Event di _Users): data event, tamu dan template; slug/domain tidak bisa diubah.',
  '',
  'Akun demo (WAJIB diganti lewat menu akun → Ganti password, atau setupAdmin() di editor):',
  ...SEED_USERS.map((u) => {
    const ev = SEED_EVENTS.find((e) => e.meta.event.id === u.event)?.meta.event.slug
    return `  • ${u.email} / ${u.password} (${u.role}${ev ? ` · ${ev}` : ''})`
  }),
  '',
  'Tab:',
  '  Setiap tab data diawali kolom ID (UUID) — dibuat script, jangan diubah. Kolom Event di tab lain berisi ID event (01_Event.ID), bukan slug.',
  '  01_Event — satu baris per event; ID adalah kuncinya (URL admin /event/:code). Slug hanya untuk link undangan dan boleh diganti.',
  '  01_Sesi — sesi per event (S1, S2…), kolom Event = ID event.',
  '  02_Tamu — tamu per event. No, HP_Valid, Link_Undangan, Preview_Pesan, Link_WA ditulis script — jangan diketik manual.',
  '  03_Template — template WhatsApp per event.',
  '  _Config, _Enum, _Users, _Sessions — tab sistem. Password disimpan sebagai hash; token sesi juga di-hash.',
  '  _Users.Event — ID event untuk akun CLIENT; kosong untuk SUPER_ADMIN.',
  '  Baris yang diketik manual tanpa ID mendapat ID otomatis saat dibaca aplikasi atau saat setup() dijalankan.',
]

/** The sample database workbook: every tab and column the Apps Script expects, with two seeded events. */
export function buildSampleWorkbook({ ExcelJS, sha256Hex, randomSalt, now }: SampleDeps): Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'undangan'
  wb.created = now
  const stamp = now.toISOString()

  const panduan = wb.addWorksheet(SHEETS.panduan)
  panduan.getColumn(1).width = 110
  PANDUAN.forEach((line, i) => (panduan.getCell(i + 1, 1).value = line))
  panduan.getCell(1, 1).font = { bold: true, size: 14 }

  table(
    wb,
    SHEETS.event,
    EVENT_COLUMNS,
    SEED_EVENTS.map(({ meta }) => ({ ...eventToRow(meta.event, meta.mode), Dibuat: stamp, Diubah: stamp })),
  )

  table(
    wb,
    SHEETS.sesi,
    SESI_COLUMNS,
    SEED_EVENTS.flatMap(({ meta }) => meta.event.sesi.map((s) => sessionToRow(meta.event.id, s))),
  )

  const tamu = table(
    wb,
    SHEETS.tamu,
    TAMU_SHEET_COLUMNS,
    // No / HP_Valid / Link_Undangan are script-written per event; ship them already computed.
    SEED_EVENTS.flatMap(({ meta, guests }) => applyFormulas(guests, meta.event).map((g) => ({ ...g, Event: meta.event.id }))),
  )
  dropdown(tamu, 'Akses', AKSES)
  dropdown(tamu, 'Sisi', SISI)
  dropdown(tamu, 'Gelar', GELAR, false)

  const tpl = table(
    wb,
    SHEETS.template,
    TEMPLATE_SHEET_COLUMNS,
    SEED_EVENTS.flatMap(({ meta, templates }) => templates.map((t) => ({ ...t, Event: meta.event.id }))),
  )
  dropdown(tpl, 'Tipe', TEMPLATE_TIPE)
  dropdown(tpl, 'Akses', TEMPLATE_AKSES)
  tpl.getColumn('Isi_Pesan').alignment = { wrapText: true, vertical: 'top' }

  table(wb, SHEETS.config, CONFIG_COLUMNS, [
    { Key: 'GREETINGS', Value: SEED_EVENTS[0].meta.greetings.join('|'), Catatan: 'Variasi {{greet}}, pisahkan dengan |' },
    { Key: 'TOKEN_TTL_HOURS', Value: 168, Catatan: 'Umur sesi login (jam)' },
  ])

  const enums: Record<(typeof ENUM_COLUMNS)[number], readonly string[]> = {
    Akses: AKSES,
    Sisi: SISI,
    Gelar: GELAR,
    Status_RSVP: STATUS_RSVP,
    Status_Kirim: STATUS_KIRIM,
    Tipe_Template: TEMPLATE_TIPE,
    Tipe_Event: EVENT_TIPE.map((t) => t.value),
    Mode: ['DRY-RUN', 'LIVE'],
    Role: ROLES,
  }
  const depth = Math.max(...Object.values(enums).map((v) => v.length))
  table(
    wb,
    SHEETS.enum,
    ENUM_COLUMNS,
    Array.from({ length: depth }, (_, i) => Object.fromEntries(ENUM_COLUMNS.map((c) => [c, enums[c][i] ?? '']))),
  )

  table(
    wb,
    SHEETS.users,
    USER_COLUMNS,
    SEED_USERS.map((u) => {
      const salt = randomSalt()
      return {
        ID: u.id,
        Email: u.email,
        Nama: u.nama,
        Role: u.role,
        Event: u.event,
        Password_Hash: hashPassword(u.password, salt, sha256Hex),
        Salt: salt,
        Aktif: true,
        Dibuat: stamp,
        Login_Terakhir: '',
      }
    }),
  )

  table(wb, SHEETS.sessions, SESSION_COLUMNS, [])
  return wb
}
