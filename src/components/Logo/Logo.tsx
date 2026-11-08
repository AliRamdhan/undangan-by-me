import { cn } from 'cn'

/** Heart in a 20×18 box, placed as the "full stop" after the u (24×24 grid). */
const HEART =
  'M18.9 18.88C17.58 17.89 16.7 17.12 16.7 16.13C16.7 15.45 17.23 14.92 17.91 14.92C18.33 14.92 18.7 15.14 18.9 15.45C19.1 15.14 19.47 14.92 19.89 14.92C20.57 14.92 21.1 15.45 21.1 16.13C21.1 17.12 20.22 17.89 18.9 18.88Z'

/**
 * Brand mark: the lowercase "u" of undangan with a heart as its full stop.
 * The u follows `currentColor`; the heart uses the primary token, so it turns pink in dark mode.
 */
export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('size-6 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M5.5 5.5V12.5a5 5 0 0 0 10 0V5.5" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <path d={HEART} className="fill-primary" />
    </svg>
  )
}
