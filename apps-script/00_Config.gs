/**
 * 00_Config.gs — constants shared by every file.
 *
 * Tab names and header rows mirror client/src/core/domain/sheetSchema.ts.
 * client/src/core/api/gasParity.test.ts asserts the two stay identical, so
 * change both together.
 *
 * Nothing in this file calls a Google service: the parity test loads it in a
 * plain Node vm.
 */

const API_VERSION = '2.0.0';

const SHEETS = {
  panduan: '00_Panduan',
  event: '01_Event',
  sesi: '01_Sesi',
  tamu: '02_Tamu',
  template: '03_Template',
  config: '_Config',
  enum: '_Enum',
  users: '_Users',
  sessions: '_Sessions',
};

/**
 * 01_Event: one row per event, EventInfo flattened. `ID` (a UUID, never
 * changes) is the key every other tab's `Event` column points at; `Slug` is
 * only the public invitation URL and may be renamed.
 */
const EVENT_COLUMNS = [
  'ID', 'Slug', 'Domain', 'Nama_Event', 'Tipe', 'Bahasa', 'Timezone', 'Web_Template',
  'Pria_Panggilan', 'Pria_Lengkap', 'Pria_Ortu', 'Pria_HP', 'Pria_Email',
  'Wanita_Panggilan', 'Wanita_Lengkap', 'Wanita_Ortu', 'Wanita_HP', 'Wanita_Email',
  'Hashtag', 'Tanggal_Utama', 'Tanggal_Pengingat', 'Batas_RSVP',
  'Gift_Bank', 'Gift_Atas_Nama', 'Gift_Norek', 'Gift_QRIS', 'Musik', 'Judul_Musik', 'Cover', 'Galeri',
  'CS_Nama', 'CS_HP', 'Kapasitas_S1', 'Kapasitas_S2', 'Mode', 'Dibuat', 'Diubah',
];

/**
 * Every data tab starts with `ID`: a UUID per row, written by the script and
 * never changed. Routes address rows by it; `Event` holds 01_Event.ID.
 */

/** 01_Sesi: one row per session; `Kode` is S1, S2… in row order within an event. */
const SESI_COLUMNS = [
  'ID', 'Event', 'Kode', 'Label', 'Tanggal', 'Mulai', 'Selesai', 'Nama_Tempat', 'Alamat',
  'Maps_URL', 'Dress_Code', 'Live_Stream',
];

/** 02_Tamu: `ID`, `Event`, then the 28 guest columns. */
const TAMU_COLUMNS = [
  'ID', 'Event', 'No', 'PIN', 'Gelar', 'Nama', 'HP', 'Email', 'Akses', 'Grup', 'Sisi', 'Q_S1', 'Q_S2',
  'Status_RSVP', 'RSVP_S1', 'RSVP_S2', 'RSVP_Waktu', 'Nama_Pax', 'Pesan_Tamu',
  'Status_Kirim', 'Kirim_Terakhir', 'Kirim_Count', 'Kirim_Error',
  'Meja', 'Note_Unik', 'Catatan', 'HP_Valid', 'Link_Undangan', 'Preview_Pesan', 'Link_WA',
];

/** The guest object the API returns: every 02_Tamu column except `Event`. */
const GUEST_KEYS = TAMU_COLUMNS.filter(function (k) { return k !== 'Event'; });

/**
 * 03_Template: a row with a blank `Event` is a master template (SUPER_ADMIN)
 * that every event inherits. A row with an `Event` is that event's own version
 * of the master with the same Kode (Isi_Pesan / Header_Image_URL / Aktif).
 */
const TEMPLATE_COLUMNS = ['ID', 'Event', 'Kode', 'Tipe', 'Akses', 'Bahasa', 'Header_Image_URL', 'Isi_Pesan', 'Aktif'];
const TEMPLATE_KEYS = TEMPLATE_COLUMNS.filter(function (k) { return k !== 'Event'; });

const CONFIG_COLUMNS = ['Key', 'Value', 'Catatan'];

const ENUM_COLUMNS = [
  'Akses', 'Sisi', 'Gelar', 'Status_RSVP', 'Status_Kirim', 'Tipe_Template', 'Tipe_Event', 'Mode', 'Role',
];

/** _Users. `Event` is the ID of the one event a CLIENT may access; blank for SUPER_ADMIN. */
const USER_COLUMNS = ['ID', 'Email', 'Nama', 'Role', 'Event', 'Password_Hash', 'Salt', 'Aktif', 'Dibuat', 'Login_Terakhir'];

const SESSION_COLUMNS = ['Token_Hash', 'Email', 'Dibuat', 'Kedaluwarsa'];

/** The columns a human (and therefore the API) may write. */
const MANUAL_KEYS = ['Gelar', 'Nama', 'HP', 'Email', 'Akses', 'Grup', 'Sisi', 'Q_S1', 'Q_S2', 'Meja', 'Note_Unik', 'Catatan'];

/** Columns only refreshDerived_() writes (they used to be ARRAYFORMULAs). */
const SCRIPT_DERIVED_KEYS = ['No', 'HP_Valid', 'Link_Undangan'];

const NUMERIC_GUEST_KEYS = ['No', 'Q_S1', 'Q_S2', 'RSVP_S1', 'RSVP_S2', 'Kirim_Count'];

/** Kept as text so a leading 0 / + survives. */
const TEXT_GUEST_KEYS = ['ID', 'PIN', 'HP'];

const AKSES = ['VIP', 'KELUARGA', 'REGULAR', 'PUBLIC'];
const SISI = ['PRIA', 'WANITA', 'BERSAMA'];
const GELAR = ['Bapak', 'Ibu', 'Bapak/Ibu', 'Sdr.', 'Sdri.', 'Keluarga', 'dr.', 'Prof.'];
const STATUS_RSVP = ['BELUM', 'HADIR', 'TIDAK_HADIR', 'RAGU'];
const STATUS_KIRIM = ['BELUM', 'ANTRI', 'TERKIRIM', 'DIBACA', 'GAGAL'];
const TEMPLATE_TIPE = ['UNDANGAN', 'REMINDER', 'KONFIRMASI_RSVP', 'TERIMA_KASIH', 'INFO_HARI_H'];
const TEMPLATE_AKSES = ['SEMUA'].concat(AKSES);
const EVENT_TIPE = ['PERNIKAHAN', 'LAMARAN', 'KHITANAN', 'ULANG_TAHUN', 'LAINNYA'];
const MODES = ['DRY-RUN', 'LIVE'];
/** SUPER_ADMIN: every event + /users. CLIENT: its own `_Users.Event` only. */
const ROLES = ['SUPER_ADMIN', 'CLIENT'];

/** _Enum column → values, in ENUM_COLUMNS order. */
const ENUM_VALUES = {
  Akses: AKSES,
  Sisi: SISI,
  Gelar: GELAR,
  Status_RSVP: STATUS_RSVP,
  Status_Kirim: STATUS_KIRIM,
  Tipe_Template: TEMPLATE_TIPE,
  Tipe_Event: EVENT_TIPE,
  Mode: MODES,
  Role: ROLES,
};

/** Validasi Data Event: the keys validateEvent_() requires. */
const EVENT_REQUIRED = [
  'slug', 'nama_event', 'tipe', 'timezone', 'tanggal_utama',
  'couple.pria.lengkap', 'couple.pria.panggilan', 'couple.pria.ortu',
  'couple.wanita.lengkap', 'couple.wanita.panggilan', 'couple.wanita.ortu',
];

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

const DEFAULT_MODE = 'DRY-RUN';
const DEFAULT_GREETINGS = ['Halo'];

/** Session lifetime; _Config `TOKEN_TTL_HOURS` overrides. */
const TOKEN_TTL_HOURS = 168;
/** CacheService caps entries at 6 hours. */
const TOKEN_CACHE_SECONDS = 21600;
const HASH_ITERATIONS = 1000;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;
const LOCK_WAIT_MS = 20000;
