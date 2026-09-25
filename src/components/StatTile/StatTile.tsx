import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** A single headline number on the dashboard. */
export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'critical' | 'good' }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn('text-3xl font-semibold tabular-nums', tone === 'critical' && 'text-critical-ink', tone === 'good' && 'text-good-ink')}>
          {value}
        </CardTitle>
      </CardHeader>
      {sub && <CardContent className="text-xs text-muted-foreground">{sub}</CardContent>}
    </Card>
  )
}
