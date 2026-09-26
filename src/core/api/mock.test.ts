import { beforeEach, describe, expect, it } from 'vitest'
import { MockApp } from '@/core/api/mock'
import { SEED_EVENTS, SEED_GUESTS, SEED_META, SEED_TEMPLATES, SEED_USERS } from '@/core/api/seed'
import { ApiError, refOf, type UndanganApi } from '@/core/api/types'

const ADMIN = SEED_USERS.find((u) => u.role === 'SUPER_ADMIN')!
const KLIEN_FE = SEED_USERS.find((u) => u.event === 'fidaeno')!
// Not seeded (commented out in seed.ts) — each test creates it through the admin.
const KLIEN_DR = { email: 'klien.dimasrara@example.com', nama: 'Dimas & Rara', role: 'CLIENT' as const, event: 'dimas-rara', password: 'Klien#123' }

async function signIn(user = ADMIN) {
  const s = await new MockApp().login(user.email, user.password)
  return new MockApp(s.token)
}

// No DOM in the test env: MockApp falls back to an in-memory seed.
let app: MockApp
let api: UndanganApi
beforeEach(async () => {
  // dimas-rara (with every planted fault) is no longer seeded; the tests put it back as a fixture.
  MockApp.reset(true, [{ meta: SEED_META, guests: SEED_GUESTS, templates: SEED_TEMPLATES }, ...SEED_EVENTS])
  app = await signIn()
  api = app.forEvent('dimas-rara')
  await app.createUser(KLIEN_DR)
})

describe('MockApi — one column, one writer', () => {
  it('refuses to write formula or script columns', async () => {
    const [g] = await api.listGuests()
    for (const k of ['Link_Undangan', 'HP_Valid', 'Status_RSVP', 'Status_Kirim', 'PIN', 'Preview_Pesan']) {
      await expect(api.saveGuest(refOf(g), { [k]: 'x' } as never)).rejects.toMatchObject({ code: 'VALIDATION' })
    }
  })

  it('writes by PIN, so a re-sorted list still hits the right guest', async () => {
    const guests = await api.listGuests()
    const target = guests.find((g) => g.PIN === '365865')!
    // A stale rowHint must not matter when the PIN is unique.
    await api.saveGuest({ ...refOf(target), rowHint: 1 }, { Meja: 'A-9' })
    const after = await api.listGuests()
    expect(after.find((g) => g.PIN === '365865')!.Meja).toBe('A-9')
    expect(after[0].Meja).toBe('VIP-1')
  })

  it('refuses an ambiguous shared PIN unless the row hint revalidates', async () => {
    const guests = await api.listGuests()
    const dup = guests.filter((g) => g.PIN === '729104')
    expect(dup).toHaveLength(2)
    await expect(api.saveGuest({ PIN: '729104', rowHint: 1, nama: 'x' }, { Meja: '1' })).rejects.toMatchObject({
      code: 'DUPLICATE_PIN',
    })
    const saved = await api.saveGuest(refOf(dup[1]), { Meja: 'B-2' })
    expect(saved.Nama).toBe('Dian Santoso')
  })

  it('refuses a PIN-less write whose row moved', async () => {
    const g = (await api.listGuests()).find((x) => !x.PIN)!
    await expect(api.saveGuest({ ...refOf(g), rowHint: g.No + 1 }, { Meja: '1' })).rejects.toBeInstanceOf(ApiError)
  })

  it('assigns a PIN to a new guest and to every PIN-less row', async () => {
    const created = await api.saveGuest(null, { Nama: 'Baru', HP: '08120000000' })
    expect(created.PIN).toMatch(/^\d{6}$/)
    const filled = await api.generatePins()
    expect(filled).toBeGreaterThan(0)
    expect((await api.listGuests()).every((g) => /^\d{6}$/.test(g.PIN))).toBe(true)
  })

  it('normalises phones and generates WA links through the one renderer', async () => {
    expect(await api.normalizePhones()).toBeGreaterThan(0)
    const res = await api.generateLinks(null, 'UNDANGAN')
    expect(res.written).toBeGreaterThan(0)
    const vip = (await api.listGuests()).find((g) => g.PIN === '012345')!
    expect(vip.Preview_Pesan).toContain('Tempat duduk: *VIP-1*')
    expect(vip.Link_WA).toMatch(/^https:\/\/wa\.me\/6281211110001\?text=/)
  })

  it('validation reports a broken token', async () => {
    const [t] = await api.listTemplates()
    await api.saveTemplate({ ...t, Isi_Pesan: 'Halo {{tamu.namaa}}' }, t.Kode)
    const report = await api.validateTemplates()
    expect(report.find((r) => r.kode === t.Kode)!.unknown).toEqual(['tamu.namaa'])
    await expect(api.generateLinks(null, 'UNDANGAN')).resolves.toMatchObject({
      skipped: expect.arrayContaining([expect.objectContaining({ reason: expect.stringMatching(/tamu\.namaa/) })]),
    })
  })

  it('saves a valid event, renumbers sessions and relinks every guest', async () => {
    const meta = await api.getMeta()
    const event = { ...meta.event, slug: 'dimas-rara-2026', sesi: meta.event.sesi.map((s) => ({ ...s, kode: 'X' })) }
    const saved = await api.saveEvent(event)
    expect(saved.event.slug).toBe('dimas-rara-2026')
    expect(saved.event.sesi.map((s) => s.kode)).toEqual(['S1', 'S2'])
    const [g] = await app.forEvent('dimas-rara-2026').listGuests()
    expect(g.Link_Undangan).toBe(`https://undangan.by.me/dimas-rara-2026/${g.PIN}`)
    await expect(api.getMeta()).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('refuses a rename onto another event\'s slug', async () => {
    const meta = await api.getMeta()
    await expect(api.saveEvent({ ...meta.event, slug: 'fidaeno' })).rejects.toMatchObject({ code: 'DUPLICATE_SLUG' })
  })

  it('refuses an event that fails Validasi Data Event', async () => {
    const meta = await api.getMeta()
    await expect(api.saveEvent({ ...meta.event, slug: '1bad' })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await api.getMeta()).event.slug).toBe('dimas-rara')
  })
})

describe('MockApp — auth', () => {
  it('rejects bad credentials without a session', async () => {
    await expect(new MockApp().login(ADMIN.email, 'salah')).rejects.toMatchObject({ code: 'LOGIN_FAILED' })
  })

  it('needs a valid token for every event route and reports AUTH', async () => {
    let expired = 0
    const anon = new MockApp('nope', () => expired++)
    await expect(anon.listEvents()).rejects.toMatchObject({ code: 'AUTH' })
    await expect(anon.forEvent('dimas-rara').listGuests()).rejects.toMatchObject({ code: 'AUTH' })
    expect(expired).toBe(2)
  })

  it('logs out by revoking the token', async () => {
    expect((await app.me()).role).toBe('SUPER_ADMIN')
    await app.logout()
    await expect(app.me()).rejects.toMatchObject({ code: 'AUTH' })
  })

  it('changes the password', async () => {
    await expect(app.changePassword('salah', 'barubaru1')).rejects.toMatchObject({ code: 'VALIDATION' })
    await app.changePassword(ADMIN.password, 'barubaru1')
    await expect(new MockApp().login(ADMIN.email, ADMIN.password)).rejects.toMatchObject({ code: 'LOGIN_FAILED' })
    await expect(new MockApp().login(ADMIN.email, 'barubaru1')).resolves.toMatchObject({ user: { role: 'SUPER_ADMIN' } })
  })

})

describe('MockApp — CLIENT is scoped to its one event', () => {
  let klien: MockApp
  beforeEach(async () => {
    klien = await signIn(KLIEN_DR)
  })

  it('lists only its own event and cannot see any other', async () => {
    expect((await klien.me()).event).toBe('dimas-rara')
    expect((await klien.listEvents()).map((e) => e.slug)).toEqual(['dimas-rara'])
    const other = klien.forEvent('fidaeno')
    await expect(other.getMeta()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(other.listGuests()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(other.saveGuest(null, { Nama: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('manages its event data, guests and templates', async () => {
    const own = klien.forEvent('dimas-rara')
    const meta = await own.getMeta()
    await expect(own.saveEvent({ ...meta.event, nama_event: 'Nikahan D&R' })).resolves.toMatchObject({ event: { nama_event: 'Nikahan D&R' } })
    await expect(own.saveGuest(null, { Nama: 'Tamu Klien' })).resolves.toMatchObject({ Nama: 'Tamu Klien' })
    const [t] = await own.listTemplates()
    await own.saveTemplate({ ...t, Isi_Pesan: 'Halo {{tamu.nama}}' }, t.Kode)
    await own.deleteTemplate(t.Kode)
    expect((await own.listTemplates()).some((x) => x.Kode === t.Kode)).toBe(false)
  })

  it('may not move the invitation URL', async () => {
    const own = klien.forEvent('dimas-rara')
    const meta = await own.getMeta()
    await expect(own.saveEvent({ ...meta.event, slug: 'pindah' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(own.saveEvent({ ...meta.event, domain: 'https://lain.id' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('cannot create or delete events, nor touch accounts', async () => {
    const meta = await klien.forEvent('dimas-rara').getMeta()
    await expect(klien.createEvent({ ...meta.event, slug: 'baru' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(klien.deleteEvent('dimas-rara')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(klien.listUsers()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(klien.resetPassword(ADMIN.email, 'hijack123')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('follows its event through a slug rename by SUPER_ADMIN', async () => {
    const meta = await api.getMeta()
    await api.saveEvent({ ...meta.event, slug: 'dimas-rara-2026' })
    expect((await klien.me()).event).toBe('dimas-rara-2026')
    await expect(klien.forEvent('dimas-rara-2026').listGuests()).resolves.not.toHaveLength(0)
  })
})

describe('MockApp — accounts (SUPER_ADMIN)', () => {
  const newClient = { email: 'baru@example.com', nama: 'Baru', role: 'CLIENT' as const, event: 'fidaeno', password: 'rahasia123' }

  it('creates a client account that can log in to its event only', async () => {
    const u = await app.createUser(newClient)
    expect(u).toMatchObject({ email: 'baru@example.com', role: 'CLIENT', event: 'fidaeno', aktif: true })
    expect(u).not.toHaveProperty('password')
    const s = await new MockApp().login(newClient.email, newClient.password)
    expect(s.user.event).toBe('fidaeno')
  })

  it('validates new accounts', async () => {
    await expect(app.createUser({ ...newClient, email: KLIEN_DR.email.toUpperCase() })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(app.createUser({ ...newClient, event: '' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(app.createUser({ ...newClient, event: 'tidak-ada' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(app.createUser({ ...newClient, password: 'pendek' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(app.createUser({ ...newClient, email: 'bukan-email' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('ends sessions on reset password, deactivation and event change', async () => {
    const klien = await signIn(KLIEN_DR)
    await app.resetPassword(KLIEN_DR.email, 'passwordbaru')
    await expect(klien.me()).rejects.toMatchObject({ code: 'AUTH' })

    const again = await signIn({ ...KLIEN_DR, password: 'passwordbaru' })
    await app.updateUser(KLIEN_DR.email, { aktif: false })
    await expect(again.me()).rejects.toMatchObject({ code: 'AUTH' })
    await expect(new MockApp().login(KLIEN_DR.email, 'passwordbaru')).rejects.toMatchObject({ code: 'LOGIN_FAILED' })

    const fe = await signIn(KLIEN_FE)
    await app.updateUser(KLIEN_FE.email, { event: 'dimas-rara' })
    await expect(fe.me()).rejects.toMatchObject({ code: 'AUTH' })
  })

  it('keeps at least one active SUPER_ADMIN and protects the own account', async () => {
    await expect(app.deleteUser(ADMIN.email)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(app.updateUser(ADMIN.email, { role: 'CLIENT', event: 'fidaeno' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(app.updateUser(ADMIN.email, { aktif: false })).rejects.toMatchObject({ code: 'VALIDATION' })
    await app.createUser({ ...newClient, email: 'sa2@example.com', role: 'SUPER_ADMIN', event: 'fidaeno' })
    // A second SUPER_ADMIN may be removed; the event is blanked for SUPER_ADMIN.
    expect((await app.listUsers()).find((u) => u.email === 'sa2@example.com')!.event).toBe('')
    await app.deleteUser('SA2@example.com')
    expect((await app.listUsers()).map((u) => u.email)).not.toContain('sa2@example.com')
  })

  it('deletes an event\'s client accounts with the event', async () => {
    const klien = await signIn(KLIEN_FE)
    await expect(app.deleteEvent('fidaeno')).resolves.toMatchObject({ akun: 1 })
    await expect(klien.me()).rejects.toMatchObject({ code: 'AUTH' })
    expect((await app.listUsers()).map((u) => u.email)).not.toContain(KLIEN_FE.email)
  })
})

describe('MockApp — events', () => {
  it('lists every event with counts', async () => {
    const list = await app.listEvents()
    expect(list.map((e) => e.slug)).toEqual(['dimas-rara', 'fidaeno'])
    expect(list[1]).toMatchObject({ jumlah_tamu: 4, mode: 'DRY-RUN' })
  })

  it('scopes guests per event, so a PIN only has to be unique inside one event', async () => {
    const fida = app.forEvent('fidaeno')
    expect((await fida.listGuests()).map((g) => g.No)).toEqual([1, 2, 3, 4])
    const [g] = await api.listGuests()
    await expect(fida.saveGuest(refOf(g), { Meja: '1' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('creates, refuses a duplicate slug and deletes with a cascade', async () => {
    const meta = await api.getMeta()
    const created = await app.createEvent({ ...meta.event, slug: 'baru', nama_event: 'Event Baru' })
    expect(created.event.slug).toBe('baru')
    await expect(app.createEvent({ ...meta.event, slug: 'baru' })).rejects.toMatchObject({ code: 'DUPLICATE_SLUG' })
    await app.forEvent('baru').saveGuest(null, { Nama: 'A' })
    await expect(app.deleteEvent('baru')).resolves.toEqual({ tamu: 1, template: 0, sesi: 2, akun: 0 })
    await expect(app.forEvent('baru').getMeta()).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
