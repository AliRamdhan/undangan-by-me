import { cn } from 'cn'

interface Props {
  className?: string
  /** Grid line colour; defaults to the theme border. Pass a translucent white on dark or coloured panels. */
  line?: string
  /** A soft primary glow at the top. */
  glow?: boolean
}

/**
 * Decorative background for public-page heroes and bands: a fine line grid that
 * fades out from the top, plus an optional primary glow. The parent needs
 * `relative isolate` (the layer sits at -z-10).
 */
export function GridBackdrop({ className, line = 'color-mix(in oklch, var(--color-border) 60%, transparent)', glow = true }: Props) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <div
        style={{ '--grid-line': line } as React.CSSProperties}
        className="absolute inset-0 [background-image:linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black,transparent)]"
      />
      {glow && <div className="absolute -top-48 left-1/2 h-96 w-[min(64rem,100%)] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />}
    </div>
  )
}
