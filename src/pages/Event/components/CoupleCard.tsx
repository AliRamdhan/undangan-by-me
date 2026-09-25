import { Card, CardContent } from '@/components/ui/card'
import type { Person } from '@/core/domain/types'
import { SectionHeader, TextField, type SectionProps } from './form'

const SIDES = [
  { key: 'pria', title: 'Mempelai 1' },
  { key: 'wanita', title: 'Mempelai 2' },
] as const

const ROWS: { key: keyof Person; label: string; type?: string; inputMode?: 'tel' | 'email'; required?: boolean; hint?: string }[] = [
  { key: 'lengkap', label: 'Nama lengkap', required: true, hint: 'Dengan gelar, seperti di undangan' },
  { key: 'panggilan', label: 'Nama panggilan', required: true, hint: 'Dipakai di pesan: {{event.pria}} / {{event.wanita}}' },
  { key: 'hp', label: 'No. HP', inputMode: 'tel' },
  { key: 'email', label: 'Email', type: 'email', inputMode: 'email' },
  { key: 'ortu', label: 'Nama orang tua', required: true, hint: 'Contoh: Bapak … & Ibu …' },
]

/** #A.1 — both people side by side, one row per attribute (like the design). */
export function CoupleCard({ draft, update, err, touch }: SectionProps) {
  return (
    <Card>
      <SectionHeader title="Data Mempelai" code="#A.1" />
      <CardContent className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {SIDES.map((s) => (
          <p key={s.key} className="hidden text-sm font-semibold sm:block">
            {s.title}
          </p>
        ))}
        {ROWS.map((row) =>
          SIDES.map((side) => {
            const path = `couple.${side.key}.${row.key}`
            return (
              <TextField
                key={path}
                id={`ev-${side.key}-${row.key}`}
                label={
                  <>
                    <span className="sm:hidden">{side.title} · </span>
                    {row.label}
                    {row.required && ' *'}
                  </>
                }
                type={row.type}
                inputMode={row.inputMode}
                className={row.key === 'hp' ? 'font-mono' : undefined}
                value={draft.couple[side.key][row.key]}
                onChange={(e) =>
                  update((d) => {
                    d.couple[side.key][row.key] = e.target.value
                  })
                }
                onBlur={touch(path)}
                error={err(path)}
                hint={row.hint?.replace('{{event.pria}} / {{event.wanita}}', `{{event.${side.key}}}`)}
              />
            )
          }),
        )}
      </CardContent>
    </Card>
  )
}
