import { describe, expect, it } from 'vitest'
import { SEED_META } from '@/core/api/seed'
import { validateEvent, withEventDefaults } from './event'
import type { EventInfo } from './types'

const valid = (): EventInfo => structuredClone(SEED_META.event)

describe('withEventDefaults', () => {
  it('fills fields missing from an event stored before the form existed', () => {
    const legacy = {
      slug: 'a',
      couple: { pria: { panggilan: 'A', lengkap: 'A B', ortu: 'X' }, wanita: { panggilan: 'C', lengkap: 'C D', ortu: 'Y' }, hashtag: '#AC' },
      sesi: [{ label: 'Akad' }],
    }
    const e = withEventDefaults(legacy)
    expect(e.couple.pria).toMatchObject({ panggilan: 'A', hp: '', email: '' })
    expect(e.gift).toEqual({ bank: '', atas_nama: '', norek: '', qris: '' })
    expect(e.media).toEqual({ musik: '', cover: '' })
    expect(e.tanggal_pengingat).toBe('')
    expect(e.sesi[0]).toMatchObject({ kode: 'S1', label: 'Akad', mulai: '' })
  })
  it('leaves a complete event unchanged', () => {
    expect(withEventDefaults(valid())).toEqual(valid())
  })
})

describe('validateEvent', () => {
  it('accepts the seeded event', () => {
    expect(validateEvent(valid())).toEqual({})
  })
  it('names every missing EVENT_REQUIRED key', () => {
    const e = withEventDefaults({})
    const errs = validateEvent(e)
    for (const k of [
      'slug',
      'domain',
      'nama_event',
      'tanggal_utama',
      'batas_rsvp',
      'couple.pria.lengkap',
      'couple.pria.panggilan',
      'couple.pria.ortu',
      'couple.wanita.lengkap',
      'couple.wanita.panggilan',
      'couple.wanita.ortu',
    ])
      expect(errs, k).toHaveProperty([k])
  })
  it('rejects a slug that does not start with a letter or has uppercase/spaces', () => {
    for (const slug of ['1dimas', 'Dimas-Rara', 'dimas rara', '-x']) {
      expect(validateEvent({ ...valid(), slug }).slug, slug).toBeTruthy()
    }
    expect(validateEvent({ ...valid(), slug: 'dimas-rara-2026' }).slug).toBeUndefined()
  })
  it('requires the RSVP deadline on or before the event date', () => {
    expect(validateEvent({ ...valid(), batas_rsvp: '2026-11-20' }).batas_rsvp).toBeTruthy()
    expect(validateEvent({ ...valid(), batas_rsvp: '2026-11-14' }).batas_rsvp).toBeUndefined()
  })
  it('flags an incomplete session and an end time before the start', () => {
    const e = valid()
    e.sesi[1] = { ...e.sesi[1], label: '', selesai: '10:00', mulai: '11:00' }
    const errs = validateEvent(e)
    expect(errs['sesi.1.label']).toBeTruthy()
    expect(errs['sesi.1.selesai']).toBeTruthy()
  })
  it('checks optional phone, email and hashtag formats only when filled', () => {
    const e = valid()
    e.couple.pria.hp = '12'
    e.couple.wanita.email = 'rara@'
    e.couple.hashtag = '#Dimas Rara'
    const errs = validateEvent(e)
    expect(errs).toHaveProperty(['couple.pria.hp'])
    expect(errs).toHaveProperty(['couple.wanita.email'])
    expect(errs).toHaveProperty(['couple.hashtag'])
    e.couple.pria.hp = ''
    e.couple.wanita.email = ''
    e.couple.hashtag = ''
    expect(validateEvent(e)).toEqual({})
  })
})
