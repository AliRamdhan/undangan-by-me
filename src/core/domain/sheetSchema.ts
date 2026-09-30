import type { EventInfo, GatewayMode, Session } from '@/core/domain/types'

/**
 * The multi-event workbook (STRUCTURE.md): tab names and header rows. The
 * Apps Script mirrors these in apps-script/00_Config.gs, and gasParity.test.ts
 * asserts the two stay identical.
 */
export const SHEETS = {
  panduan: '00_Panduan',
  event: '01_Event',
  sesi: '01_Sesi',
  tamu: '02_Tamu',
  template: '03_Template',
  config: '_Config',
  enum: '_Enum',
  users: '_Users',
  sessions: '_Sessions',
} as const

/**
 * Every data tab starts with `ID`: a UUID per row, written by the script and
 * never changed. Routes address rows by it; `Event` holds 01_Event.ID.
 */

/** 01_Event: one row per event, `EventInfo` flattened. `Slug` is only the public invitation URL. */
export const EVENT_COLUMNS = [
  'ID',
  'Slug',
  'Domain',
  'Nama_Event',
  'Tipe',
  'Bahasa',
  'Timezone',
  'Web_Template',
  'Pria_Panggilan',
  'Pria_Lengkap',
  'Pria_Ortu',
  'Pria_HP',
  'Pria_Email',
  'Wanita_Panggilan',
  'Wanita_Lengkap',
  'Wanita_Ortu',
  'Wanita_HP',
  'Wanita_Email',
  'Hashtag',
  'Tanggal_Utama',
  'Tanggal_Pengingat',
  'Batas_RSVP',
  'Gift_Bank',
  'Gift_Atas_Nama',
  'Gift_Norek',
  'Gift_QRIS',
  'Musik',
  'Cover',
  'CS_Nama',
  'CS_HP',
  'Kapasitas_S1',
  'Kapasitas_S2',
  'Mode',
  'Dibuat',
  'Diubah',
] as const

/** 01_Sesi: one row per session; `Kode` is S1, S2… in row order within an event. */
export const SESI_COLUMNS = [
  'ID',
  'Event',
  'Kode',
  'Label',
  'Tanggal',
  'Mulai',
  'Selesai',
  'Nama_Tempat',
  'Alamat',
  'Maps_URL',
  'Dress_Code',
  'Live_Stream',
] as const

/** 02_Tamu: `ID`, `Event`, then the 28 guest columns of STRUCTURE.md. */
export const TAMU_SHEET_COLUMNS = [
  'ID',
  'Event',
  'No',
  'PIN',
  'Gelar',
  'Nama',
  'HP',
  'Email',
  'Akses',
  'Grup',
  'Sisi',
  'Q_S1',
  'Q_S2',
  'Status_RSVP',
  'RSVP_S1',
  'RSVP_S2',
  'RSVP_Waktu',
  'Nama_Pax',
  'Pesan_Tamu',
  'Status_Kirim',
  'Kirim_Terakhir',
  'Kirim_Count',
  'Kirim_Error',
  'Meja',
  'Note_Unik',
  'Catatan',
  'HP_Valid',
  'Link_Undangan',
  'Preview_Pesan',
  'Link_WA',
] as const

export const TEMPLATE_SHEET_COLUMNS = [
  'ID',
  'Event',
  'Kode',
  'Tipe',
  'Akses',
  'Bahasa',
  'Header_Image_URL',
  'Isi_Pesan',
  'Aktif',
] as const

export const CONFIG_COLUMNS = ['Key', 'Value', 'Catatan'] as const

export const ENUM_COLUMNS = [
  'Akses',
  'Sisi',
  'Gelar',
  'Status_RSVP',
  'Status_Kirim',
  'Tipe_Template',
  'Tipe_Event',
  'Mode',
  'Role',
] as const

/** `Event` is the ID of the one event a CLIENT may access; blank for SUPER_ADMIN. */
export const USER_COLUMNS = [
  'ID',
  'Email',
  'Nama',
  'Role',
  'Event',
  'Password_Hash',
  'Salt',
  'Aktif',
  'Dibuat',
  'Login_Terakhir',
] as const

export const SESSION_COLUMNS = ['Token_Hash', 'Email', 'Dibuat', 'Kedaluwarsa'] as const

export type EventRow = Record<(typeof EVENT_COLUMNS)[number], string | number>
export type SesiRow = Record<(typeof SESI_COLUMNS)[number], string>

/** `EventInfo` → one 01_Event row. `Dibuat`/`Diubah` are left to the caller. */
export function eventToRow(e: EventInfo, mode: GatewayMode): EventRow {
  const { pria, wanita, hashtag } = e.couple
  return {
    ID: e.id,
    Slug: e.slug,
    Domain: e.domain,
    Nama_Event: e.nama_event,
    Tipe: e.tipe,
    Bahasa: e.bahasa,
    Timezone: e.timezone,
    Web_Template: e.web_template,
    Pria_Panggilan: pria.panggilan,
    Pria_Lengkap: pria.lengkap,
    Pria_Ortu: pria.ortu,
    Pria_HP: pria.hp,
    Pria_Email: pria.email,
    Wanita_Panggilan: wanita.panggilan,
    Wanita_Lengkap: wanita.lengkap,
    Wanita_Ortu: wanita.ortu,
    Wanita_HP: wanita.hp,
    Wanita_Email: wanita.email,
    Hashtag: hashtag,
    Tanggal_Utama: e.tanggal_utama,
    Tanggal_Pengingat: e.tanggal_pengingat,
    Batas_RSVP: e.batas_rsvp,
    Gift_Bank: e.gift.bank,
    Gift_Atas_Nama: e.gift.atas_nama,
    Gift_Norek: e.gift.norek,
    Gift_QRIS: e.gift.qris,
    Musik: e.media.musik,
    Cover: e.media.cover,
    CS_Nama: e.cs.nama,
    CS_HP: e.cs.hp,
    Kapasitas_S1: e.kapasitas.s1,
    Kapasitas_S2: e.kapasitas.s2,
    Mode: mode,
    Dibuat: '',
    Diubah: '',
  }
}

export function sessionToRow(eventId: string, s: Session): SesiRow {
  return {
    ID: s.id,
    Event: eventId,
    Kode: s.kode,
    Label: s.label,
    Tanggal: s.tanggal,
    Mulai: s.mulai,
    Selesai: s.selesai,
    Nama_Tempat: s.tempat,
    Alamat: s.alamat,
    Maps_URL: s.maps,
    Dress_Code: s.dress_code,
    Live_Stream: s.live_stream,
  }
}

/**
 * Password hash shared by apps-script/04_Auth.gs and the sample generator:
 * `h = sha256(salt + ':' + password)`, then `h = sha256(h + salt)` × iterations,
 * lowercase hex. `sha256Hex` is injected so this runs in Node and the browser.
 */
export const HASH_ITERATIONS = 1000

export function hashPassword(password: string, salt: string, sha256Hex: (s: string) => string): string {
  let h = sha256Hex(`${salt}:${password}`)
  for (let i = 0; i < HASH_ITERATIONS; i++) h = sha256Hex(h + salt)
  return h
}
