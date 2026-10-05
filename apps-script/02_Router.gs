/**
 * 02_Router.gs — the REST route table and its middleware.
 *
 * Routes match in table order, so fixed segments (`guests/check`,
 * `templates/validate`) sit above the `:id` patterns they would otherwise
 * fall into. Every `:id` / `:code` is a row's `ID` column (a UUID). Handlers are named by string and looked up on the
 * global object at call time: files load in alphabetical order, and the
 * handlers live in later files.
 *
 * Middleware order: auth → role → client event scope → event loader (`:code`)
 * → script lock. Options: `auth` (default true), `role` ('SUPER_ADMIN'),
 * `lock` (write routes).
 *
 * `:code` is the event's `ID` (01_Event), never its slug: a slug rename keeps
 * every admin URL. A CLIENT is bound to its `_Users.Event` (an ID): any other
 * `:code` is NOT_FOUND (not FORBIDDEN), so a client cannot probe which events exist.
 */

/** The global object; top-level `this` in a script, in Apps Script and in a Node vm alike. */
const GLOBAL_ = this;

const E_ = 'event/:code';

const ROUTES = [
  ['GET', 'health', 'handleHealth_', { auth: false }],
  // Public: the invitation page reads its event (by ID or slug) and the guest (by PIN).
  ['GET', 'invitation', 'handleInvitation_', { auth: false }],

  ['POST', 'auth/login', 'handleLogin_', { auth: false, lock: true }],
  ['POST', 'auth/logout', 'handleLogout_', { lock: true }],
  ['GET', 'auth/me', 'handleMe_', {}],
  ['POST', 'auth/change-password', 'handleChangePassword_', { lock: true }],

  ['GET', 'event', 'handleListEvents_', {}],
  ['POST', 'event', 'handleCreateEvent_', { role: 'SUPER_ADMIN', lock: true }],
  ['GET', E_, 'handleGetEvent_', {}],
  ['PUT', E_, 'handleUpdateEvent_', { lock: true }],
  ['DELETE', E_, 'handleDeleteEvent_', { role: 'SUPER_ADMIN', lock: true }],

  ['GET', E_ + '/guests', 'handleListGuests_', {}],
  ['POST', E_ + '/guests', 'handleCreateGuest_', { lock: true }],
  ['GET', E_ + '/guests/check', 'handleCheckGuests_', {}],
  ['POST', E_ + '/guests/import', 'handleImportGuests_', { lock: true }],
  ['POST', E_ + '/guests/normalize-phones', 'handleNormalizePhones_', { lock: true }],
  ['POST', E_ + '/guests/bulk-delete', 'handleBulkDeleteGuests_', { lock: true }],
  ['POST', E_ + '/guests/links', 'handleGenerateLinks_', { lock: true }],
  ['GET', E_ + '/guests/:id', 'handleGetGuest_', {}],
  ['PATCH', E_ + '/guests/:id', 'handlePatchGuest_', { lock: true }],
  ['DELETE', E_ + '/guests/:id', 'handleDeleteGuest_', { lock: true }],
  ['GET', E_ + '/guests/:id/preview', 'handlePreview_', {}],

  // An event's view of the master templates (`:id` = the master's ID): its own text/Aktif, never create or delete.
  ['GET', E_ + '/templates', 'handleListTemplates_', {}],
  ['GET', E_ + '/templates/validate', 'handleValidateTemplates_', {}],
  ['GET', E_ + '/templates/:id', 'handleGetTemplate_', {}],
  ['PUT', E_ + '/templates/:id', 'handleUpdateTemplate_', { lock: true }],
  ['POST', E_ + '/templates/:id/reset', 'handleResetTemplate_', { lock: true }],

  ['POST', E_ + '/render/draft', 'handleRenderDraft_', {}],

  // Master templates (03_Template rows with a blank Event); every event has them.
  ['GET', 'templates', 'handleListMasters_', { role: 'SUPER_ADMIN' }],
  ['POST', 'templates', 'handleCreateMaster_', { role: 'SUPER_ADMIN', lock: true }],
  ['PUT', 'templates/:id', 'handleUpdateMaster_', { role: 'SUPER_ADMIN', lock: true }],
  ['DELETE', 'templates/:id', 'handleDeleteMaster_', { role: 'SUPER_ADMIN', lock: true }],

  ['GET', 'users', 'handleListUsers_', { role: 'SUPER_ADMIN' }],
  ['POST', 'users', 'handleCreateUser_', { role: 'SUPER_ADMIN', lock: true }],
  ['PATCH', 'users/:id', 'handleUpdateUser_', { role: 'SUPER_ADMIN', lock: true }],
  ['DELETE', 'users/:id', 'handleDeleteUser_', { role: 'SUPER_ADMIN', lock: true }],
  ['POST', 'users/:id/reset-password', 'handleResetPassword_', { role: 'SUPER_ADMIN', lock: true }],
];

/** Compiled once per execution. */
let COMPILED_ROUTES_ = null;

function compileRoutes_() {
  if (COMPILED_ROUTES_) return COMPILED_ROUTES_;
  COMPILED_ROUTES_ = ROUTES.map(function (r) {
    const names = [];
    const src = r[1]
      .split('/')
      .map(function (seg) {
        if (seg.charAt(0) === ':') {
          names.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    return { method: r[0], pattern: r[1], re: new RegExp('^' + src + '$'), names: names, handler: r[2], opts: r[3] || {} };
  });
  return COMPILED_ROUTES_;
}

function decodeSegment_(s) {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

/** `{handler, pattern, params, opts}` for the first route matching both method and path. */
function matchRoute_(method, path) {
  const clean = String(path || '').replace(/^\/+|\/+$/g, '');
  const routes = compileRoutes_();
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    if (r.method !== method) continue;
    const m = r.re.exec(clean);
    if (!m) continue;
    const params = {};
    r.names.forEach(function (n, j) {
      params[n] = decodeSegment_(m[j + 1]);
    });
    return { handler: r.handler, pattern: r.pattern, params: params, opts: r.opts };
  }
  throw new ApiError_('ROUTE_NOT_FOUND', 'Rute ' + method + ' /' + clean + ' tidak dikenal');
}

/** Runs the matched handler through the middleware chain. */
function route_(req) {
  const match = matchRoute_(req.method, req.path);
  const opts = match.opts;
  const ctx = {
    method: req.method,
    path: req.path,
    params: match.params,
    query: req.query || {},
    body: req.body || {},
    token: req.token || '',
    user: null,
    event: null,
  };
  const origin = str_(ctx.query.origin || ctx.body.origin);
  REQUEST_ORIGIN_ = /^https?:\/\/[^\s/]+$/i.test(origin) ? origin : '';

  if (opts.auth !== false) ctx.user = requireAuth_(ctx.token);
  if (opts.role && (!ctx.user || ctx.user.role !== opts.role)) {
    throw new ApiError_('FORBIDDEN', 'Aksi ini hanya untuk ' + opts.role);
  }
  if (match.params.code !== undefined && ctx.user && ctx.user.role === 'CLIENT' && match.params.code !== ctx.user.event) {
    throw new ApiError_('NOT_FOUND', 'Event tidak ditemukan');
  }
  if (match.params.code !== undefined) ctx.event = loadEvent_(match.params.code);

  const fn = GLOBAL_[match.handler];
  if (typeof fn !== 'function') throw new Error('Handler ' + match.handler + ' tidak ada');
  if (!opts.lock) return fn(ctx);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    throw new ApiError_('BUSY', 'Server sedang sibuk memproses permintaan lain. Coba lagi sebentar.');
  }
  try {
    // Re-read under the lock: another writer may have changed the event meanwhile.
    if (match.params.code !== undefined) ctx.event = loadEvent_(match.params.code);
    const out = fn(ctx);
    SpreadsheetApp.flush();
    return out;
  } finally {
    lock.releaseLock();
  }
}

function handleHealth_() {
  return { ok: true, version: API_VERSION };
}
