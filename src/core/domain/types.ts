// Mirrors docs/STRUCTURE.md. Keys are the sheet header names verbatim so the
// Apps Script adapter maps rows without a translation table.

export const AKSES = ['VIP', 'KELUARGA', 'REGULAR', 'PUBLIC'] as const
export type Akses = (typeof AKSES)[number]

export const SISI = ['PRIA', 'WANITA', 'BERSAMA'] as const

export const GELAR = ['Bapak', 'Ibu', 'Bapak/Ibu', 'Sdr.', 'Sdri.', 'Keluarga', 'dr.', 'Prof.'] as const

export const STATUS_RSVP = ['BELUM', 'HADIR', 'TIDAK_HADIR', 'RAGU'] as const
export type StatusRSVP = (typeof STATUS_RSVP)[number]

export const STATUS_KIRIM = ['BELUM', 'ANTRI', 'TERKIRIM', 'DIBACA', 'GAGAL'] as const
export type StatusKirim = (typeof STATUS_KIRIM)[number]

export const TEMPLATE_TIPE = [
  'UNDANGAN',
  'REMINDER',
  'KONFIRMASI_RSVP',
  'TERIMA_KASIH',
  'INFO_HARI_H',
] as const
export type TemplateTipe = (typeof TEMPLATE_TIPE)[number]

export const TEMPLATE_AKSES = ['SEMUA', ...AKSES] as const
export type TemplateAkses = (typeof TEMPLATE_AKSES)[number]

export type HpValid = '✅' | '⚠️ format' | '⚠️ duplikat' | '⚠️ kosong'

/**
 * One row of 02_Tamu. PIN and HP are always strings — a PIN may start with 0
 * and HP must keep its leading 0 / + (UIUX.md § Number formats).
 * `Akses`, `Gelar`, `Sisi` stay `string` because imported data can hold
 * anything; `cekDuplikat` reports the invalid values instead of the type
 * system silently hiding them.
 */
export interface Guest {
  /** UUID, script-written; the API addresses a guest by it. */
  ID: string
  // A — formula
  No: number
  // B–K — manual block (B is script-written PIN)
  PIN: string
  Gelar: string
  Nama: string
  HP: string
  Email: string
  Akses: string
  Grup: string
  Sisi: string
  Q_S1: number
  Q_S2: number
  // L–Q — RSVP block, webhook-written
  Status_RSVP: StatusRSVP
  RSVP_S1: number
  RSVP_S2: number
  RSVP_Waktu: string
  Nama_Pax: string
  Pesan_Tamu: string
  // R–U — send block, blast-written
  Status_Kirim: StatusKirim
  Kirim_Terakhir: string
  Kirim_Count: number
  Kirim_Error: string
  // V–X — operational, manual
  Meja: string
  Note_Unik: string
  Catatan: string
  // Y–Z — formula
  HP_Valid: HpValid
  Link_Undangan: string
  // AA–AB — script (renderer)
  Preview_Pesan: string
  Link_WA: string
}

export type GuestKey = keyof Guest

/** The columns a human (and therefore this UI) is allowed to write. */
export const MANUAL_KEYS = [
  'Gelar',
  'Nama',
  'HP',
  'Email',
  'Akses',
  'Grup',
  'Sisi',
  'Q_S1',
  'Q_S2',
  'Meja',
  'Note_Unik',
  'Catatan',
] as const satisfies readonly GuestKey[]
export type ManualKey = (typeof MANUAL_KEYS)[number]

export type GuestInput = Pick<Guest, ManualKey>

export interface Session {
  /** UUID of the 01_Sesi row; '' until the event is saved. */
  id: string
  kode: string
  label: string
  tanggal: string
  mulai: string
  selesai: string
  tempat: string
  alamat: string
  maps: string
  dress_code: string
  live_stream: string
}

export const EVENT_TIPE = [
  { value: 'PERNIKAHAN', label: 'Pernikahan' },
  { value: 'LAMARAN', label: 'Lamaran / Tunangan' },
  { value: 'KHITANAN', label: 'Khitanan' },
  { value: 'ULANG_TAHUN', label: 'Ulang Tahun' },
  { value: 'LAINNYA', label: 'Lainnya' },
] as const

/** Display labels only — times are wall-clock and never converted (STRUCTURE.md). */
export const TIMEZONES = ['WIB', 'WITA', 'WIT'] as const

export const BAHASA = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
] as const

/** Placeholder until the invitation site publishes its real design list. */
export const WEB_TEMPLATES = [
  { value: 'klasik', label: 'Klasik' },
  { value: 'floral', label: 'Floral' },
  { value: 'minimalis', label: 'Minimalis' },
] as const

export interface Person {
  /** Nickname used in messages (`{{event.pria}}`). */
  panggilan: string
  lengkap: string
  ortu: string
  hp: string
  email: string
}

/** The export payload from URL-CONTRACT.md § 2, plus the fields the event form edits. */
export interface EventInfo {
  /** 01_Event.ID (UUID) — the admin URL and API key; '' for an unsaved event. */
  id: string
  /** The public invitation URL (`{domain}/{slug}/{PIN}`); may be renamed. */
  slug: string
  domain: string
  nama_event: string
  tipe: string
  bahasa: string
  timezone: string
  web_template: string
  couple: {
    pria: Person
    wanita: Person
    hashtag: string
  }
  tanggal_utama: string
  /** `YYYY-MM-DDTHH:mm`, wall-clock. */
  tanggal_pengingat: string
  batas_rsvp: string
  sesi: Session[]
  gift: { bank: string; atas_nama: string; norek: string; qris: string }
  media: { musik: string; cover: string }
  cs: { nama: string; hp: string }
  kapasitas: { s1: number; s2: number }
}

export type GatewayMode = 'DRY-RUN' | 'LIVE'

export interface Meta {
  mode: GatewayMode
  event: EventInfo
  /** `{{greet}}` variants (_Config). */
  greetings: string[]
}

/** One row of 03_Template. */
export interface Template {
  /** UUID; '' for an unsaved template. */
  ID: string
  Kode: string
  Tipe: TemplateTipe
  Akses: TemplateAkses
  Bahasa: string
  Header_Image_URL: string
  Isi_Pesan: string
  Aktif: boolean
}
