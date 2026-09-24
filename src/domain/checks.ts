import { HP_PATTERN, normalizePhone, phoneKey } from './phone'
import { PIN_PATTERN } from './pin'
import { AKSES, type Guest, type GuestKey } from './types'

export type IssueKind =
  | 'NAMA_KOSONG'
  | 'PIN_KOSONG'
  | 'PIN_FORMAT'
  | 'PIN_DUPLIKAT'
  | 'HP_KOSONG'
  | 'HP_FORMAT'
  | 'HP_DUPLIKAT'
  | 'AKSES_INVALID'
  | 'LEBIH_KUOTA'

export interface Issue {
  kind: IssueKind
  /** Row number (the `No` column) — for jump-to-row, not for writes. */
  no: number
  pin: string
  nama: string
  field: GuestKey
  message: string
}

export const ISSUE_LABEL: Record<IssueKind, string> = {
  NAMA_KOSONG: 'Nama kosong',
  PIN_KOSONG: 'PIN kosong',
  PIN_FORMAT: 'PIN bukan 6 digit',
  PIN_DUPLIKAT: 'PIN duplikat',
  HP_KOSONG: 'HP kosong',
  HP_FORMAT: 'Format HP salah',
  HP_DUPLIKAT: 'HP duplikat',
  AKSES_INVALID: 'Akses tidak dikenal',
  LEBIH_KUOTA: 'RSVP melebihi kuota',
}

/** Errors block sending; warnings are worth a look but can be left. */
export const ISSUE_SEVERITY: Record<IssueKind, 'error' | 'warning'> = {
  NAMA_KOSONG: 'error',
  PIN_KOSONG: 'warning',
  PIN_FORMAT: 'error',
  PIN_DUPLIKAT: 'error',
  HP_KOSONG: 'warning',
  HP_FORMAT: 'error',
  HP_DUPLIKAT: 'warning',
  AKSES_INVALID: 'error',
  LEBIH_KUOTA: 'warning',
}

function hasData(g: Guest): boolean {
  return [g.PIN, g.Gelar, g.Nama, g.HP, g.Email, g.Grup, g.Akses].some((v) => v.trim() !== '')
}

/** `Cek Duplikat & Error`. */
export function cekDuplikat(guests: readonly Guest[]): Issue[] {
  const rows = guests.filter(hasData)
  const pinCount = new Map<string, number>()
  const hpCount = new Map<string, number>()
  for (const g of rows) {
    if (g.PIN) pinCount.set(g.PIN, (pinCount.get(g.PIN) ?? 0) + 1)
    if (g.HP.trim()) hpCount.set(phoneKey(g.HP), (hpCount.get(phoneKey(g.HP)) ?? 0) + 1)
  }

  const issues: Issue[] = []
  for (const g of rows) {
    const add = (kind: IssueKind, field: GuestKey, message: string) =>
      issues.push({ kind, no: g.No, pin: g.PIN, nama: g.Nama, field, message })

    if (!g.Nama.trim()) add('NAMA_KOSONG', 'Nama', 'Baris berisi data tetapi Nama kosong')

    if (!g.PIN) add('PIN_KOSONG', 'PIN', 'Jalankan Generate PIN')
    else if (!PIN_PATTERN.test(g.PIN)) add('PIN_FORMAT', 'PIN', `"${g.PIN}" bukan 6 digit`)
    else if ((pinCount.get(g.PIN) ?? 0) > 1)
      add('PIN_DUPLIKAT', 'PIN', `PIN ${g.PIN} dipakai ${pinCount.get(g.PIN)} tamu`)

    if (!g.HP.trim()) add('HP_KOSONG', 'HP', 'Tidak bisa dikirim via WhatsApp')
    else if (!HP_PATTERN.test(normalizePhone(g.HP))) add('HP_FORMAT', 'HP', `"${g.HP}" tidak dikenali`)
    else if ((hpCount.get(phoneKey(g.HP)) ?? 0) > 1)
      add('HP_DUPLIKAT', 'HP', `${normalizePhone(g.HP)} dipakai ${hpCount.get(phoneKey(g.HP))} tamu`)

    if (!(AKSES as readonly string[]).includes(g.Akses))
      add('AKSES_INVALID', 'Akses', g.Akses ? `"${g.Akses}" bukan ${AKSES.join('/')}` : 'Akses kosong')

    if (g.RSVP_S1 > g.Q_S1) add('LEBIH_KUOTA', 'RSVP_S1', `S1: ${g.RSVP_S1} pax > kuota ${g.Q_S1}`)
    if (g.RSVP_S2 > g.Q_S2) add('LEBIH_KUOTA', 'RSVP_S2', `S2: ${g.RSVP_S2} pax > kuota ${g.Q_S2}`)
  }
  return issues
}
