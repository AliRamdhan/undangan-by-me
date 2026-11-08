import { cn } from 'cn'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { PATHS } from '@/route.paths'

/** Logo tile + wordmark; links home (the public landing page) unless told otherwise. */
export function Brand({ to = PATHS.root, className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-lg text-[15px] font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        className,
      )}
    >
      <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
        <Logo className="size-6" />
      </span>
      Undangan
    </Link>
  )
}
