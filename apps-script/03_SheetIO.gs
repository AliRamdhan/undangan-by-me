/**
 * 03_SheetIO.gs — the only file that touches cells.
 *
 * Tables are read whole (one getValues) into objects keyed by header, each
 * carrying its sheet row number in `_row`. Writes go through setValues over
 * contiguous blocks. PIN and HP cells are forced to text ('@') first so a
 * leading 0 or + survives.
 */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Tab ' + name + ' tidak ada — jalankan setup() dari editor Apps Script');
  return sh;
}

/**
 * `{sheet, headers, rows}`; each row is `{_row, <header>: value}`. Blank rows
 * are skipped. Values are strings/numbers/booleans (Dates are formatted).
 */
function readTable_(name) {
  const sh = sheet_(name);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { sheet: sh, headers: [], rows: [] };
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function (h) {
    return String(h).trim();
  });
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v.every(function (c) { return c === '' || c === null; })) continue;
    const obj = { _row: i + 1 };
    headers.forEach(function (h, j) {
      if (h) obj[h] = cellValue_(v[j]);
    });
    rows.push(obj);
  }
  return { sheet: sh, headers: headers, rows: rows };
}

/** A Date cell → the wall-clock string the app stores; anything else unchanged. */
function cellValue_(v) {
  if (!(v instanceof Date)) return v === null || v === undefined ? '' : v;
  const tz = ss_().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  if (v.getFullYear() < 1900) return Utilities.formatDate(v, tz, 'HH:mm'); // a time-only cell
  const hm = Utilities.formatDate(v, tz, 'HH:mm');
  return hm === '00:00' ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm");
}

function str_(v) {
  return v === null || v === undefined ? '' : String(v);
}

function num_(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/** TRUE / 'TRUE' / 'Ya' / 1 → true. */
function bool_(v) {
  if (v === true) return true;
  if (typeof v === 'number') return v !== 0;
  const s = str_(v).trim().toLowerCase();
  return s === 'true' || s === 'ya' || s === 'yes' || s === 'y' || s === '1';
}

function colIndex_(headers, key) {
  const i = headers.indexOf(key);
  if (i < 0) throw new Error('Kolom ' + key + ' tidak ada di header — jalankan setup()');
  return i + 1;
}

/** Headers of the sheet itself, or `fallback` when the header row is still empty. */
function headersOf_(sh, fallback) {
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return fallback.slice();
  const h = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) {
    return String(x).trim();
  });
  return h.some(function (x) { return x; }) ? h : fallback.slice();
}

/**
 * Adds header `col` right after `after` (or at the end when `after` is missing)
 * if the tab has a header row without it. Data in other columns keeps its place.
 * Returns whether a column was added.
 */
function ensureColumnAfter_(name, col, after) {
  const sh = sheet_(name);
  const headers = headersOf_(sh, []);
  if (!headers.length || headers.indexOf(col) >= 0) return false;
  const i = headers.indexOf(after);
  const at = i >= 0 ? i + 1 : headers.length; // 1-based column to insert after
  sh.insertColumnAfter(at);
  sh.getRange(1, at + 1).setValue(col);
  return true;
}

function toRowArray_(headers, obj) {
  return headers.map(function (h) {
    return obj[h] === undefined || obj[h] === null ? '' : obj[h];
  });
}

/** Sets '@' (plain text) on the given columns for rows [startRow, startRow + n). */
function forceText_(sh, headers, keys, startRow, n) {
  if (n < 1) return;
  keys.forEach(function (k) {
    const i = headers.indexOf(k);
    if (i >= 0) sh.getRange(startRow, i + 1, n, 1).setNumberFormat('@');
  });
}

/** Appends `objs` below the last row. `textKeys` are forced to text first. */
function appendRows_(name, objs, textKeys) {
  if (!objs.length) return 0;
  const sh = sheet_(name);
  const headers = headersOf_(sh, []);
  const start = Math.max(sh.getLastRow(), 1) + 1;
  forceText_(sh, headers, textKeys || [], start, objs.length);
  const values = objs.map(function (o) {
    return toRowArray_(headers, o);
  });
  sh.getRange(start, 1, values.length, headers.length).setValues(values);
  return objs.length;
}

/** Overwrites the given keys of one row, one contiguous run of columns at a time. */
function writeFields_(sh, headers, rowNum, fields, textKeys) {
  const entries = Object.keys(fields).map(function (k) {
    return { col: colIndex_(headers, k), value: fields[k], key: k };
  });
  entries.sort(function (a, b) {
    return a.col - b.col;
  });
  (textKeys || []).forEach(function (k) {
    if (fields[k] !== undefined) sh.getRange(rowNum, colIndex_(headers, k)).setNumberFormat('@');
  });
  let i = 0;
  while (i < entries.length) {
    let j = i;
    while (j + 1 < entries.length && entries[j + 1].col === entries[j].col + 1) j++;
    const vals = [entries.slice(i, j + 1).map(function (e) { return e.value; })];
    sh.getRange(rowNum, entries[i].col, 1, j - i + 1).setValues(vals);
    i = j + 1;
  }
}

/**
 * Writes `keys` (adjacent columns, in header order) for many rows, one
 * setValues per contiguous run of sheet rows. `items` = `[{row, values: [...]}]`.
 */
function writeBlocks_(sh, headers, keys, items, textKeys) {
  if (!items.length) return;
  const col = colIndex_(headers, keys[0]);
  keys.forEach(function (k, i) {
    if (colIndex_(headers, k) !== col + i) throw new Error('Kolom ' + keys.join(', ') + ' tidak bersebelahan');
  });
  const sorted = items.slice().sort(function (a, b) {
    return a.row - b.row;
  });
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].row === sorted[j].row + 1) j++;
    const n = j - i + 1;
    forceText_(sh, headers, (textKeys || []).filter(function (k) { return keys.indexOf(k) >= 0; }), sorted[i].row, n);
    sh.getRange(sorted[i].row, col, n, keys.length).setValues(
      sorted.slice(i, j + 1).map(function (it) {
        return it.values;
      })
    );
    i = j + 1;
  }
}

/** Deletes sheet rows bottom-up, one deleteRows per contiguous run. */
function deleteRows_(sh, rowNums) {
  const rows = rowNums.slice().sort(function (a, b) {
    return b - a;
  });
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] - 1) j++;
    sh.deleteRows(rows[j], j - i + 1);
    i = j + 1;
  }
  return rows.length;
}

/**
 * Gives every row of `t` without an `ID` a new UUID (rows typed straight into
 * the sheet), writes them, and sets `ID` on the row objects. Returns the count.
 */
function ensureIds_(t) {
  if (t.headers.indexOf('ID') < 0) throw new Error('Kolom ID tidak ada — jalankan setup()');
  const items = t.rows
    .filter(function (r) { return !str_(r.ID).trim(); })
    .map(function (r) {
      r.ID = Utilities.getUuid();
      return { row: r._row, values: [r.ID] };
    });
  writeBlocks_(t.sheet, t.headers, ['ID'], items, ['ID']);
  return items.length;
}

/** Deletes every row whose `Event` equals the event `id`. Returns the count. */
function deleteEventRows_(name, id) {
  const t = readTable_(name);
  const rows = t.rows.filter(function (r) { return str_(r.Event) === id; }).map(function (r) { return r._row; });
  return deleteRows_(t.sheet, rows);
}

/** _Config Key → Value. */
function readConfig_() {
  const out = {};
  try {
    readTable_(SHEETS.config).rows.forEach(function (r) {
      const k = str_(r.Key).trim();
      if (k) out[k] = r.Value;
    });
  } catch (e) {
    // Missing _Config: every setting falls back to its default.
  }
  return out;
}

function nowIso_() {
  return new Date().toISOString();
}
