/**
 * 05_Event.gs — 01_Event (one row per event) + 01_Sesi ↔ EventInfo, and the
 * /event routes. The mapping mirrors eventToRow / sessionToRow in
 * client/src/core/domain/sheetSchema.ts.
 */

// ── mapping (pure) ──────────────────────────────────────────────────────────

/** EventInfo → one 01_Event row. `Dibuat` / `Diubah` are left to the caller. */
function eventToRow_(e, mode) {
  const pria = e.couple.pria;
  const wanita = e.couple.wanita;
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
    Hashtag: e.couple.hashtag,
    Tanggal_Utama: e.tanggal_utama,
    Tanggal_Pengingat: e.tanggal_pengingat,
    Batas_RSVP: e.batas_rsvp,
    Gift_Bank: e.gift.bank,
    Gift_Atas_Nama: e.gift.atas_nama,
    Gift_Norek: e.gift.norek,
    Gift_QRIS: e.gift.qris,
    Musik: e.media.musik,
    Judul_Musik: e.media.judul_musik,
    Cover: e.media.cover,
    Galeri: galleryToCell_(e.gallery),
    CS_Nama: e.cs.nama,
    CS_HP: e.cs.hp,
    Kapasitas_S1: e.kapasitas.s1,
    Kapasitas_S2: e.kapasitas.s2,
    Mode: mode,
    Dibuat: '',
    Diubah: '',
  };
}

function sessionToRow_(eventId, s) {
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
  };
}

function rowToSession_(r) {
  return {
    id: str_(r.ID),
    kode: str_(r.Kode),
    label: str_(r.Label),
    tanggal: str_(r.Tanggal),
    mulai: str_(r.Mulai),
    selesai: str_(r.Selesai),
    tempat: str_(r.Nama_Tempat),
    alamat: str_(r.Alamat),
    maps: str_(r.Maps_URL),
    dress_code: str_(r.Dress_Code),
    live_stream: str_(r.Live_Stream),
  };
}

/** Galeri: one path or URL per line, so the cell stays editable in the Sheet. */
function galleryToCell_(list) {
  return (list || [])
    .map(function (s) { return str_(s).trim(); })
    .filter(function (s) { return s; })
    .join('\n');
}

function cellToGallery_(v) {
  return str_(v)
    .split(/\r?\n/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
}

/** One 01_Event row + its 01_Sesi rows (sheet order) → EventInfo. */
function rowToEvent_(r, sesiRows) {
  const person = function (p) {
    return {
      panggilan: str_(r[p + '_Panggilan']),
      lengkap: str_(r[p + '_Lengkap']),
      ortu: str_(r[p + '_Ortu']),
      hp: str_(r[p + '_HP']),
      email: str_(r[p + '_Email']),
    };
  };
  return {
    id: str_(r.ID),
    slug: str_(r.Slug),
    domain: str_(r.Domain),
    nama_event: str_(r.Nama_Event),
    tipe: str_(r.Tipe),
    bahasa: str_(r.Bahasa),
    timezone: str_(r.Timezone),
    web_template: str_(r.Web_Template),
    couple: { pria: person('Pria'), wanita: person('Wanita'), hashtag: str_(r.Hashtag) },
    tanggal_utama: str_(r.Tanggal_Utama),
    tanggal_pengingat: str_(r.Tanggal_Pengingat),
    batas_rsvp: str_(r.Batas_RSVP),
    sesi: (sesiRows || []).map(rowToSession_),
    gift: { bank: str_(r.Gift_Bank), atas_nama: str_(r.Gift_Atas_Nama), norek: str_(r.Gift_Norek), qris: str_(r.Gift_QRIS) },
    media: { musik: str_(r.Musik), judul_musik: str_(r.Judul_Musik), cover: str_(r.Cover) },
    gallery: cellToGallery_(r.Galeri),
    cs: { nama: str_(r.CS_Nama), hp: str_(r.CS_HP) },
    kapasitas: { s1: num_(r.Kapasitas_S1), s2: num_(r.Kapasitas_S2) },
  };
}

function modeOf_(v) {
  const m = str_(v).trim().toUpperCase();
  return MODES.indexOf(m) >= 0 ? m : DEFAULT_MODE;
}

/**
 * Defaults, validateEvent, S1..Sn re-coding and HP normalisation. A session
 * keeps its `id` only if it is one of `ownSesiIds` (this event's sessions);
 * any other gets a new UUID. Throws VALIDATION.
 */
function prepareEvent_(raw, ownSesiIds) {
  if (!raw || typeof raw !== 'object') throw new ApiError_('VALIDATION', 'Data event wajib dikirim');
  const next = withEventDefaults_(JSON.parse(JSON.stringify(raw)));
  const v = validateEvent_(next);
  const errs = Object.keys(v).map(function (k) {
    return [k, v[k]];
  });
  if (errs.length) {
    throw new ApiError_('VALIDATION', 'Data event belum lengkap: ' + errs.map(function (e) { return e[0] + ' (' + e[1] + ')'; }).join(', '));
  }
  next.sesi = next.sesi.map(function (s, i) {
    const id = str_(s.id).trim();
    return Object.assign({}, s, { id: (ownSesiIds || []).indexOf(id) >= 0 ? id : Utilities.getUuid(), kode: 'S' + (i + 1) });
  });
  [next.couple.pria, next.couple.wanita].forEach(function (p) {
    p.hp = normalizePhone_(p.hp);
  });
  next.kapasitas = { s1: num_(next.kapasitas.s1), s2: num_(next.kapasitas.s2) };
  return next;
}

function requireMode_(mode, fallback) {
  if (mode === undefined || mode === null || mode === '') return fallback;
  const m = str_(mode).toUpperCase();
  if (MODES.indexOf(m) < 0) throw new ApiError_('VALIDATION', 'Mode harus DRY-RUN atau LIVE');
  return m;
}

// ── sheet access ────────────────────────────────────────────────────────────

function greetings_() {
  const raw = str_(readConfig_().GREETINGS);
  const list = raw.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  return list.length ? list : DEFAULT_GREETINGS.slice();
}

/** `{id, slug, row, meta}` for the event with this `ID`, or NOT_FOUND. */
function loadEvent_(id) {
  id = str_(id);
  const t = readTable_(SHEETS.event);
  const row = id && t.rows.find(function (r) { return str_(r.ID) === id; });
  if (!row) throw new ApiError_('NOT_FOUND', 'Event tidak ditemukan');
  const sesi = readTable_(SHEETS.sesi).rows.filter(function (r) { return str_(r.Event) === id; });
  return {
    id: id,
    slug: str_(row.Slug),
    row: row,
    table: t,
    meta: { mode: modeOf_(row.Mode), event: rowToEvent_(row, sesi), greetings: greetings_() },
  };
}

/** Whether another event (not `exceptId`) already uses `slug`. */
function slugTaken_(slug, exceptId) {
  return readTable_(SHEETS.event).rows.some(function (r) { return str_(r.Slug) === slug && str_(r.ID) !== exceptId; });
}

function eventExists_(id) {
  return !!id && readTable_(SHEETS.event).rows.some(function (r) { return str_(r.ID) === id; });
}

const EVENT_TEXT_KEYS_ = [
  'ID', 'Slug', 'Pria_HP', 'Wanita_HP', 'CS_HP', 'Tanggal_Utama', 'Tanggal_Pengingat', 'Batas_RSVP', 'Gift_Norek', 'Dibuat', 'Diubah',
];
const SESI_TEXT_KEYS_ = ['ID', 'Tanggal', 'Mulai', 'Selesai'];

function writeSessions_(id, sesi) {
  deleteEventRows_(SHEETS.sesi, id);
  appendRows_(
    SHEETS.sesi,
    sesi.map(function (s) { return sessionToRow_(id, s); }),
    SESI_TEXT_KEYS_
  );
}

/**
 * 01_Event columns added after a workbook was made. Writes map values onto the
 * sheet's own header row, so a missing column would silently drop its value:
 * add it before writing, whether or not setup() has been re-run.
 */
function ensureEventColumns_() {
  ensureColumnAfter_(SHEETS.event, 'Judul_Musik', 'Musik');
  ensureColumnAfter_(SHEETS.event, 'Galeri', 'Cover');
}

// ── handlers ────────────────────────────────────────────────────────────────

/** GET event → EventSummary[]. A CLIENT gets only its own event. Rows typed into the sheet get their ID here. */
function handleListEvents_(ctx) {
  ensureIds_(readTable_(SHEETS.event));
  const only = ctx && ctx.user && ctx.user.role === 'CLIENT' ? ctx.user.event : null;
  const count = function (name) {
    const out = {};
    readTable_(name).rows.forEach(function (r) {
      const s = str_(r.Event);
      out[s] = (out[s] || 0) + 1;
    });
    return out;
  };
  const tamu = count(SHEETS.tamu);
  // Every event has every master template.
  const tpl = readMasters_().templates.length;
  return readTable_(SHEETS.event)
    .rows.filter(function (r) { return str_(r.ID) && (only === null || str_(r.ID) === only); })
    .map(function (r) {
      const id = str_(r.ID);
      return {
        id: id,
        slug: str_(r.Slug),
        nama_event: str_(r.Nama_Event),
        tipe: str_(r.Tipe),
        tanggal_utama: str_(r.Tanggal_Utama),
        mode: modeOf_(r.Mode),
        jumlah_tamu: tamu[id] || 0,
        jumlah_template: tpl,
      };
    });
}

/** GET E → Meta */
function handleGetEvent_(ctx) {
  return ctx.event.meta;
}

/** POST event {event, mode?} → Meta */
function handleCreateEvent_(ctx) {
  ensureEventColumns_();
  const next = prepareEvent_(ctx.body.event, []);
  const mode = requireMode_(ctx.body.mode, DEFAULT_MODE);
  if (slugTaken_(next.slug)) throw new ApiError_('DUPLICATE_SLUG', 'Slug "' + next.slug + '" sudah dipakai event lain');
  next.id = Utilities.getUuid();
  const row = eventToRow_(next, mode);
  row.Dibuat = row.Diubah = nowIso_();
  appendRows_(SHEETS.event, [row], EVENT_TEXT_KEYS_);
  writeSessions_(next.id, next.sesi);
  return loadEvent_(next.id).meta;
}

/**
 * PUT E {event, mode?} → Meta. The ID never changes, so a new slug touches
 * only this row. A CLIENT may not change slug or domain, and its `mode` is ignored.
 */
function handleUpdateEvent_(ctx) {
  ensureEventColumns_();
  const old = ctx.event;
  const next = prepareEvent_(ctx.body.event, old.meta.event.sesi.map(function (s) { return s.id; }).filter(function (id) { return id; }));
  const isClient = ctx.user && ctx.user.role === 'CLIENT';
  if (isClient && (next.slug !== old.slug || str_(next.domain).trim() !== str_(old.meta.event.domain).trim())) {
    throw new ApiError_('FORBIDDEN', 'Slug dan domain hanya bisa diubah SUPER_ADMIN');
  }
  const mode = isClient ? old.meta.mode : requireMode_(ctx.body.mode, old.meta.mode);
  if (next.slug !== old.slug && slugTaken_(next.slug, old.id)) {
    throw new ApiError_('DUPLICATE_SLUG', 'Slug "' + next.slug + '" sudah dipakai event lain');
  }
  next.id = old.id;
  const row = eventToRow_(next, mode);
  row.Dibuat = str_(old.row.Dibuat) || nowIso_();
  row.Diubah = nowIso_();
  const t = readTable_(SHEETS.event);
  const current = t.rows.find(function (r) { return str_(r.ID) === old.id; });
  if (!current) throw new ApiError_('NOT_FOUND', 'Event tidak ditemukan');
  forceText_(t.sheet, t.headers, EVENT_TEXT_KEYS_, current._row, 1);
  t.sheet.getRange(current._row, 1, 1, t.headers.length).setValues([toRowArray_(t.headers, row)]);
  // Sessions are replaced wholesale.
  writeSessions_(old.id, next.sesi);
  refreshDerived_(old.id, next);
  return loadEvent_(old.id).meta;
}

/** DELETE E → {tamu, template, sesi, akun} removed. `akun` = the event's CLIENT accounts. */
function handleDeleteEvent_(ctx) {
  const id = ctx.event.id;
  const out = {
    tamu: deleteEventRows_(SHEETS.tamu, id),
    template: deleteEventRows_(SHEETS.template, id),
    sesi: deleteEventRows_(SHEETS.sesi, id),
    akun: deleteEventClients_(id),
  };
  const t = readTable_(SHEETS.event);
  deleteRows_(t.sheet, t.rows.filter(function (r) { return str_(r.ID) === id; }).map(function (r) { return r._row; }));
  return out;
}

/** Deletes the CLIENT rows of `_Users` bound to event `id` and ends their sessions. */
function deleteEventClients_(id) {
  const t = readTable_(SHEETS.users);
  const dead = t.rows.filter(function (r) {
    return normalizeRole_(r.Role) === 'CLIENT' && str_(r.Event).trim() === id;
  });
  dead.forEach(function (r) { revokeUserSessions_(r.Email); });
  return deleteRows_(t.sheet, dead.map(function (r) { return r._row; }));
}

// ── public invitation read (URL-CONTRACT § 7) ───────────────────────────────

/** EventInfo → what the public invitation page may see: render fields only, no IDs, contacts or capacities. */
function publicEvent_(ev) {
  const person = function (p) {
    return { panggilan: p.panggilan, lengkap: p.lengkap, ortu: p.ortu };
  };
  return {
    slug: ev.slug,
    tipe: ev.tipe,
    bahasa: ev.bahasa,
    timezone: ev.timezone,
    couple: { pria: person(ev.couple.pria), wanita: person(ev.couple.wanita), hashtag: ev.couple.hashtag },
    tanggal_utama: ev.tanggal_utama,
    sesi: ev.sesi.map(function (s) {
      return {
        kode: s.kode,
        label: s.label,
        tanggal: s.tanggal,
        mulai: s.mulai,
        selesai: s.selesai,
        tempat: s.tempat,
        alamat: s.alamat,
        maps: s.maps,
        dress_code: s.dress_code,
        live_stream: s.live_stream,
      };
    }),
    gift: { bank: ev.gift.bank, atas_nama: ev.gift.atas_nama, norek: ev.gift.norek, qris: ev.gift.qris },
    media: { musik: ev.media.musik, judul_musik: ev.media.judul_musik, cover: ev.media.cover },
    gallery: ev.gallery,
  };
}

/**
 * GET invitation ?id= | ?slug=, &pin= → {event, guest}. Public (no token).
 * `guest` is `{gelar, nama}` or null when the PIN is empty or unknown.
 */
function handleInvitation_(ctx) {
  const q = ctx.query || {};
  let id = str_(q.id).trim();
  const slug = str_(q.slug).trim();
  if (!id && slug) {
    const row = readTable_(SHEETS.event).rows.find(function (r) { return str_(r.Slug) === slug; });
    id = row ? str_(row.ID) : '';
  }
  if (!id) throw new ApiError_('NOT_FOUND', 'Event tidak ditemukan');
  const ev = loadEvent_(id);

  const pin = str_(q.pin).trim();
  const g = pin
    ? readTable_(SHEETS.tamu).rows.find(function (r) { return str_(r.Event) === ev.id && str_(r.PIN) === pin; })
    : null;
  return {
    event: publicEvent_(ev.meta.event),
    guest: g ? { gelar: str_(g.Gelar), nama: str_(g.Nama) } : null,
  };
}
