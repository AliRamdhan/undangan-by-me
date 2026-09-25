import { linkUndangan } from '@/core/domain/link'
import { hpValid, phoneCounts } from '@/core/domain/phone'
import type { EventInfo, Guest } from '@/core/domain/types'

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
