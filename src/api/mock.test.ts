import { beforeEach, describe, expect, it } from 'vitest'
import { MockApi } from './mock'
import { ApiError, refOf } from './types'

// No DOM in the test env: MockApi falls back to an in-memory seed.
let api: MockApi
beforeEach(() => {
  api = new MockApi()
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
})
