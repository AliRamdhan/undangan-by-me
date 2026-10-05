/**
 * 07_Templates.gs — master templates (/templates, SUPER_ADMIN) and an event's
 * view of them (/event/:code/templates).
 *
 * One tab, 03_Template. A row with a blank `Event` is a master: every event
 * has it, so a new master reaches every event (and every new event) at once.
 * A row with an `Event` is that event's own version of the master with the
 * same Kode: it is written the first time the event saves the template, holds
 * Isi_Pesan / Header_Image_URL / Aktif, and replaces the master's for that
 * event only. Kode/Tipe/Akses/Bahasa always come from the master.
 *
 * An event addresses a template by the master's ID, whether or not it has its
 * own version (`Custom`). Reset deletes the event's row.
 */

function rowToTemplate_(r) {
  return {
    ID: str_(r.ID),
    Kode: str_(r.Kode),
    Tipe: str_(r.Tipe),
    Akses: str_(r.Akses),
    Bahasa: str_(r.Bahasa),
    Header_Image_URL: str_(r.Header_Image_URL),
    Isi_Pesan: str_(r.Isi_Pesan),
    Aktif: bool_(r.Aktif),
  };
}

function isMasterRow_(r) {
  return !str_(r.Event).trim();
}

/** Two rows (or templates) carry the same event-editable values. */
function sameText_(a, b) {
  return (
    str_(a.Isi_Pesan) === str_(b.Isi_Pesan) &&
    str_(a.Header_Image_URL) === str_(b.Header_Image_URL) &&
    bool_(a.Aktif) === bool_(b.Aktif)
  );
}

/** `{table, rows, templates}` of the master rows, sheet order. */
function readMasters_() {
  const table = readTable_(SHEETS.template);
  const rows = table.rows.filter(isMasterRow_);
  ensureIds_({ sheet: table.sheet, headers: table.headers, rows: rows });
  return { table: table, rows: rows, templates: rows.map(rowToTemplate_) };
}

/** Master `m` as event `own` row sees it (`own` may be undefined). */
function mergeTemplate_(m, own) {
  if (!own) return Object.assign({}, m, { Custom: false });
  return Object.assign({}, m, {
    Header_Image_URL: str_(own.Header_Image_URL),
    Isi_Pesan: str_(own.Isi_Pesan),
    Aktif: bool_(own.Aktif),
    Custom: true,
  });
}

/**
 * `{table, masters, own, templates}` for one event: every master, with the
 * event's own version applied. `own` = the event's rows by Kode.
 */
function readTemplates_(id) {
  const st = readMasters_();
  const rows = st.table.rows.filter(function (r) { return str_(r.Event) === id; });
  ensureIds_({ sheet: st.table.sheet, headers: st.table.headers, rows: rows });
  const own = {};
  rows.forEach(function (r) {
    const k = str_(r.Kode);
    if (!own[k]) own[k] = r;
  });
  return {
    table: st.table,
    masters: st.templates,
    own: own,
    templates: st.templates.map(function (m) { return mergeTemplate_(m, own[m.Kode]); }),
  };
}

/** Body `template` → a clean Template (Kode trimmed). `ID` is left to the caller. */
function cleanTemplate_(t) {
  if (!t || typeof t !== 'object') throw new ApiError_('VALIDATION', 'Data template wajib dikirim');
  const kode = str_(t.Kode).trim();
  if (!kode) throw new ApiError_('VALIDATION', 'Kode template wajib diisi');
  const tipe = str_(t.Tipe);
  if (TEMPLATE_TIPE.indexOf(tipe) < 0) throw new ApiError_('VALIDATION', 'Tipe template tidak dikenal: ' + (tipe || '(kosong)'));
  const akses = str_(t.Akses);
  if (TEMPLATE_AKSES.indexOf(akses) < 0) throw new ApiError_('VALIDATION', 'Akses template tidak dikenal: ' + (akses || '(kosong)'));
  return {
    ID: '',
    Kode: kode,
    Tipe: tipe,
    Akses: akses,
    Bahasa: str_(t.Bahasa),
    Header_Image_URL: str_(t.Header_Image_URL),
    Isi_Pesan: str_(t.Isi_Pesan),
    Aktif: t.Aktif === undefined ? true : bool_(t.Aktif),
  };
}

function findTemplate_(st, id) {
  id = str_(id);
  const i = id ? st.templates.findIndex(function (t) { return t.ID === id; }) : -1;
  if (i < 0) throw new ApiError_('NOT_FOUND', 'Template tidak ditemukan');
  return i;
}

/** Kode is unique among the masters. */
function kodeClash_(masters, next) {
  if (masters.some(function (t) { return t.Kode === next.Kode && t.ID !== next.ID; })) {
    throw new ApiError_('VALIDATION', 'Kode ' + next.Kode + ' sudah dipakai');
  }
}

/** The event rows (every event) that are versions of the master with this Kode. */
function versionRows_(table, kode) {
  return table.rows.filter(function (r) { return !isMasterRow_(r) && str_(r.Kode) === kode; });
}

// ── master handlers (SUPER_ADMIN) ───────────────────────────────────────────

function handleListMasters_() {
  return readMasters_().templates;
}

/** POST templates {template} → {template, custom: 0}. Every event has it at once. */
function handleCreateMaster_(ctx) {
  const next = cleanTemplate_(ctx.body.template);
  const st = readMasters_();
  kodeClash_(st.templates, next);
  next.ID = Utilities.getUuid();
  appendRows_(SHEETS.template, [Object.assign({ Event: '' }, next)], ['ID', 'Kode']);
  return { template: next, custom: 0 };
}

/**
 * PUT templates/:id {template} → {template, custom}. Events without their own
 * version see the change at once; `custom` = events that keep their own text.
 * Those rows follow a Kode/Tipe/Akses/Bahasa change.
 */
function handleUpdateMaster_(ctx) {
  const next = cleanTemplate_(ctx.body.template);
  const st = readMasters_();
  const i = findTemplate_(st, ctx.params.id);
  const old = st.templates[i];
  next.ID = old.ID;
  kodeClash_(st.templates, next);
  const t = st.table;
  t.sheet.getRange(st.rows[i]._row, 1, 1, t.headers.length).setValues([toRowArray_(t.headers, Object.assign({ Event: '' }, next))]);
  const versions = versionRows_(t, old.Kode).map(function (r) {
    return { row: r._row, values: [next.Kode, next.Tipe, next.Akses, next.Bahasa] };
  });
  writeBlocks_(t.sheet, t.headers, ['Kode', 'Tipe', 'Akses', 'Bahasa'], versions, ['Kode']);
  return { template: next, custom: versions.length };
}

/** DELETE templates/:id → {custom}: the master and every event's version go. A missing ID is a no-op. */
function handleDeleteMaster_(ctx) {
  const st = readMasters_();
  const m = st.templates.find(function (t) { return t.ID === str_(ctx.params.id); });
  if (!m) return { custom: 0 };
  const versions = versionRows_(st.table, m.Kode).map(function (r) { return r._row; });
  const masterRows = st.rows.filter(function (r) { return str_(r.ID) === m.ID; }).map(function (r) { return r._row; });
  deleteRows_(st.table.sheet, masterRows.concat(versions));
  return { custom: versions.length };
}

// ── event handlers ──────────────────────────────────────────────────────────

function handleListTemplates_(ctx) {
  return readTemplates_(ctx.event.id).templates;
}

function handleGetTemplate_(ctx) {
  const st = readTemplates_(ctx.event.id);
  return st.templates[findTemplate_(st, ctx.params.id)];
}

/**
 * PUT E/templates/:id {template} → Template. `:id` is the master's ID. Only
 * Isi_Pesan, Header_Image_URL and Aktif are taken; they are written to the
 * event's own row (created on first save). Values equal to the master's drop
 * that row, so the event follows the master again.
 */
function handleUpdateTemplate_(ctx) {
  const t = ctx.body.template;
  if (!t || typeof t !== 'object') throw new ApiError_('VALIDATION', 'Data template wajib dikirim');
  const st = readTemplates_(ctx.event.id);
  const i = findTemplate_(st, ctx.params.id);
  const cur = st.templates[i];
  const m = st.masters[i];
  const own = st.own[m.Kode];
  const fields = {
    Header_Image_URL: t.Header_Image_URL === undefined ? cur.Header_Image_URL : str_(t.Header_Image_URL),
    Isi_Pesan: t.Isi_Pesan === undefined ? cur.Isi_Pesan : str_(t.Isi_Pesan),
    Aktif: t.Aktif === undefined ? cur.Aktif : bool_(t.Aktif),
  };
  if (sameText_(fields, m)) {
    if (own) deleteRows_(st.table.sheet, [own._row]);
    return mergeTemplate_(m);
  }
  if (own) {
    writeFields_(st.table.sheet, st.table.headers, own._row, fields);
  } else {
    const row = Object.assign({ ID: Utilities.getUuid(), Event: ctx.event.id, Kode: m.Kode, Tipe: m.Tipe, Akses: m.Akses, Bahasa: m.Bahasa }, fields);
    appendRows_(SHEETS.template, [row], ['ID', 'Event', 'Kode']);
  }
  return mergeTemplate_(m, fields);
}

/** POST E/templates/:id/reset → Template: the event's own version goes; it follows the master again. */
function handleResetTemplate_(ctx) {
  const st = readTemplates_(ctx.event.id);
  const m = st.masters[findTemplate_(st, ctx.params.id)];
  const own = st.own[m.Kode];
  if (own) deleteRows_(st.table.sheet, [own._row]);
  return mergeTemplate_(m);
}

/** GET E/templates/validate → TemplateReport[] */
function handleValidateTemplates_(ctx) {
  const guests = guestState_(ctx.event).guests;
  const meta = ctx.event.meta;
  return validateTemplates_(readTemplates_(ctx.event.id).templates, guests, meta);
}

/** Pure: port of MockApi.validateTemplates. */
function validateTemplates_(templates, guests, meta) {
  return templates
    .filter(function (t) { return t.Aktif; })
    .map(function (t) {
      const targets = t.Akses === 'SEMUA' ? guests : guests.filter(function (g) { return g.Akses === t.Akses; });
      const sample = targets.length ? targets : [blankGuest_()];
      const results = sample.map(function (g) {
        return inspectTemplate_(t.Isi_Pesan, buildContext_(g, meta));
      });
      // Blank for every guest means event data is missing, not a per-guest gap.
      const empty = results[0].empty.filter(function (tok) {
        return results.every(function (r) { return r.empty.indexOf(tok) >= 0; });
      });
      return {
        kode: t.Kode,
        tipe: t.Tipe,
        akses: t.Akses,
        rendered: targets.length,
        unknown: results[0].unknown,
        malformed: results[0].malformed,
        empty: empty,
      };
    });
}
