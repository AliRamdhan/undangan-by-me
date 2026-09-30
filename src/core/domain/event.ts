import { HP_PATTERN, normalizePhone } from './phone'
import type { EventInfo, Person, Session } from './types'

/** `slug` must start with a letter — the same constraint the invitation site's route carries. */
export const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const blankPerson = (): Person => ({ panggilan: '', lengkap: '', ortu: '', hp: '', email: '' })

export const blankSession = (kode: string): Session => ({
  id: '',
  kode,
  label: '',
  tanggal: '',
  mulai: '',
  selesai: '',
  tempat: '',
  alamat: '',
  maps: '',
  dress_code: '',
  live_stream: '',
})

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

/**
 * Fills every field the form edits. Events saved before these fields existed
 * (e.g. an older 01_Event row) come back complete instead of
 * leaving the form reading `undefined`.
 */
export function withEventDefaults(e: DeepPartial<EventInfo>): EventInfo {
  const c = e.couple ?? {}
  return {
    id: e.id ?? '',
    slug: e.slug ?? '',
    domain: e.domain ?? '',
    nama_event: e.nama_event ?? '',
    tipe: e.tipe ?? 'PERNIKAHAN',
    bahasa: e.bahasa ?? 'id',
    timezone: e.timezone ?? 'WIB',
    web_template: e.web_template ?? '',
    couple: {
      pria: { ...blankPerson(), ...c.pria },
      wanita: { ...blankPerson(), ...c.wanita },
      hashtag: c.hashtag ?? '',
    },
    tanggal_utama: e.tanggal_utama ?? '',
    tanggal_pengingat: e.tanggal_pengingat ?? '',
    batas_rsvp: e.batas_rsvp ?? '',
    sesi: (e.sesi ?? []).map((s, i) => ({ ...blankSession(`S${i + 1}`), ...s }) as Session),
    gift: { bank: '', atas_nama: '', norek: '', qris: '', ...e.gift },
    media: { musik: '', cover: '', ...e.media },
    cs: { nama: '', hp: '', ...e.cs },
    kapasitas: { s1: 0, s2: 0, ...e.kapasitas },
  }
}

/** Field path → message, e.g. `{ 'couple.pria.lengkap': 'Wajib diisi' }`. */
export type EventErrors = Record<string, string>

const REQUIRED = 'Wajib diisi'

/**
 * Validasi Data Event: the EVENT_REQUIRED keys (STRUCTURE.md § 01_Event) plus
 * the checks the export relies on. An event that fails here must not be saved,
 * or the invitation would render with sections silently missing.
 */
export function validateEvent(e: EventInfo): EventErrors {
  const errs: EventErrors = {}
  const need = (path: string, value: string) => {
    if (!value.trim()) errs[path] = REQUIRED
  }

  need('nama_event', e.nama_event)
  need('tipe', e.tipe)
  // HIDDEN(sementara): Domain undangan is hidden in the form
  // need('domain', e.domain)
  need('timezone', e.timezone)
  need('tanggal_utama', e.tanggal_utama)
  // HIDDEN(sementara): Batas RSVP is hidden in the form
  // need('batas_rsvp', e.batas_rsvp)

  if (!e.slug.trim()) errs.slug = REQUIRED
  else if (!SLUG_PATTERN.test(e.slug)) errs.slug = 'Huruf kecil, angka dan tanda hubung; harus diawali huruf'

  if (e.domain.trim() && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(e.domain.trim())) {
    errs.domain = 'Contoh: https://undangan.by.me'
  }

  if (e.tanggal_utama && e.batas_rsvp && e.batas_rsvp > e.tanggal_utama) {
    errs.batas_rsvp = 'Batas RSVP harus sebelum atau sama dengan tanggal acara'
  }

  for (const side of ['pria', 'wanita'] as const) {
    const p = e.couple[side]
    need(`couple.${side}.lengkap`, p.lengkap)
    need(`couple.${side}.panggilan`, p.panggilan)
    need(`couple.${side}.ortu`, p.ortu)
    if (p.hp.trim() && !HP_PATTERN.test(normalizePhone(p.hp))) {
      errs[`couple.${side}.hp`] = 'Format tidak dikenali — gunakan 08xx atau +628xx'
    }
    if (p.email.trim() && !EMAIL_PATTERN.test(p.email.trim())) errs[`couple.${side}.email`] = 'Email tidak valid'
  }

  if (e.couple.hashtag && !/^#[\p{L}\p{N}_]+$/u.test(e.couple.hashtag)) {
    errs['couple.hashtag'] = 'Satu kata tanpa spasi, contoh #DimasRara'
  }

  e.sesi.forEach((s, i) => {
    need(`sesi.${i}.label`, s.label)
    need(`sesi.${i}.tanggal`, s.tanggal)
    need(`sesi.${i}.mulai`, s.mulai)
    if (s.mulai && s.selesai && s.selesai <= s.mulai) errs[`sesi.${i}.selesai`] = 'Harus setelah jam mulai'
  })

  return errs
}
