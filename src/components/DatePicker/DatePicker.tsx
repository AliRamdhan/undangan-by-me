import { Calendar03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { id as localeId } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatTanggal } from '@/core/domain/template'
import { cn } from '@/lib/utils'

// Dates are wall-clock `YYYY-MM-DD` strings (STRUCTURE.md): built from local
// parts both ways so no timezone offset can shift the day.
function toDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function DatePicker({
  id,
  value,
  onChange,
  invalid,
  placeholder = 'Pilih tanggal',
  className,
}: {
  id?: string
  value: string
  onChange: (iso: string) => void
  invalid?: boolean
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            aria-invalid={invalid}
            className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
          />
        }
      >
        {selected ? formatTanggal(value.slice(0, 10)) : placeholder}
        <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={localeId}
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(toIso(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
