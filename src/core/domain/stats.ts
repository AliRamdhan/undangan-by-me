import { AKSES, SISI, STATUS_KIRIM, STATUS_RSVP, type EventInfo, type Guest } from '@/core/domain/types'

export interface SessionPax {
  kode: string
  label: string
  /** Σ Q_Sn — pax allocated. */
  kuota: number
  /** Σ RSVP_Sn over guests who answered HADIR. */
  hadir: number
  /** Venue capacity from 01_Event. */
  kapasitas: number
}

export interface Breakdown {
  key: string
  total: number
  hadir: number
}

export interface Stats {
  total: number
  pinKosong: number
  hpBermasalah: number
  pinDuplikat: number
  rsvp: Record<string, number>
  kirim: Record<string, number>
  sesi: SessionPax[]
  akses: Breakdown[]
  sisi: Breakdown[]
  lebihKuota: Guest[]
}

function breakdown(guests: readonly Guest[], keys: readonly string[], pick: (g: Guest) => string): Breakdown[] {
  const rows = new Map<string, Breakdown>(keys.map((k) => [k, { key: k, total: 0, hadir: 0 }]))
  for (const g of guests) {
    const k = pick(g) || '(kosong)'
    const b = rows.get(k) ?? rows.set(k, { key: k, total: 0, hadir: 0 }).get(k)!
    b.total++
    if (g.Status_RSVP === 'HADIR') b.hadir++
  }
  return [...rows.values()]
}

/** The 06_Dashboard COUNTIFS, as one pass over the guest list. */
export function computeStats(guests: readonly Guest[], event: EventInfo): Stats {
  const rsvp = Object.fromEntries(STATUS_RSVP.map((s) => [s, 0]))
  const kirim = Object.fromEntries(STATUS_KIRIM.map((s) => [s, 0]))
  const pinCount = new Map<string, number>()
  let pinKosong = 0
  let hpBermasalah = 0
  const pax = { s1: { kuota: 0, hadir: 0 }, s2: { kuota: 0, hadir: 0 } }

  for (const g of guests) {
    rsvp[g.Status_RSVP] = (rsvp[g.Status_RSVP] ?? 0) + 1
    kirim[g.Status_Kirim] = (kirim[g.Status_Kirim] ?? 0) + 1
    if (!g.PIN) pinKosong++
    else pinCount.set(g.PIN, (pinCount.get(g.PIN) ?? 0) + 1)
    if (g.HP_Valid !== '✅') hpBermasalah++
    pax.s1.kuota += g.Q_S1
    pax.s2.kuota += g.Q_S2
    if (g.Status_RSVP === 'HADIR') {
      pax.s1.hadir += g.RSVP_S1
      pax.s2.hadir += g.RSVP_S2
    }
  }

  const pinDuplikat = [...pinCount.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0)
  const sesi: SessionPax[] = (['s1', 's2'] as const).map((k, i) => ({
    kode: event.sesi[i]?.kode ?? k.toUpperCase(),
    label: event.sesi[i]?.label ?? `Sesi ${i + 1}`,
    ...pax[k],
    kapasitas: event.kapasitas[k],
  }))

  return {
    total: guests.length,
    pinKosong,
    hpBermasalah,
    pinDuplikat,
    rsvp,
    kirim,
    sesi,
    akses: breakdown(guests, AKSES, (g) => g.Akses),
    sisi: breakdown(guests, SISI, (g) => g.Sisi),
    lebihKuota: guests.filter((g) => g.RSVP_S1 > g.Q_S1 || g.RSVP_S2 > g.Q_S2),
  }
}
