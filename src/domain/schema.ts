import type { GuestKey } from './types'

export type Owner = 'formula' | 'script' | 'manual'

/** The six header colour bands from UIUX.md § Layout. */
export type Zone = 'identitas' | 'segmentasi' | 'rsvp' | 'kirim' | 'operasional' | 'otomatis'

export interface Column {
  key: GuestKey
  col: string
  owner: Owner
  zone: Zone
  /** Shown in the "Ringkas" column preset. */
  compact: boolean
  width: number
}

const c = (
  key: GuestKey,
  col: string,
  owner: Owner,
  zone: Zone,
  width: number,
  compact = false,
): Column => ({ key, col, owner, zone, width, compact })

/** 02_Tamu, A–AB, in sheet order. */
export const TAMU_COLUMNS: readonly Column[] = [
  c('No', 'A', 'formula', 'identitas', 48, true),
  c('PIN', 'B', 'script', 'identitas', 80, true),
  c('Gelar', 'C', 'manual', 'identitas', 88, true),
  c('Nama', 'D', 'manual', 'identitas', 200, true),
  c('HP', 'E', 'manual', 'identitas', 150, true),
  c('Email', 'F', 'manual', 'identitas', 180),
  // c('Akses', 'G', 'manual', 'segmentasi', 100, true),
  c('Grup', 'H', 'manual', 'segmentasi', 120, true),
  c('Sisi', 'I', 'manual', 'segmentasi', 90, true),
  // c('Q_S1', 'J', 'manual', 'rsvp', 64, true),
  // c('Q_S2', 'K', 'manual', 'rsvp', 64, true),
  // c('Status_RSVP', 'L', 'script', 'rsvp', 120, true),
  // c('RSVP_S1', 'M', 'script', 'rsvp', 72, true),
  // c('RSVP_S2', 'N', 'script', 'rsvp', 72, true),
  // c('RSVP_Waktu', 'O', 'script', 'rsvp', 150),
  // c('Nama_Pax', 'P', 'script', 'rsvp', 160),
  // c('Pesan_Tamu', 'Q', 'script', 'rsvp', 200),
  // c('Status_Kirim', 'R', 'script', 'kirim', 120, true),
  // c('Kirim_Terakhir', 'S', 'script', 'kirim', 150),
  // c('Kirim_Count', 'T', 'script', 'kirim', 80),
  // c('Kirim_Error', 'U', 'script', 'kirim', 180),
  // c('Meja', 'V', 'manual', 'operasional', 72),
  c('Note_Unik', 'W', 'manual', 'operasional', 180),
  c('Catatan', 'X', 'manual', 'operasional', 180),
  // c('HP_Valid', 'Y', 'formula', 'otomatis', 110, true),
  c('Link_Undangan', 'Z', 'formula', 'otomatis', 240),
  c('Preview_Pesan', 'AA', 'script', 'otomatis', 260),
  c('Link_WA', 'AB', 'script', 'otomatis', 110, true),
]

export const FORMULA_KEYS = TAMU_COLUMNS.filter((x) => x.owner === 'formula').map((x) => x.key)

/** Columns frozen on the left (A–D) so the guest's name stays visible. */
export const FROZEN_COUNT = 4

/**
 * Every 02_Tamu column A–AB, in sheet order — fixed, for Export CSV. Independent
 * of TAMU_COLUMNS, which only controls what the table shows.
 */
export const SHEET_COLUMNS = [
  'No', 'PIN', 'Gelar', 'Nama', 'HP', 'Email', 'Akses', 'Grup', 'Sisi', 'Q_S1', 'Q_S2',
  'Status_RSVP', 'RSVP_S1', 'RSVP_S2', 'RSVP_Waktu', 'Nama_Pax', 'Pesan_Tamu',
  'Status_Kirim', 'Kirim_Terakhir', 'Kirim_Count', 'Kirim_Error',
  'Meja', 'Note_Unik', 'Catatan', 'HP_Valid', 'Link_Undangan', 'Preview_Pesan', 'Link_WA',
] as const satisfies readonly GuestKey[]

/** 02_Tamu_import.csv — columns B–K, header text and order are meaningful. */
export const IMPORT_COLUMNS = [
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
] as const satisfies readonly GuestKey[]

export const ZONE_LABEL: Record<Zone, string> = {
  identitas: 'Identitas',
  segmentasi: 'Segmentasi',
  rsvp: 'Kuota & RSVP',
  kirim: 'Status Kirim',
  operasional: 'Operasional',
  otomatis: 'Otomatis',
}
