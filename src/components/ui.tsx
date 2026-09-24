import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90 border-transparent',
  secondary: 'bg-surface text-ink border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink',
  danger: 'bg-surface text-critical-ink border-line hover:tint-critical',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm'
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  )
}

export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'muted' | 'info' | 'plain'

const TONE: Record<Tone, string> = {
  good: 'tint-good text-good-ink',
  warning: 'tint-warning text-warning-ink',
  serious: 'tint-serious text-serious-ink',
  critical: 'tint-critical text-critical-ink',
  muted: 'tint-muted text-ink-2',
  info: 'bg-accent-soft text-accent',
  plain: 'bg-surface-2 text-ink-2',
}

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

/** Modal dialog on the native <dialog> element: focus trap, Esc and backdrop for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-32px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup">
              ✕
            </Button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

/** Right-side panel, also a native <dialog> so it is modal and keyboard-safe. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-xl border-l border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-semibold">
                {title}
              </h2>
              {subtitle && <div className="mt-1 text-sm text-ink-2">{subtitle}</div>}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup">
              ✕
            </Button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-critical-ink">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-3">{hint}</p>
      )}
    </div>
  )
}

/** Field styling without size, for inputs that set their own width/height. */
export const fieldBase =
  'rounded-lg border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:bg-surface-2 disabled:text-ink-2'
export const inputCls = `${fieldBase} h-9 w-full`

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-2">{children}</div>}
    </div>
  )
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      <div className="px-5 pt-3 pb-5">{children}</div>
    </section>
  )
}
