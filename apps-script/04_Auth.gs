/**
 * 04_Auth.gs — _Users + _Sessions, bearer tokens.
 *
 * Passwords: hashPassword_() is identical to `hashPassword` in
 * client/src/core/domain/sheetSchema.ts (the sample-workbook generator), and
 * gasParity.test.ts asserts it.
 *
 * Tokens: two UUIDs without dashes. Only SHA-256(token) is stored, in
 * _Sessions and in CacheService, so a leaked sheet does not leak sessions.
 */

function sha256Hex_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = (bytes[i] + 256) % 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

/** `h = sha256(salt + ':' + pw)`, then `h = sha256(h + salt)` × HASH_ITERATIONS. */
function hashPassword_(password, salt) {
  let h = sha256Hex_(salt + ':' + password);
  for (let i = 0; i < HASH_ITERATIONS; i++) h = sha256Hex_(h + salt);
  return h;
}

/** Compares two strings without an early exit on the first mismatch. */
function safeEqual_(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** `n` random lowercase hex chars (from UUID v4 randomness). */
function randomHex_(n) {
  let s = '';
  while (s.length < n) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, n);
}

function newToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function newSalt_() {
  return randomHex_(16);
}

/** Sheet Role → SUPER_ADMIN | CLIENT. Legacy `ADMIN` rows read as SUPER_ADMIN; anything else is CLIENT. */
function normalizeRole_(v) {
  const r = str_(v).trim().toUpperCase();
  return r === 'SUPER_ADMIN' || r === 'ADMIN' ? 'SUPER_ADMIN' : 'CLIENT';
}

/** `{id, email, nama, role, event}`; `event` is the CLIENT's event ID and '' for SUPER_ADMIN. */
function publicUser_(u) {
  const role = normalizeRole_(u.Role);
  return {
    id: str_(u.ID).trim(),
    email: str_(u.Email).trim(),
    nama: str_(u.Nama),
    role: role,
    event: role === 'CLIENT' ? str_(u.Event).trim() : '',
  };
}

function findUser_(email) {
  const key = str_(email).trim().toLowerCase();
  if (!key) return null;
  const t = readTable_(SHEETS.users);
  const u = t.rows.find(function (r) {
    return str_(r.Email).trim().toLowerCase() === key;
  });
  return u ? { table: t, user: u } : null;
}

function tokenTtlHours_() {
  const v = Number(readConfig_().TOKEN_TTL_HOURS);
  return v > 0 ? v : TOKEN_TTL_HOURS;
}

function cacheKey_(tokenHash) {
  return 'sess:' + tokenHash;
}

function expiryMs_(v) {
  if (v instanceof Date) return v.getTime();
  const t = new Date(str_(v)).getTime();
  return isNaN(t) ? 0 : t;
}

/** Token → the signed-in user, or AUTH. Also rejects inactive users. */
function requireAuth_(token) {
  if (!token) throw new ApiError_('AUTH', 'Silakan login terlebih dahulu');
  const hash = sha256Hex_(token);
  const cache = CacheService.getScriptCache();
  let email = '';
  let exp = 0;
  const cached = cache.get(cacheKey_(hash));
  if (cached) {
    const c = JSON.parse(cached);
    email = c.email;
    exp = c.exp;
  } else {
    const s = readTable_(SHEETS.sessions).rows.find(function (r) {
      return safeEqual_(str_(r.Token_Hash), hash);
    });
    if (!s) throw new ApiError_('AUTH', 'Sesi tidak valid atau sudah dicabut — silakan login lagi');
    email = str_(s.Email);
    exp = expiryMs_(s.Kedaluwarsa);
    const ttl = Math.min(TOKEN_CACHE_SECONDS, Math.floor((exp - Date.now()) / 1000));
    if (ttl > 1) cache.put(cacheKey_(hash), JSON.stringify({ email: email, exp: exp }), ttl);
  }
  if (!exp || exp <= Date.now()) throw new ApiError_('AUTH', 'Sesi sudah kedaluwarsa — silakan login lagi');
  const found = findUser_(email);
  if (!found || !bool_(found.user.Aktif)) throw new ApiError_('AUTH', 'Akun tidak aktif — hubungi admin');
  const user = publicUser_(found.user);
  if (user.role === 'CLIENT' && !user.event) throw new ApiError_('AUTH', 'Akun belum terhubung ke event — hubungi admin');
  return user;
}

function handleLogin_(ctx) {
  const email = str_(ctx.body.email).trim();
  const password = str_(ctx.body.password);
  if (!email || !password) throw new ApiError_('VALIDATION', 'Email dan password wajib diisi');

  const cache = CacheService.getScriptCache();
  const failKey = 'loginfail:' + email.toLowerCase();
  const fails = Number(cache.get(failKey)) || 0;
  if (fails >= LOGIN_MAX_FAILURES) {
    throw new ApiError_('LOGIN_LOCKED', 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.');
  }

  const found = findUser_(email);
  const u = found && found.user;
  const ok = u && str_(u.Salt) && safeEqual_(hashPassword_(password, str_(u.Salt)), str_(u.Password_Hash).trim().toLowerCase());
  if (!ok) {
    cache.put(failKey, String(fails + 1), LOGIN_LOCK_SECONDS);
    throw new ApiError_('LOGIN_FAILED', 'Email atau password salah');
  }
  if (!bool_(u.Aktif)) throw new ApiError_('LOGIN_FAILED', 'Akun tidak aktif — hubungi admin');
  // A CLIENT with no event could never pass requireAuth_; don't hand out a dead token.
  const pub = publicUser_(u);
  if (pub.role === 'CLIENT' && !pub.event) {
    throw new ApiError_('LOGIN_FAILED', 'Akun belum terhubung ke event — hubungi admin');
  }
  cache.remove(failKey);

  pruneSessions_();
  const token = newToken_();
  const hash = sha256Hex_(token);
  const now = new Date();
  const expMs = now.getTime() + tokenTtlHours_() * 3600 * 1000;
  const expiresAt = new Date(expMs).toISOString();
  appendRows_(
    SHEETS.sessions,
    [{ Token_Hash: hash, Email: str_(u.Email).trim(), Dibuat: now.toISOString(), Kedaluwarsa: expiresAt }],
    SESSION_COLUMNS
  );
  writeFields_(found.table.sheet, found.table.headers, u._row, { Login_Terakhir: now.toISOString() }, ['Login_Terakhir']);
  const ttl = Math.min(TOKEN_CACHE_SECONDS, Math.floor((expMs - Date.now()) / 1000));
  cache.put(cacheKey_(hash), JSON.stringify({ email: str_(u.Email).trim(), exp: expMs }), ttl);

  return { token: token, expiresAt: expiresAt, user: pub };
}

/** Deletes expired _Sessions rows. */
function pruneSessions_() {
  const t = readTable_(SHEETS.sessions);
  const now = Date.now();
  const dead = t.rows.filter(function (r) {
    return expiryMs_(r.Kedaluwarsa) <= now;
  });
  deleteRows_(t.sheet, dead.map(function (r) { return r._row; }));
  return dead.length;
}

/** Deletes sessions matching `pred` and evicts them from the cache. */
function revokeSessions_(pred) {
  const t = readTable_(SHEETS.sessions);
  const dead = t.rows.filter(pred);
  const cache = CacheService.getScriptCache();
  if (dead.length) {
    cache.removeAll(dead.map(function (r) { return cacheKey_(str_(r.Token_Hash)); }));
  }
  deleteRows_(t.sheet, dead.map(function (r) { return r._row; }));
  return dead.length;
}

/** Ends every session of `email` (case-insensitive). */
function revokeUserSessions_(email) {
  const key = str_(email).trim().toLowerCase();
  return revokeSessions_(function (r) {
    return str_(r.Email).trim().toLowerCase() === key;
  });
}

function handleLogout_(ctx) {
  const hash = sha256Hex_(ctx.token);
  CacheService.getScriptCache().remove(cacheKey_(hash));
  revokeSessions_(function (r) {
    return str_(r.Token_Hash) === hash;
  });
  return null;
}

function handleMe_(ctx) {
  return ctx.user;
}

function handleChangePassword_(ctx) {
  const oldPassword = str_(ctx.body.oldPassword);
  const newPassword = str_(ctx.body.newPassword);
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError_('VALIDATION', 'Password baru minimal ' + MIN_PASSWORD_LENGTH + ' karakter');
  }
  const found = findUser_(ctx.user.email);
  if (!found) throw new ApiError_('AUTH', 'Akun tidak ditemukan — silakan login lagi');
  const u = found.user;
  if (!safeEqual_(hashPassword_(oldPassword, str_(u.Salt)), str_(u.Password_Hash).trim().toLowerCase())) {
    throw new ApiError_('VALIDATION', 'Password lama salah');
  }
  const salt = newSalt_();
  writeFields_(found.table.sheet, found.table.headers, u._row, { Password_Hash: hashPassword_(newPassword, salt), Salt: salt }, [
    'Password_Hash',
    'Salt',
  ]);
  const keep = sha256Hex_(ctx.token);
  const email = ctx.user.email.toLowerCase();
  revokeSessions_(function (r) {
    return str_(r.Email).trim().toLowerCase() === email && str_(r.Token_Hash) !== keep;
  });
  return null;
}

/**
 * Editor helper: creates or resets a SUPER_ADMIN user. Run from the Apps Script
 * editor, e.g. `setupAdmin('saya@contoh.com', 'PasswordKuat#1', 'Nama Saya')`
 * (wrap it in a function with your values, then Run). Revokes that user's
 * sessions.
 */
function setupAdmin(email, password, nama) {
  email = str_(email).trim();
  if (!email || str_(password).length < MIN_PASSWORD_LENGTH) {
    throw new Error('setupAdmin(email, password, nama): email wajib, password minimal ' + MIN_PASSWORD_LENGTH + ' karakter');
  }
  const salt = newSalt_();
  const fields = { Nama: nama || email, Role: 'SUPER_ADMIN', Event: '', Password_Hash: hashPassword_(password, salt), Salt: salt, Aktif: true };
  const found = findUser_(email);
  // A legacy _Users without the Event column: leave it out rather than fail.
  if (found && found.table.headers.indexOf('Event') < 0) delete fields.Event;
  if (found) {
    writeFields_(found.table.sheet, found.table.headers, found.user._row, fields, ['Password_Hash', 'Salt']);
  } else {
    fields.ID = Utilities.getUuid();
    fields.Email = email;
    fields.Dibuat = nowIso_();
    appendRows_(SHEETS.users, [fields], ['ID', 'Email', 'Password_Hash', 'Salt', 'Dibuat', 'Login_Terakhir']);
  }
  revokeUserSessions_(email);
  Logger.log('SUPER_ADMIN ' + email + ' siap.');
}
