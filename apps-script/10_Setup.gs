/**
 * 10_Setup.gs — run `setup()` once from the Apps Script editor (and again any
 * time; it is idempotent). It never deletes or reorders data:
 *   - creates missing tabs and writes their header row when it is empty;
 *   - bolds and freezes headers, sets text format on PIN/HP/date columns;
 *   - fills _Enum / _Config defaults when empty, and always refreshes the
 *     _Enum Role column (roles are code, not data);
 *   - adds the `Event` column to a legacy _Users (inserted after `Role`);
 *   - adds 01_Event columns newer than the workbook (`Judul_Musik` after `Musik`);
 *   - adds the `ID` column (column A) to a legacy data tab, fills every
 *     missing ID with a UUID, and turns `Event` values that are still slugs
 *     into 01_Event IDs;
 *   - turns a legacy 03_Template (every row bound to an event) into master
 *     templates (blank Event) plus per-event versions;
 *   - adds dropdowns sourced from _Enum;
 *   - hides and (warning-only) protects the `_` tabs.
 * A tab whose header differs from 00_Config.gs is reported in the log, not rewritten.
 */

const SETUP_TABS_ = [
  [SHEETS.panduan, ['Panduan']],
  [SHEETS.event, EVENT_COLUMNS],
  [SHEETS.sesi, SESI_COLUMNS],
  [SHEETS.tamu, TAMU_COLUMNS],
  [SHEETS.template, TEMPLATE_COLUMNS],
  [SHEETS.config, CONFIG_COLUMNS],
  [SHEETS.enum, ENUM_COLUMNS],
  [SHEETS.users, USER_COLUMNS],
  [SHEETS.sessions, SESSION_COLUMNS],
];

/** Plain-text columns per tab (a leading 0 / + or a wall-clock date must survive). */
const SETUP_TEXT_COLUMNS_ = {
  '01_Event': ['ID', 'Slug', 'Pria_HP', 'Wanita_HP', 'CS_HP', 'Tanggal_Utama', 'Tanggal_Pengingat', 'Batas_RSVP', 'Gift_Norek', 'Dibuat', 'Diubah'],
  '01_Sesi': ['ID', 'Event', 'Tanggal', 'Mulai', 'Selesai'],
  '02_Tamu': ['ID', 'Event', 'PIN', 'HP'],
  '03_Template': ['ID', 'Event'],
  _Users: ['ID', 'Email', 'Event', 'Password_Hash', 'Salt', 'Dibuat', 'Login_Terakhir'],
  _Sessions: SESSION_COLUMNS,
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const warnings = [];
  migrateUsers_(ss);
  migrateIds_(ss);
  if (ss.getSheetByName(SHEETS.event)) ensureEventColumns_();

  SETUP_TABS_.forEach(function (spec) {
    const name = spec[0];
    const cols = spec[1];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
      sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    } else if (name !== SHEETS.panduan) {
      const have = headersOf_(sh, cols).filter(function (h) { return h; });
      if (have.join('|') !== cols.join('|')) {
        warnings.push('Header ' + name + ' berbeda dari 00_Config.gs. Diharapkan: ' + cols.join(', ') + ' | Ada: ' + have.join(', '));
      }
    }
    if (name !== SHEETS.panduan) {
      sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#efefef');
      sh.setFrozenRows(1);
    }
    const text = SETUP_TEXT_COLUMNS_[name] || [];
    const headers = headersOf_(sh, cols);
    const rows = Math.max(sh.getMaxRows() - 1, 1);
    text.forEach(function (k) {
      const i = headers.indexOf(k);
      if (i >= 0) sh.getRange(2, i + 1, rows, 1).setNumberFormat('@');
    });
  });

  fillEnum_(ss);
  fillConfig_(ss);
  applyDropdowns_(ss);
  migrateMasterTemplates_();

  SETUP_TABS_.forEach(function (spec) {
    const name = spec[0];
    if (name.charAt(0) !== '_') return;
    const sh = ss.getSheetByName(name);
    if (!sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
      sh.protect().setDescription('Dikelola skrip — jangan diedit manual').setWarningOnly(true);
    }
    // A spreadsheet needs at least one visible sheet; _ tabs are never the only ones.
    if (!sh.isSheetHidden()) sh.hideSheet();
  });

  warnings.forEach(function (w) { Logger.log('PERINGATAN: ' + w); });
  Logger.log('setup() selesai. Buat SUPER_ADMIN dengan setupAdmin(email, password, nama) bila _Users masih kosong.');
  return warnings;
}

/**
 * A _Users made before roles were event-scoped has no `Event` column: insert
 * it after `Role`. Legacy `ADMIN` rows keep working (read as SUPER_ADMIN);
 * legacy `OPERATOR` rows read as CLIENT and need an Event before they can log in.
 */
function migrateUsers_(ss) {
  const sh = ss.getSheetByName(SHEETS.users);
  if (!sh || sh.getLastRow() === 0) return;
  const headers = headersOf_(sh, []);
  const role = headers.indexOf('Role');
  if (headers.indexOf('Event') >= 0 || role < 0) return;
  sh.insertColumnAfter(role + 1);
  sh.getRange(1, role + 2).setValue('Event');
  Logger.log('Kolom Event ditambahkan ke _Users. Isi ID event (01_Event.ID) untuk tiap akun CLIENT.');
}

/** The data tabs keyed by an `ID` column, and the ones among them that point at an event. */
const ID_TABS_ = [SHEETS.event, SHEETS.sesi, SHEETS.tamu, SHEETS.template, SHEETS.users];
const EVENT_REF_TABS_ = [SHEETS.sesi, SHEETS.tamu, SHEETS.template, SHEETS.users];

/**
 * A workbook made before every row had an ID: insert `ID` as column A, give
 * each row a UUID, and rewrite `Event` cells that still hold an event's slug
 * to that event's ID. Safe to run again: filled IDs and ID references are kept.
 */
function migrateIds_(ss) {
  ID_TABS_.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() === 0) return;
    if (headersOf_(sh, []).indexOf('ID') < 0) {
      sh.insertColumnBefore(1);
      sh.getRange(1, 1).setValue('ID');
      Logger.log('Kolom ID ditambahkan ke ' + name + '.');
    }
    const n = ensureIds_(readTable_(name));
    if (n) Logger.log(n + ' ID baru di ' + name + '.');
  });

  if (!ss.getSheetByName(SHEETS.event)) return;
  const idBySlug = {};
  const isId = {};
  readTable_(SHEETS.event).rows.forEach(function (r) {
    idBySlug[str_(r.Slug).trim()] = str_(r.ID);
    isId[str_(r.ID)] = true;
  });
  EVENT_REF_TABS_.forEach(function (name) {
    if (!ss.getSheetByName(name)) return;
    const t = readTable_(name);
    if (t.headers.indexOf('Event') < 0) return;
    const items = t.rows
      .filter(function (r) {
        const v = str_(r.Event).trim();
        return v && !isId[v] && idBySlug[v];
      })
      .map(function (r) { return { row: r._row, values: [idBySlug[str_(r.Event).trim()]] }; });
    writeBlocks_(t.sheet, t.headers, ['Event'], items, ['Event']);
    if (items.length) Logger.log(items.length + ' baris ' + name + ': kolom Event diubah dari slug ke ID event.');
  });
}

/** _Enum Role always mirrors ROLES, so the _Users dropdown accepts SUPER_ADMIN / CLIENT. */
function refreshEnumRoles_(sh) {
  const col = ENUM_COLUMNS.indexOf('Role') + 1;
  const n = Math.max(sh.getLastRow() - 1, ROLES.length);
  sh.getRange(2, col, n, 1).setValues(
    Array.from({ length: n }, function (_, i) { return [ROLES[i] === undefined ? '' : ROLES[i]]; })
  );
}

function fillEnum_(ss) {
  const sh = ss.getSheetByName(SHEETS.enum);
  if (sh.getLastRow() > 1) {
    refreshEnumRoles_(sh);
    return;
  }
  const height = Math.max.apply(null, ENUM_COLUMNS.map(function (c) { return ENUM_VALUES[c].length; }));
  const values = [];
  for (let i = 0; i < height; i++) {
    values.push(ENUM_COLUMNS.map(function (c) { return ENUM_VALUES[c][i] === undefined ? '' : ENUM_VALUES[c][i]; }));
  }
  sh.getRange(2, 1, height, ENUM_COLUMNS.length).setValues(values);
}

function fillConfig_(ss) {
  const sh = ss.getSheetByName(SHEETS.config);
  const have = {};
  readTable_(SHEETS.config).rows.forEach(function (r) { have[str_(r.Key)] = true; });
  const defaults = [
    ['GREETINGS', 'Halo|Hai|Salam hangat|Dengan hormat', 'Variasi {{greet}}, dipisah |'],
    ['TOKEN_TTL_HOURS', TOKEN_TTL_HOURS, 'Masa berlaku sesi login (jam)'],
  ].filter(function (r) { return !have[r[0]]; });
  if (defaults.length) sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, defaults.length, 3).setValues(defaults);
}

/** Dropdown from an _Enum column (rows 2..n). */
function enumRule_(ss, enumCol, allowInvalid) {
  const sh = ss.getSheetByName(SHEETS.enum);
  const col = ENUM_COLUMNS.indexOf(enumCol) + 1;
  const n = ENUM_VALUES[enumCol].length;
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(sh.getRange(2, col, n, 1), true)
    .setAllowInvalid(!!allowInvalid)
    .build();
}

function applyDropdowns_(ss) {
  const set = function (tab, key, rule) {
    const sh = ss.getSheetByName(tab);
    const i = headersOf_(sh, []).indexOf(key);
    if (i < 0) return;
    sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  };
  set(SHEETS.tamu, 'Akses', enumRule_(ss, 'Akses', false));
  set(SHEETS.tamu, 'Sisi', enumRule_(ss, 'Sisi', false));
  set(SHEETS.tamu, 'Gelar', enumRule_(ss, 'Gelar', true));
  set(SHEETS.template, 'Tipe', enumRule_(ss, 'Tipe_Template', false));
  set(
    SHEETS.template,
    'Akses',
    SpreadsheetApp.newDataValidation().requireValueInList(TEMPLATE_AKSES, true).setAllowInvalid(false).build()
  );
  set(SHEETS.event, 'Tipe', enumRule_(ss, 'Tipe_Event', false));
  set(SHEETS.event, 'Mode', enumRule_(ss, 'Mode', false));
  set(SHEETS.users, 'Role', enumRule_(ss, 'Role', false));
}

/**
 * Templates made before masters existed (every row has an Event): the first
 * row of each Kode, in sheet order, becomes the master (its Event is blanked,
 * its ID kept). Other events' rows with that Kode stay as their own version,
 * unless they equal the master, in which case they go. Skipped once any master exists.
 */
function migrateMasterTemplates_() {
  const t = readTable_(SHEETS.template);
  if (t.headers.indexOf('Event') < 0 || t.rows.some(function (r) { return !str_(r.Event).trim(); })) return;
  const first = {};
  t.rows.forEach(function (r) {
    const k = str_(r.Kode).trim();
    if (k && !first[k]) first[k] = r;
  });
  const masters = Object.keys(first).map(function (k) { return first[k]; });
  writeBlocks_(t.sheet, t.headers, ['Event'], masters.map(function (r) { return { row: r._row, values: [''] }; }));
  const same = t.rows
    .filter(function (r) {
      const m = first[str_(r.Kode).trim()];
      return m && m !== r && sameText_(r, m);
    })
    .map(function (r) { return r._row; });
  deleteRows_(t.sheet, same);
  if (masters.length) Logger.log(masters.length + ' template master dibuat; ' + same.length + ' baris event yang sama dengan master dihapus.');
}
