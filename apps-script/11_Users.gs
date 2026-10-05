/**
 * 11_Users.gs — /users: account management for SUPER_ADMIN (the router gates
 * every route). Accounts are addressed by `ID`. Output is ManagedUser `{id,
 * email, nama, role, event, aktif, dibuat, loginTerakhir}`; hashes and salts
 * never leave the server.
 *
 * Guards: a SUPER_ADMIN cannot delete, deactivate or demote itself, and at
 * least one active SUPER_ADMIN always remains. A change of role, event or
 * aktif, a password reset and a delete all end that user's sessions.
 */

const USER_TEXT_KEYS_ = ['ID', 'Email', 'Password_Hash', 'Salt', 'Dibuat', 'Login_Terakhir'];

function managedUser_(r) {
  const u = publicUser_(r);
  u.aktif = bool_(r.Aktif);
  u.dibuat = str_(r.Dibuat);
  u.loginTerakhir = str_(r.Login_Terakhir);
  return u;
}

/** `{table, user}` for the path's `:id`, or NOT_FOUND. */
function requireUser_(id) {
  id = str_(id).trim();
  const t = readTable_(SHEETS.users);
  const u = id && t.rows.find(function (r) { return str_(r.ID).trim() === id; });
  if (!u) throw new ApiError_('NOT_FOUND', 'Akun tidak ditemukan');
  return { table: t, user: u };
}

function requireRole_(v) {
  const r = str_(v).trim().toUpperCase();
  if (ROLES.indexOf(r) < 0) throw new ApiError_('VALIDATION', 'Role harus ' + ROLES.join(' atau '));
  return r;
}

/** The event a user of `role` is bound to: an existing event ID for CLIENT, '' for SUPER_ADMIN. */
function requireUserEvent_(role, event) {
  if (role !== 'CLIENT') return '';
  const id = str_(event).trim();
  if (!id) throw new ApiError_('VALIDATION', 'Akun CLIENT wajib terhubung ke event');
  if (!eventExists_(id)) throw new ApiError_('VALIDATION', 'Event "' + id + '" tidak ada');
  return id;
}

function requirePassword_(v) {
  const pw = str_(v);
  if (pw.length < MIN_PASSWORD_LENGTH) throw new ApiError_('VALIDATION', 'Password minimal ' + MIN_PASSWORD_LENGTH + ' karakter');
  return pw;
}

function sameEmail_(a, b) {
  return str_(a).trim().toLowerCase() === str_(b).trim().toLowerCase();
}

/**
 * Throws VALIDATION unless an active SUPER_ADMIN remains once the row
 * `email` takes the role/aktif in `after` (null = deleted).
 */
function keepSuperAdmin_(rows, email, after) {
  const left = rows.some(function (r) {
    if (sameEmail_(r.Email, email)) return !!after && after.role === 'SUPER_ADMIN' && after.aktif;
    return normalizeRole_(r.Role) === 'SUPER_ADMIN' && bool_(r.Aktif);
  });
  if (!left) throw new ApiError_('VALIDATION', 'Harus tersisa minimal satu SUPER_ADMIN aktif');
}

// ── handlers ────────────────────────────────────────────────────────────────

/** GET users → ManagedUser[] (sheet order). Rows typed into the sheet get their ID here. */
function handleListUsers_() {
  const t = readTable_(SHEETS.users);
  const rows = t.rows.filter(function (r) { return str_(r.Email).trim(); });
  ensureIds_({ sheet: t.sheet, headers: t.headers, rows: rows });
  return rows.map(managedUser_);
}

/** POST users {email, nama, role, event, password} → ManagedUser */
function handleCreateUser_(ctx) {
  const b = ctx.body;
  const email = str_(b.email).trim();
  if (!EMAIL_PATTERN.test(email)) throw new ApiError_('VALIDATION', 'Email tidak valid');
  if (findUser_(email)) throw new ApiError_('VALIDATION', 'Email sudah terdaftar');
  const nama = str_(b.nama).trim();
  const role = requireRole_(b.role);
  const event = requireUserEvent_(role, b.event);
  const password = requirePassword_(b.password);
  const salt = newSalt_();
  const id = Utilities.getUuid();
  appendRows_(
    SHEETS.users,
    [{
      ID: id,
      Email: email,
      Nama: nama || email,
      Role: role,
      Event: event,
      Password_Hash: hashPassword_(password, salt),
      Salt: salt,
      Aktif: true,
      Dibuat: nowIso_(),
      Login_Terakhir: '',
    }],
    USER_TEXT_KEYS_
  );
  return managedUser_(requireUser_(id).user);
}

/** PATCH users/:id {nama?, role?, event?, aktif?} → ManagedUser */
function handleUpdateUser_(ctx) {
  const found = requireUser_(ctx.params.id);
  const u = found.user;
  const b = ctx.body;
  const cur = managedUser_(u);
  const role = b.role === undefined ? cur.role : requireRole_(b.role);
  const aktif = b.aktif === undefined ? cur.aktif : bool_(b.aktif);
  const event = requireUserEvent_(role, b.event === undefined ? cur.event : b.event);
  const nama = b.nama === undefined ? cur.nama : str_(b.nama).trim() || cur.email;

  if (sameEmail_(cur.email, ctx.user.email)) {
    if (role !== cur.role) throw new ApiError_('VALIDATION', 'Tidak bisa mengubah role akun sendiri');
    if (!aktif) throw new ApiError_('VALIDATION', 'Tidak bisa menonaktifkan akun sendiri');
  }
  keepSuperAdmin_(found.table.rows, cur.email, { role: role, aktif: aktif });

  const fields = { Nama: nama, Role: role, Aktif: aktif };
  // A legacy _Users without the Event column can still hold SUPER_ADMINs.
  if (found.table.headers.indexOf('Event') >= 0) fields.Event = event;
  else if (role === 'CLIENT') throw new ApiError_('VALIDATION', 'Tab _Users belum punya kolom Event — jalankan setup() / impor ulang');
  writeFields_(found.table.sheet, found.table.headers, u._row, fields);

  if (role !== cur.role || event !== cur.event || aktif !== cur.aktif) revokeUserSessions_(cur.email);
  return managedUser_(requireUser_(cur.id).user);
}

/** POST users/:id/reset-password {password} → null. Ends that user's sessions. */
function handleResetPassword_(ctx) {
  const found = requireUser_(ctx.params.id);
  const password = requirePassword_(ctx.body.password);
  const salt = newSalt_();
  writeFields_(found.table.sheet, found.table.headers, found.user._row, { Password_Hash: hashPassword_(password, salt), Salt: salt }, [
    'Password_Hash',
    'Salt',
  ]);
  revokeUserSessions_(found.user.Email);
  return null;
}

/** DELETE users/:id → null. Ends that user's sessions. */
function handleDeleteUser_(ctx) {
  const found = requireUser_(ctx.params.id);
  const email = str_(found.user.Email).trim();
  if (sameEmail_(email, ctx.user.email)) throw new ApiError_('VALIDATION', 'Tidak bisa menghapus akun sendiri');
  keepSuperAdmin_(found.table.rows, email, null);
  deleteRows_(found.table.sheet, [found.user._row]);
  revokeUserSessions_(email);
  return null;
}
