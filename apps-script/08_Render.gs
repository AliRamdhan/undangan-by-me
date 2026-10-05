/**
 * 08_Render.gs — the one renderer. Line-for-line port of
 * client/src/core/domain/template.ts and link.ts (gasParity.test.ts compares
 * them on the seed data), plus the preview / links / draft handlers.
 */

const SESI_FIELDS_ = ['label', 'tanggal', 'jam', 'tempat', 'alamat', 'maps', 'dresscode', 'stream'];

const KNOWN_TOKENS_ = new Set(
  [
    'tamu.gelar', 'tamu.nama', 'tamu.pin', 'tamu.q_s1', 'tamu.q_s2', 'tamu.rsvp_s1', 'tamu.rsvp_s2', 'tamu.meja',
    'tamu.note_unik', 'link', 'greet',
    'event.pria', 'event.wanita', 'event.pria_lengkap', 'event.wanita_lengkap', 'event.pria_ortu', 'event.wanita_ortu',
    'event.nama', 'event.hashtag', 'event.tanggal', 'event.batas_rsvp', 'event.cs_nama', 'event.cs_hp',
  ]
    .concat(SESI_FIELDS_.map(function (f) { return 'sesi1.' + f; }))
    .concat(SESI_FIELDS_.map(function (f) { return 'sesi2.' + f; }))
);

const TOKEN_RE_ = /\{\{([^{}]*)\}\}/g;

class TemplateError_ extends Error {
  constructor(unknown, malformed) {
    const parts = [];
    if (unknown.length) parts.push('token tidak dikenal: ' + unknown.map(function (t) { return '{{' + t + '}}'; }).join(', '));
    if (malformed) parts.push('kurung kurawal tidak seimbang');
    super('Template tidak valid — ' + parts.join('; '));
    this.name = 'TemplateError';
    this.unknown = unknown;
    this.malformed = malformed;
  }
}

/** Non-throwing render for live preview and validation reports. */
function inspectTemplate_(body, ctx) {
  body = str_(body);
  const unknown = new Set();
  const empty = new Set();
  const text = body.replace(TOKEN_RE_, function (whole, inner) {
    const token = inner.trim();
    if (!KNOWN_TOKENS_.has(token) || !Object.prototype.hasOwnProperty.call(ctx, token)) {
      unknown.add(token);
      return whole;
    }
    const value = ctx[token];
    if (value === '') empty.add(token);
    return value;
  });
  const malformed = /\{\{|\}\}/.test(body.replace(TOKEN_RE_, ''));
  return { text: text, unknown: Array.from(unknown), malformed: malformed, empty: Array.from(empty) };
}

/** Strict render: an unknown token throws rather than reaching a guest as a blank. */
function renderTemplate_(body, ctx) {
  const r = inspectTemplate_(body, ctx);
  if (r.unknown.length || r.malformed) throw new TemplateError_(r.unknown, r.malformed);
  return r.text;
}

/** Deterministic per PIN (FNV-1a + murmur3 finaliser). */
function pinHash_(pin) {
  let h = 0x811c9dc5;
  for (const ch of str_(pin)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

function pickGreeting_(pin, variants) {
  if (!variants || !variants.length) return '';
  return variants[pinHash_(pin) % variants.length];
}

const HARI_ = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/**
 * `2026-11-14` → `Sabtu, 14 November 2026`. Wall-clock, never shifted.
 * Written out by hand: Intl locale data is not guaranteed in Apps Script.
 */
function formatTanggal_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str_(iso));
  if (!m) return str_(iso);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return HARI_[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + BULAN_[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

function sessionContext_(prefix, s, tz) {
  const jam = s && s.mulai ? (s.mulai + (s.selesai ? '–' + s.selesai : '') + ' ' + tz).trim() : '';
  const ctx = {};
  ctx[prefix + '.label'] = s ? orDefault_(s.label, '') : '';
  ctx[prefix + '.tanggal'] = s ? formatTanggal_(s.tanggal) : '';
  ctx[prefix + '.jam'] = jam;
  ctx[prefix + '.tempat'] = s ? orDefault_(s.tempat, '') : '';
  ctx[prefix + '.alamat'] = s ? orDefault_(s.alamat, '') : '';
  ctx[prefix + '.maps'] = s ? orDefault_(s.maps, '') : '';
  ctx[prefix + '.dresscode'] = s ? orDefault_(s.dress_code, '') : '';
  ctx[prefix + '.stream'] = s ? orDefault_(s.live_stream, '') : '';
  return ctx;
}

function buildContext_(g, meta) {
  const event = meta.event;
  return Object.assign(
    {
      'tamu.gelar': g.Gelar,
      'tamu.nama': g.Nama,
      'tamu.pin': g.PIN,
      'tamu.q_s1': String(g.Q_S1),
      'tamu.q_s2': String(g.Q_S2),
      'tamu.rsvp_s1': String(g.RSVP_S1),
      'tamu.rsvp_s2': String(g.RSVP_S2),
      'tamu.meja': g.Meja,
      'tamu.note_unik': g.Note_Unik,
      link: linkTamu_(event.domain, event.slug, g.PIN),
      greet: pickGreeting_(g.PIN, meta.greetings),
      'event.pria': event.couple.pria.panggilan,
      'event.wanita': event.couple.wanita.panggilan,
      'event.pria_lengkap': event.couple.pria.lengkap,
      'event.wanita_lengkap': event.couple.wanita.lengkap,
      'event.pria_ortu': event.couple.pria.ortu,
      'event.wanita_ortu': event.couple.wanita.ortu,
      'event.nama': event.nama_event,
      'event.hashtag': event.couple.hashtag,
      'event.tanggal': formatTanggal_(event.tanggal_utama),
      'event.batas_rsvp': formatTanggal_(event.batas_rsvp),
      'event.cs_nama': event.cs.nama,
      'event.cs_hp': event.cs.hp,
    },
    sessionContext_('sesi1', event.sesi[0], event.timezone),
    sessionContext_('sesi2', event.sesi[1], event.timezone)
  );
}

/** (Tipe, Akses) falling back to (Tipe, SEMUA); inactive rows never match. */
function pickTemplate_(templates, tipe, akses) {
  const active = templates.filter(function (t) {
    return t.Aktif && t.Tipe === tipe;
  });
  return (
    active.find(function (t) { return t.Akses === akses; }) ||
    active.find(function (t) { return t.Akses === 'SEMUA'; })
  );
}

// ── link.ts ─────────────────────────────────────────────────────────────────

/** `{domain}/{slug}/{PIN}` (URL-CONTRACT.md § 1). */
function linkUndangan_(domain, slug, pin) {
  domain = str_(domain);
  slug = str_(slug);
  pin = str_(pin);
  if (!pin || !domain || !slug) return '';
  const base = /^https?:\/\//i.test(domain) ? domain : 'https://' + domain;
  return base.replace(/\/+$/, '') + '/' + slug + '/' + pin;
}

/** This app's own invitation page: `{origin}/events/{slug}/{PIN}`. */
function linkLocal_(origin, slug, pin) {
  origin = str_(origin);
  slug = str_(slug);
  pin = str_(pin);
  if (!pin || !slug) return '';
  return origin.replace(/\/+$/, '') + '/events/' + encodeURIComponent(slug) + '/' + pin;
}

/**
 * Set per request by route_() from the client's `origin` param. Apps Script
 * runs each request in a fresh global scope, so this never leaks across calls.
 */
let REQUEST_ORIGIN_ = '';

/** `{domain}/{slug}/{PIN}`, or the client's own page when the event has no domain. */
function linkTamu_(domain, slug, pin, origin) {
  if (origin === undefined) origin = REQUEST_ORIGIN_;
  if (str_(domain).trim()) return linkUndangan_(domain, slug, pin);
  return str_(origin) ? linkLocal_(origin, slug, pin) : '';
}

/** `https://wa.me/628…?text=…`, or '' when the number is not sendable. */
function waLink_(hp, text) {
  const normalized = normalizePhone_(hp);
  if (!HP_PATTERN.test(normalized)) return '';
  return 'https://wa.me/' + normalized.slice(1) + '?text=' + encodeURIComponent(text);
}

// ── render for one guest (mock.ts render) ───────────────────────────────────

function renderFor_(g, tipe, templates, meta) {
  const tpl = pickTemplate_(templates, tipe, g.Akses);
  if (!tpl) {
    throw new ApiError_('NO_TEMPLATE', 'Tidak ada template ' + tipe + ' aktif untuk akses ' + (g.Akses || '(kosong)') + ' atau SEMUA');
  }
  try {
    const text = renderTemplate_(tpl.Isi_Pesan, buildContext_(g, meta));
    return { kode: tpl.Kode, text: text, waLink: waLink_(g.HP, text) };
  } catch (e) {
    if (e instanceof TemplateError_) throw new ApiError_('TEMPLATE', tpl.Kode + ': ' + e.message);
    throw e;
  }
}

function requireTipe_(tipe) {
  if (TEMPLATE_TIPE.indexOf(tipe) < 0) throw new ApiError_('VALIDATION', 'Tipe template tidak dikenal: ' + (tipe || '(kosong)'));
  return tipe;
}

// ── handlers ────────────────────────────────────────────────────────────────

/** GET E/guests/:id/preview?tipe */
function handlePreview_(ctx) {
  const tipe = requireTipe_(str_(ctx.query.tipe));
  const st = guestState_(ctx.event);
  const i = findGuest_(st.guests, ctx.params.id);
  return renderFor_(st.guests[i], tipe, readTemplates_(ctx.event.id).templates, ctx.event.meta);
}

/** POST E/render/draft {body, id|null} — `id` is the sample guest; never throws on bad tokens. */
function handleRenderDraft_(ctx) {
  const id = ctx.body.id;
  let g;
  if (id) {
    const st = guestState_(ctx.event);
    g = st.guests[findGuest_(st.guests, id)];
  } else {
    g = Object.assign(blankGuest_(), { Nama: 'Nama Tamu', PIN: '000000' });
  }
  return inspectTemplate_(str_(ctx.body.body), buildContext_(g, ctx.event.meta));
}

/** POST E/guests/links {ids|null, tipe} — fills Preview_Pesan and Link_WA. */
function handleGenerateLinks_(ctx) {
  const tipe = requireTipe_(str_(ctx.body.tipe));
  const st = guestState_(ctx.event);
  const templates = readTemplates_(ctx.event.id).templates;
  const ids = ctx.body.ids;
  const idxs = Array.isArray(ids)
    ? ids.map(function (id) { return findGuest_(st.guests, id); })
    : st.guests.map(function (_, i) { return i; });
  const result = { written: 0, skipped: [] };
  const items = [];
  idxs.forEach(function (i) {
    const g = st.guests[i];
    const skip = function (reason) {
      result.skipped.push({ pin: g.PIN, nama: g.Nama, reason: reason });
    };
    if (!g.PIN) {
      skip('PIN kosong — link undangan belum ada');
      return;
    }
    try {
      const r = renderFor_(g, tipe, templates, ctx.event.meta);
      items.push({ row: st.rows[i]._row, values: [r.text, r.waLink] });
      if (!r.waLink) skip('HP "' + g.HP + '" tidak valid — pesan dibuat tanpa link WA');
      result.written++;
    } catch (e) {
      skip(e && e.message ? e.message : String(e));
    }
  });
  writeBlocks_(st.table.sheet, st.table.headers, ['Preview_Pesan', 'Link_WA'], items);
  return result;
}
