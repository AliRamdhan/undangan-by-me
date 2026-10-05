/**
 * 09_Domain.gs — pure ports of client/src/core/domain/{phone,pin,checks,derive,event}.ts.
 *
 * No SpreadsheetApp here: gasParity.test.ts runs these in Node against the
 * TypeScript originals. Keep them line-for-line.
 */

// ── phone.ts ────────────────────────────────────────────────────────────────

/** Indonesian mobile, normalised: +62 8xx, 9–13 digits after the country code. */
const HP_PATTERN = /^\+628\d{7,11}$/;

/** Normalisasi Nomor HP: 08xx / 628xx / 8xx → +628xx; anything else trimmed but untouched. */
function normalizePhone_(raw) {
  const trimmed = str_(raw).trim();
  if (!trimmed) return '';
  const compact = trimmed.replace(/[\s\-.()]/g, '');
  if (!/^\+?\d+$/.test(compact)) return trimmed;
  if (compact.startsWith('+62')) return compact;
  if (compact.startsWith('62')) return '+' + compact;
  if (compact.startsWith('08')) return '+62' + compact.slice(1);
  if (compact.startsWith('8')) return '+62' + compact;
  return compact;
}

function phoneKey_(raw) {
  return normalizePhone_(raw).replace(/^\+/, '');
}

function hpValid_(raw, counts) {
  raw = str_(raw);
  if (!raw.trim()) return '⚠️ kosong';
  if (!HP_PATTERN.test(normalizePhone_(raw))) return '⚠️ format';
  if ((counts.get(phoneKey_(raw)) || 0) > 1) return '⚠️ duplikat';
  return '✅';
}

function phoneCounts_(phones) {
  const counts = new Map();
  for (const hp0 of phones) {
    const hp = str_(hp0);
    if (!hp.trim()) continue;
    const k = phoneKey_(hp);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

// ── pin.ts ──────────────────────────────────────────────────────────────────

const PIN_PATTERN = /^\d{6}$/;
const PIN_RANGE = 1000000;
const PIN_LIMIT = Math.floor(0x100000000 / PIN_RANGE) * PIN_RANGE;

/** Uniform 6-digit PIN from UUID v4 randomness (Apps Script has no crypto.getRandomValues). */
function randomPin_() {
  for (;;) {
    const n = parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16);
    if (n < PIN_LIMIT) return String(n % PIN_RANGE).padStart(6, '0');
  }
}

/** `count` new PINs, unique among themselves and against `existing`. */
function generatePins_(count, existing) {
  const taken = new Set();
  for (const p of existing) taken.add(str_(p));
  if (taken.size + count > PIN_RANGE / 2) throw new Error('Terlalu banyak PIN untuk ruang 6 digit');
  const out = [];
  while (out.length < count) {
    const pin = randomPin_();
    if (taken.has(pin)) continue;
    taken.add(pin);
    out.push(pin);
  }
  return out;
}

// ── derive.ts ───────────────────────────────────────────────────────────────

/** No, HP_Valid and Link_Undangan for one event's guests, in sheet order. */
function applyFormulas_(guests, event) {
  const counts = phoneCounts_(guests.map(function (g) { return g.HP; }));
  return guests.map(function (g, i) {
    return Object.assign({}, g, {
      No: i + 1,
      HP_Valid: hpValid_(g.HP, counts),
      Link_Undangan: linkTamu_(event.domain, event.slug, g.PIN),
    });
  });
}

// ── checks.ts ───────────────────────────────────────────────────────────────

function hasData_(g) {
  return [g.PIN, g.Gelar, g.Nama, g.HP, g.Email, g.Grup, g.Akses].some(function (v) {
    return str_(v).trim() !== '';
  });
}

/** Cek Duplikat & Error. */
function cekDuplikat_(guests) {
  const rows = guests.filter(hasData_);
  const pinCount = new Map();
  const hpCount = new Map();
  for (const g of rows) {
    if (g.PIN) pinCount.set(g.PIN, (pinCount.get(g.PIN) || 0) + 1);
    if (g.HP.trim()) hpCount.set(phoneKey_(g.HP), (hpCount.get(phoneKey_(g.HP)) || 0) + 1);
  }

  const issues = [];
  for (const g of rows) {
    const add = function (kind, field, message) {
      issues.push({ kind: kind, no: g.No, pin: g.PIN, nama: g.Nama, field: field, message: message });
    };

    if (!g.Nama.trim()) add('NAMA_KOSONG', 'Nama', 'Baris berisi data tetapi Nama kosong');

    if (!g.PIN) add('PIN_KOSONG', 'PIN', 'PIN belum ada — import ulang atau tambah ulang tamu ini');
    else if (!PIN_PATTERN.test(g.PIN)) add('PIN_FORMAT', 'PIN', '"' + g.PIN + '" bukan 6 digit');
    else if ((pinCount.get(g.PIN) || 0) > 1) add('PIN_DUPLIKAT', 'PIN', 'PIN ' + g.PIN + ' dipakai ' + pinCount.get(g.PIN) + ' tamu');

    if (!g.HP.trim()) add('HP_KOSONG', 'HP', 'Tidak bisa dikirim via WhatsApp');
    else if (!HP_PATTERN.test(normalizePhone_(g.HP))) add('HP_FORMAT', 'HP', '"' + g.HP + '" tidak dikenali');
    else if ((hpCount.get(phoneKey_(g.HP)) || 0) > 1)
      add('HP_DUPLIKAT', 'HP', normalizePhone_(g.HP) + ' dipakai ' + hpCount.get(phoneKey_(g.HP)) + ' tamu');

    if (AKSES.indexOf(g.Akses) < 0) add('AKSES_INVALID', 'Akses', g.Akses ? '"' + g.Akses + '" bukan ' + AKSES.join('/') : 'Akses kosong');

    if (g.RSVP_S1 > g.Q_S1) add('LEBIH_KUOTA', 'RSVP_S1', 'S1: ' + g.RSVP_S1 + ' pax > kuota ' + g.Q_S1);
    if (g.RSVP_S2 > g.Q_S2) add('LEBIH_KUOTA', 'RSVP_S2', 'S2: ' + g.RSVP_S2 + ' pax > kuota ' + g.Q_S2);
  }
  return issues;
}

// ── seed.ts blankGuest ──────────────────────────────────────────────────────

function blankGuest_() {
  return {
    ID: '', No: 0, PIN: '', Gelar: '', Nama: '', HP: '', Email: '', Akses: 'REGULAR', Grup: '', Sisi: 'BERSAMA',
    Q_S1: 0, Q_S2: 2, Status_RSVP: 'BELUM', RSVP_S1: 0, RSVP_S2: 0, RSVP_Waktu: '', Nama_Pax: '', Pesan_Tamu: '',
    Status_Kirim: 'BELUM', Kirim_Terakhir: '', Kirim_Count: 0, Kirim_Error: '', Meja: '', Note_Unik: '', Catatan: '',
    HP_Valid: '✅', Link_Undangan: '', Preview_Pesan: '', Link_WA: '',
  };
}

// ── event.ts ────────────────────────────────────────────────────────────────

const EMAIL_PATTERN_ = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function blankPerson_() {
  return { panggilan: '', lengkap: '', ortu: '', hp: '', email: '' };
}

function blankSession_(kode) {
  return { id: '', kode: kode, label: '', tanggal: '', mulai: '', selesai: '', tempat: '', alamat: '', maps: '', dress_code: '', live_stream: '' };
}

function orDefault_(v, d) {
  return v === undefined || v === null ? d : v;
}

/** Fills every field the form edits (port of withEventDefaults). */
function withEventDefaults_(e) {
  e = e || {};
  const c = e.couple || {};
  return {
    id: orDefault_(e.id, ''),
    slug: orDefault_(e.slug, ''),
    domain: orDefault_(e.domain, ''),
    nama_event: orDefault_(e.nama_event, ''),
    tipe: orDefault_(e.tipe, 'PERNIKAHAN'),
    bahasa: orDefault_(e.bahasa, 'id'),
    timezone: orDefault_(e.timezone, 'WIB'),
    web_template: orDefault_(e.web_template, ''),
    couple: {
      pria: Object.assign(blankPerson_(), c.pria),
      wanita: Object.assign(blankPerson_(), c.wanita),
      hashtag: orDefault_(c.hashtag, ''),
    },
    tanggal_utama: orDefault_(e.tanggal_utama, ''),
    tanggal_pengingat: orDefault_(e.tanggal_pengingat, ''),
    batas_rsvp: orDefault_(e.batas_rsvp, ''),
    sesi: (e.sesi || []).map(function (s, i) {
      return Object.assign(blankSession_('S' + (i + 1)), s);
    }),
    gift: Object.assign({ bank: '', atas_nama: '', norek: '', qris: '' }, e.gift),
    media: Object.assign({ musik: '', judul_musik: '', cover: '' }, e.media),
    gallery: Array.isArray(e.gallery) ? e.gallery : [],
    cs: Object.assign({ nama: '', hp: '' }, e.cs),
    kapasitas: Object.assign({ s1: 0, s2: 0 }, e.kapasitas),
  };
}

/** Validasi Data Event: path → message (port of validateEvent). */
function validateEvent_(e) {
  const REQUIRED = 'Wajib diisi';
  const errs = {};
  const need = function (path, value) {
    if (!str_(value).trim()) errs[path] = REQUIRED;
  };

  need('nama_event', e.nama_event);
  need('tipe', e.tipe);
  // HIDDEN(sementara): domain is hidden in the form
  need('timezone', e.timezone);
  need('tanggal_utama', e.tanggal_utama);
  // HIDDEN(sementara): batas_rsvp is hidden in the form

  if (!str_(e.slug).trim()) errs.slug = REQUIRED;
  else if (!SLUG_PATTERN.test(e.slug)) errs.slug = 'Huruf kecil, angka dan tanda hubung; harus diawali huruf';

  if (str_(e.domain).trim() && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(str_(e.domain).trim())) {
    errs.domain = 'Contoh: https://undangan.by.me';
  }

  if (e.tanggal_utama && e.batas_rsvp && e.batas_rsvp > e.tanggal_utama) {
    errs.batas_rsvp = 'Batas RSVP harus sebelum atau sama dengan tanggal acara';
  }

  ['pria', 'wanita'].forEach(function (side) {
    const p = e.couple[side];
    need('couple.' + side + '.lengkap', p.lengkap);
    need('couple.' + side + '.panggilan', p.panggilan);
    need('couple.' + side + '.ortu', p.ortu);
    if (str_(p.hp).trim() && !HP_PATTERN.test(normalizePhone_(p.hp))) {
      errs['couple.' + side + '.hp'] = 'Format tidak dikenali — gunakan 08xx atau +628xx';
    }
    if (str_(p.email).trim() && !EMAIL_PATTERN_.test(str_(p.email).trim())) errs['couple.' + side + '.email'] = 'Email tidak valid';
  });

  if (e.couple.hashtag && !/^#[\p{L}\p{N}_]+$/u.test(e.couple.hashtag)) {
    errs['couple.hashtag'] = 'Satu kata tanpa spasi, contoh #DimasRara';
  }

  e.sesi.forEach(function (s, i) {
    need('sesi.' + i + '.label', s.label);
    need('sesi.' + i + '.tanggal', s.tanggal);
    need('sesi.' + i + '.mulai', s.mulai);
    if (s.mulai && s.selesai && s.selesai <= s.mulai) errs['sesi.' + i + '.selesai'] = 'Harus setelah jam mulai';
  });

  return errs;
}
