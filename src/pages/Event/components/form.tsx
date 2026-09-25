import type { ComponentProps, ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { EventInfo } from '@/core/domain/types'

/** What every section card receives from the form. */
export interface SectionProps {
  draft: EventInfo
  /** Mutates a structured clone; never the live draft. */
  update: (fn: (d: EventInfo) => void) => void
  /** Error for a field path, shown only once it's been touched or a save was tried. */
  err: (path: string) => string | undefined
  touch: (path: string) => () => void
}

export function SectionHeader({ title, code, className }: { title: string; code: string; className?: string }) {
  return (
    <CardHeader className={className ?? 'border-b'}>
      <CardTitle className="flex items-center gap-2 text-base">
        {title}
        <Badge variant="secondary" className="font-mono">
          {code}
        </Badge>
      </CardTitle>
    </CardHeader>
  )
}

/** Label + control + one line below: the error if there is one, else the hint. */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  )
}

export function TextField({
  id,
  label,
  error,
  hint,
  ...input
}: { id: string; label: ReactNode; error?: string; hint?: ReactNode } & ComponentProps<typeof Input>) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <Input id={id} aria-invalid={!!error} {...input} />
    </FormField>
  )
}
