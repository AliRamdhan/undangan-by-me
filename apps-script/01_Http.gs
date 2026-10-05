/**
 * 01_Http.gs — Web App entry points, request parsing and the response envelope.
 *
 * Apps Script only has doGet/doPost and cannot read request headers or answer a
 * CORS preflight, so:
 *   - the route is the `?path=` query parameter (`{exec}?path=auth/login`).
 *     Not `/exec/auth/login`: Google sends any URL with a segment after
 *     `/exec` to its sign-in page (401) for anonymous callers, even when the
 *     deployment is "Anyone". `e.pathInfo` is still honoured as a fallback;
 *   - PUT/PATCH/DELETE arrive as a text/plain POST with `_method` in the body;
 *   - the token is `?token=` on GET and `token` in the POST body;
 *   - every response is HTTP 200 with `{v, ok, code, data | message}`.
 */

class ApiError_ extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function doGet(e) {
  return handle_('GET', e);
}

function doPost(e) {
  return handle_('POST', e);
}

function handle_(httpMethod, e) {
  let env;
  try {
    const req = parseRequest_(httpMethod, e);
    env = { v: 1, ok: true, code: 'OK', data: route_(req) };
  } catch (err) {
    env = errorEnvelope_(err);
  }
  return json_(env);
}

function errorEnvelope_(err) {
  if (err instanceof ApiError_) return { v: 1, ok: false, code: err.code, message: err.message };
  const message = err && err.message ? err.message : String(err);
  try {
    console.error(err && err.stack ? err.stack : message);
  } catch (ignored) {
    // console may be unavailable in tests
  }
  return { v: 1, ok: false, code: 'INTERNAL', message: 'Terjadi kesalahan server: ' + message };
}

function json_(env) {
  return ContentService.createTextOutput(JSON.stringify(env)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * `e` → `{method, path, query, body, token}`. Pure, so the parity test can call it.
 * `method` is the logical method (see logicalMethod_).
 */
function parseRequest_(httpMethod, e) {
  e = e || {};
  const p = e.parameter || {};
  const path = String(p.path || e.pathInfo || '').replace(/^\/+|\/+$/g, '');
  const query = {};
  Object.keys(p).forEach(function (k) {
    if (k !== 'path') query[k] = p[k];
  });

  let body = {};
  if (httpMethod === 'POST') {
    const raw = e.postData && e.postData.contents;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (err) {
        throw new ApiError_('VALIDATION', 'Body permintaan bukan JSON yang valid');
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError_('VALIDATION', 'Body permintaan harus berupa objek JSON');
      }
    }
  }
  const method = logicalMethod_(httpMethod, body);
  const token = httpMethod === 'GET' ? query.token : body.token;
  return { method: method, path: path, query: query, body: body, token: token ? String(token) : '' };
}

/** GET stays GET; a POST becomes `_method` when that is PUT, PATCH or DELETE. */
function logicalMethod_(httpMethod, body) {
  if (httpMethod === 'GET') return 'GET';
  const m = body && body._method ? String(body._method).toUpperCase() : '';
  return m === 'PUT' || m === 'PATCH' || m === 'DELETE' ? m : 'POST';
}
