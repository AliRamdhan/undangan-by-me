import { ApiError } from '@/core/api/types'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type Query = Record<string, string | number | null | undefined>

interface Envelope<T> {
  v: number
  ok: boolean
  code: string
  message?: string
  data?: T
}

/**
 * REST over an Apps Script Web App (docs/ADMIN-API.md § Transport). The route
 * travels as `?path=` — a URL like `/exec/auth/login` is bounced to Google's
 * sign-in page (401) for anonymous callers. Apps Script only has doGet/doPost
 * and cannot read request headers, so:
 * - GET sends params and the token in the query string;
 * - everything else is a POST whose JSON body carries `_method` and `token`.
 */
export class RestClient {
  private readonly base: string
  private readonly token: string | null
  private readonly onUnauthorized?: () => void

  constructor(url: string, token: string | null, onUnauthorized?: () => void) {
    this.base = url.replace(/\/+$/, '')
    this.token = token
    this.onUnauthorized = onUnauthorized
  }

  async request<T>(method: HttpMethod, path: string, opts: { query?: Query; body?: Record<string, unknown> } = {}): Promise<T> {
    if (!this.base) throw new ApiError('NETWORK', 'URL Apps Script belum diatur — isi VITE_APPS_SCRIPT_URL di .env lalu build/jalankan ulang.')
    const url = new URL(this.base)
    url.searchParams.set('path', path.replace(/^\/+/, ''))
    // The server falls back to `{origin}/events/{slug}/{PIN}` for {{link}} when an event has no domain.
    const origin = globalThis.location?.origin ?? ''
    let init: RequestInit
    if (method === 'GET') {
      for (const [k, v] of Object.entries({ ...opts.query, token: this.token, origin })) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
      }
      init = { method: 'GET', redirect: 'follow' }
    } else {
      const body = { v: 1, ...(method === 'POST' ? {} : { _method: method }), ...(this.token ? { token: this.token } : {}), ...(origin ? { origin } : {}), ...opts.body }
      init = {
        method: 'POST',
        // text/plain keeps this a "simple" request: Apps Script cannot answer
        // a CORS preflight, so application/json would never arrive.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
      }
    }

    let res: Response
    try {
      res = await fetch(url, init)
    } catch {
      throw new ApiError('NETWORK', 'Tidak bisa menghubungi Apps Script. Cek URL /exec dan koneksi.')
    }
    let env: Envelope<T>
    try {
      env = (await res.json()) as Envelope<T>
    } catch {
      throw new ApiError('BAD_RESPONSE', 'Respons bukan JSON — deployment salah atau belum di-redeploy?')
    }
    if (!env.ok) {
      if (env.code === 'AUTH') this.onUnauthorized?.()
      throw new ApiError(env.code, env.message || env.code)
    }
    return env.data as T
  }
}
