import { Badge } from '../../components/ui'
import type { StatusKirim, StatusRSVP } from '../../domain/types'
import { KIRIM_META, RSVP_META } from './statusMeta'

export function RsvpBadge({ status }: { status: StatusRSVP }) {
  const m = RSVP_META[status] ?? RSVP_META.BELUM
  return (
    <Badge tone={m.tone}>
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </Badge>
  )
}

export function KirimBadge({ status, title }: { status: StatusKirim; title?: string }) {
  const m = KIRIM_META[status] ?? KIRIM_META.BELUM
  return (
    <Badge tone={m.tone} title={title}>
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </Badge>
  )
}
