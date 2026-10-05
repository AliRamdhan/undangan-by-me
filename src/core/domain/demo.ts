import { buildContext, inspectTemplate, type RenderResult } from '@/core/domain/template'
import type { Guest, Meta } from '@/core/domain/types'

/**
 * Fictitious data the app itself may ship: the superadmin's master-template
 * preview renders against it, so no real event or guest is ever loaded there.
 * core/api/seed.ts builds the sample workbook and tests on top of it; keep
 * real client data out of this file.
 */

export const GREETINGS = ['Halo', 'Hai', 'Salam hangat', 'Dengan hormat']

/**
 * Fixed UUIDs, so the sample workbook and the tests are reproducible.
 * `kind` keeps the tabs apart: 1 event, 2 sesi, 3 tamu, 4 template, 5 user.
 */
export const seedId = (kind: number, n: number) => `00000000-0000-4000-8${kind}00-${String(n).padStart(12, '0')}`

// Sample event from docs/URL-CONTRACT.md § 2.
export const DEMO_META: Meta = {
  mode: 'DRY-RUN',
  greetings: GREETINGS,
  event: {
    id: seedId(1, 1),
    slug: 'dimas-rara',
    domain: 'https://undangan.by.me',
    nama_event: 'Pernikahan Dimas & Rara',
    tipe: 'PERNIKAHAN',
    bahasa: 'id',
    timezone: 'WIB',
    web_template: 'klasik',
    couple: {
      pria: { panggilan: 'Dimas', lengkap: 'Dimas Prasetyo, S.T.', ortu: 'Bapak Hadi & Ibu Sri', hp: '+6281277770001', email: 'dimas@example.com' },
      wanita: { panggilan: 'Rara', lengkap: 'Rara Anindita, S.Psi.', ortu: 'Bapak Agus & Ibu Wulan', hp: '+6281277770002', email: 'rara@example.com' },
      hashtag: '#DimasRara',
    },
    tanggal_utama: '2026-11-14',
    tanggal_pengingat: '2026-11-12T09:00',
    batas_rsvp: '2026-11-01',
    sesi: [
      {
        id: seedId(2, 1),
      kode: 'S1',
        label: 'Akad Nikah',
        tanggal: '2026-11-14',
        mulai: '08:00',
        selesai: '10:00',
        tempat: 'Masjid Al-Azhar',
        alamat: 'Jl. Sisingamangaraja, Kebayoran Baru, Jakarta Selatan',
        maps: 'https://maps.app.goo.gl/alazhar',
        dress_code: 'Putih',
        live_stream: '',
      },
      {
        id: seedId(2, 2),
      kode: 'S2',
        label: 'Resepsi',
        tanggal: '2026-11-14',
        mulai: '11:00',
        selesai: '14:00',
        tempat: 'Balai Kartini',
        alamat: 'Jl. Gatot Subroto Kav. 37, Jakarta Selatan',
        maps: 'https://maps.app.goo.gl/balaikartini',
        dress_code: 'Batik / Formal',
        live_stream: 'https://youtube.com/@dimasrara',
      },
    ],
    gift: { bank: 'BCA', atas_nama: 'Rara Anindita', norek: '1234567890', qris: '' },
    media: { musik: '', judul_musik: '', cover: '' },
    gallery: [],
    cs: { nama: 'Sari', hp: '+628123456789' },
    kapasitas: { s1: 200, s2: 400 },
  },
}

const blank: Guest = {
  ID: '',
  No: 0,
  PIN: '',
  Gelar: '',
  Nama: '',
  HP: '',
  Email: '',
  Akses: 'REGULAR',
  Grup: '',
  Sisi: 'BERSAMA',
  Q_S1: 0,
  Q_S2: 2,
  Status_RSVP: 'BELUM',
  RSVP_S1: 0,
  RSVP_S2: 0,
  RSVP_Waktu: '',
  Nama_Pax: '',
  Pesan_Tamu: '',
  Status_Kirim: 'BELUM',
  Kirim_Terakhir: '',
  Kirim_Count: 0,
  Kirim_Error: '',
  Meja: '',
  Note_Unik: '',
  Catatan: '',
  HP_Valid: '✅',
  Link_Undangan: '',
  Preview_Pesan: '',
  Link_WA: '',
}

export const blankGuest = (): Guest => ({ ...blank })

/** Demo guests for the master-template preview (one per kind of salutation). */
export const DEMO_GUESTS: Guest[] = [
  { PIN: '012345', Gelar: 'Bapak/Ibu', Nama: 'H. Bambang Sutrisno', Akses: 'VIP', Q_S1: 2, Q_S2: 2, Meja: 'VIP-1', Note_Unik: 'Mohon berkenan memberikan sambutan.' },
  { PIN: '365865', Gelar: 'Ibu', Nama: 'Hj. Siti Aminah', Akses: 'VIP', Q_S1: 2, Q_S2: 2, Meja: 'VIP-1' },
  { PIN: '731902', Gelar: 'Keluarga', Nama: 'Keluarga Wijaya', Akses: 'KELUARGA', Q_S1: 4, Q_S2: 4 },
  { PIN: '903417', Gelar: 'Sdr.', Nama: 'Andi Saputra', Q_S1: 0, Q_S2: 2 },
  { PIN: '660392', Gelar: 'Sdri.', Nama: 'Maya Lestari', Q_S1: 0, Q_S2: 1 },
].map((g, i) => ({ ...blank, ID: `demo-${i + 1}`, ...g }) as Guest)

/** The guest the server renders a draft for when no sample guest is picked. */
export const DEMO_DUMMY: Guest = { ...blank, Nama: 'Nama Tamu', PIN: '000000' }

/** A template body rendered locally against the demo event and guest `guestId` (`null` = the dummy). */
export function renderDemo(body: string, guestId: string | null): Promise<RenderResult> {
  const g = DEMO_GUESTS.find((x) => x.ID === guestId) ?? DEMO_DUMMY
  return Promise.resolve(inspectTemplate(body, buildContext(g, DEMO_META)))
}
