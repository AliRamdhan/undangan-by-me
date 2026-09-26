import type { Role } from '@/core/api/types'
import type { Guest, Meta, Template } from '@/core/domain/types'

const GREETINGS = ['Halo', 'Hai', 'Salam hangat', 'Dengan hormat']

// Sample event from docs/URL-CONTRACT.md § 2.
export const SEED_META: Meta = {
  mode: 'DRY-RUN',
  greetings: GREETINGS,
  event: {
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
    media: { musik: '', cover: '' },
    cs: { nama: 'Sari', hp: '+628123456789' },
    kapasitas: { s1: 200, s2: 400 },
  },
}

type Row = Partial<Guest> & Pick<Guest, 'Nama'>

const blank: Guest = {
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

const hadir = (s1: number, s2: number, waktu: string, pax = '', pesan = ''): Partial<Guest> => ({
  Status_RSVP: 'HADIR',
  RSVP_S1: s1,
  RSVP_S2: s2,
  RSVP_Waktu: waktu,
  Nama_Pax: pax,
  Pesan_Tamu: pesan,
})

const sent = (status: Guest['Status_Kirim'], at: string, count = 1, err = ''): Partial<Guest> => ({
  Status_Kirim: status,
  Kirim_Terakhir: at,
  Kirim_Count: count,
  Kirim_Error: err,
})

// Mostly clean rows plus every planted fault from 02_Tamu_test_dirty.csv
// (sheet-templates/README.md): leading-zero HP, spaced/dashed HP, a duplicate
// pair, an unparseable HP, an empty HP, a missing name, an unknown access
// tier and an over-quota row.
const ROWS: Row[] = [
  { PIN: '012345', Gelar: 'Bapak/Ibu', Nama: 'H. Bambang Sutrisno', HP: '+6281211110001', Akses: 'VIP', Grup: 'Keluarga Besar Pria', Sisi: 'PRIA', Q_S1: 2, Q_S2: 2, Meja: 'VIP-1', Note_Unik: 'Mohon berkenan memberikan sambutan.', ...hadir(2, 2, '2026-10-02 19:12', 'Bambang | Ratna', 'Barakallah, semoga sakinah.'), ...sent('DIBACA', '2026-09-28 09:14') },
  { PIN: '365865', Gelar: 'Ibu', Nama: 'Hj. Siti Aminah', HP: '+6281211110002', Akses: 'VIP', Grup: 'Keluarga Besar Wanita', Sisi: 'WANITA', Q_S1: 2, Q_S2: 2, Meja: 'VIP-1', ...hadir(1, 2, '2026-10-03 08:40', 'Siti | Nurul'), ...sent('DIBACA', '2026-09-28 09:15') },
  { PIN: '480213', Gelar: 'Bapak', Nama: 'Prof. Darmawan', HP: '+6281211110003', Akses: 'VIP', Grup: 'Dosen', Sisi: 'PRIA', Q_S1: 0, Q_S2: 2, Meja: 'VIP-2', ...sent('TERKIRIM', '2026-09-28 09:17') },
  { PIN: '731902', Gelar: 'Keluarga', Nama: 'Keluarga Wijaya', HP: '+6281211110004', Akses: 'KELUARGA', Grup: 'Keluarga Besar Pria', Sisi: 'PRIA', Q_S1: 4, Q_S2: 4, ...hadir(4, 4, '2026-10-04 20:01', 'Wijaya | Lina | Kevin | Kezia'), ...sent('DIBACA', '2026-09-28 09:21') },
  { PIN: '209381', Gelar: 'Keluarga', Nama: 'Keluarga Hartono', HP: '+6281211110005', Akses: 'KELUARGA', Grup: 'Keluarga Besar Wanita', Sisi: 'WANITA', Q_S1: 3, Q_S2: 3, Status_RSVP: 'RAGU', RSVP_Waktu: '2026-10-05 11:30', Pesan_Tamu: 'Insya Allah, masih menunggu jadwal.', ...sent('DIBACA', '2026-09-28 09:22') },
  { PIN: '554120', Gelar: 'Bapak', Nama: 'Rudi Hermawan', HP: '+6281211110006', Akses: 'KELUARGA', Grup: 'Keluarga Besar Pria', Sisi: 'PRIA', Q_S1: 2, Q_S2: 2, ...sent('TERKIRIM', '2026-09-28 09:24') },
  { PIN: '118274', Gelar: 'Ibu', Nama: 'Wulan Sari', HP: '+6281211110007', Akses: 'KELUARGA', Grup: 'Keluarga Besar Wanita', Sisi: 'WANITA', Q_S1: 2, Q_S2: 2, Status_RSVP: 'TIDAK_HADIR', RSVP_Waktu: '2026-10-01 07:55', Pesan_Tamu: 'Mohon maaf tidak bisa hadir, doa terbaik untuk kalian.', ...sent('DIBACA', '2026-09-28 09:26') },
  { PIN: '903417', Gelar: 'Sdr.', Nama: 'Andi Saputra', HP: '+6281211110008', Email: 'andi@example.com', Grup: 'Teman Kantor', Sisi: 'PRIA', ...hadir(0, 2, '2026-10-06 21:10', 'Andi | Budi'), ...sent('DIBACA', '2026-09-29 10:02') },
  { PIN: '660392', Gelar: 'Sdri.', Nama: 'Maya Lestari', HP: '+6281211110009', Grup: 'Teman Kuliah', Sisi: 'WANITA', ...hadir(0, 1, '2026-10-06 22:48', 'Maya'), ...sent('TERKIRIM', '2026-09-29 10:04') },
  { PIN: '274815', Gelar: 'Sdr.', Nama: 'Fajar Nugroho', HP: '+6281211110010', Grup: 'Teman Kantor', Sisi: 'PRIA', ...sent('GAGAL', '2026-09-29 10:06', 3, 'not registered on WhatsApp') },
  { PIN: '381046', Gelar: 'Sdri.', Nama: 'Dewi Kartika', HP: '+6281211110011', Grup: 'Teman Kuliah', Sisi: 'WANITA', ...sent('ANTRI', '') },
  { PIN: '495731', Gelar: 'Sdr.', Nama: 'Yoga Pratama', HP: '+6281211110012', Grup: 'Teman SMA', Sisi: 'PRIA', ...sent('ANTRI', '') },
  { PIN: '827364', Gelar: 'Sdri.', Nama: 'Intan Permata', HP: '+6281211110013', Grup: 'Teman SMA', Sisi: 'WANITA', Status_RSVP: 'RAGU', RSVP_Waktu: '2026-10-07 13:00', ...sent('DIBACA', '2026-09-29 10:10') },
  { PIN: '152938', Gelar: 'Bapak', Nama: 'Agus Salim', HP: '+6281211110014', Grup: 'Tetangga', Sisi: 'BERSAMA', ...hadir(0, 2, '2026-10-08 09:20', 'Agus | Rina'), ...sent('DIBACA', '2026-09-29 10:12') },
  { PIN: '640285', Gelar: 'Ibu', Nama: 'Ratna Dewi', HP: '+6281211110015', Grup: 'Tetangga', Sisi: 'BERSAMA', Status_RSVP: 'TIDAK_HADIR', RSVP_Waktu: '2026-10-08 16:45', ...sent('DIBACA', '2026-09-29 10:13') },
  { PIN: '309572', Gelar: 'Sdr.', Nama: 'Kevin Tanoto', HP: '+6281211110016', Grup: 'Teman Kantor', Sisi: 'PRIA', ...sent('TERKIRIM', '2026-09-29 10:15') },
  { PIN: '713628', Gelar: 'Sdri.', Nama: 'Nadia Putri', HP: '+6281211110017', Grup: 'Teman Kuliah', Sisi: 'WANITA' },
  { PIN: '836152', Gelar: 'Sdr.', Nama: 'Bima Aditya', HP: '+6281211110018', Grup: 'Teman SMA', Sisi: 'PRIA' },
  { PIN: '471093', Gelar: 'Sdri.', Nama: 'Laras Ayu', HP: '+6281211110019', Grup: 'Teman SMA', Sisi: 'WANITA' },
  { PIN: '560284', Gelar: 'Bapak/Ibu', Nama: 'Hendra Gunawan', HP: '+6281211110020', Akses: 'PUBLIC', Grup: 'Rekan Bisnis', Sisi: 'PRIA', Q_S2: 2 },
  { PIN: '698315', Gelar: 'Bapak/Ibu', Nama: 'Yusuf Maulana', HP: '+6281211110021', Akses: 'PUBLIC', Grup: 'Rekan Bisnis', Sisi: 'PRIA', Q_S2: 2 },
  { PIN: '245067', Gelar: 'dr.', Nama: 'Anisa Rahma', HP: '+6281211110022', Grup: 'Teman Kuliah', Sisi: 'WANITA', Note_Unik: 'Terima kasih sudah jadi saksi perjalanan kami.' },
  { PIN: '917430', Gelar: 'Sdr.', Nama: 'Rizky TEST', HP: '+6281211110023', Grup: 'TEST', Sisi: 'BERSAMA', Catatan: 'Nomor uji coba blast pertama' },
  // — planted faults —
  { Gelar: 'Sdr.', Nama: 'Taufik Hidayat', HP: '08123456789', Grup: 'Teman Kantor', Sisi: 'PRIA', Catatan: 'HP belum dinormalisasi (awalan 0)' },
  { Gelar: 'Sdri.', Nama: 'Citra Maharani', HP: '0812-3456 7891', Grup: 'Teman Kuliah', Sisi: 'WANITA', Catatan: 'HP berspasi & strip' },
  { Gelar: 'Bapak', Nama: 'Joko Susilo', HP: '(0813) 5555-1212', Grup: 'Tetangga', Sisi: 'BERSAMA' },
  { PIN: '382910', Gelar: 'Sdr.', Nama: 'Eko Prasetyo', HP: '+6285700001111', Grup: 'Teman SMA', Sisi: 'PRIA', Catatan: 'Duplikat HP dengan Eko P.' },
  { PIN: '382911', Gelar: 'Sdr.', Nama: 'Eko P.', HP: '085700001111', Grup: 'Teman SMA', Sisi: 'PRIA', Catatan: 'Duplikat HP dengan Eko Prasetyo' },
  { Gelar: 'Ibu', Nama: 'Sri Rejeki', HP: 'nomor-nyusul', Grup: 'Tetangga', Sisi: 'BERSAMA', Catatan: 'HP tidak bisa diparse' },
  { Gelar: 'Bapak', Nama: 'Slamet Riyadi', HP: '', Grup: 'Tetangga', Sisi: 'BERSAMA', Catatan: 'Belum ada nomor' },
  { Gelar: 'Sdri.', Nama: '', HP: '+6281211110031', Grup: 'Teman Kuliah', Sisi: 'WANITA', Catatan: 'Nama lupa diisi' },
  { PIN: '615243', Gelar: 'Bapak', Nama: 'Arief Budiman', HP: '+6281211110032', Akses: 'VVIP', Grup: 'Rekan Bisnis', Sisi: 'PRIA' },
  { PIN: '729104', Gelar: 'Keluarga', Nama: 'Keluarga Santoso', HP: '+6281211110033', Akses: 'KELUARGA', Grup: 'Keluarga Besar Wanita', Sisi: 'WANITA', Q_S1: 2, Q_S2: 2, ...hadir(3, 4, '2026-10-09 18:30', 'Santoso | Mira | Dian | Tio'), ...sent('DIBACA', '2026-09-28 09:30') },
  { PIN: '729104', Gelar: 'Sdr.', Nama: 'Dian Santoso', HP: '+6281211110034', Grup: 'Teman Kantor', Sisi: 'WANITA', Catatan: 'PIN bentrok — impor manual' },
]

// @__PURE__ marks the top-level calls side-effect free, so a production build drops this whole seed.
export const SEED_GUESTS: Guest[] = /* @__PURE__ */ ROWS.map((r) => ({ ...blank, ...r }))

export const SEED_TEMPLATES: Template[] = [
  {
    Kode: 'UND-SEMUA',
    Tipe: 'UNDANGAN',
    Akses: 'SEMUA',
    Bahasa: 'id',
    Header_Image_URL: '',
    Aktif: true,
    Isi_Pesan: `{{greet}} {{tamu.gelar}} *{{tamu.nama}}*,

Dengan penuh sukacita kami mengundang Anda di hari bahagia kami:

💍 *{{event.pria}} & {{event.wanita}}*
📅 {{event.tanggal}}

*{{sesi2.label}}*
🕚 {{sesi2.jam}}
📍 {{sesi2.tempat}}
{{sesi2.maps}}

Undangan digital & konfirmasi kehadiran:
{{link}}

Mohon konfirmasi sebelum {{event.batas_rsvp}}.
{{event.hashtag}}`,
  },
  {
    Kode: 'UND-VIP',
    Tipe: 'UNDANGAN',
    Akses: 'VIP',
    Bahasa: 'id',
    Header_Image_URL: '',
    Aktif: true,
    Isi_Pesan: `{{greet}} {{tamu.gelar}} *{{tamu.nama}}*,

Merupakan suatu kehormatan bagi kami, putra-putri dari {{event.pria_ortu}} dan {{event.wanita_ortu}}, apabila Bapak/Ibu berkenan hadir:

*{{sesi1.label}}* — {{sesi1.tanggal}}, {{sesi1.jam}}
📍 {{sesi1.tempat}}

*{{sesi2.label}}* — {{sesi2.jam}}
📍 {{sesi2.tempat}}

Tempat duduk: *{{tamu.meja}}* · Untuk {{tamu.q_s2}} orang
{{tamu.note_unik}}

{{link}}

Hormat kami,
{{event.pria_lengkap}} & {{event.wanita_lengkap}}`,
  },
  {
    Kode: 'REM-SEMUA',
    Tipe: 'REMINDER',
    Akses: 'SEMUA',
    Bahasa: 'id',
    Header_Image_URL: '',
    Aktif: true,
    Isi_Pesan: `{{greet}} {{tamu.nama}} 👋

Pengingat: batas konfirmasi kehadiran untuk pernikahan {{event.pria}} & {{event.wanita}} adalah *{{event.batas_rsvp}}*.

Konfirmasi di sini: {{link}}

Terima kasih 🙏`,
  },
  {
    Kode: 'KONF-SEMUA',
    Tipe: 'KONFIRMASI_RSVP',
    Akses: 'SEMUA',
    Bahasa: 'id',
    Header_Image_URL: '',
    Aktif: true,
    Isi_Pesan: `Terima kasih {{tamu.gelar}} {{tamu.nama}}, konfirmasi Anda sudah kami terima ✅

{{sesi1.label}}: {{tamu.rsvp_s1}} orang
{{sesi2.label}}: {{tamu.rsvp_s2}} orang

Pertanyaan? Hubungi {{event.cs_nama}} ({{event.cs_hp}}).`,
  },
  {
    Kode: 'TK-SEMUA',
    Tipe: 'TERIMA_KASIH',
    Akses: 'SEMUA',
    Bahasa: 'id',
    Header_Image_URL: '',
    Aktif: true,
    Isi_Pesan: `{{greet}} {{tamu.nama}},

Terima kasih atas doa dan kehadirannya di hari bahagia kami 🤍

Salam hangat,
{{event.pria}} & {{event.wanita}}
{{event.hashtag}}`,
  },
  {
    Kode: 'H-SEMUA',
    Tipe: 'INFO_HARI_H',
    Akses: 'SEMUA',
    Bahasa: 'id',
    Header_Image_URL: '',
    Aktif: false,
    Isi_Pesan: `{{greet}} {{tamu.nama}}, sampai jumpa hari ini!

📍 {{sesi2.tempat}}, {{sesi2.alamat}}
🕚 {{sesi2.jam}}
👔 Dress code: {{sesi2.dresscode}}
🗺️ {{sesi2.maps}}

Tidak bisa hadir? Saksikan live: {{sesi2.stream}}`,
  },
]

// Second event, matching the static page in public/events/fidaeno/.
const FIDAENO_ALAMAT = 'Jl. Masjid Raya RT 03 RW 06 No. 38, Larangan Selatan, Tangerang'
const FIDAENO_MAPS = 'https://maps.app.goo.gl/6JcDw9zS62NNYCoY7'

export const SEED_FIDAENO_META: Meta = {
  mode: 'DRY-RUN',
  greetings: GREETINGS,
  event: {
    slug: 'fidaeno',
    domain: 'https://undangan.by.me',
    nama_event: 'Pernikahan Fida & Eno',
    tipe: 'PERNIKAHAN',
    bahasa: 'id',
    timezone: 'WIB',
    web_template: 'klasik',
    couple: {
      pria: { panggilan: 'Eno', lengkap: 'Hendro Tri Suseno, S.S.', ortu: 'Bapak Mintro S. Miharjo & Ibu Metih', hp: '+6281277770011', email: '' },
      wanita: { panggilan: 'Fida', lengkap: 'Firda Aulia, S.S.', ortu: 'Bapak Ahmad Rizki & Ibu Rahmawati', hp: '+6281277770012', email: '' },
      hashtag: '',
    },
    tanggal_utama: '2026-11-01',
    tanggal_pengingat: '',
    batas_rsvp: '2026-10-25',
    sesi: [
      { kode: 'S1', label: 'Akad Nikah', tanggal: '2026-11-01', mulai: '09:00', selesai: '', tempat: '', alamat: FIDAENO_ALAMAT, maps: FIDAENO_MAPS, dress_code: '', live_stream: '' },
      { kode: 'S2', label: 'Resepsi', tanggal: '2026-11-01', mulai: '11:00', selesai: '18:00', tempat: '', alamat: FIDAENO_ALAMAT, maps: FIDAENO_MAPS, dress_code: '', live_stream: '' },
    ],
    gift: { bank: 'SeaBank', atas_nama: 'Firda Aulia', norek: '901198500332', qris: '' },
    media: { musik: '', cover: '' },
    cs: { nama: 'Eno', hp: '+6281277770011' },
    kapasitas: { s1: 50, s2: 300 },
  },
}

export const SEED_FIDAENO_GUESTS: Guest[] = /* @__PURE__ */ [
  { PIN: '104729', Gelar: 'Bapak/Ibu', Nama: 'Mintro Miharjo', HP: '+6281311110001', Akses: 'KELUARGA', Sisi: 'PRIA' },
  { PIN: '593018', Gelar: 'Ibu', Nama: 'Rahmawati', HP: '+6281311110002', Akses: 'KELUARGA', Sisi: 'WANITA' },
  { PIN: '287465', Gelar: 'Sdr.', Nama: 'Galih Pratama', HP: '081311110003', Grup: 'Teman Kuliah', Sisi: 'BERSAMA' },
  { PIN: '', Gelar: 'Sdri.', Nama: 'Nurul Hidayah', HP: '+6281311110004', Grup: 'Teman Kuliah', Sisi: 'BERSAMA' },
].map((r) => ({ ...blank, ...r }) as Guest)

/**
 * Every seeded event (mock + sample xlsx); templates are copied per event.
 * dimas-rara is kept above only as a test fixture (mock.test.ts, gasParity.test.ts).
 */
export const SEED_EVENTS: { meta: Meta; guests: Guest[]; templates: Template[] }[] = [
  // { meta: SEED_META, guests: SEED_GUESTS, templates: SEED_TEMPLATES },
  { meta: SEED_FIDAENO_META, guests: SEED_FIDAENO_GUESTS, templates: SEED_TEMPLATES },
]

/**
 * Demo logins — the same accounts ship hashed in sheet-templates/undangan-db-sample.xlsx.
 * The mock compares the plain password; the Apps Script compares hashes.
 */
export const SEED_USERS: { email: string; nama: string; role: Role; event: string; password: string }[] = [
  { email: 'admin@example.com', nama: 'Super Admin', role: 'SUPER_ADMIN', event: '', password: 'Admin#123' },
  // { email: 'klien.dimasrara@example.com', nama: 'Dimas & Rara', role: 'CLIENT', event: 'dimas-rara', password: 'Klien#123' },
  { email: 'klien.fidaeno@example.com', nama: 'Fida & Eno', role: 'CLIENT', event: 'fidaeno', password: 'Klien#123' },
]
