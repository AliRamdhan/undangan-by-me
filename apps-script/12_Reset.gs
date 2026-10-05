/**
 * 12_Reset.gs — production reset: clears the demo / test data of the sample
 * workbook from the live sheet. Run from the Apps Script editor only (no route).
 *
 *   cekResetProduksi()                    dry run: logs what would go, changes nothing
 *   resetProduksi('HAPUS DATA DEMO')      backs the spreadsheet up to Drive, then clears
 *
 * Removed: every event, session (01_Sesi), guest, event version of a template
 * and CLIENT account (with its logins). Kept: master templates (03_Template rows
 * with a blank Event), SUPER_ADMIN accounts and their logins, _Config, _Enum,
 * 00_Panduan, and every tab's header, formats and dropdowns.
 */

const RESET_CONFIRM_ = 'HAPUS DATA DEMO';

/** Per tab: which data rows the reset removes. */
const RESET_PLAN_ = [
  { tab: SHEETS.event, key: 'event', drop: function () { return true; } },
  { tab: SHEETS.sesi, key: 'sesi', drop: function () { return true; } },
  { tab: SHEETS.tamu, key: 'tamu', drop: function () { return true; } },
  { tab: SHEETS.template, key: 'template', drop: function (r) { return !isMasterRow_(r); } },
  { tab: SHEETS.users, key: 'akun', drop: function (r) { return normalizeRole_(r.Role) === 'CLIENT'; } },
];

/** `{hapus, sisa, peringatan}`: rows the reset removes per tab, what stays, and warnings. */
function resetSummary_() {
  const hapus = {};
  RESET_PLAN_.forEach(function (p) {
    hapus[p.key] = readTable_(p.tab).rows.filter(p.drop).length;
  });
  const admins = readTable_(SHEETS.users).rows.filter(function (r) { return normalizeRole_(r.Role) === 'SUPER_ADMIN'; });
  const peringatan = [];
  if (!admins.length) peringatan.push('Tidak ada akun SUPER_ADMIN — buat dulu dengan setupAdmin(email, password, nama).');
  admins
    .filter(function (r) { return /@example\.com$/i.test(str_(r.Email).trim()); })
    .forEach(function (r) {
      peringatan.push(
        'Akun demo ' + str_(r.Email).trim() + ' masih SUPER_ADMIN — buat akun asli dengan setupAdmin(), login, lalu hapus akun demo di menu Pengguna.'
      );
    });
  return {
    hapus: hapus,
    sisa: { template_master: readTable_(SHEETS.template).rows.filter(isMasterRow_).length, super_admin: admins.length },
    peringatan: peringatan,
  };
}

function logResetSummary_(title, s) {
  Logger.log(title);
  Object.keys(s.hapus).forEach(function (k) { Logger.log('  hapus ' + k + ': ' + s.hapus[k] + ' baris'); });
  Logger.log('  tetap: ' + s.sisa.template_master + ' template master, ' + s.sisa.super_admin + ' SUPER_ADMIN, _Config');
  s.peringatan.forEach(function (w) { Logger.log('PERINGATAN: ' + w); });
}

/**
 * Removes the data rows of `name` matching `pred`; returns how many. When every
 * data row goes, the range is blanked instead: Sheets refuses to delete all
 * non-frozen rows, and a blank row is skipped on read and appended after.
 */
function clearDataRows_(name, pred) {
  const t = readTable_(name);
  const dead = t.rows.filter(pred);
  if (!dead.length) return 0;
  if (dead.length < t.rows.length) return deleteRows_(t.sheet, dead.map(function (r) { return r._row; }));
  const n = t.sheet.getLastRow() - 1;
  const blank = Array.from({ length: n }, function () { return t.headers.map(function () { return ''; }); });
  t.sheet.getRange(2, 1, n, t.headers.length).setValues(blank);
  return dead.length;
}

/** Dry run: logs and returns what resetProduksi() would remove. Changes nothing. */
function cekResetProduksi() {
  const s = resetSummary_();
  logResetSummary_('cekResetProduksi() — belum ada yang dihapus. Jalankan resetProduksi(\'' + RESET_CONFIRM_ + '\') untuk menghapus:', s);
  return s;
}

/**
 * Clears the demo data for production. `konfirmasi` must be exactly
 * 'HAPUS DATA DEMO'; run it through a one-off wrapper:
 *   function jalankanReset() { resetProduksi('HAPUS DATA DEMO') }
 * A copy of the whole spreadsheet is saved to Drive first; nothing is removed
 * if that copy fails.
 */
function resetProduksi(konfirmasi) {
  if (konfirmasi !== RESET_CONFIRM_) {
    throw new Error("resetProduksi: tulis resetProduksi('" + RESET_CONFIRM_ + "') untuk benar-benar menghapus. Cek dulu dengan cekResetProduksi().");
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error('Server sedang sibuk memproses permintaan lain. Coba lagi sebentar.');
  try {
    const ss = ss_();
    const backup = 'BACKUP ' + ss.getName() + ' ' + nowIso_();
    ss.copy(backup);
    Logger.log('Cadangan disimpan di Drive: ' + backup);

    // CLIENT logins end first, while their emails are still in _Users.
    readTable_(SHEETS.users)
      .rows.filter(function (r) { return normalizeRole_(r.Role) === 'CLIENT'; })
      .forEach(function (r) { revokeUserSessions_(r.Email); });

    const hapus = {};
    RESET_PLAN_.forEach(function (p) {
      hapus[p.key] = clearDataRows_(p.tab, p.drop);
    });
    const s = resetSummary_();
    s.hapus = hapus;
    s.backup = backup;
    logResetSummary_('resetProduksi() selesai:', s);
    return s;
  } finally {
    lock.releaseLock();
  }
}
