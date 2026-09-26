import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppsScriptApp } from '@/core/api/appsScript'
import type { GuestRef } from '@/core/api/types'

const EXEC = 'https://script.google.com/macros/s/abc/exec'

interface Call {
  method: string
  url: URL
  body: Record<string, unknown> | null
}

let calls: Call[]
let reply: unknown

beforeEach(() => {
  calls = []
  reply = { v: 1, ok: true, code: 'OK', data: null }
  vi.stubGlobal('fetch', async (input: URL, init: RequestInit) => {
    calls.push({ method: init.method!, url: new URL(input), body: init.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify(reply))
  })
})
afterEach(() => vi.unstubAllGlobals())

const last = () => calls[calls.length - 1]
/** The route, carried as `?path=` on the bare /exec URL. */
const path = (c: Call) => {
  expect(c.url.pathname).toBe('/macros/s/abc/exec')
  return `/${c.url.searchParams.get('path')}`
}

const pinned: GuestRef = { PIN: '012345', rowHint: 1, nama: 'Budi' }
const pinless: GuestRef = { PIN: '', rowHint: 7, nama: 'Sri' }

describe('AppsScriptApp — REST transport', () => {
  it('sends GET with the token in the query string', async () => {
    await new AppsScriptApp(EXEC, 'tok').listEvents()
    expect(last().method).toBe('GET')
    expect(path(last())).toBe('/event')
    expect(last().url.searchParams.get('token')).toBe('tok')
  })

  it('tunnels PUT/PATCH/DELETE through POST with _method and the token in the body', async () => {
    const ev = new AppsScriptApp(EXEC, 'tok').forEvent('dimas-rara')
    await ev.saveGuest(pinned, { Meja: 'A' })
    expect(last()).toMatchObject({ method: 'POST', body: { _method: 'PATCH', token: 'tok', fields: { Meja: 'A' }, rowHint: 1, nama: 'Budi' } })
    expect(path(last())).toBe('/event/dimas-rara/guests/012345')

    await ev.deleteTemplate('UND 1')
    expect(path(last())).toBe('/event/dimas-rara/templates/UND%201')
    expect(last().body).toMatchObject({ _method: 'DELETE' })
  })

  it('addresses a PIN-less guest as row-{No}', async () => {
    const ev = new AppsScriptApp(EXEC, 'tok').forEvent('dimas-rara')
    reply = { v: 1, ok: true, code: 'OK', data: { kode: 'U', text: 'x', waLink: '' } }
    await ev.previewMessage(pinless, 'UNDANGAN')
    expect(path(last())).toBe('/event/dimas-rara/guests/row-7/preview')
    expect(Object.fromEntries(last().url.searchParams)).toMatchObject({ tipe: 'UNDANGAN', rowHint: '7', nama: 'Sri' })
  })

  it('maps every method to its route', async () => {
    const app = new AppsScriptApp(EXEC, 'tok')
    const ev = app.forEvent('x')
    const cases: [() => Promise<unknown>, string, string, string?][] = [
      [() => app.login('a@b.c', 'pw'), 'POST', '/auth/login'],
      [() => app.logout(), 'POST', '/auth/logout'],
      [() => app.me(), 'GET', '/auth/me'],
      [() => app.changePassword('a', 'b'), 'POST', '/auth/change-password'],
      [() => app.createEvent({} as never), 'POST', '/event'],
      [() => app.deleteEvent('x'), 'POST', '/event/x', 'DELETE'],
      [() => ev.saveEvent({} as never), 'POST', '/event/x', 'PUT'],
      [() => ev.listGuests(), 'GET', '/event/x/guests'],
      [() => ev.saveGuest(null, { Nama: 'A' }), 'POST', '/event/x/guests'],
      [() => ev.deleteGuests([pinned]), 'POST', '/event/x/guests/012345', 'DELETE'],
      [() => ev.deleteGuests([pinned, pinless]), 'POST', '/event/x/guests/bulk-delete'],
      [() => ev.importGuests([]), 'POST', '/event/x/guests/import'],
      [() => ev.generatePins(), 'POST', '/event/x/guests/generate-pins'],
      [() => ev.normalizePhones(), 'POST', '/event/x/guests/normalize-phones'],
      [() => ev.checkGuests(), 'GET', '/event/x/guests/check'],
      [() => ev.generateLinks(null, 'UNDANGAN'), 'POST', '/event/x/guests/links'],
      [() => ev.listTemplates(), 'GET', '/event/x/templates'],
      [() => ev.validateTemplates(), 'GET', '/event/x/templates/validate'],
      [() => ev.saveTemplate({ Kode: 'N' } as never), 'POST', '/event/x/templates'],
      [() => ev.saveTemplate({ Kode: 'N' } as never, 'OLD'), 'POST', '/event/x/templates/OLD', 'PUT'],
      [() => ev.renderDraft('b', null), 'POST', '/event/x/render/draft'],
      [() => app.listUsers(), 'GET', '/users'],
      [() => app.createUser({ email: 'a@b.c', nama: 'A', role: 'CLIENT', event: 'x', password: 'p' }), 'POST', '/users'],
      [() => app.updateUser('a+1@b.c', { aktif: false }), 'POST', '/users/a%2B1%40b.c', 'PATCH'],
      [() => app.resetPassword('a+1@b.c', 'baru'), 'POST', '/users/a%2B1%40b.c/reset-password'],
      [() => app.deleteUser('a+1@b.c'), 'POST', '/users/a%2B1%40b.c', 'DELETE'],
    ]
    for (const [call, method, p, override] of cases) {
      await call()
      expect([last().method, path(last()), last().body?._method]).toEqual([method, p, override])
    }
  })

  it('fires onUnauthorized on AUTH only, and surfaces the server message', async () => {
    const expired = vi.fn()
    const app = new AppsScriptApp(EXEC, 'tok', expired)
    reply = { v: 1, ok: false, code: 'LOGIN_FAILED', message: 'Email atau password salah' }
    await expect(app.login('a', 'b')).rejects.toMatchObject({ code: 'LOGIN_FAILED', message: 'Email atau password salah' })
    expect(expired).not.toHaveBeenCalled()
    reply = { v: 1, ok: false, code: 'AUTH', message: 'Sesi berakhir' }
    await expect(app.me()).rejects.toMatchObject({ code: 'AUTH' })
    expect(expired).toHaveBeenCalledOnce()
  })
})
