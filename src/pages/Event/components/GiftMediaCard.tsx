import { Card, CardContent } from '@/components/ui/card'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import type { EventInfo } from '@/core/domain/types'
import { SectionHeader, TextField, type SectionProps } from './form'

type GiftKey = keyof EventInfo['gift']
type MediaKey = keyof EventInfo['media']

const GIFT: { key: GiftKey; label: string; placeholder: string; mono?: boolean }[] = [
  { key: 'bank', label: 'Bank', placeholder: 'BCA' },
  { key: 'atas_nama', label: 'Atas nama', placeholder: 'Rara Anindita' },
  { key: 'norek', label: 'No. rekening', placeholder: '1234567890', mono: true },
  { key: 'qris', label: 'Gambar QRIS (URL)', placeholder: 'https://…' },
]
const MEDIA: { key: MediaKey; label: string; placeholder: string }[] = [
  { key: 'musik', label: 'Musik latar (URL)', placeholder: 'https://….mp3' },
  { key: 'cover', label: 'Foto cover (URL)', placeholder: 'https://….jpg' },
]

/** #A.4 — the `gift` and `media` blocks of the event JSON (URL-CONTRACT.md § 2). */
export function GiftMediaCard({ draft, update }: SectionProps) {
  return (
    <Card>
      <SectionHeader title="Hadiah & Media" code="#A.4" />
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FieldSet>
          <FieldLegend>Hadiah / amplop digital</FieldLegend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {GIFT.map((f) => (
              <TextField
                key={f.key}
                id={`ev-gift-${f.key}`}
                label={f.label}
                placeholder={f.placeholder}
                className={f.mono ? 'font-mono' : undefined}
                inputMode={f.key === 'norek' ? 'numeric' : undefined}
                value={draft.gift[f.key]}
                onChange={(e) => update((d) => void (d.gift[f.key] = e.target.value))}
              />
            ))}
          </div>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Media</FieldLegend>
          <div className="grid grid-cols-1 gap-y-4">
            {MEDIA.map((f) => (
              <TextField
                key={f.key}
                id={`ev-media-${f.key}`}
                label={f.label}
                placeholder={f.placeholder}
                value={draft.media[f.key]}
                onChange={(e) => update((d) => void (d.media[f.key] = e.target.value))}
              />
            ))}
          </div>
        </FieldSet>
      </CardContent>
    </Card>
  )
}
