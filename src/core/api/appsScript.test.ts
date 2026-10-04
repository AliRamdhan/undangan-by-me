import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppsScriptApp } from '@/core/api/appsScript'

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

const EVENT = '00000000-0000-4000-8100-000000000001'
const GUEST = '00000000-0000-4000-8300-000000000001'
const OTHER = '00000000-0000-4000-8300-000000000002'

describe('AppsScriptApp — REST transport', () => {
  it('sends GET with the token in the query string', async () => {
    await new AppsScriptApp(EXEC, 'tok').listEvents()
    expect(last().method).toBe('GET')
    expect(path(last())).toBe('/event')
    expect(last().url.searchParams.get('token')).toBe('tok')
  })

  it('tunnels PUT/PATCH/DELETE through POST with _method and the token in the body', async () => {
    const ev = new AppsScriptApp(EXEC, 'tok').forEvent(EVENT)
    await ev.saveGuest(GUEST, { Meja: 'A' })
    expect(last().method).toBe('POST')
    expect(last().body).toEqual({ v: 1, _method: 'PATCH', token: 'tok', fields: { Meja: 'A' } })
    expect(path(last())).toBe(`/event/${EVENT}/guests/${GUEST}`)

    await ev.deleteTemplate('T 1')
    expect(path(last())).toBe(`/event/${EVENT}/templates/T%201`)
    expect(last().body).toMatchObject({ _method: 'DELETE' })
  })

  it('addresses guests, templates and users by ID', async () => {
    const app = new AppsScriptApp(EXEC, 'tok')
    const ev = app.forEvent(EVENT)
    reply = { v: 1, ok: true, code: 'OK', data: { kode: 'U', text: 'x', waLink: '' } }
    await ev.previewMessage(GUEST, 'UNDANGAN')
    expect(path(last())).toBe(`/event/${EVENT}/guests/${GUEST}/preview`)
    expect(Object.fromEntries(last().url.searchParams)).toEqual({ path: `event/${EVENT}/guests/${GUEST}/preview`, token: 'tok', tipe: 'UNDANGAN' })

    await ev.deleteGuests([GUEST, OTHER])
    expect(last().body).toMatchObject({ ids: [GUEST, OTHER] })
    await ev.generateLinks([GUEST], 'UNDANGAN')
    expect(last().body).toMatchObject({ ids: [GUEST], tipe: 'UNDANGAN' })
    await ev.renderDraft('b', GUEST)
    expect(last().body).toMatchObject({ body: 'b', id: GUEST })
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
      [() => ev.deleteGuests(['g1']), 'POST', '/event/x/guests/g1', 'DELETE'],
      [() => ev.deleteGuests(['g1', 'g2']), 'POST', '/event/x/guests/bulk-delete'],
      [() => ev.importGuests([]), 'POST', '/event/x/guests/import'],
      [() => ev.normalizePhones(), 'POST', '/event/x/guests/normalize-phones'],
      [() => ev.checkGuests(), 'GET', '/event/x/guests/check'],
      [() => ev.generateLinks(null, 'UNDANGAN'), 'POST', '/event/x/guests/links'],
      [() => ev.listTemplates(), 'GET', '/event/x/templates'],
      [() => ev.validateTemplates(), 'GET', '/event/x/templates/validate'],
      [() => ev.saveTemplate({ ID: '', Kode: 'N' } as never), 'POST', '/event/x/templates'],
      [() => ev.saveTemplate({ ID: 't1', Kode: 'N' } as never), 'POST', '/event/x/templates/t1', 'PUT'],
      [() => ev.renderDraft('b', null), 'POST', '/event/x/render/draft'],
      [() => app.listUsers(), 'GET', '/users'],
      [() => app.createUser({ email: 'a@b.c', nama: 'A', role: 'CLIENT', event: 'x', password: 'p' }), 'POST', '/users'],
      [() => app.updateUser('u1', { aktif: false }), 'POST', '/users/u1', 'PATCH'],
      [() => app.resetPassword('u1', 'baru'), 'POST', '/users/u1/reset-password'],
      [() => app.deleteUser('u1'), 'POST', '/users/u1', 'DELETE'],
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
