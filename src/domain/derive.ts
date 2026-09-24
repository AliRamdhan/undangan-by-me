import { linkUndangan } from './link'
import { hpValid, phoneCounts } from './phone'
import type { EventInfo, Guest } from './types'

/**
 * What the three ARRAYFORMULA columns (No, HP_Valid, Link_Undangan) would
 * show. Display-only: these values are never written back.
 */
export function applyFormulas(guests: readonly Guest[], event: EventInfo): Guest[] {
  const counts = phoneCounts(guests.map((g) => g.HP))
  return guests.map((g, i) => ({
    ...g,
    No: i + 1,
    HP_Valid: hpValid(g.HP, counts),
    Link_Undangan: linkUndangan(event.domain, event.slug, g.PIN),
  }))
}
