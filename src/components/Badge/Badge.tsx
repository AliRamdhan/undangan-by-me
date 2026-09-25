import type { ReactNode } from 'react'
import { TONE, type Tone } from './badge.styles'

export function Badge({ tone = 'plain', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}
    >
      {children}
    </span>
  )
}
