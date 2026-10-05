/**
 * 06_Guests.gs — /event/:code/guests, scoped to one event's rows of 02_Tamu.
 * A guest is addressed by its `ID` (never PIN or row position).
 *
 * `No` is the 1-based position of a row among its event's rows, in sheet
 * order. `No`, `HP_Valid` and `Link_Undangan` are written only by
 * refreshDerived_(), which runs after every write.
 */

function rowToGuest_(r) {
  const g = {};
  GUEST_KEYS.forEach(function (k) {
    g[k] = NUMERIC_GUEST_KEYS.indexOf(k) >= 0 ? num_(r[k]) : str_(r[k]);
  });
  return g;
}

/** `{table, rows, guests}` — the event's sheet rows and their Guest objects, same order. */
function guestState_(ev) {
  const table = readTable_(SHEETS.tamu);
  const rows = table.rows.filter(function (r) { return str_(r.Event) === ev.id; });
  ensureIds_({ sheet: table.sheet, headers: table.headers, rows: rows });
  const event = ev.meta ? ev.meta.event : ev;
  return { table: table, rows: rows, guests: applyFormulas_(rows.map(rowToGuest_), event) };
}

/** Recomputes No / HP_Valid / Link_Undangan for one event and writes what changed. */
function refreshDerived_(id, event) {
  event = event || loadEvent_(id).meta.event;
  const st = guestState_({ id: id, meta: { event: event } });
  const noItems = [];
  const restItems = [];
  st.rows.forEach(function (r, i) {
    const g = st.guests[i];
    if (num_(r.No) !== g.No || r.No === '') noItems.push({ row: r._row, values: [g.No] });
    if (str_(r.HP_Valid) !== g.HP_Valid || str_(r.Link_Undangan) !== g.Link_Undangan) {
      restItems.push({ row: r._row, values: [g.HP_Valid, g.Link_Undangan] });
    }
  });
  writeBlocks_(st.table.sheet, st.table.headers, ['No'], noItems);
  writeBlocks_(st.table.sheet, st.table.headers, ['HP_Valid', 'Link_Undangan'], restItems);
  return st;
}

// ── guest references ────────────────────────────────────────────────────────

/** Index of the guest with this `ID`, or NOT_FOUND. */
function findGuest_(guests, id) {
  id = str_(id);
  const i = id ? guests.findIndex(function (g) { return g.ID === id; }) : -1;
  if (i < 0) throw new ApiError_('NOT_FOUND', 'Tamu tidak ditemukan — muat ulang lalu coba lagi');
  return i;
}

function idsFrom_(ids) {
  if (!Array.isArray(ids)) throw new ApiError_('VALIDATION', 'ids harus berupa daftar ID tamu');
  return ids.map(str_);
}

/** Only `allowed` keys; numbers numeric, everything else a string. */
function cleanFields_(fields, allowed) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new ApiError_('VALIDATION', 'fields harus berupa objek');
  }
  const clean = {};
  Object.keys(fields).forEach(function (k) {
    if (allowed.indexOf(k) < 0) throw new ApiError_('VALIDATION', 'Kolom ' + k + ' bukan kolom manual — tidak boleh ditulis');
    clean[k] = NUMERIC_GUEST_KEYS.indexOf(k) >= 0 ? num_(fields[k]) : str_(fields[k]);
  });
  return clean;
}

// ── handlers ────────────────────────────────────────────────────────────────

function handleListGuests_(ctx) {
  return guestState_(ctx.event).guests;
}

function handleGetGuest_(ctx) {
  const st = guestState_(ctx.event);
  return st.guests[findGuest_(st.guests, ctx.params.id)];
}

/** POST E/guests {fields} → Guest with a new ID and a PIN unique within the event. */
function handleCreateGuest_(ctx) {
  const clean = cleanFields_(ctx.body.fields || {}, MANUAL_KEYS);
  const st = guestState_(ctx.event);
  const pin = generatePins_(1, st.guests.map(function (g) { return g.PIN; }))[0];
  const row = Object.assign(blankGuest_(), clean, { ID: Utilities.getUuid(), PIN: pin, Event: ctx.event.id });
  appendRows_(SHEETS.tamu, [row], TEXT_GUEST_KEYS);
  return refreshDerived_(ctx.event.id, ctx.event.meta.event).guests[st.guests.length];
}

/** PATCH E/guests/:id {fields} → Guest */
function handlePatchGuest_(ctx) {
  const clean = cleanFields_(ctx.body.fields || {}, MANUAL_KEYS);
  const st = guestState_(ctx.event);
  const i = findGuest_(st.guests, ctx.params.id);
  if (Object.keys(clean).length) writeFields_(st.table.sheet, st.table.headers, st.rows[i]._row, clean, TEXT_GUEST_KEYS);
  return refreshDerived_(ctx.event.id, ctx.event.meta.event).guests[i];
}

/** DELETE E/guests/:id */
function handleDeleteGuest_(ctx) {
  const st = guestState_(ctx.event);
  const i = findGuest_(st.guests, ctx.params.id);
  deleteRows_(st.table.sheet, [st.rows[i]._row]);
  refreshDerived_(ctx.event.id, ctx.event.meta.event);
  return null;
}

/** POST E/guests/bulk-delete {ids} → number */
function handleBulkDeleteGuests_(ctx) {
  const ids = idsFrom_(ctx.body.ids);
  const st = guestState_(ctx.event);
  const idxs = {};
  ids.forEach(function (id) {
    idxs[findGuest_(st.guests, id)] = true;
  });
  const rows = Object.keys(idxs).map(function (i) { return st.rows[Number(i)]._row; });
  deleteRows_(st.table.sheet, rows);
  refreshDerived_(ctx.event.id, ctx.event.meta.event);
  return rows.length;
}

/**
 * Columns an import row overwrites on a guest it matches by HP — only when the
 * imported cell is not blank. HP itself is the match key and keeps its stored form.
 */
const IMPORT_UPDATE_KEYS_ = ['Gelar', 'Nama', 'Email'];

/**
 * POST E/guests/import {rows} → {added, updated}. Keys: MANUAL_KEYS + PIN.
 * A row whose HP (normalised) matches an existing guest — or an earlier row of
 * the same import — updates that guest instead of adding a duplicate.
 *
 * PINs are assigned here, once: every added guest gets a new one (an imported
 * PIN is ignored), as does any existing guest of the event still without one.
 * A PIN that is set is never changed.
 */
function handleImportGuests_(ctx) {
  const rows = ctx.body.rows;
  if (!Array.isArray(rows)) throw new ApiError_('VALIDATION', 'rows harus berupa daftar');
  const allowed = MANUAL_KEYS.concat(['PIN']);
  const st = guestState_(ctx.event);
  /** phoneKey_ → the guest it lands on: `{i, fields}` for an existing one, `{obj}` for a new one. */
  const byPhone = new Map();
  st.guests.forEach(function (g, i) {
    const key = phoneKey_(g.HP);
    if (key && !byPhone.has(key)) byPhone.set(key, { i: i, fields: {} });
  });
  const added = [];
  rows.forEach(function (r) {
    const clean = cleanFields_(r, allowed);
    const key = phoneKey_(clean.HP);
    const hit = key ? byPhone.get(key) : undefined;
    if (!hit) {
      const obj = Object.assign(blankGuest_(), clean, { ID: Utilities.getUuid(), Event: ctx.event.id });
      added.push(obj);
      if (key) byPhone.set(key, { obj: obj });
      return;
    }
    IMPORT_UPDATE_KEYS_.forEach(function (k) {
      if (str_(clean[k]).trim()) (hit.obj || hit.fields)[k] = clean[k];
    });
  });

  let updated = 0;
  byPhone.forEach(function (hit) {
    if (hit.obj) return;
    const g = st.guests[hit.i];
    const changed = {};
    Object.keys(hit.fields).forEach(function (k) {
      if (hit.fields[k] !== g[k]) changed[k] = hit.fields[k];
    });
    if (!Object.keys(changed).length) return;
    writeFields_(st.table.sheet, st.table.headers, st.rows[hit.i]._row, changed, TEXT_GUEST_KEYS);
    updated++;
  });

  const empty = [];
  st.guests.forEach(function (g, i) {
    if (!g.PIN) empty.push(i);
  });
  const pins = generatePins_(empty.length + added.length, st.guests.map(function (g) { return g.PIN; }));
  writeBlocks_(
    st.table.sheet,
    st.table.headers,
    ['PIN'],
    empty.map(function (i, j) { return { row: st.rows[i]._row, values: [pins[j]] }; }),
    ['PIN']
  );
  added.forEach(function (obj, j) { obj.PIN = pins[empty.length + j]; });
  appendRows_(SHEETS.tamu, added, TEXT_GUEST_KEYS);
  refreshDerived_(ctx.event.id, ctx.event.meta.event);
  return { added: added.length, updated: updated };
}

/** POST E/guests/normalize-phones → number changed. */
function handleNormalizePhones_(ctx) {
  const st = guestState_(ctx.event);
  const items = [];
  st.guests.forEach(function (g, i) {
    const n = normalizePhone_(g.HP);
    if (n !== g.HP) items.push({ row: st.rows[i]._row, values: [n] });
  });
  writeBlocks_(st.table.sheet, st.table.headers, ['HP'], items, ['HP']);
  refreshDerived_(ctx.event.id, ctx.event.meta.event);
  return items.length;
}

/** GET E/guests/check → Issue[] */
function handleCheckGuests_(ctx) {
  return cekDuplikat_(guestState_(ctx.event).guests);
}
